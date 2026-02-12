#!/usr/bin/env node
/**
 * Conversational Project Intake
 * 
 * Implements adaptive questioning flow where:
 * - Questions asked one at a time
 * - Each question adapts based on previous answers
 * - User can skip questions
 * - User can ask for suggestions ("What do you think?")
 * - Conversation completes after 5-8 strategic questions
 * - State persisted for continuation
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Conversational session state
 */
class ConversationSession {
  constructor(projectId, projectIdea, projectType = 'project') {
    this.projectId = projectId;
    this.projectIdea = projectIdea;
    this.projectType = projectType; // 'project' | 'feature' | 'ops'
    this.messages = [];
    this.answers = [];
    this.questionCount = 0;
    this.maxQuestions = 8;
    this.minQuestions = 5;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.completed = false;
  }

  addMessage(role, content) {
    this.messages.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    this.updatedAt = new Date().toISOString();
  }

  addAnswer(question, answer) {
    this.answers.push({
      question,
      answer,
      timestamp: new Date().toISOString()
    });
    this.questionCount++;
    this.updatedAt = new Date().toISOString();
  }

  shouldComplete() {
    // Complete if we've asked minimum and got substantial answers
    if (this.questionCount < this.minQuestions) {
      return false;
    }
    
    // Complete if we've reached max
    if (this.questionCount >= this.maxQuestions) {
      return true;
    }
    
    // Could add logic to complete early if answers are comprehensive
    return false;
  }

  toJSON() {
    return {
      projectId: this.projectId,
      projectIdea: this.projectIdea,
      projectType: this.projectType,
      messages: this.messages,
      answers: this.answers,
      questionCount: this.questionCount,
      maxQuestions: this.maxQuestions,
      minQuestions: this.minQuestions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completed: this.completed
    };
  }

  static fromJSON(data) {
    const session = new ConversationSession(data.projectId, data.projectIdea, data.projectType);
    Object.assign(session, data);
    return session;
  }
}

/**
 * Storage for conversation sessions
 */
class ConversationStore {
  constructor() {
    this.sessions = new Map();
    this.storePath = path.join(
      process.env.OPENCLAW_WORKSPACE || path.join(process.env.HOME, '.openclaw', 'workspace'),
      '.clawhub',
      'conversation-sessions.json'
    );
  }

  async load() {
    try {
      const data = await fs.readFile(this.storePath, 'utf8');
      const parsed = JSON.parse(data);
      for (const [id, sessionData] of Object.entries(parsed)) {
        this.sessions.set(id, ConversationSession.fromJSON(sessionData));
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Error loading conversation sessions:', err);
      }
      // Start with empty sessions
    }
  }

  async save() {
    const data = {};
    for (const [id, session] of this.sessions.entries()) {
      data[id] = session.toJSON();
    }
    
    const dir = path.dirname(this.storePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.storePath, JSON.stringify(data, null, 2), 'utf8');
  }

  get(projectId) {
    return this.sessions.get(projectId);
  }

  set(projectId, session) {
    this.sessions.set(projectId, session);
    return this.save();
  }

  delete(projectId) {
    this.sessions.delete(projectId);
    return this.save();
  }
}

const store = new ConversationStore();

/**
 * Generate next question based on conversation history
 */
async function generateNextQuestion(session) {
  // Build prompt with conversation history
  const prompt = buildConversationalPrompt(session);
  
  try {
    const { stdout } = await execFileAsync('openclaw', [
      'agent',
      '--agent', 'main',
      '--local',
      '--thinking', 'low',
      '--message', prompt
    ], {
      timeout: 60000,
      maxBuffer: 1024 * 1024
    });

    // Parse response
    const response = parseNextQuestionResponse(stdout);
    
    return {
      question: response.question,
      context: response.context,
      followUpSuggestions: response.followUpSuggestions || [],
      progress: {
        current: session.questionCount + 1,
        min: session.minQuestions,
        max: session.maxQuestions
      }
    };
  } catch (err) {
    console.error('Error generating next question:', err);
    throw new Error('Failed to generate next question: ' + err.message);
  }
}

