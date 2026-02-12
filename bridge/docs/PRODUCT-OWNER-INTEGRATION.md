# Product Owner AI Integration

**Architecture design for AI-powered project requirement question generation**

## Overview

Replace hardcoded question templates in `intakeProjects.mjs` with OpenClaw agent-generated questions. The agent acts as an experienced product owner, analyzing user ideas and generating intelligent, context-aware clarifying questions.

**Status**: Design complete, ready for implementation  
**Version**: 1.0.0  
**Author**: Blueprint  
**Date**: 2026-02-12

---

## 1. Prompt Templates

### 1.1 Project-Level Questions

**Purpose**: Generate 8-10 questions to analyze a new project idea  
**Model role**: Experienced product owner / requirements analyst

```javascript
export function buildProjectQuestionPrompt(idea, title) {
  return `You are an experienced product owner conducting requirements discovery.

**User's project idea:**
Title: ${title}
Idea: ${idea}

**Your task:**
Generate 8-10 clarifying questions to understand this project deeply. Act as if you're in a requirements workshop with the stakeholder.

**Question guidelines:**
- Ask about the core problem and user value (WHO benefits, WHAT problem, WHY now)
- Probe for scope boundaries (what's in/out for v1)
- Understand workflows and user journeys (step-by-step usage)
- Identify success metrics and acceptance criteria
- Uncover constraints (deadlines, dependencies, tech/legal/security)
- Explore edge cases and failure modes
- Ask about data/entities that need persistence
- Question UX expectations and key screens

**Output format (strict JSON):**
Return ONLY a JSON array of question objects. No markdown, no explanation.

[
  {
    "id": "q-<unique-id>",
    "category": "Goal|Users|Workflow|Scope|Data|UX|Constraints|Edge cases|Security|Integrations|Analytics|Notifications",
    "prompt": "The question text",
    "required": true|false
  },
  ...
]

**Required questions (at least 5):**
- What problem are we solving, and for whom?
- How will we measure success?
- Who are the user roles/permissions?
- Describe the happy-path workflow
- What is explicitly out of scope for v1?

**Example output:**
[
  {
    "id": "q-1a2b3c4d",
    "category": "Goal",
    "prompt": "What problem are we solving, and for whom (primary user persona)?",
    "required": true
  },
  {
    "id": "q-5e6f7g8h",
    "category": "Workflow",
    "prompt": "Describe the happy-path workflow step-by-step from user login to task completion.",
    "required": true
  }
]

Generate questions now. Return ONLY the JSON array.`
}
```

### 1.2 Feature-Level Questions

**Purpose**: Generate 3-5 questions for a specific feature in the project  
**Model role**: Technical product owner drilling into implementation details

```javascript
export function buildFeatureQuestionPrompt(featureTitle, featureSummary, projectContext) {
  return `You are a product owner drilling into feature-level requirements.

**Project context:**
${projectContext}

**Feature to analyze:**
Title: ${featureTitle}
Summary: ${featureSummary}

**Your task:**
Generate 3-5 targeted questions to clarify this specific feature's requirements.

**Question guidelines:**
- Focus on this feature's implementation details
- Ask about acceptance criteria and "done" definition
- Probe for dependencies on other features or systems
- Identify data/state changes this feature introduces
- Question error handling and edge cases specific to this feature
- Ask about UI/UX flows within this feature

**Output format (strict JSON):**
Return ONLY a JSON array of question objects. No markdown, no explanation.

[
  {
    "id": "q-<unique-id>",
    "category": "Acceptance|Dependencies|Data|UX|Edge cases|Implementation",
    "prompt": "The question text",
    "required": true|false
  },
  ...
]

**Example output:**
[
  {
    "id": "q-9i0j1k2l",
    "category": "Acceptance",
    "prompt": "What does 'done' look like for this feature? What can the user accomplish?",
    "required": true
  },
  {
    "id": "q-3m4n5o6p",
    "category": "Dependencies",
    "prompt": "Does this feature depend on other features being completed first?",
    "required": false
  }
]

Generate questions now. Return ONLY the JSON array.`
}
```

---

## 2. Response Schema

### 2.1 JSON Schema Definition

```typescript
interface QuestionResponse {
  questions: Question[]
}

interface Question {
  id: string          // Format: "q-<random-hex>" (e.g., "q-a1b2c3d4e5f6")
  category: QuestionCategory
  prompt: string      // The question text
  required: boolean   // Whether answer is required for scope generation
}

type QuestionCategory =
  | 'Goal'
  | 'Users'
  | 'Workflow'
  | 'Scope'
  | 'Data'
  | 'UX'
  | 'Constraints'
  | 'Edge cases'
  | 'Security'
  | 'Integrations'
  | 'Analytics'
  | 'Notifications'
  | 'Acceptance'
  | 'Dependencies'
  | 'Implementation'
```

### 2.2 Example Valid Response

```json
[
  {
    "id": "q-7f8e9d0c1b2a",
    "category": "Goal",
    "prompt": "What problem are we solving, and for whom (primary user persona)?",
    "required": true
  },
  {
    "id": "q-3a4b5c6d7e8f",
    "category": "Users",
    "prompt": "Who are the user roles, and what permissions do they need?",
    "required": true
  },
  {
    "id": "q-9g0h1i2j3k4l",
    "category": "Workflow",
    "prompt": "Describe the happy-path workflow step-by-step from start to finish.",
    "required": true
  },
  {
    "id": "q-5m6n7o8p9q0r",
    "category": "Scope",
    "prompt": "What is explicitly out of scope for v1?",
    "required": true
  },
  {
    "id": "q-1s2t3u4v5w6x",
    "category": "Data",
    "prompt": "What entities/data must be stored? Any retention or audit requirements?",
    "required": false
  }
]
```

---

## 3. Integration Pattern

### 3.1 Service Architecture

Follow the worker service pattern from `workerService.mjs`:

1. **Spawn agent** as detached child process via `openclaw agent`
2. **Pass context** via `--message` flag with structured prompt
3. **Collect output** from process stdout (agent returns JSON)
4. **Parse response** and validate against schema
5. **Timeout handling** with 15-second limit
6. **Error fallback** to hardcoded questions if agent fails

### 3.2 Implementation Module

**File**: `bridge/productOwnerAgent.mjs`

```javascript
import { spawn } from 'child_process'

const DEFAULT_TIMEOUT_MS = 15000 // 15 seconds
const WORKING_DIR = '/home/openclaw/.openclaw/workspace/'

/**
 * Spawn OpenClaw agent to generate questions
 * @param {string} prompt - The complete prompt (from buildProjectQuestionPrompt or buildFeatureQuestionPrompt)
 * @param {Object} options - Configuration options
 * @param {number} options.timeoutMs - Timeout in milliseconds (default 15000)
 * @returns {Promise<Array<Question>>} Array of question objects
 * @throws {Error} If agent spawn fails, times out, or returns invalid JSON
 */
export async function generateQuestionsViaAgent(prompt, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const sessionLabel = `product-owner-${Date.now()}`
  const sessionId = `agent:main:subagent:${sessionLabel}`

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGTERM')
        setTimeout(() => {
          if (!proc.killed) proc.kill('SIGKILL')
        }, 1000)
      }
      reject(new Error(`Agent timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    let stdout = ''
    let stderr = ''

    // Spawn openclaw agent as subprocess
    const proc = spawn('openclaw', [
      'agent',
      '--session-id', sessionId,
      '--message', prompt,
      '--thinking', 'low'
    ], {
      cwd: WORKING_DIR,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    // Collect stdout (agent returns JSON here)
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    // Collect stderr for debugging
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    // Handle process completion
    proc.on('close', (code) => {
      clearTimeout(timeout)

      if (code !== 0) {
        return reject(new Error(`Agent exited with code ${code}: ${stderr}`))
      }

      // Parse JSON from stdout
      try {
        const questions = parseAgentResponse(stdout)
        resolve(questions)
      } catch (parseError) {
        reject(new Error(`Failed to parse agent response: ${parseError.message}\nOutput: ${stdout}`))
      }
    })

    // Handle spawn errors
    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Failed to spawn agent: ${err.message}`))
    })
  })
}

/**
 * Parse and validate agent response
 * @param {string} output - Raw stdout from agent
 * @returns {Array<Question>} Validated array of questions
 * @throws {Error} If output is not valid JSON or doesn't match schema
 */
function parseAgentResponse(output) {
  // Extract JSON from output (handle markdown code blocks)
  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/) || 
                    output.match(/\[[\s\S]*\]/)
  
  if (!jsonMatch) {
    throw new Error('No JSON array found in agent output')
  }

  const jsonText = jsonMatch[1] || jsonMatch[0]
  const parsed = JSON.parse(jsonText)

  if (!Array.isArray(parsed)) {
    throw new Error('Agent response must be a JSON array')
  }

  // Validate each question
  const questions = parsed.map((q, idx) => {
    if (!q.id || typeof q.id !== 'string') {
      throw new Error(`Question ${idx} missing or invalid 'id'`)
    }
    if (!q.category || typeof q.category !== 'string') {
      throw new Error(`Question ${idx} missing or invalid 'category'`)
    }
    if (!q.prompt || typeof q.prompt !== 'string') {
      throw new Error(`Question ${idx} missing or invalid 'prompt'`)
    }
    if (typeof q.required !== 'boolean') {
      q.required = false // Default to optional if not specified
    }

    return {
      id: q.id.trim(),
      category: q.category.trim(),
      prompt: q.prompt.trim(),
      required: q.required
    }
  })

  if (questions.length === 0) {
    throw new Error('Agent returned empty question array')
  }

  return questions
}

/**
 * Build project-level question prompt
 */
export function buildProjectQuestionPrompt(idea, title) {
  return `You are an experienced product owner conducting requirements discovery.

**User's project idea:**
Title: ${title}
Idea: ${idea}

**Your task:**
Generate 8-10 clarifying questions to understand this project deeply. Act as if you're in a requirements workshop with the stakeholder.

**Question guidelines:**
- Ask about the core problem and user value (WHO benefits, WHAT problem, WHY now)
- Probe for scope boundaries (what's in/out for v1)
- Understand workflows and user journeys (step-by-step usage)
- Identify success metrics and acceptance criteria
- Uncover constraints (deadlines, dependencies, tech/legal/security)
- Explore edge cases and failure modes
- Ask about data/entities that need persistence
- Question UX expectations and key screens

**Output format (strict JSON):**
Return ONLY a JSON array of question objects. No markdown, no explanation.

[
  {
    "id": "q-<unique-id>",
    "category": "Goal|Users|Workflow|Scope|Data|UX|Constraints|Edge cases|Security|Integrations|Analytics|Notifications",
    "prompt": "The question text",
    "required": true|false
  },
  ...
]

**Required questions (at least 5):**
- What problem are we solving, and for whom?
- How will we measure success?
- Who are the user roles/permissions?
- Describe the happy-path workflow
- What is explicitly out of scope for v1?

Generate questions now. Return ONLY the JSON array.`
}

/**
 * Build feature-level question prompt
 */
export function buildFeatureQuestionPrompt(featureTitle, featureSummary, projectContext) {
  return `You are a product owner drilling into feature-level requirements.

**Project context:**
${projectContext}

**Feature to analyze:**
Title: ${featureTitle}
Summary: ${featureSummary}

**Your task:**
Generate 3-5 targeted questions to clarify this specific feature's requirements.

**Question guidelines:**
- Focus on this feature's implementation details
- Ask about acceptance criteria and "done" definition
- Probe for dependencies on other features or systems
- Identify data/state changes this feature introduces
- Question error handling and edge cases specific to this feature
- Ask about UI/UX flows within this feature

**Output format (strict JSON):**
Return ONLY a JSON array of question objects. No markdown, no explanation.

[
  {
    "id": "q-<unique-id>",
    "category": "Acceptance|Dependencies|Data|UX|Edge cases|Implementation",
    "prompt": "The question text",
    "required": true|false
  },
  ...
]

Generate questions now. Return ONLY the JSON array.`
}
```

### 3.3 Integration in `intakeProjects.mjs`

Replace the hardcoded `generateClarifyingQuestions` function:

```javascript
import { generateQuestionsViaAgent, buildProjectQuestionPrompt } from './productOwnerAgent.mjs'

/**
 * Generate clarifying questions (AI-powered)
 * Falls back to hardcoded questions on error
 */
export async function generateClarifyingQuestions({ idea, title }) {
  try {
    // Try AI generation first
    const prompt = buildProjectQuestionPrompt(idea, title)
    const questions = await generateQuestionsViaAgent(prompt, { timeoutMs: 15000 })
    
    // Add answer field for each question
    return questions.map(q => ({
      ...q,
      answer: ''
    }))
  } catch (error) {
    console.error('[Product Owner Agent] Failed to generate questions:', error.message)
    console.warn('[Product Owner Agent] Falling back to hardcoded questions')
    
    // Fallback to existing hardcoded logic
    return generateClarifyingQuestionsFallback({ idea, title })
  }
}

/**
 * Fallback: Original hardcoded question generation
 * (Rename existing function to this)
 */
function generateClarifyingQuestionsFallback({ idea, title }) {
  // ... existing hardcoded logic from current generateClarifyingQuestions ...
}
```

---

## 4. Error Handling

### 4.1 Error Scenarios

| Error Type | Detection | Recovery Strategy |
|------------|-----------|-------------------|
| **Agent spawn failure** | `proc.on('error')` | Fallback to hardcoded questions |
| **Timeout** | `setTimeout` + `proc.kill()` | Fallback to hardcoded questions |
| **Invalid JSON** | `JSON.parse()` throws | Fallback to hardcoded questions |
| **Schema validation** | Missing required fields | Fallback to hardcoded questions |
| **Empty response** | `questions.length === 0` | Fallback to hardcoded questions |
| **Process crash** | Exit code != 0 | Fallback to hardcoded questions |

### 4.2 Error Logging

All errors should be logged with context:

```javascript
console.error('[Product Owner Agent] Error:', {
  type: 'timeout|spawn|parse|validation',
  message: error.message,
  context: { idea, title },
  timestamp: new Date().toISOString()
})
```

### 4.3 User-Facing Behavior

**Success case:**
- Questions appear instantly (< 15s)
- User sees AI-generated questions tailored to their idea

**Failure case:**
- Questions appear instantly (fallback is synchronous)
- User sees generic hardcoded questions
- No error message shown to user (silent fallback)
- Error logged to server console for debugging

### 4.4 Graceful Degradation

The system **always works** even if OpenClaw agent is unavailable:

1. Agent unreachable → hardcoded questions
2. Agent timeout → hardcoded questions
3. Invalid response → hardcoded questions
4. OpenClaw CLI not installed → hardcoded questions

**User experience is never broken.**

---

## 5. Performance Estimates

### 5.1 Response Times

| Scenario | Expected Time | P95 Time | Timeout |
|----------|--------------|----------|---------|
| **Project questions (8-10)** | 3-8 seconds | 12 seconds | 15 seconds |
| **Feature questions (3-5)** | 2-5 seconds | 8 seconds | 15 seconds |
| **Fallback (hardcoded)** | < 10ms | < 10ms | N/A |

**User-perceived performance:**
- Initial intake form appears instantly (empty, no questions yet)
- Questions populate after agent responds (loading state shown)
- If agent times out, questions appear after 15s with fallback

### 5.2 Token Usage Estimates

**Input tokens** (per request):

| Component | Tokens |
|-----------|--------|
| System prompt (project-level) | ~600 tokens |
| User idea + title | ~50-200 tokens |
| **Total input** | **~650-800 tokens** |

**Output tokens** (per response):

| Component | Tokens |
|-----------|--------|
| 8-10 questions @ ~40 tokens each | ~320-400 tokens |
| JSON structure overhead | ~100 tokens |
| **Total output** | **~420-500 tokens** |

**Per-request cost**:
- Input: ~800 tokens @ $3/MTok = $0.0024
- Output: ~500 tokens @ $15/MTok = $0.0075
- **Total: ~$0.01 per project intake**

**Monthly estimates** (100 projects/month):
- Token cost: ~$1.00/month
- Minimal impact on budget

### 5.3 Concurrent Request Handling

**Current limitation**: Sequential processing (one agent at a time)

**Reasoning**:
- Project intake is rare (not a high-throughput operation)
- Agents are spawned as subprocesses (OS-level isolation)
- No shared state between requests
- Future: Can add queue if needed

**Concurrency strategy**:
- No explicit locking required
- Each spawn is independent
- If user creates multiple projects simultaneously, each request spawns its own agent
- OpenClaw gateway handles session isolation

**Load testing recommendations**:
- Test with 5 concurrent project creations
- Monitor OpenClaw session count (should scale linearly)
- Watch for memory pressure (each agent ~100-200MB)

---

## 6. Testing Strategy

### 6.1 Unit Tests

```javascript
// test: productOwnerAgent.test.mjs

describe('productOwnerAgent', () => {
  it('should generate valid questions from agent', async () => {
    const questions = await generateQuestionsViaAgent(
      buildProjectQuestionPrompt('Build a todo app', 'Todo App')
    )
    
    expect(questions).toBeInstanceOf(Array)
    expect(questions.length).toBeGreaterThanOrEqual(5)
    expect(questions[0]).toHaveProperty('id')
    expect(questions[0]).toHaveProperty('category')
    expect(questions[0]).toHaveProperty('prompt')
    expect(questions[0]).toHaveProperty('required')
  })

  it('should timeout after 15 seconds', async () => {
    await expect(
      generateQuestionsViaAgent('test', { timeoutMs: 100 })
    ).rejects.toThrow('timeout')
  })

  it('should reject invalid JSON', () => {
    expect(() => parseAgentResponse('not json'))
      .toThrow('No JSON array found')
  })

  it('should reject non-array response', () => {
    expect(() => parseAgentResponse('{"foo": "bar"}'))
      .toThrow('must be a JSON array')
  })
})
```

### 6.2 Integration Tests

```javascript
// test: intakeProjects.integration.test.mjs

describe('generateClarifyingQuestions', () => {
  it('should use AI when available', async () => {
    const questions = await generateClarifyingQuestions({
      idea: 'Build a real-time chat app',
      title: 'Chat App'
    })
    
    expect(questions.length).toBeGreaterThan(0)
    expect(questions[0].prompt).toBeTruthy()
  })

  it('should fallback to hardcoded on agent failure', async () => {
    // Mock agent to fail
    jest.spyOn(productOwnerAgent, 'generateQuestionsViaAgent')
      .mockRejectedValue(new Error('Agent unavailable'))
    
    const questions = await generateClarifyingQuestions({
      idea: 'Test idea',
      title: 'Test'
    })
    
    // Should still return questions
    expect(questions.length).toBeGreaterThan(0)
  })
})
```

### 6.3 Manual Testing Checklist

- [ ] Create new project → verify AI questions appear
- [ ] Create project with unavailable agent → verify fallback works
- [ ] Create project with slow agent (>15s) → verify timeout + fallback
- [ ] Verify question JSON structure matches schema
- [ ] Verify questions are contextual (mention user's idea keywords)
- [ ] Test with complex multi-paragraph idea
- [ ] Test with simple one-sentence idea
- [ ] Test with empty idea (should still generate questions)

---

## 7. Future Enhancements

### 7.1 Streaming Responses

Instead of waiting for full response, stream questions as they're generated:

```javascript
// Future API
for await (const question of streamQuestionsViaAgent(prompt)) {
  // Send question to frontend immediately
  emitQuestionUpdate(question)
}
```

**Benefits**: Faster perceived performance, progressive loading

### 7.2 Question Refinement

Allow user to regenerate questions or ask for more:

```javascript
// UI: "Generate 3 more questions" button
const additionalQuestions = await generateQuestionsViaAgent(
  buildFollowUpQuestionPrompt(existingQuestions, idea)
)
```

### 7.3 Answer Validation

Agent validates user answers and suggests improvements:

```javascript
const validation = await validateAnswersViaAgent(questions, answers)
// Returns: { complete: boolean, suggestions: string[] }
```

### 7.4 Scope Generation

Agent drafts scope document from answers:

```javascript
const scopeDraft = await generateScopeViaAgent(questions, answers)
// Returns: { inScope, outOfScope, assumptions, risks }
```

---

## 8. Migration Plan

### Phase 1: Parallel Run (Week 1)
- Deploy new agent integration behind feature flag
- Both hardcoded and AI questions generated
- Log comparison metrics (response time, quality)

### Phase 2: Soft Launch (Week 2)
- Enable AI questions for 50% of new projects
- Monitor error rates and fallback frequency
- Collect user feedback

### Phase 3: Full Rollout (Week 3)
- Enable AI questions for 100% of projects
- Keep hardcoded fallback forever (safety net)
- Remove feature flag, clean up old code

### Phase 4: Optimization (Week 4+)
- Tune prompts based on question quality feedback
- Optimize timeout values based on P95 latency
- Consider caching common question patterns

---

## 9. Appendix: Code Locations

| File | Function | Purpose |
|------|----------|---------|
| `bridge/productOwnerAgent.mjs` | `generateQuestionsViaAgent()` | Main agent spawning logic |
| `bridge/productOwnerAgent.mjs` | `buildProjectQuestionPrompt()` | Prompt template builder |
| `bridge/productOwnerAgent.mjs` | `parseAgentResponse()` | JSON validation |
| `bridge/intakeProjects.mjs` | `generateClarifyingQuestions()` | Integration point (replace hardcoded) |
| `bridge/server.mjs` | `POST /api/intake` | API endpoint that calls question generation |

---

## 10. Success Metrics

**Quantitative:**
- Response time P95 < 12 seconds
- Fallback rate < 5% (agent availability)
- Token cost < $2/month for 100 projects

**Qualitative:**
- Questions are contextual (mention user's domain/keywords)
- Questions cover all critical categories (Goal, Users, Workflow, Scope)
- User feedback: "Questions helped me think through my idea"

---

**END OF DOCUMENT**
