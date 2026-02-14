import { useState } from "react";

/* ── Data ─────────────────────────────────────────────── */

const AGENTS = [
  { name: "TARS", role: "PM", emoji: "🍊", heartbeat: "4s", task: null },
  { name: "Blueprint", role: "Architect", emoji: "🏗️", heartbeat: "26s", task: null },
  { name: "Sentinel", role: "QA", emoji: "🔍", heartbeat: "28s", task: null },
  { name: "Forge", role: "Dev", emoji: "🔨", heartbeat: "2s", task: "Implement redesigned modals" },
  { name: "Patch", role: "Dev", emoji: "🌟", heartbeat: "30s", task: null },
];

const COLUMNS = [
  { id: "proposed", label: "Proposed", tasks: [
    { id: "t-01", title: "QA verify Project import flow", tag: "Epic", p: "P1" },
    { id: "t-02", title: "Projects type-safe refactor", tag: "Epic", p: "P1" },
    { id: "t-03", title: "Projects backend pagination", tag: "Epic", p: "P0" },
  ]},
  { id: "queued", label: "Queued", tasks: [
    { id: "t-04", title: "Implement redesigned modal components", tag: "UI", p: "P0", owner: "Forge" },
    { id: "t-05", title: "Implement redesigned task cards", tag: "UI", p: "P0" },
    { id: "t-06", title: "Document agent worker architecture", tag: "Docs", p: "P1" },
    { id: "t-07", title: "Update agent heartbeat protocol", tag: "Backend", p: "P0" },
    { id: "t-08", title: "Add query parameter validation", tag: "Backend", p: "P0" },
    { id: "t-09", title: "Add GET /api/projects endpoint", tag: "Backend", p: "P0" },
  ]},
  { id: "development", label: "Development", tasks: [
    { id: "t-10", title: "User Authentication System", tag: "Epic", p: "P0" },
    { id: "t-11", title: "Add GET /api/projects endpoint", tag: "Backend", p: "P1" },
    { id: "t-12", title: "Create epic subtask drawer component", tag: "UI", p: "P1" },
    { id: "t-13", title: "Add feature-level question generation", tag: "Backend", p: "P0" },
    { id: "t-14", title: "Design OpenClaw integration", tag: "Arch", p: "P0" },
  ]},
  { id: "review", label: "Review", tasks: [
    { id: "t-15", title: "Show subtasks when clicking epic tiles", tag: "Epic", p: "P1" },
    { id: "t-16", title: "Add subtask count badge to tiles", tag: "UI", p: "P1" },
    { id: "t-17", title: "Test epic subtask viewing flow e2e", tag: "QA", p: "P1" },
    { id: "t-18", title: "Test import flow end-to-end", tag: "QA", p: "P0" },
    { id: "t-19", title: "Wire Import flow to backend", tag: "Frontend", p: "P0" },
    { id: "t-20", title: "Design integration for question gen", tag: "Arch", p: "P0" },
    { id: "t-21", title: "Add loading states for AI question gen", tag: "UI", p: "P1" },
  ]},
  { id: "done", label: "Done", tasks: [
    { id: "t-22", title: "Import Project from GitHub", tag: "Epic", p: "P0" },
    { id: "t-23", title: "Build AI code analysis pipeline", tag: "Backend", p: "P0" },
    { id: "t-24", title: "Test import flow end-to-end", tag: "QA", p: "P0" },
  ]},
];

const BLOCKED_TASKS = [
  { id: "b-01", title: "Implement RBAC permission middleware", tag: "Backend", p: "P0", blockedBy: "Session middleware not merged", assignee: "Forge", blockedSince: "2h ago" },
  { id: "b-02", title: "Agent permission scoping E2E tests", tag: "QA", p: "P0", blockedBy: "RBAC schema not finalized", assignee: "Sentinel", blockedSince: "45m ago" },
];

const ACTIVITY = [
  { time: "4m ago", msg: "bridge started on :8787", type: "info", count: 3 },
  { time: "42m ago", msg: "gateway: down → warn (probe ok, runtime unknown)", type: "warn" },
  { time: "1h ago", msg: "Forge completed: Wire Import flow to backend", type: "success" },
  { time: "1h ago", msg: "Sentinel started: Test epic subtask viewing flow", type: "info" },
  { time: "2h ago", msg: "Blueprint completed: Design OpenClaw integration", type: "success" },
  { time: "2h ago", msg: "TARS created 4 new tasks from epic breakdown", type: "info" },
];