/**
 * Generate suggestions for current question
 */
async function generateSuggestions(session, currentQuestion) {
  const prompt = buildSuggestionPrompt(session, currentQuestion);
  
  try {
    const { stdout } = await execFileAsync('openclaw', [
      'agent',
      '--agent', 'main',
      '--local',
      '--thinking', 'low',
      '--message', prompt
    ], {
      timeout: 30000,
      maxBuffer: 512 * 1024
    });

    const response = parseSuggestionResponse(stdout);
    return {
      suggestions: response.suggestions || [],
      category: response.category
    };
  } catch (err) {
    console.error('Error generating suggestions:', err);
    // Return generic suggestions as fallback
    return {
      suggestions: [
        "Consider the target audience and their needs",
        "Think about technical constraints and requirements",
        "Define success metrics for this aspect"
      ]
    };
  }
}

/**
 * Build prompt for next question generation
 */
function buildConversationalPrompt(session) {
  const typeContext = {
    'project': 'a complete project',
    'feature': 'a specific feature',
    'ops': 'an operational/infrastructure task'
  }[session.projectType] || 'a project';

  let prompt = `You are an experienced product owner conducting a requirements interview for ${typeContext}.

Project Idea: ${session.projectIdea}

You have asked ${session.questionCount} questions so far (min: ${session.minQuestions}, max: ${session.maxQuestions}).

`;

  if (session.answers.length > 0) {
    prompt += `Previous Q&A:\n`;
    session.answers.forEach((qa, idx) => {
      prompt += `\nQ${idx + 1}: ${qa.question}\nA${idx + 1}: ${qa.answer}\n`;
    });
  }

  if (session.shouldComplete()) {
    prompt += `\nYou have enough information now. Ask ONE final clarifying question to wrap up the requirements.

`;
  } else {
    prompt += `\nBased on the project idea and answers so far, generate the NEXT SINGLE QUESTION that will:
- Build on what you've learned (avoid repetition)
- Uncover critical requirements not yet discussed
- Be specific and actionable
- Help define scope, constraints, or success criteria

`;
  }

  prompt += `Respond with ONLY valid JSON in this exact format (no preamble, no markdown):
{
  "question": "Your next question here?",
  "context": "Brief explanation of why this question matters (1 sentence)",
  "followUpSuggestions": ["Possible answer 1", "Possible answer 2", "Possible answer 3"]
}`;

  return prompt;
}

/**
 * Build prompt for suggestion generation
 */
function buildSuggestionPrompt(session, currentQuestion) {
  return `You are helping a user answer this question about their project: "${currentQuestion}"

Project Idea: ${session.projectIdea}

Provide 3-5 concrete suggestions or examples they could consider when answering this question.

Respond with ONLY valid JSON (no preamble):
{
  "suggestions": [
    "Specific suggestion 1",
    "Specific suggestion 2",
    "Specific suggestion 3"
  ],
  "category": "Category of suggestions (e.g., 'Examples', 'Best Practices', 'Considerations')"
}`;
}

/**
 * Parse next question response from AI
 */
