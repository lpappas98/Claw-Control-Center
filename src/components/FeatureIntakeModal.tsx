import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { FeatureIntake, FeatureIntakeQuestion, Priority } from '../types'

type FeatureContext = {
  id: string
  title: string
  description?: string
  priority?: Priority
  parentTitle?: string
  projectName?: string
  projectSummary?: string
}

type Props = {
  feature: FeatureContext
  intake: FeatureIntake | null
  onSave: (intake: FeatureIntake) => void
  onClose: () => void
  onComplete?: (intake: FeatureIntake) => void
}

/** Generate contextual questions based on feature and project context */
function generateQuestions(feature: FeatureContext): FeatureIntakeQuestion[] {
  const title = feature.title.toLowerCase()
  const desc = (feature.description ?? '').toLowerCase()
  const context = `${title} ${desc}`

  // Base questions that apply to all features
  const questions: FeatureIntakeQuestion[] = [
    {
      id: 'q-goal',
      category: 'goal',
      prompt: `What is the user trying to accomplish with "${feature.title}"?`,
      hint: 'Think about the end goal, not the steps. What problem does this solve for them?',
    },
    {
      id: 'q-trigger',
      category: 'trigger',
      prompt: 'What action or event triggers this feature?',
      hint: 'e.g., "User clicks the export button", "System receives a webhook", "Timer fires at midnight"',
    },
    {
      id: 'q-flow',
      category: 'flow',
      prompt: 'Walk me through the main flow step-by-step.',
      hint: 'Describe what happens from trigger to completion. Include user actions and system responses.',
    },
    {
      id: 'q-edge',
      category: 'edge_cases',
      prompt: 'What could go wrong? What edge cases should we handle?',
      hint: 'Think about errors, empty states, permissions, network failures, invalid inputs...',
    },
    {
      id: 'q-success',
      category: 'success',
      prompt: 'How do you know this feature is working correctly?',
      hint: 'What would you test? What does success look like to the user?',
    },
  ]

  // Add contextual questions based on feature type
  if (/(auth|login|permission|role|access)/.test(context)) {
    questions.push({
      id: 'q-auth',
      category: 'constraints',
      prompt: 'What permissions or roles are involved?',
      hint: 'Who can do what? Are there different access levels?',
    })
  }

  if (/(api|endpoint|backend|server)/.test(context)) {
    questions.push({
      id: 'q-api',
      category: 'constraints',
      prompt: 'What data does this feature need? What does it return?',
      hint: 'Think about inputs, outputs, and data shape.',
    })
  }

  if (/(ui|page|screen|form|button|modal)/.test(context)) {
    questions.push({
      id: 'q-ui',
      category: 'flow',
      prompt: 'Describe the UI layout and key interactions.',
      hint: 'What does the user see? What can they click/tap/type?',
    })
  }

  if (/(schedule|cron|timer|recurring|daily|weekly)/.test(context)) {
    questions.push({
      id: 'q-schedule',
      category: 'trigger',
      prompt: 'When and how often does this run?',
      hint: 'Specify the schedule, timezone considerations, and what happens if it misses a run.',
    })
  }

  if (/(integration|sync|import|export|webhook)/.test(context)) {
    questions.push({
      id: 'q-integration',
      category: 'constraints',
      prompt: 'What external systems are involved? How do we handle failures?',
      hint: 'Think about retries, timeouts, data format, rate limits...',
    })
  }

  // Add dependencies question if not standalone
  questions.push({
    id: 'q-deps',
    category: 'dependencies',
    prompt: 'Does this feature depend on other features being done first?',
    hint: 'List any blockers or prerequisites. "None" is a valid answer.',
  })

  // Add priority/importance question
  questions.push({
    id: 'q-priority',
    category: 'priority',
    prompt: 'How critical is this feature for launch?',
    hint: 'Must-have for v1? Nice-to-have? Can it be simplified for initial release?',
  })

  return questions
}

/** Initialize intake state for a feature */
function initializeIntake(feature: FeatureContext, existing: FeatureIntake | null): FeatureIntake {
  if (existing && existing.questions.length > 0) {
    return existing
  }

  return {
    status: 'not_started',
    currentQuestionIndex: 0,
    questions: generateQuestions(feature),
  }
}