const NAV_ITEMS = ["Mission Control", "Projects", "Activity", "Kanban", "Recurring", "Integrations", "System", "Config", "Docs"];

/* ── Colors ───────────────────────────────────────────── */

const P = {
  P0: { dot: "#f87171", border: "#ef4444", text: "#fca5a5" },
  P1: { dot: "#fbbf24", border: "#f59e0b", text: "#fde68a" },
  P2: { dot: "#facc15", border: "#eab308", text: "#fef08a" },
  P3: { dot: "#64748b", border: "#475569", text: "#94a3b8" },
};

const TAG = {
  Epic: { bg: "rgba(139,92,246,0.15)", text: "#c4b5fd" },
  UI: { bg: "rgba(14,165,233,0.15)", text: "#7dd3fc" },
  Backend: { bg: "rgba(168,85,247,0.15)", text: "#d8b4fe" },
  QA: { bg: "rgba(16,185,129,0.15)", text: "#6ee7b7" },
  Arch: { bg: "rgba(245,158,11,0.15)", text: "#fcd34d" },
  Frontend: { bg: "rgba(6,182,212,0.15)", text: "#67e8f9" },
  Docs: { bg: "rgba(100,116,139,0.15)", text: "#94a3b8" },
};

const COL_ACCENT = {
  proposed: "#64748b",
  queued: "#3b82f6",
  development: "#8b5cf6",
  review: "#f59e0b",
  done: "#10b981",
};

/* ── Helpers ──────────────────────────────────────────── */

