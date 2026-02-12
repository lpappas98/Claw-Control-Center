import fs from 'node:fs/promises'
import path from 'node:path'
import { generateAIQuestions } from './aiQuestionGenerator.mjs'

function cap(list, max) {
  if (!Array.isArray(list)) return []
  if (list.length <= max) return list
  return list.slice(0, max)
}

export async function loadIntakeProjects(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(raw)
    return cap(Array.isArray(data) ? data : data?.projects, 500)
  } catch {
    return []
  }
}

export async function saveIntakeProjects(filePath, projects) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })

  const tmp = `${filePath}.tmp`
  const payload = JSON.stringify(cap(projects, 500), null, 2)
  await fs.writeFile(tmp, payload, 'utf8')
  await fs.rename(tmp, filePath)
}

export function makeId(prefix = 'ip') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`
}

export function slugifyId(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function ensureUniqueProjectId(projects, desired) {
  const base = slugifyId(desired) || `project-${Date.now()}`
  let id = base
  let n = 2
  while (projects.some((p) => p.id === id)) id = `${base}-${n++}`
  return id
}

function cleanLines(s) {
  return String(s ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

function guessDomainTags(idea) {
  const text = String(idea ?? '').toLowerCase()
  const tags = new Set()
  if (/api|integration|webhook|sdk|oauth|sso/.test(text)) tags.add('integration')
  if (/mobile|ios|android/.test(text)) tags.add('mobile')
  if (/dashboard|report|analytics|metric/.test(text)) tags.add('analytics')
  if (/payment|billing|invoice|stripe/.test(text)) tags.add('billing')
  if (/ai|llm|prompt|agent/.test(text)) tags.add('ai')
  if (/permission|role|rbac|auth/.test(text)) tags.add('security')
  if (/notification|email|sms|push/.test(text)) tags.add('notifications')
  if (/workflow|approval|review/.test(text)) tags.add('workflow')
  return [...tags]
}

export async function generateClarifyingQuestions({ idea }) {
  // Use AI-powered question generation
  try {
    const questions = await generateAIQuestions({ 
      idea, 
      type: 'project',
      questionCount: 10 
    })
    return questions
  } catch (error) {
    console.error('[intakeProjects] AI question generation failed, using fallback:', error.message)
    // Fallback to template questions if AI fails
    return generateFallbackQuestions({ idea })
  }
}

// Fallback for when AI generation fails
function generateFallbackQuestions({ idea }) {
  const tags = guessDomainTags(idea)

  /** @type {Array<{ id: string, category: string, prompt: string, required?: boolean }>} */
  const base = [
    { category: 'Goal', prompt: 'What problem are we solving, and for whom (primary user persona)?', required: true },
    { category: 'Goal', prompt: 'How will we measure success (metrics / outcomes)?', required: true },
    { category: 'Users', prompt: 'Who are the user roles, and what permissions do they need?', required: true },
    { category: 'Workflow', prompt: 'Describe the happy-path workflow step-by-step from start to finish.', required: true },
    { category: 'Scope', prompt: 'What is explicitly out of scope for v1?', required: true },
    { category: 'Data', prompt: 'What entities/data must be stored? Any retention or audit requirements?', required: false },
    { category: 'UX', prompt: 'What are the key screens/views we need for v1?', required: true },
    { category: 'Constraints', prompt: 'Any deadlines, dependencies, or constraints (tech/legal/security)?', required: false },
    { category: 'Edge cases', prompt: 'What are the top 5 edge cases or failure modes we must handle?', required: false },
  ]

  const extra = []
  if (tags.includes('integration')) {
    extra.push(
      { category: 'Integrations', prompt: 'Which external systems do we integrate with (APIs/webhooks), and what auth method is required?', required: false },
      { category: 'Integrations', prompt: 'What rate limits / SLAs / error handling expectations exist?', required: false },
    )
  }
  if (tags.includes('security')) {
    extra.push(
      { category: 'Security', prompt: 'What authentication method will be used (SSO/OAuth/passwordless), and what is the threat model?', required: false },
      { category: 'Security', prompt: 'Any compliance requirements (SOC2, HIPAA, GDPR) or audit logging needs?', required: false },
    )
  }
  if (tags.includes('analytics')) {
    extra.push({ category: 'Analytics', prompt: 'What reports/dashboards are required, and what time ranges/filters?', required: false })
  }
  if (tags.includes('notifications')) {
    extra.push({ category: 'Notifications', prompt: 'Which events trigger notifications, and via which channels (email/SMS/in-app)?', required: false })
  }

  const all = [...base, ...extra]
  return all.map((q) => ({
    id: makeId('q'),
    category: q.category,
    prompt: q.prompt,
    required: !!q.required,
    answer: '',
  }))
}

function bulletize(s) {
  const lines = cleanLines(s)
  return lines.length ? lines : []
}

function summarizeIdea(idea) {
  const t = String(idea ?? '').trim()
  if (!t) return 'TBD'
  return t.length > 280 ? `${t.slice(0, 277)}…` : t
}

function nonEmptyAnswerMap(questions) {
  const out = {}
  for (const q of questions ?? []) {
    const a = String(q?.answer ?? '').trim()
    if (a) out[q.prompt ?? q.id] = a
  }
  return out
}

export function draftScopeAndTree({ title, idea, questions }) {
  const answers = nonEmptyAnswerMap(questions)
  const scopeSummary = summarizeIdea(idea)

  const inScope = [
    'Basic project intake record (idea, questions, answers)',
    'Scope summary + in/out-of-scope',
    'Feature tree with priorities and acceptance criteria drafts',
    'Local persistence in ~/.openclaw/workspace/.clawhub/',
  ]

  const outOfScope = [
    'Multi-user collaboration',
    'Full backlog management (sprints, estimates, burndown)',
    'External publishing / sharing links',
  ]

  const assumptions = [
    'Single operator uses this locally',
    'Bridge server is available for persistence when enabled',
  ]

  const risks = []
  if (Object.keys(answers).length === 0) risks.push('Missing requirement answers may lead to wrong scope; confirm before build.')

  const featureTree = [
    {
      id: makeId('f'),
      title: 'Intake workflow',
      priority: 'P0',
      description: 'Capture idea, generate clarifying questions, and store answers.',
      acceptanceCriteria: [
        'User can create a new intake project from a title + idea.',
        'System generates a reusable question template.',
        'User can answer questions and persist changes locally.',
      ],
      children: [
        {
          id: makeId('f'),
          title: 'Idea capture',
          priority: 'P0',
          description: 'Title + freeform idea/problem statement.',
          acceptanceCriteria: ['Title and idea are required to create a project.', 'Project shows created/updated timestamps.'],
          children: [],
        },
        {
          id: makeId('f'),
          title: 'Clarifying questions',
          priority: 'P0',
          description: 'Generate and answer requirement questions.',
          acceptanceCriteria: ['Generate questions from idea.', 'Answers are editable and saved.'],
          children: [],
        },
      ],
    },
    {
      id: makeId('f'),
      title: 'Scope draft',
      priority: 'P0',
      description: 'Summarize scope and boundaries for v1.',
      acceptanceCriteria: ['Scope includes in-scope, out-of-scope, assumptions, and risks.', 'Scope can be edited and saved.'],
      children: [],
    },
    {
      id: makeId('f'),
      title: 'Feature tree',
      priority: 'P1',
      description: 'Structured breakdown with priorities and acceptance criteria.',
      acceptanceCriteria: ['Tree renders as nested list.', 'Each node has priority and acceptance criteria.'],
      children: [],
    },
  ]

  return {
    scope: {
      summary: scopeSummary,
      inScope,
      outOfScope,
      assumptions,
      risks,
    },
    featureTree,
    notes: { generatedFrom: { title: title ?? '', idea: idea ?? '' } },
  }
}

export function toMarkdownBrief(project) {
  const title = project.title || project.id
  const idea = project.idea || ''
  const q = project.questions || []
  const scope = project.scope
  const lines = []

  lines.push(`# ${title}`)
  lines.push('')
  lines.push('## Idea')
  lines.push(idea ? idea.trim() : 'TBD')
  lines.push('')

  lines.push('## Clarifying questions')
  for (const item of q) {
    lines.push(`- **${item.prompt}**`)
    lines.push(`  - Answer: ${String(item.answer ?? '').trim() || 'TBD'}`)
  }
  lines.push('')

  if (scope) {
    lines.push('## Scope')
    lines.push(`**Summary:** ${scope.summary || 'TBD'}`)
    lines.push('')
    lines.push('### In scope')
    for (const s of bulletize(scope.inScope)) lines.push(`- ${s}`)
    lines.push('')
    lines.push('### Out of scope')
    for (const s of bulletize(scope.outOfScope)) lines.push(`- ${s}`)
    lines.push('')
    lines.push('### Assumptions')
    for (const s of bulletize(scope.assumptions)) lines.push(`- ${s}`)
    lines.push('')
    lines.push('### Risks')
    for (const s of bulletize(scope.risks)) lines.push(`- ${s}`)
    lines.push('')
  }

  function walk(nodes, depth) {
    for (const n of nodes || []) {
      const indent = '  '.repeat(depth)
      lines.push(`${indent}- **${n.title}** (${n.priority ?? 'P2'})`)
      if (n.description) lines.push(`${indent}  - ${n.description}`)
      if (Array.isArray(n.acceptanceCriteria) && n.acceptanceCriteria.length) {
        lines.push(`${indent}  - Acceptance criteria:`)
        for (const ac of n.acceptanceCriteria) lines.push(`${indent}    - ${ac}`)
      }
      if (n.children?.length) walk(n.children, depth + 1)
    }
  }

  lines.push('## Feature tree')
  walk(project.featureTree || [], 0)
  lines.push('')

  return lines.join('\n')
}