function parseNextQuestionResponse(responseText) {
  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*?"question"[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error('Could not find JSON in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  
  if (!parsed.question) {
    throw new Error('Response missing question field');
  }

  return {
    question: parsed.question,
    context: parsed.context || '',
    followUpSuggestions: parsed.followUpSuggestions || []
  };
}

/**
 * Parse suggestion response from AI
 */
function parseSuggestionResponse(responseText) {
  const jsonMatch = responseText.match(/\{[\s\S]*?"suggestions"[\s\S]*?\}/);
  if (!jsonMatch) {
    // Fallback
    return {
      suggestions: ["Consider what matters most for your use case"],
      category: "General"
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    suggestions: parsed.suggestions || [],
    category: parsed.category || 'Suggestions'
  };
}

/**
 * Start a new conversation session
 */
export async function startConversation(projectId, projectIdea, projectType = 'project') {
  await store.load();
  
  // Check if session already exists
  let session = store.get(projectId);
  if (session && !session.completed) {
    // If session exists but has no messages yet, generate first question
    if (session.messages.length === 0) {
      const nextQ = await generateNextQuestion(session);
      session.addMessage('assistant', nextQ.question);
      await store.set(projectId, session);
      
      return {
        ...session.toJSON(),
        currentQuestion: nextQ
      };
    }
    
    // Session exists with messages, return current state
    // Get the last assistant message as current question
    const lastAssistantMessage = session.messages.filter(m => m.role === 'assistant').pop();
    
    return {
      ...session.toJSON(),
      currentQuestion: lastAssistantMessage ? {
        question: lastAssistantMessage.content,
        progress: {
          current: session.questionCount + 1,
          min: session.minQuestions,
          max: session.maxQuestions
        }
      } : null
    };
  }

  // Create new session
  session = new ConversationSession(projectId, projectIdea, projectType);
  await store.set(projectId, session);

  // Generate first question
  const nextQ = await generateNextQuestion(session);
  session.addMessage('assistant', nextQ.question);
  await store.set(projectId, session);

  return {
    ...session.toJSON(),
    currentQuestion: nextQ
  };
}

/**
 * Submit answer and get next question
 */
export async function submitAnswer(projectId, question, answer) {
  await store.load();
  
  const session = store.get(projectId);
  if (!session) {
    throw new Error('Session not found');
  }

  if (session.completed) {
    throw new Error('Conversation already completed');
  }

  // Record answer
  session.addAnswer(question, answer);
  session.addMessage('user', answer);
  
  // Check if we should complete
  if (session.shouldComplete()) {
    session.completed = true;
    await store.set(projectId, session);
    
    return {
      ...session.toJSON(),
      completed: true,
      summary: generateSummary(session)
    };
  }

  // Generate next question
  const nextQ = await generateNextQuestion(session);
  session.addMessage('assistant', nextQ.question);
  await store.set(projectId, session);

  return {
    ...session.toJSON(),
    currentQuestion: nextQ
  };
}

/**
 * Skip current question and get next one
 */
export async function skipQuestion(projectId, question) {
  await store.load();
  
  const session = store.get(projectId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Record skip
  session.addAnswer(question, '[SKIPPED]');
  session.addMessage('user', '[SKIPPED]');

  // Check completion
  if (session.shouldComplete()) {
    session.completed = true;
    await store.set(projectId, session);
    
    return {
      ...session.toJSON(),
      completed: true,
      summary: generateSummary(session)
    };
  }

  // Generate next question
  const nextQ = await generateNextQuestion(session);
  session.addMessage('assistant', nextQ.question);
  await store.set(projectId, session);

  return {
    ...session.toJSON(),
    currentQuestion: nextQ
  };
}

/**
 * Get suggestions for current question
 */
export async function getSuggestions(projectId, question) {
  await store.load();
  
  const session = store.get(projectId);
  if (!session) {
    throw new Error('Session not found');
  }

  return await generateSuggestions(session, question);
}

/**
 * Get current session state
 */
export async function getSession(projectId) {
  await store.load();
  
  const session = store.get(projectId);
  if (!session) {
    throw new Error('Session not found');
  }

  return session.toJSON();
}

/**
 * Generate summary of conversation
 */
function generateSummary(session) {
  const answeredQuestions = session.answers.filter(a => a.answer !== '[SKIPPED]');
  const skippedCount = session.answers.filter(a => a.answer === '[SKIPPED]').length;

  return {
    totalQuestions: session.questionCount,
    answeredCount: answeredQuestions.length,
    skippedCount: skippedCount,
    answers: answeredQuestions,
    completedAt: new Date().toISOString()
  };
}

export { ConversationSession, ConversationStore };