const s = {
  card: {
    background: "rgba(30,41,59,0.45)",
    border: "1px solid rgba(51,65,85,0.35)",
    borderRadius: 8,
    padding: "10px 12px",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  panel: {
    background: "rgba(15,23,42,0.45)",
    border: "1px solid rgba(30,41,59,0.55)",
    borderRadius: 14,
    overflow: "hidden",
  },
};

/* ── Components ───────────────────────────────────────── */

function AgentCardExpanded({ agent }) {
  return (
    <div style={{
      width: 300,
      flexShrink: 0,
      background: "linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(15,23,42,0.5) 100%)",
      border: "1px solid rgba(16,185,129,0.18)",
      borderRadius: 12,
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{agent.emoji}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{agent.name}</span>
          <span style={{ fontSize: 11, color: "#64748b" }}>{agent.role}</span>
          <div style={{
            marginLeft: "auto",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#34d399",
            boxShadow: "0 0 6px rgba(52,211,153,0.5)"
          }} />
        </div>
        <p style={{
          fontSize: 12,
          color: "rgba(110,231,183,0.65)",
          marginTop: 3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}>{agent.task}</p>
      </div>
    </div>
  );
}

function AgentCardCompact({ agent }) {
  const isActive = !!agent.task;
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      background: isActive
        ? "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(15,23,42,0.5) 100%)"
        : "rgba(30,41,59,0.4)",
      border: isActive ? "1px solid rgba(16,185,129,0.18)" : "1px solid rgba(51,65,85,0.35)",
      borderRadius: 12,
      padding: "10px 14px",
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{agent.emoji}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9" }}>{agent.name}</span>
          <span style={{ fontSize: 10, color: "#475569" }}>{agent.role}</span>
          <div style={{
            marginLeft: "auto",
            width: 6,
            height: 6,
            borderRadius: "50%",
            flexShrink: 0,
            background: isActive ? "#34d399" : "#475569",
            boxShadow: isActive ? "0 0 6px rgba(52,211,153,0.5)" : "none",
          }} />
        </div>
        {isActive ? (
          <p style={{
            fontSize: 11,
            color: "rgba(110,231,183,0.6)",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>{agent.task}</p>
        ) : (
          <p style={{ fontSize: 11, color: "#334155", marginTop: 2 }}>Idle · {agent.heartbeat}</p>
        )}
      </div>
    </div>
  );
}

function IdleCluster({ agents }) {
  return (
    <div style={{
      background: "rgba(30,41,59,0.4)",
      border: "1px solid rgba(51,65,85,0.35)",
      borderRadius: 12,
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <div style={{ display: "flex", gap: 6 }}>
        {agents.map(a => (
          <div
            key={a.name}
            title={`${a.name} · ${a.role} · heartbeat ${a.heartbeat}`}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(51,65,85,0.5)",
              border: "1px solid rgba(71,85,105,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              cursor: "default",
            }}
          >
            {a.emoji}
          </div>
        ))}
      </div>
      <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
        <span style={{ color: "#cbd5e1", fontWeight: 500 }}>{agents.length}</span> idle
      </span>
    </div>
  );
}

function AgentStrip({ agents }) {
  const working = agents.filter(a => a.task);
  const idle = agents.filter(a => !a.task);
  const useCompactMode = working.length >= 4;

  /* ── Compact mode: equal-width cards for ALL agents ── */
  if (useCompactMode) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        {agents.map(a => <AgentCardCompact key={a.name} agent={a} />)}
      </div>
    );
  }

  /* ── Expanded mode: big cards for active + cluster for idle ── */
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
      {working.map(a => <AgentCardExpanded key={a.name} agent={a} />)}
      {idle.length > 0 && <IdleCluster agents={idle} />}
    </div>
  );
}

function TaskCard({ task }) {
  const [hovered, setHovered] = useState(false);
  const tc = TAG[task.tag] || TAG.Docs;
  const pc = P[task.p] || P.P3;

  return (
    <div
      style={{
        ...s.card,
        borderLeft: `3px solid ${pc.border}`,
        background: hovered ? "rgba(30,41,59,0.7)" : s.card.background,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <p style={{
        fontSize: 12.5,
        lineHeight: 1.45,
        color: "#e2e8f0",
        margin: 0,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>{task.title}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          padding: "2px 7px",
          borderRadius: 4,
          background: tc.bg,
          color: tc.text,
          letterSpacing: "0.01em",
        }}>{task.tag}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: pc.text }}>{task.p}</span>
        {task.owner && (
          <span style={{ fontSize: 10, color: "#60a5fa", marginLeft: 2 }}>→ {task.owner}</span>
        )}
      </div>
    </div>
  );
}

function BlockedBar() {
  const [expanded, setExpanded] = useState(true);
  const count = BLOCKED_TASKS.length;

  if (count === 0) return null;

  return (
    <div style={{
      background: "rgba(239,68,68,0.04)",
      border: "1px solid rgba(239,68,68,0.12)",
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 4,
    }}>
      {/* Header bar — always visible */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          display: "inline-block",
          transition: "transform 0.2s",
          transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          color: "#f87171",
        }}>▶</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#f87171",
            display: "inline-block",
            boxShadow: "0 0 6px rgba(248,113,113,0.4)",
          }} />
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#fca5a5",
            textTransform: "uppercase",
            letterSpacing: "0.05em"
          }}>Blocked</span>
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: "#f87171",
          background: "rgba(239,68,68,0.12)",
          padding: "2px 8px",
          borderRadius: 10,
        }}>{count}</span>
        {!expanded && (
          <div style={{ display: "flex", gap: 8, marginLeft: 8, flex: 1, overflow: "hidden" }}>
            {BLOCKED_TASKS.map(t => (
              <span key={t.id} style={{
                fontSize: 11,
                color: "#fca5a5",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>{t.title}</span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded: horizontal task cards */}
      {expanded && (
        <div style={{
          padding: "4px 16px 12px",
          display: "flex",
          gap: 8,
          overflowX: "auto",
        }}>
          {BLOCKED_TASKS.map(task => {
            const tc = TAG[task.tag] || { bg: "rgba(100,116,139,0.12)", text: "#94a3b8" };
            const pc = P[task.p] || P.P0;

            return (
              <div
                key={task.id}
                style={{
                  minWidth: 260,
                  maxWidth: 320,
                  flex: "0 0 auto",
                  background: "rgba(30,41,59,0.4)",
                  border: "1px solid rgba(239,68,68,0.15)",
                  borderLeft: "3px solid #f87171",
                  borderRadius: 8,
                  padding: "10px 14px",
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(30,41,59,0.6)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(30,41,59,0.4)"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: tc.bg,
                    color: tc.text
                  }}>{task.tag}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: pc.text }}>{task.p}</span>
                  {task.assignee && (
                    <span style={{ fontSize: 10, color: "#60a5fa", marginLeft: "auto" }}>→ {task.assignee}</span>
                  )}
                </div>
                <p style={{
                  fontSize: 12.5,
                  color: "#e2e8f0",
                  margin: 0,
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>{task.title}</p>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 8,
                  padding: "5px 8px",
                  borderRadius: 6,
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.08)",
                }}>
                  <span style={{ fontSize: 10, color: "#f87171" }}>⚠</span>
                  <span style={{
                    fontSize: 11,
                    color: "#fca5a5",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>{task.blockedBy}</span>
                  <span style={{ fontSize: 10, color: "#7f1d1d", flexShrink: 0 }}>{task.blockedSince}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ col }) {
  const MAX = 5;
  const visible = col.tasks.slice(0, MAX);
  const overflow = col.tasks.length - MAX;
  const p0 = col.tasks.filter(t => t.p === "P0").length;
  const accent = COL_ACCENT[col.id] || "#64748b";
  const [btnHover, setBtnHover] = useState(false);

  return (
    <div style={{ minWidth: 185, flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "8px 10px 8px", borderBottom: `2px solid ${accent}35`, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.06em"
            }}>{col.label}</span>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#64748b",
              background: "rgba(30,41,59,0.7)",
              padding: "2px 8px",
              borderRadius: 10,
            }}>{col.tasks.length}</span>
          </div>
          {p0 > 0 && col.id !== "done" && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171" }} />
              <span style={{ fontSize: 10, color: "#fca5a5", fontWeight: 500 }}>{p0}</span>
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map(t => <TaskCard key={t.id} task={t} />)}
        {overflow > 0 && (
          <button
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: btnHover ? "#e2e8f0" : "#94a3b8",
              background: "transparent",
              border: `1px dashed ${btnHover ? "rgba(100,116,139,0.6)" : "rgba(71,85,105,0.4)"}`,
              borderRadius: 8,
              padding: "8px 0",
              cursor: "pointer",
              textAlign: "center",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
          >
            +{overflow} more
          </button>
        )}
      </div>
    </div>
  );
}

function ActivityFeed() {
  const icons = { info: "ℹ", warn: "⚠", success: "✓" };
  const iconColors = { info: "#64748b", warn: "#fbbf24", success: "#34d399" };

  return (
    <div>
      {ACTIVITY.map((a, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 10,
            padding: "10px 16px",
            borderLeft: a.type === "warn" ? "2px solid rgba(245,158,11,0.35)" : "2px solid transparent",
            background: a.type === "warn" ? "rgba(245,158,11,0.04)" : "transparent",
          }}
        >
          <span style={{ color: iconColors[a.type], fontSize: 12, flexShrink: 0, marginTop: 1 }}>
            {icons[a.type]}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              fontSize: 12,
              lineHeight: 1.5,
              margin: 0,
              wordBreak: "break-word",
              color: a.type === "warn" ? "#fde68a" : "#cbd5e1",
            }}>
              {a.msg}
              {a.count > 1 && <span style={{ color: "#475569", marginLeft: 4 }}>×{a.count}</span>}
            </p>
            <span style={{ fontSize: 11, color: "#475569" }}>{a.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────── */

/* Agent data for the "all busy" scenario */
const AGENTS_ALL_BUSY = [
  { name: "TARS", role: "PM", emoji: "🍊", heartbeat: "4s", task: "Breaking down epic into subtasks" },
  { name: "Blueprint", role: "Architect", emoji: "🏗️", heartbeat: "26s", task: "Designing auth system architecture" },
  { name: "Sentinel", role: "QA", emoji: "🔍", heartbeat: "28s", task: "Running e2e test suite" },
  { name: "Forge", role: "Dev", emoji: "🔨", heartbeat: "2s", task: "Implement redesigned modals" },
  { name: "Patch", role: "Dev", emoji: "🌟", heartbeat: "30s", task: "Fixing heartbeat format mismatch" },
];

export default function MissionControl() {
  const [activeNav, setActiveNav] = useState("Mission Control");
  const [allBusy, setAllBusy] = useState(false);

  const totalTasks = COLUMNS.reduce((s, c) => s + c.tasks.length, 0);
  const totalP0 = COLUMNS.reduce((s, c) => s + c.tasks.filter(t => t.p === "P0").length, 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c16",
      color: "#e2e8f0",
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        button {
          font-family: inherit;
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 3px;
        }
      `}</style>

      {/* ── Nav ── */}
      <header style={{
        borderBottom: "1px solid rgba(30,41,59,0.7)",
        background: "rgba(8,12,22,0.95)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}>
        <div style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          height: 48
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginRight: 32,
            flexShrink: 0
          }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "linear-gradient(135deg, #3b82f6, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#f1f5f9",
              letterSpacing: "-0.02em"
            }}>Claw Control</span>
            <span style={{ fontSize: 11, color: "#334155", fontWeight: 500 }}>local</span>
          </div>

          <nav style={{ display: "flex", gap: 2, overflowX: "auto" }}>
            {NAV_ITEMS.map(n => (
              <button
                key={n}
                onClick={() => setActiveNav(n)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  border: "none",
                  cursor: "pointer",
                  background: activeNav === n ? "rgba(30,41,59,0.7)" : "transparent",
                  color: activeNav === n ? "#f1f5f9" : "#64748b",
                  transition: "all 0.15s",
                }}
              >{n}</button>
            ))}
          </nav>
        </div>
      </header>

      <div style={{
        maxWidth: 1440,
        margin: "0 auto",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14
      }}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <AgentStrip agents={allBusy ? AGENTS_ALL_BUSY : AGENTS} />
          </div>
          <button
            onClick={() => setAllBusy(!allBusy)}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#94a3b8",
              background: "rgba(30,41,59,0.5)",
              border: "1px solid rgba(51,65,85,0.35)",
              borderRadius: 12,
              padding: "10px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              flexShrink: 0,
              alignSelf: "center",
            }}
          >
            {allBusy ? "⬅ 1 active" : "➡ All active"}
          </button>
        </div>

        {/* Board + Activity */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {/* Board */}
          <div style={{ ...s.panel, flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {/* Board header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 20px",
              borderBottom: "1px solid rgba(30,41,59,0.55)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>Task Board</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#64748b" }}>
                  <span>{totalTasks} tasks</span>
                  <span style={{ color: "#1e293b" }}>·</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f87171", display: "inline-block" }} />
                    <span style={{ color: "#fca5a5" }}>{totalP0} critical</span>
                  </span>
                  <span style={{ color: "#1e293b" }}>·</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: BLOCKED_TASKS.length > 0 ? "#f87171" : "#34d399",
                      display: "inline-block"
                    }} />
                    <span style={{ color: BLOCKED_TASKS.length > 0 ? "#fca5a5" : "#64748b" }}>{BLOCKED_TASKS.length} blocked</span>
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "#334155" }}>1:00 AM</span>
                <button style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#cbd5e1",
                  background: "rgba(30,41,59,0.6)",
                  border: "1px solid rgba(51,65,85,0.4)",
                  borderRadius: 8,
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}>+ New task</button>
              </div>
            </div>

            {/* Blocked bar */}
            <div style={{ padding: "12px 16px 0" }}>
              <BlockedBar />
            </div>

            {/* Columns */}
            <div style={{ display: "flex", gap: 10, padding: "14px 16px", overflowX: "auto" }}>
              {COLUMNS.map(c => <KanbanColumn key={c.id} col={c} />)}
            </div>
          </div>

          {/* Activity sidebar */}
          <div style={{
            ...s.panel,
            width: 270,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 150px)"
          }}>
            <div style={{
              padding: "12px 16px",
              borderBottom: "1px solid rgba(30,41,59,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.06em"
              }}>Activity</span>
              <span style={{ fontSize: 11, color: "#334155" }}>{ACTIVITY.length} events</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <ActivityFeed />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
