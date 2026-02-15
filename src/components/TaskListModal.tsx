import { useState, useMemo, CSSProperties } from 'react'
import type { Task, Priority } from '../types'

interface TaskListModalProps {
  title?: string
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onClose: () => void
  highlightLane?: string
}

type SortOption = 'priority' | 'name' | 'type'

const PRIORITY_ORDER: Record<Priority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
}

// Priority styles (inline)
const priorityStyles: Record<Priority, { dot: string; bg: string; text: string }> = {
  P0: { dot: '#f87171', bg: 'rgba(239, 68, 68, 0.1)', text: '#f87171' },
  P1: { dot: '#fb923c', bg: 'rgba(249, 115, 22, 0.1)', text: '#fb923c' },
  P2: { dot: '#facc15', bg: 'rgba(234, 179, 8, 0.1)', text: '#facc15' },
  P3: { dot: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', text: '#64748b' },
}

// Tag/prefix color styles
const tagColorMap: Record<string, { bg: string; text: string; border: string }> = {
  UI: { bg: 'rgba(56, 189, 248, 0.1)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.2)' },
  QA: { bg: 'rgba(52, 211, 153, 0.1)', text: '#34d399', border: 'rgba(52, 211, 153, 0.2)' },
  Backend: { bg: 'rgba(167, 139, 250, 0.1)', text: '#a78bfa', border: 'rgba(167, 139, 250, 0.2)' },
  Architecture: { bg: 'rgba(251, 191, 36, 0.1)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.2)' },
  Epic: { bg: 'rgba(167, 139, 250, 0.1)', text: '#a78bfa', border: 'rgba(167, 139, 250, 0.2)' },
  Test: { bg: 'rgba(45, 212, 191, 0.1)', text: '#2dd4bf', border: 'rgba(45, 212, 191, 0.2)' },
  Fix: { bg: 'rgba(251, 113, 133, 0.1)', text: '#fb7185', border: 'rgba(251, 113, 133, 0.2)' },
  Cleanup: { bg: 'rgba(161, 161, 161, 0.1)', text: '#a1a1aa', border: 'rgba(161, 161, 161, 0.2)' },
}

const getTagColor = (tag?: string) => {
  if (!tag || !tagColorMap[tag]) {
    return { bg: 'rgba(51, 65, 85, 0.1)', text: '#cbd5e1', border: 'rgba(51, 65, 85, 0.2)' }
  }
  return tagColorMap[tag]
}

const getInitials = (owner?: string): string => {
  if (!owner) return '?'
  return owner
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function TaskListModal({
  title = 'Tasks',
  tasks,
  onTaskClick,
  onClose,
  highlightLane,
}: TaskListModalProps) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('priority')
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Filter tasks by search
  const filtered = useMemo(() => {
    return tasks.filter(t =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      (t.tag && t.tag.toLowerCase().includes(search.toLowerCase()))
    )
  }, [tasks, search])

  // Sort tasks
  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sortBy === 'priority') {
      arr.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    } else if (sortBy === 'name') {
      arr.sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortBy === 'type') {
      arr.sort((a, b) => (a.tag || 'Other').localeCompare(b.tag || 'Other'))
    }
    return arr
  }, [filtered, sortBy])

  // Count by priority
  const priorityCount = useMemo(() => {
    return tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1
      return acc
    }, {} as Record<Priority, number>)
  }, [tasks])

  const handleTaskClick = (task: Task) => {
    onTaskClick(task)
    onClose()
  }

  // Styles
  const backdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 40,
    animation: 'fadeIn 0.2s ease-out',
  }

  const modalContainerStyle: CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 50,
    width: 'min(90vw, 560px)',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0f172a',
    border: '1px solid rgba(51, 65, 85, 0.4)',
    borderRadius: 16,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
    animation: 'slideUp 0.3s ease-out',
    overflow: 'hidden',
  }

  const headerStyle: CSSProperties = {
    borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  }

  const titleStyle: CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    color: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  }

  const countBadgeStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: '#94a3b8',
  }

  const closeButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '4px',
    fontSize: 20,
    lineHeight: 1,
    transition: 'color 0.15s ease',
  }

  const contentStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  }

  const prioritySummaryStyle: CSSProperties = {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  }

  const priorityBadgeBase: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid',
  }

  const controlsStyle: CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  }

  const searchInputStyle: CSSProperties = {
    flex: 1,
    padding: '8px 12px 8px 36px',
    background: '#1e293b',
    border: '1px solid rgba(51, 65, 85, 0.6)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s ease',
    fontFamily: 'inherit',
  }

  const sortButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#1e293b',
    border: '1px solid rgba(51, 65, 85, 0.6)',
    borderRadius: 8,
    color: '#cbd5e1',
    cursor: 'pointer',
    fontSize: 14,
    transition: 'all 0.15s ease',
    position: 'relative',
    minWidth: 120,
  }

  const sortMenuStyle: CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    background: '#1e293b',
    border: '1px solid rgba(51, 65, 85, 0.6)',
    borderRadius: 8,
    minWidth: 150,
    overflow: 'hidden',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
    zIndex: 100,
  }

  const taskListContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: '55vh',
    overflowY: 'auto',
  }

  const taskRowStyle: (highlighted: boolean) => CSSProperties = (highlighted) => ({
    padding: 12,
    borderRadius: 12,
    border: highlighted ? '2px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(51, 65, 85, 0.4)',
    background: highlighted ? 'rgba(59, 130, 246, 0.1)' : '#1e293b',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  })

  const footerStyle: CSSProperties = {
    borderTop: '1px solid rgba(51, 65, 85, 0.4)',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#64748b',
  }

  const closeFooterButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#cbd5e1',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 14,
    transition: 'all 0.15s ease',
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, calc(-50% + 20px));
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>

      <div style={backdropStyle} onClick={onClose} />

      <div style={modalContainerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={titleStyle}>
            <span>{title}</span>
            <span style={countBadgeStyle}>
              {filtered.length} / {tasks.length}
            </span>
          </div>
          <button
            onClick={onClose}
            style={closeButtonStyle}
            aria-label="Close modal"
            onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {/* Priority Summary Bar */}
          <div style={prioritySummaryStyle}>
            {(['P0', 'P1', 'P2', 'P3'] as const).map(priority => {
              const pStyle = priorityStyles[priority]
              return (
                <div
                  key={priority}
                  style={{
                    ...priorityBadgeBase,
                    background: pStyle.bg,
                    color: pStyle.text,
                    borderColor: pStyle.bg,
                  }}
                >
                  <span>{priority}</span>
                  <span>{priorityCount[priority] || 0}</span>
                </div>
              )
            })}
          </div>

          {/* Search and Sort Controls */}
          <div style={controlsStyle}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                placeholder="Search tasks by title or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(51, 65, 85, 0.6)')}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                }}
              >
                🔍
              </span>
            </div>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                style={sortButtonStyle}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#0f172a'
                  e.currentTarget.style.borderColor = 'rgba(51, 65, 85, 0.8)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#1e293b'
                  e.currentTarget.style.borderColor = 'rgba(51, 65, 85, 0.6)'
                }}
              >
                <span>Sort: {sortBy}</span>
                <span style={{ fontSize: 12 }}>▼</span>
              </button>

              {showSortMenu && (
                <div style={sortMenuStyle}>
                  {(['priority', 'name', 'type'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => {
                        setSortBy(opt)
                        setShowSortMenu(false)
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 16px',
                        border: 'none',
                        background:
                          sortBy === opt
                            ? 'rgba(59, 130, 246, 0.3)'
                            : 'transparent',
                        color: sortBy === opt ? '#60a5fa' : '#cbd5e1',
                        cursor: 'pointer',
                        fontSize: 14,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        if (sortBy !== opt) {
                          e.currentTarget.style.background = '#0f172a'
                        }
                      }}
                      onMouseLeave={e => {
                        if (sortBy !== opt) {
                          e.currentTarget.style.background = 'transparent'
                        }
                      }}
                    >
                      {opt === 'priority' && 'By Priority'}
                      {opt === 'name' && 'By Name'}
                      {opt === 'type' && 'By Type'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Task List */}
          <div style={taskListContainerStyle}>
            {sorted.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 16px',
                  color: '#64748b',
                  fontSize: 14,
                }}
              >
                {search ? 'No tasks match your search' : 'No tasks to display'}
              </div>
            ) : (
              sorted.map((task) => {
                const isHighlighted = highlightLane && task.lane === highlightLane
                const tagColor = getTagColor(task.tag)

                return (
                  <button
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    style={taskRowStyle(isHighlighted)}
                    onMouseEnter={e => {
                      if (!isHighlighted) {
                        e.currentTarget.style.background = '#334155'
                        e.currentTarget.style.borderColor = 'rgba(51, 65, 85, 0.6)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isHighlighted) {
                        e.currentTarget.style.background = '#1e293b'
                        e.currentTarget.style.borderColor = 'rgba(51, 65, 85, 0.4)'
                      }
                    }}
                  >
                    {/* Priority Dot */}
                    <div
                      style={{
                        flexShrink: 0,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: priorityStyles[task.priority].dot,
                        marginTop: 6,
                      }}
                    />

                    {/* Content */}
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      {/* ID and Badges Row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: '#64748b',
                          }}
                        >
                          {task.id.slice(0, 12)}...
                        </span>
                        {/* Priority Badge */}
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: priorityStyles[task.priority].bg,
                            color: priorityStyles[task.priority].text,
                          }}
                        >
                          {task.priority}
                        </span>
                        {/* Tag Badge */}
                        {task.tag && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              padding: '3px 8px',
                              borderRadius: 4,
                              background: tagColor.bg,
                              color: tagColor.text,
                              border: `1px solid ${tagColor.border}`,
                            }}
                          >
                            {task.tag}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <div
                        style={{
                          color: '#e2e8f0',
                          fontSize: 14,
                          fontWeight: 500,
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          marginBottom: 8,
                        }}
                      >
                        {task.title}
                      </div>

                      {/* Footer with Lane and Owner */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          color: '#64748b',
                        }}
                      >
                        <span>{task.lane}</span>
                        {task.owner ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 600,
                                color: 'white',
                              }}
                            >
                              {getInitials(task.owner)}
                            </div>
                            <span>{task.owner}</span>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              color: '#475569',
                            }}
                          >
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: '1px dashed #475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                              }}
                            >
                              •
                            </div>
                            <span>unassigned</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <span>{sorted.length} of {tasks.length} tasks</span>
          <button
            onClick={onClose}
            style={closeFooterButtonStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(51, 65, 85, 0.3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}
