import { useState, useMemo } from "react";

/* ── Data ─────────────────────────────────────────────── */
const RAW_EVENTS = [
  { id: 1, source: "tasks", type: "task.assigned", actor: "Patch", severity: "Low", time: "4:40 AM", msg: "Redesign LaneOverflowModal with search, sort, and priority summary → Patch", category: "task" },
  { id: 2, source: "tasks", type: "task.created", actor: "Patch", severity: "Low", time: "4:40 AM", msg: "Redesign LaneOverflowModal with search, sort, and priority summary", category: "task" },
  { id: 3, source: "tasks", type: "task.completed", actor: "Patch", severity: "Low", time: "4:40 AM", msg: "Agent Heartbeat Test – Query Parameter Verification · Patch · took 40m 49s", category: "task" },
  { id: 4, source: "tasks", type: "task.assigned", actor: "Forge", severity: "Low", time: "4:40 AM", msg: "Implement redesigned TaskModal component following UI/UX guide → Forge", category: "task" },
  { id: 5, source: "tasks", type: "task.created", actor: "Forge", severity: "Low", time: "4:40 AM", msg: "Implement redesigned TaskModal component following UI/UX guide", category: "task" },
  { id: 6, source: "tasks", type: "task.created", actor: "Blueprint", severity: "Low", time: "4:15 AM", msg: "P0 Epic: Projects backend (bridge persistence + APIs)", category: "task" },
  { id: 7, source: "tasks", type: "task.assigned", actor: "Blueprint", severity: "Low", time: "4:15 AM", msg: "P0 Epic: Projects backend (bridge persistence + APIs) → Blueprint", category: "task" },
  { id: 8, source: "tasks", type: "task.created", actor: "Patch", severity: "Low", time: "4:00 AM", msg: "Agent Heartbeat Test – Query Parameter Verification", category: "task" },
  { id: 9, source: "tasks", type: "task.assigned", actor: "Patch", severity: "Low", time: "4:00 AM", msg: "Agent Heartbeat Test – Query Parameter Verification → Patch", category: "task" },
  { id: 10, source: "operator-hub", type: "system", actor: "system", severity: "Low", time: "4:00 AM", msg: "bridge started on :8787", category: "system" },
  { id: 11, source: "tasks", type: "task.assigned", actor: "Patch", severity: "Low", time: "3:54 AM", msg: "Agent Heartbeat Test – Query Parameter Verification → Patch", category: "task" },
  { id: 12, source: "tasks", type: "task.created", actor: "Patch", severity: "Low", time: "3:54 AM", msg: "Agent Heartbeat Test – Query Parameter Verification", category: "task" },
  { id: 13, source: "operator-hub", type: "system", actor: "system", severity: "Low", time: "3:54 AM", msg: "bridge started on :8787", category: "system" },
  { id: 14, source: "tasks", type: "task.assigned", actor: "Patch", severity: "Low", time: "3:45 AM", msg: "Agent Heartbeat Test – Query Parameter Verification → Patch", category: "task" },
  { id: 15, source: "tasks", type: "task.created", actor: "Patch", severity: "Low", time: "3:45 AM", msg: "Agent Heartbeat Test – Query Parameter Verification", category: "task" },
  { id: 16, source: "operator-hub", type: "system", actor: "system", severity: "Low", time: "3:45 AM", msg: "bridge started on :8787", category: "system" },
  { id: 17, source: "tasks", type: "task.assigned", actor: "Patch", severity: "Low", time: "3:19 AM", msg: "Agent Heartbeat Test – Query Parameter Verification → Patch", category: "task" },
  { id: 18, source: "tasks", type: "task.created", actor: "Patch", severity: "Low", time: "3:19 AM", msg: "Agent Heartbeat Test – Query Parameter Verification", category: "task" },
  { id: 19, source: "operator-hub", type: "system", actor: "system", severity: "Low", time: "3:19 AM", msg: "bridge started on :8787", category: "system" },
  { id: 20, source: "tasks", type: "task.assigned", actor: "Patch", severity: "Low", time: "3:03 AM", msg: "Agent Heartbeat Test – Query Parameter Verification → Patch", category: "task" },
  { id: 21, source: "tasks", type: "task.created", actor: "Patch", severity: "Low", time: "3:03 AM", msg: "Agent Heartbeat Test – Query Parameter Verification", category: "task" },
  { id: 22, source: "operator-hub", type: "system", actor: "system", severity: "Low", time: "3:03 AM", msg: "bridge started on :8787", category: "system" },
  { id: 23, source: "tasks", type: "task.completed", actor: "Forge", severity: "Low", time: "2:51 AM", msg: "Auth session middleware · Forge · took 1h 12m", category: "task" },
  { id: 24, source: "tasks", type: "task.assigned", actor: "Sentinel", severity: "Low", time: "2:30 AM", msg: "Test epic subtask viewing flow → Sentinel", category: "task" },
  { id: 25, source: "gateway", type: "system.warning", actor: "system", severity: "Medium", time: "2:15 AM", msg: "gateway: down → warn (probe ok, runtime unknown)", category: "system" },
];