export function FeatureIntakeModal({ feature, intake, onSave, onClose, onComplete }: Props) {
  const [state, setState] = useState<FeatureIntake>(() => initializeIntake(feature, intake))
  const [currentAnswer, setCurrentAnswer] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentQ = state.questions[state.currentQuestionIndex]
  const answeredCount = state.questions.filter(q => q.answer && q.answer.trim()).length
  const totalCount = state.questions.length
  const progress = Math.round((answeredCount / totalCount) * 100)
  const isLastQuestion = state.currentQuestionIndex === state.questions.length - 1

  // Load current answer when question changes
  useEffect(() => {
    setCurrentAnswer(currentQ?.answer ?? '')
    textareaRef.current?.focus()
  }, [state.currentQuestionIndex, currentQ?.id])

  // Auto-save on answer change (debounced)
  const saveAnswer = useCallback((answer: string) => {
    setState(prev => {
      const updated = { ...prev }
      updated.questions = prev.questions.map((q, i) => 
        i === prev.currentQuestionIndex 
          ? { ...q, answer, answeredAt: answer.trim() ? new Date().toISOString() : undefined }
          : q
      )
      if (prev.status === 'not_started' && answer.trim()) {
        updated.status = 'in_progress'
        updated.startedAt = new Date().toISOString()
      }
      return updated
    })
  }, [])

  // Debounced save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentAnswer !== (currentQ?.answer ?? '')) {
        saveAnswer(currentAnswer)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [currentAnswer, currentQ?.answer, saveAnswer])

  const goNext = () => {
    // Save current answer first
    saveAnswer(currentAnswer)
    
    if (state.currentQuestionIndex < state.questions.length - 1) {
      setState(prev => ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1 }))
    }
  }

  const goPrev = () => {
    saveAnswer(currentAnswer)
    if (state.currentQuestionIndex > 0) {
      setState(prev => ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex - 1 }))
    }
  }

  const goToQuestion = (index: number) => {
    saveAnswer(currentAnswer)
    setState(prev => ({ ...prev, currentQuestionIndex: index }))
  }

  const handleSaveAndExit = () => {
    saveAnswer(currentAnswer)
    const finalState = {
      ...state,
      questions: state.questions.map((q, i) => 
        i === state.currentQuestionIndex 
          ? { ...q, answer: currentAnswer, answeredAt: currentAnswer.trim() ? new Date().toISOString() : undefined }
          : q
      ),
    }
    onSave(finalState)
    onClose()
  }

  const handleComplete = () => {
    saveAnswer(currentAnswer)
    const finalState: FeatureIntake = {
      ...state,
      status: 'complete',
      completedAt: new Date().toISOString(),
      questions: state.questions.map((q, i) => 
        i === state.currentQuestionIndex 
          ? { ...q, answer: currentAnswer, answeredAt: currentAnswer.trim() ? new Date().toISOString() : undefined }
          : q
      ),
    }
    onSave(finalState)
    onComplete?.(finalState)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      if (isLastQuestion) {
        handleComplete()
      } else {
        goNext()
      }
    }
  }

  const categoryLabel: Record<FeatureIntakeQuestion['category'], string> = {
    goal: '🎯 Goal',
    trigger: '⚡ Trigger',
    flow: '🔄 Flow',
    edge_cases: '⚠️ Edge Cases',
    success: '✅ Success',
    dependencies: '🔗 Dependencies',
    priority: '📊 Priority',
    constraints: '🔒 Constraints',
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && handleSaveAndExit()}>
      <div className="modal feature-intake-modal" role="dialog" aria-modal="true" aria-label={`Define ${feature.title}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 12 }}>defining feature</div>
            <h3 style={{ margin: '6px 0 0' }}>{feature.title}</h3>
            {feature.description && <div className="muted" style={{ marginTop: 4 }}>{feature.description}</div>}
          </div>
          <div className="stack-h">
            <button className="btn ghost" type="button" onClick={handleSaveAndExit}>
              Save & Exit
            </button>
          </div>
        </div>

        <div className="intake-progress">
          <div className="intake-progress-bar">
            <div className="intake-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="intake-progress-text">
            <span>{answeredCount} of {totalCount} answered</span>
            <span className="muted">{progress}%</span>
          </div>
        </div>

        <div className="intake-dots">
          {state.questions.map((q, i) => {
            const isAnswered = q.answer && q.answer.trim()
            const isCurrent = i === state.currentQuestionIndex
            return (
              <button
                key={q.id}
                type="button"
                className={`intake-dot ${isCurrent ? 'current' : ''} ${isAnswered ? 'answered' : ''}`}
                onClick={() => goToQuestion(i)}
                title={`${categoryLabel[q.category]}: ${isAnswered ? 'Answered' : 'Not answered'}`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>

        <div className="modal-body intake-body">
          {currentQ && (
            <div className="intake-question">
              <div className="intake-question-header">
                <span className="intake-category">{categoryLabel[currentQ.category]}</span>
                <span className="muted">Question {state.currentQuestionIndex + 1} of {totalCount}</span>
              </div>
              
              <h4 className="intake-prompt">{currentQ.prompt}</h4>
              
              {currentQ.hint && (
                <div className="intake-hint">{currentQ.hint}</div>
              )}

              <textarea
                ref={textareaRef}
                className="input intake-answer"
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer here..."
                rows={6}
                autoFocus
              />

              <div className="intake-tip">
                <kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd> + <kbd>Enter</kbd> to {isLastQuestion ? 'complete' : 'continue'}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer intake-footer">
          <div className="stack-h">
            <button 
              className="btn ghost" 
              type="button" 
              onClick={goPrev}
              disabled={state.currentQuestionIndex === 0}
            >
              ← Previous
            </button>
          </div>
          
          <div className="stack-h">
            {isLastQuestion ? (
              <button className="btn" type="button" onClick={handleComplete}>
                Complete ✓
              </button>
            ) : (
              <button className="btn" type="button" onClick={goNext}>
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeatureIntakeModal
