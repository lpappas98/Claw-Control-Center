import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Generate intelligent questions using OpenClaw agent acting as product owner
 * @param {Object} options
 * @param {string} options.idea - The project idea/description
 * @param {string} options.type - 'project' or 'feature'
 * @param {string} [options.featureContext] - Additional context for feature-level questions
 * @param {number} [options.questionCount] - Target number of questions (default: 10 for project, 5 for feature)
 * @returns {Promise<Array<{id: string, category: string, prompt: string, required: boolean, answer: string}>>}
 */
export async function generateAIQuestions({ idea, type = 'project', featureContext = '', questionCount }) {
  const targetCount = questionCount ?? (type === 'project' ? 10 : 5)
  
  const prompt = buildProductOwnerPrompt({ idea, type, featureContext, targetCount })
  
  try {
    // Spawn OpenClaw agent session to act as product owner
    const { stdout, stderr } = await execFileAsync('openclaw', [
      'agent',
      '--agent', 'main',
      '--thinking', 'low',
      '--local',
      '--message', prompt
    ], {
      timeout: 120000, // 2 minute timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    })
    
    // Parse the AI response
    const questions = parseAIResponse(stdout, type)
    
    if (questions.length === 0) {
      console.warn('[AI Question Generator] No questions parsed from AI response, using fallback')
      return generateFallbackQuestions({ idea, type, targetCount })
    }
    
    return questions
    
  } catch (error) {
    console.error('[AI Question Generator] Error calling OpenClaw agent:', error.message)
    console.error('Falling back to template-based questions')
    
    // Fallback to template-based questions on error
    return generateFallbackQuestions({ idea, type, targetCount })
  }
}

/**
 * Build the prompt for the product owner agent
 */
function buildProductOwnerPrompt({ idea, type, featureContext, targetCount }) {
  if (type === 'project') {
    return `You are an experienced product owner helping to gather requirements for a new project.

PROJECT IDEA:
${idea}

YOUR TASK:
Generate exactly ${targetCount} clarifying questions that will help understand the requirements deeply. 

QUESTION CATEGORIES (use 2-3 questions per category):
- Goal: What problem we're solving, for whom, and success metrics
- Users: User roles, personas, and permissions
- Workflow: Step-by-step happy path and key user journeys  
- Scope: What's in/out of scope for v1
- Data: Entities, storage, retention, audit requirements
- UX: Key screens, views, and interaction patterns
- Constraints: Deadlines, dependencies, tech/legal/security constraints
- Edge cases: Top failure modes and error handling
- Integrations: External systems, APIs, auth methods (if applicable)
- Security: Auth, compliance, threat model (if applicable)

OUTPUT FORMAT:
Return ONLY a JSON array with this exact structure:
[
  {
    "category": "Goal",
    "prompt": "What problem are we solving and for whom?",
    "required": true
  },
  {
    "category": "Users", 
    "prompt": "Who are the primary user roles?",
    "required": true
  }
]

RULES:
- Output ONLY valid JSON, no markdown, no explanations
- Each question must be specific and actionable
- Mark 5-6 questions as required: true, rest as false
- Focus on questions that uncover assumptions and edge cases
- Make questions relevant to the specific project idea`
  } else {
    return `You are an experienced product owner helping to refine a feature specification.

PROJECT CONTEXT:
${featureContext}

FEATURE IDEA:
${idea}

YOUR TASK:
Generate exactly ${targetCount} focused questions that will help define this specific feature's requirements.

FOCUS AREAS:
- User interaction flow for this feature
- Data inputs and outputs
- Edge cases specific to this feature
- Integration points with existing system
- Success criteria and acceptance tests

OUTPUT FORMAT:
Return ONLY a JSON array with this exact structure:
[
  {
    "category": "Interaction",
    "prompt": "How does the user trigger this feature?",
    "required": true
  },
  {
    "category": "Data",
    "prompt": "What data is required as input?",
    "required": true
  }
]

RULES:
- Output ONLY valid JSON, no markdown, no explanations
- Each question must be specific to THIS feature
- Mark 2-3 questions as required: true, rest as false
- Focus on implementation details, not high-level strategy`
  }
}

/**
 * Parse AI response and extract questions
 */
function parseAIResponse(output, type) {
  try {
    // Try to find JSON array in the output
    const jsonMatch = output.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[AI Question Generator] No JSON array found in output')
      return []
    }
    
    const questions = JSON.parse(jsonMatch[0])
    
    if (!Array.isArray(questions)) {
      console.warn('[AI Question Generator] Parsed data is not an array')
      return []
    }
    
    // Add IDs and ensure required fields
    return questions.map((q, idx) => ({
      id: makeId('q'),
      category: String(q.category || 'General'),
      prompt: String(q.prompt || ''),
      required: Boolean(q.required),
      answer: ''
    })).filter(q => q.prompt.length > 0)
    
  } catch (error) {
    console.error('[AI Question Generator] Error parsing AI response:', error.message)
    return []
  }
}

/**
 * Generate fallback questions using template-based approach
 */
function generateFallbackQuestions({ idea, type, targetCount }) {
  if (type === 'project') {
    return [
      { id: makeId('q'), category: 'Goal', prompt: 'What problem are we solving, and for whom (primary user persona)?', required: true, answer: '' },
      { id: makeId('q'), category: 'Goal', prompt: 'How will we measure success (metrics / outcomes)?', required: true, answer: '' },
      { id: makeId('q'), category: 'Users', prompt: 'Who are the user roles, and what permissions do they need?', required: true, answer: '' },
      { id: makeId('q'), category: 'Workflow', prompt: 'Describe the happy-path workflow step-by-step from start to finish.', required: true, answer: '' },
      { id: makeId('q'), category: 'Scope', prompt: 'What is explicitly out of scope for v1?', required: true, answer: '' },
      { id: makeId('q'), category: 'Data', prompt: 'What entities/data must be stored? Any retention or audit requirements?', required: false, answer: '' },
      { id: makeId('q'), category: 'UX', prompt: 'What are the key screens/views we need for v1?', required: true, answer: '' },
      { id: makeId('q'), category: 'Constraints', prompt: 'Any deadlines, dependencies, or constraints (tech/legal/security)?', required: false, answer: '' },
      { id: makeId('q'), category: 'Edge cases', prompt: 'What are the top 5 edge cases or failure modes we must handle?', required: false, answer: '' },
      { id: makeId('q'), category: 'Integrations', prompt: 'Which external systems do we integrate with, and what auth method is required?', required: false, answer: '' },
    ].slice(0, targetCount)
  } else {
    return [
      { id: makeId('q'), category: 'Interaction', prompt: 'How does the user trigger this feature?', required: true, answer: '' },
      { id: makeId('q'), category: 'Data', prompt: 'What data is required as input?', required: true, answer: '' },
      { id: makeId('q'), category: 'Output', prompt: 'What is the expected output or result?', required: true, answer: '' },
      { id: makeId('q'), category: 'Edge cases', prompt: 'What edge cases must be handled?', required: false, answer: '' },
      { id: makeId('q'), category: 'Integration', prompt: 'How does this integrate with existing features?', required: false, answer: '' },
    ].slice(0, targetCount)
  }
}

function makeId(prefix = 'q') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`
}