const NAV_ITEMS = ["Mission Control", "Projects", "Activity", "Kanban", "Recurring", "Integrations", "System", "Config", "Docs"];

/* ── Colors ───────────────────────────────────────────── */
const TYPE_CONFIG = {
  "task.created": { label: "Created", icon: "+", color: "#34d399", bg: "rgba(16,185,129,0.1)" },
  "task.assigned": { label: "Assigned", icon: "→", color: "#60a5fa", bg: "rgba(59,130,246,0.1)" },
  "task.completed": { label: "Completed", icon: "✓", color: "#a78bfa", bg: "rgba(139,92,246,0.1)" },
  "system": { label: "System", icon: "⚙", color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  "system.warning": { label: "Warning", icon: "⚠", color: "#fbbf24", bg: "rgba(245,158,11,0.08)" },
};

const ACTOR_COLORS = {
  Patch: "#f472b6",
  Forge: "#fb923c",
  Blueprint: "#60a5fa",
  Sentinel: "#34d399",
  TARS: "#fbbf24",
  system: "#475569",
};

const SEVERITY_CONFIG = {
  Low: { color: "#475569" },
  Medium: { color: "#fbbf24" },
  High: { color: "#f87171" },
};

/* ── Helpers ──────────────────────────────────────────── */
function groupConsecutiveDupes(events) {
  const result = [];
  let i = 0;
  while (i < events.length) {
    const current = events[i];
    let count = 1;
    while (
      i + count < events.length &&
      events[i + count].msg === current.msg &&
      events[i + count].type === current.type &&
      events[i + count].actor === current.actor
    ) {
      count++;
    }
    result.push({ ...current, repeatCount: count, lastTime: events[i + count - 1].time });
    i += count;
  }
  return result;
}

/* ── Components ───────────────────────────────────────── */
function FilterBar({ filters, setFilters, counts, search, setSearch }) {
  const filterGroups = [
    {
      key: "category",
      label: "Source",
      options: [
        { value: "all", label: "All" },
        { value: "task", label: `Tasks (${counts.task})` },
        { value: "system", label: `System (${counts.system})` },
      ],
    },
    {
      key: "actor",
      label: "Actor",
      options: [
        { value: "all", label: "All" },
        ...Object.keys(ACTOR_COLORS).filter(a => a !== "system").map(a => ({ value: a, label: a })),
      ],
    },
    {
      key: "type",
      label: "Type",
      options: [
        { value: "all", label: "All" },
        { value: "task.created", label: "Created" },
        { value: "task.assigned", label: "Assigned" },
        { value: "task.completed", label: "Completed" },
        { value: "system", label: "System" },
        { value: "system.warning", label: "Warnings" },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      {filterGroups.map(group => (
        <div key={group.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>{group.label}</span>
          <div style={{ display: "flex", gap: 2 }}>
            {group.options.map(opt => {
              const active = filters[group.key] === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setFilters({ ...filters, [group.key]: opt.value })}
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.12s",
                    background: active ? "rgba(59,130,246,0.12)" : "transparent",
                    color: active ? "#93c5fd" : "#475569",
                  }}>{opt.label}</button>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ marginLeft: "auto", position: "relative" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search events..."
          style={{
            width: 200,
            background: "rgba(30,41,59,0.4)",
            border: "1px solid rgba(51,65,85,0.3)",
            borderRadius: 8,
            padding: "6px 12px 6px 30px",
            fontSize: 12,
            color: "#e2e8f0",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#334155" }}>🔍</span>
      </div>
    </div>
  );
}

function EventRow({ event, expanded, onToggle }) {
  const tc = TYPE_CONFIG[event.type] || TYPE_CONFIG.system;
  const actorColor = ACTOR_COLORS[event.actor] || "#64748b";
  const isRepeat = event.repeatCount > 1;
  const isWarning = event.type === "system.warning";

  return (
    <div
      style={{
        borderBottom: "1px solid rgba(30,41,59,0.35)",
        background: isWarning ? "rgba(245,158,11,0.03)" : "transparent",
        transition: "background 0.12s",
      }}
      onMouseEnter={e => { if (!isWarning) e.currentTarget.style.background = "rgba(30,41,59,0.2)"; }}
      onMouseLeave={e => { if (!isWarning) e.currentTarget.style.background = "transparent"; }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "10px 20px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {/* Icon */}
        <div style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          flexShrink: 0,
          marginRight: 12,
          background: tc.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: tc.color,
        }}>{tc.icon}</div>

        {/* Type badge */}
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: 4,
          flexShrink: 0,
          marginRight: 10,
          background: tc.bg,
          color: tc.color,
          minWidth: 60,
          textAlign: "center",
        }}>{tc.label}</span>

        {/* Actor */}
        {event.actor !== "system" && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: actorColor,
            flexShrink: 0,
            marginRight: 10,
            minWidth: 70,
          }}>{event.actor}</span>
        )}

        {/* Message */}
        <span style={{
          fontSize: 12,
          color: isWarning ? "#fde68a" : "#cbd5e1",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{event.msg}</span>

        {/* Repeat badge */}
        {isRepeat && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 10,
            flexShrink: 0,
            marginLeft: 8,
            background: "rgba(100,116,139,0.15)",
            color: "#64748b",
          }}>×{event.repeatCount}</span>
        )}

        {/* Time */}
        <span style={{
          fontSize: 11,
          color: "#334155",
          flexShrink: 0,
          marginLeft: 12,
          minWidth: 60,
          textAlign: "right"
        }}>
          {event.time}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 20px 14px 58px", animation: "fadeIn 0.12s ease-out" }}>
          <div style={{
            background: "rgba(30,41,59,0.35)",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 12,
            lineHeight: 1.6,
          }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ color: "#475569" }}>Source: <span style={{ color: "#94a3b8" }}>{event.source}</span></span>
              <span style={{ color: "#475569" }}>Type: <span style={{ color: "#94a3b8" }}>{event.type}</span></span>
              <span style={{ color: "#475569" }}>Severity: <span style={{ color: SEVERITY_CONFIG[event.severity]?.color || "#475569" }}>{event.severity}</span></span>
              {isRepeat && <span style={{ color: "#475569" }}>Occurrences: <span style={{ color: "#94a3b8" }}>{event.repeatCount} ({event.lastTime} – {event.time})</span></span>}
            </div>
            <p style={{ color: "#94a3b8", margin: 0, wordBreak: "break-word" }}>{event.msg}</p>
            <button style={{
              marginTop: 8,
              fontSize: 11,
              fontWeight: 500,
              color: "#475569",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
            }}>Copy JSON</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsBar({ events, filtered }) {
  const types = {};
  filtered.forEach(e => {
    const label = TYPE_CONFIG[e.type]?.label || "Other";
    types[label] = (types[label] || 0) + (e.repeatCount || 1);
  });

  const totalRaw = filtered.reduce((s, e) => s + (e.repeatCount || 1), 0);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "10px 20px",
      borderBottom: "1px solid rgba(30,41,59,0.4)",
      background: "rgba(15,23,42,0.3)",
    }}>
      <span style={{ fontSize: 12, color: "#64748b" }}>
        <span style={{ color: "#94a3b8", fontWeight: 600 }}>{filtered.length}</span> groups
        <span style={{ color: "#334155", margin: "0 6px" }}>·</span>
        <span style={{ color: "#94a3b8", fontWeight: 600 }}>{totalRaw}</span> total events
      </span>
      <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
        {Object.entries(types).map(([label, count]) => {
          const tc = Object.values(TYPE_CONFIG).find(t => t.label === label) || TYPE_CONFIG.system;
          return (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: tc.color, display: "inline-block" }} />
              <span style={{ color: "#64748b" }}>{count} {label.toLowerCase()}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────── */
export default function ActivityPage() {
  const [activeNav, setActiveNav] = useState("Activity");
  const [filters, setFilters] = useState({ category: "all", actor: "all", type: "all" });
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [groupDupes, setGroupDupes] = useState(true);

  const counts = useMemo(() => ({
    task: RAW_EVENTS.filter(e => e.category === "task").length,
    system: RAW_EVENTS.filter(e => e.category === "system").length,
  }), []);

  const filtered = useMemo(() => {
    let result = RAW_EVENTS;
    if (filters.category !== "all") result = result.filter(e => e.category === filters.category);
    if (filters.actor !== "all") result = result.filter(e => e.actor === filters.actor);
    if (filters.type !== "all") result = result.filter(e => e.type === filters.type);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.msg.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q));
    }
    if (groupDupes) result = groupConsecutiveDupes(result);
    return result;
  }, [filters, search, groupDupes]);

  return (
    <div style={{ minHeight: "100vh", background: "#080c16", color: "#e2e8f0", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: inherit; }
        input::placeholder { color: #334155; }
        input:focus { border-color: rgba(59,130,246,0.35) !important; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
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
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", height: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 32, flexShrink: 0 }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "linear-gradient(135deg, #3b82f6, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Claw Control</span>
          </div>
          <nav style={{ display: "flex", gap: 2 }}>
            {NAV_ITEMS.map(n => (
              <button
                key={n}
                onClick={() => setActiveNav(n)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  background: activeNav === n ? "rgba(30,41,59,0.7)" : "transparent",
                  color: activeNav === n ? "#f1f5f9" : "#64748b",
                  transition: "all 0.15s",
                }}>{n}</button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Activity</h1>
            <span style={{ fontSize: 11, color: "#334155" }}>poll: 5s</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setGroupDupes(!groupDupes)}
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid rgba(51,65,85,0.3)",
                cursor: "pointer",
                fontFamily: "inherit",
                background: groupDupes ? "rgba(59,130,246,0.1)" : "rgba(30,41,59,0.3)",
                color: groupDupes ? "#93c5fd" : "#475569",
                transition: "all 0.12s",
              }}>{groupDupes ? "✓ " : ""}Group duplicates</button>
            <span style={{ fontSize: 11, color: "#334155" }}>last ok: 4:43 AM</span>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{
          background: "rgba(15,23,42,0.45)",
          border: "1px solid rgba(30,41,59,0.55)",
          borderRadius: "14px 14px 0 0",
          padding: "14px 20px",
          borderBottom: "none",
        }}>
          <FilterBar filters={filters} setFilters={setFilters} counts={counts} search={search} setSearch={setSearch} />
        </div>

        {/* Stats bar */}
        <div style={{
          background: "rgba(15,23,42,0.45)",
          border: "1px solid rgba(30,41,59,0.55)",
          borderTop: "1px solid rgba(30,41,59,0.4)",
        }}>
          <StatsBar events={RAW_EVENTS} filtered={filtered} />
        </div>

        {/* Event list */}
        <div style={{
          background: "rgba(15,23,42,0.45)",
          border: "1px solid rgba(30,41,59,0.55)",
          borderTop: "none",
          borderRadius: "0 0 14px 14px",
          overflow: "hidden",
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <span style={{ fontSize: 13, color: "#334155" }}>No events match your filters</span>
            </div>
          ) : (
            filtered.map(e => (
              <EventRow
                key={e.id}
                event={e}
                expanded={expandedId === e.id}
                onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
