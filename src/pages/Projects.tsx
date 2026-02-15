import { useState, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════ */

const PROJECT = {
  name: "Claw Control Center",
  tagline: "Local-first control surface for OpenClaw + projects.",
  status: "active",
  owner: "Logan",
  updated: "32m ago",
  tags: ["local", "operator", "ux"],
  description: "Local-first control surface for OpenClaw + projects.\n\nSuccess looks like: fast orientation, clear feature specs, and smooth execution via Kanban.",
  stats: { open: 5, blocked: 1, done: 12, total: 18 },
};

const FEATURES = [
  { id: "f1", name: "Auth + Identities", desc: "Local auth, sessions, and role-based permissions.", p: "P0", status: "in_progress", progress: 40, owner: "Blueprint",
    acceptanceCriteria: ["Users can log in with a local passcode", "Sessions persist across browser refresh", "Role-based permissions enforced on all API routes", "Agent actions scoped to assigned permissions"],
    aiContext: { source: "TARS", reasoning: "Broke into 3 sub-features based on layered auth pattern: sessions → RBAC → agent scoping.", confidence: 0.87 },
    subFeatures: [
      { id: "sf1", name: "Session Management", status: "in_progress", progress: 75, dependsOn: [],
        tasks: [
          { id: "t-101", title: "Session middleware", tag: "Backend", p: "P0", status: "done", assignee: "Forge", duration: "1h 12m" },
          { id: "t-102", title: "Session persistence SQLite", tag: "Backend", p: "P0", status: "done", assignee: "Forge", duration: "45m" },
          { id: "t-103", title: "Session refresh on activity", tag: "Backend", p: "P1", status: "in_progress", assignee: "Forge" },
          { id: "t-104", title: "Test session expiry edge cases", tag: "QA", p: "P1", status: "queued", assignee: "Sentinel" },
        ]},
      { id: "sf2", name: "Role-Based Access Control", status: "planned", progress: 0, dependsOn: ["sf1"],
        tasks: [
          { id: "t-105", title: "RBAC schema + role definitions", tag: "Arch", p: "P0", status: "queued", assignee: "Blueprint" },
          { id: "t-106", title: "Permission middleware", tag: "Backend", p: "P0", status: "queued" },
          { id: "t-107", title: "Role assignment UI", tag: "UI", p: "P1", status: "queued" },
        ]},
      { id: "sf3", name: "Agent Permission Scoping", status: "planned", progress: 0, dependsOn: ["sf2"],
        tasks: [
          { id: "t-108", title: "Agent permission matrix schema", tag: "Arch", p: "P0", status: "queued", assignee: "Blueprint" },
          { id: "t-109", title: "Tool-level permission checks", tag: "Backend", p: "P0", status: "queued" },
        ]},
    ],
    tasks: [
      { id: "t-101", title: "Session middleware", tag: "Backend", p: "P0", status: "done", assignee: "Forge" },
      { id: "t-102", title: "Session persistence SQLite", tag: "Backend", p: "P0", status: "done", assignee: "Forge" },
      { id: "t-103", title: "Session refresh on activity", tag: "Backend", p: "P1", status: "in_progress", assignee: "Forge" },
      { id: "t-104", title: "Test session expiry edge cases", tag: "QA", p: "P1", status: "queued", assignee: "Sentinel" },
      { id: "t-105", title: "RBAC schema + role definitions", tag: "Arch", p: "P0", status: "queued", assignee: "Blueprint" },
      { id: "t-106", title: "Permission middleware", tag: "Backend", p: "P0", status: "queued" },
      { id: "t-107", title: "Role assignment UI", tag: "UI", p: "P1", status: "queued" },
      { id: "t-108", title: "Agent permission matrix schema", tag: "Arch", p: "P0", status: "queued", assignee: "Blueprint" },
      { id: "t-109", title: "Tool-level permission checks", tag: "Backend", p: "P0", status: "queued" },
    ]},
  { id: "f2", name: "Login / Unlock Flow", desc: "Quick unlock for local instance + optional passcode.", p: "P1", status: "planned", progress: 0, owner: null,
    subFeatures: [], acceptanceCriteria: ["Passcode entry works on all browsers", "Optional biometric unlock"],
    aiContext: { source: "TARS", reasoning: "Simple feature — single sub-feature with 3 tasks.", confidence: 0.92 },
    tasks: [
      { id: "t-201", title: "Passcode input UI", tag: "UI", p: "P1", status: "queued" },
      { id: "t-202", title: "Local auth verification endpoint", tag: "Backend", p: "P1", status: "queued" },
      { id: "t-203", title: "Remember device flow", tag: "Backend", p: "P2", status: "queued" },
    ]},
  { id: "f3", name: "Tool Permissions Matrix", desc: "Allow/deny rules for exec/browser/messaging, etc.", p: "P0", status: "planned", progress: 0, owner: "Blueprint",
    subFeatures: [], acceptanceCriteria: ["Matrix UI shows all tools × roles", "Changes persist immediately"],
    aiContext: { source: "TARS", reasoning: "Depends on RBAC completion. High complexity.", confidence: 0.74 },
    tasks: [
      { id: "t-301", title: "Agent permission matrix schema", tag: "Arch", p: "P0", status: "queued", assignee: "Blueprint" },
      { id: "t-302", title: "Tool-level permission checks", tag: "Backend", p: "P0", status: "queued" },
      { id: "t-303", title: "Permissions matrix UI", tag: "UI", p: "P1", status: "queued" },
      { id: "t-304", title: "E2E: agent blocked by permissions", tag: "QA", p: "P0", status: "queued", assignee: "Sentinel" },
    ]},
  { id: "f4", name: "Projects Hub UX", desc: "Overview / Tree / Kanban with deep feature specs.", p: "P0", status: "in_progress", progress: 65, owner: "Patch",
    subFeatures: [], acceptanceCriteria: ["All 3 views functional", "Feature drill-down works", "Responsive layout"],
    aiContext: { source: "TARS", reasoning: "UI-heavy feature. Parallelizable tasks.", confidence: 0.91 },
    tasks: [
      { id: "t-401", title: "Project overview page", tag: "UI", p: "P0", status: "done", assignee: "Patch" },
      { id: "t-402", title: "Feature detail page", tag: "UI", p: "P0", status: "done", assignee: "Patch" },
      { id: "t-403", title: "Kanban board view", tag: "UI", p: "P0", status: "in_progress", assignee: "Patch" },
      { id: "t-404", title: "Tree / mindmap view", tag: "UI", p: "P1", status: "queued" },
      { id: "t-405", title: "Activity feed component", tag: "UI", p: "P1", status: "done", assignee: "Patch" },
    ]},
  { id: "f5", name: "Project Overview Dashboard", desc: "High-signal project homepage: priorities, links, activity.", p: "P0", status: "planned", progress: 0, owner: null,
    subFeatures: [], acceptanceCriteria: ["Stats visible at a glance", "Feature cards clickable"],
    aiContext: { source: "TARS", reasoning: "Dashboard layout with live stats.", confidence: 0.89 },
    tasks: [
      { id: "t-501", title: "Dashboard layout + stats", tag: "UI", p: "P0", status: "queued" },
      { id: "t-502", title: "Feature progress cards", tag: "UI", p: "P1", status: "queued" },
    ]},
  { id: "f6", name: "Feature Tree Map", desc: "Hierarchy + dependency view with feature spec pages.", p: "P0", status: "planned", progress: 0, owner: null,
    subFeatures: [], acceptanceCriteria: ["React Flow renders all nodes", "Edges show dependencies"],
    aiContext: { source: "TARS", reasoning: "Visualization feature. React Flow integration.", confidence: 0.85 },
    tasks: [
      { id: "t-601", title: "React Flow integration", tag: "UI", p: "P0", status: "queued" },
      { id: "t-602", title: "Dependency edge rendering", tag: "UI", p: "P1", status: "queued" },
    ]},
];

const ACTIVITY = [
  { agent: "Logan", action: 'Moved "Design Settings nav + sections"', to: "In progress", time: "14m ago", type: "move" },
  { agent: "TARS", action: 'Created feature: "Feature tree map"', time: "54m ago", type: "create" },
  { agent: "Forge", action: 'Completed: "Auth session middleware"', time: "1h ago", type: "done" },
  { agent: "Forge", action: 'Completed: "Session persistence SQLite"', time: "2h ago", type: "done" },
  { agent: "Blueprint", action: 'Started: RBAC schema review', time: "3h ago", type: "start" },
  { agent: "Sentinel", action: 'Queued: Test session expiry', time: "3h ago", type: "create" },
];

const NAV_ITEMS = ["Mission Control", "Projects", "Activity", "Kanban", "Recurring", "Integrations", "System", "Config", "Docs"];
const TABS = ["Overview", "Tree", "Kanban"];

/* ═══════════════════════════════════════════════════════
   COLORS & STYLES
   ═══════════════════════════════════════════════════════ */

const PC = {
  P0: { bg: "rgba(239,68,68,0.1)", text: "#fca5a5", border: "rgba(239,68,68,0.2)", dot: "#f87171" },
  P1: { bg: "rgba(245,158,11,0.1)", text: "#fde68a", border: "rgba(245,158,11,0.2)", dot: "#fbbf24" },
  P2: { bg: "rgba(234,179,8,0.1)", text: "#fef08a", border: "rgba(234,179,8,0.2)", dot: "#facc15" },
};
const ST = {
  done: { label: "Done", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  in_progress: { label: "In Progress", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  queued: { label: "Queued", color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  planned: { label: "Planned", color: "#f87171", bg: "rgba(239,68,68,0.08)" },
};
const TAG = {
  Backend: { bg: "rgba(168,85,247,0.12)", text: "#d8b4fe" },
  UI: { bg: "rgba(14,165,233,0.12)", text: "#7dd3fc" },
  QA: { bg: "rgba(16,185,129,0.12)", text: "#6ee7b7" },
  Arch: { bg: "rgba(245,158,11,0.12)", text: "#fcd34d" },
};
const ACTOR = { Forge: "#fb923c", Blueprint: "#60a5fa", Sentinel: "#34d399", TARS: "#fbbf24", Patch: "#f472b6", Logan: "#94a3b8" };
const ACT_ICON = { move: { s: "→", c: "#60a5fa" }, create: { s: "+", c: "#34d399" }, done: { s: "✓", c: "#10b981" }, start: { s: "▶", c: "#fbbf24" } };
const panel = { background: "rgba(15,23,42,0.45)", border: "1px solid rgba(30,41,59,0.55)", borderRadius: 14 };

/* ═══════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════ */

function TaskCard({ task, showFeature, onClickFeature }) {
  const pc = PC[task.p] || PC.P0;
  const tc = TAG[task.tag] || TAG.Backend;
  const isDone = task.status === "done";
  return (
    <div style={{
      background: "rgba(30,41,59,0.45)", border: "1px solid rgba(51,65,85,0.35)",
      borderLeft: `3px solid ${isDone ? "#10b981" : pc.dot}`,
      borderRadius: 8, padding: "10px 12px", cursor: "pointer", transition: "background 0.12s",
      opacity: isDone ? 0.6 : 1,
    }}
    onMouseEnter={e => e.currentTarget.style.background = "rgba(30,41,59,0.65)"}
    onMouseLeave={e => e.currentTarget.style.background = "rgba(30,41,59,0.45)"}
    >
      {showFeature && <div style={{ fontSize: 10, color: "#475569", marginBottom: 3, cursor: "pointer" }} onClick={e => { e.stopPropagation(); onClickFeature?.(); }}>{task.featureName}</div>}
      <p style={{ fontSize: 12.5, color: isDone ? "#64748b" : "#e2e8f0", margin: 0, lineHeight: 1.4, textDecoration: isDone ? "line-through" : "none", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{task.title}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
        <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 6px", borderRadius: 4, background: tc.bg, color: tc.text }}>{task.tag}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: pc.text }}>{task.p}</span>
        {task.assignee && <span style={{ fontSize: 10, color: ACTOR[task.assignee] || "#60a5fa", marginLeft: "auto", fontWeight: 500 }}>{task.assignee}</span>}
      </div>
    </div>
  );
}

function FeatureCard({ feature, onClick }) {
  const pc = PC[feature.p] || PC.P0;
  const st = ST[feature.status] || ST.planned;
  return (
    <div onClick={onClick} style={{
      background: "rgba(30,41,59,0.35)", border: "1px solid rgba(51,65,85,0.3)",
      borderLeft: `3px solid ${feature.status === "in_progress" ? "#3b82f6" : pc.dot}`,
      borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s",
    }}
    onMouseEnter={e => { e.currentTarget.style.background = "rgba(30,41,59,0.55)"; }}
    onMouseLeave={e => { e.currentTarget.style.background = "rgba(30,41,59,0.35)"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>{feature.name}</h3>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`, flexShrink: 0 }}>{feature.p}</span>
      </div>
      <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px", lineHeight: 1.4 }}>{feature.desc}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span>
        {feature.progress > 0 && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(30,41,59,0.6)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2, background: st.color, width: `${feature.progress}%` }} />
            </div>
            <span style={{ fontSize: 10, color: "#475569" }}>{feature.progress}%</span>
          </div>
        )}
        <span style={{ fontSize: 10, color: "#475569", marginLeft: "auto" }}>{feature.tasks.length} tasks</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════ */

function OverviewTab({ onSelectFeature }) {
  const pct = Math.round((PROJECT.stats.done / PROJECT.stats.total) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 0" }}>
      {/* Project header */}
      <div style={{ ...panel, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{PROJECT.name}</h1>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: "rgba(16,185,129,0.12)", color: "#6ee7b7" }}>active</span>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{PROJECT.tagline}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 12, flexWrap: "wrap" }}>
              <span style={{ color: "#94a3b8" }}>Owner: <span style={{ fontWeight: 600 }}>{PROJECT.owner}</span></span>
              <span style={{ color: "#1e293b" }}>·</span>
              {PROJECT.tags.map(t => <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(100,116,139,0.12)", color: "#94a3b8" }}>{t}</span>)}
              <span style={{ color: "#1e293b" }}>·</span>
              <span style={{ color: "#475569" }}>updated {PROJECT.updated}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
            {[{ l: "Open", v: PROJECT.stats.open, c: "#60a5fa" }, { l: "Blocked", v: PROJECT.stats.blocked, c: "#f87171" }, { l: "Done", v: PROJECT.stats.done, c: "#34d399" }].map(s => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
            <div style={{ width: 56, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>{pct}%</div>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(30,41,59,0.6)", marginTop: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #3b82f6, #10b981)", width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features + sidebar */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0, ...panel, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Key Features</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#475569", background: "rgba(30,41,59,0.7)", padding: "2px 8px", borderRadius: 10 }}>{FEATURES.length}</span>
            </div>
            <button style={{ fontSize: 11, fontWeight: 500, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>+ Add Feature</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {FEATURES.map(f => <FeatureCard key={f.id} feature={f} onClick={() => onSelectFeature(f.id)} />)}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: 270, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Description */}
          <div style={{ ...panel, padding: "16px 18px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</span>
            <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6, marginTop: 8, whiteSpace: "pre-wrap" }}>{PROJECT.description}</p>
          </div>
          {/* Activity */}
          <div style={{ ...panel, padding: "16px 18px", maxHeight: 320, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Activity</span>
              <span style={{ fontSize: 11, color: "#334155" }}>{ACTIVITY.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {ACTIVITY.map((a, i) => {
                const ic = ACT_ICON[a.type] || ACT_ICON.create;
                return (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < ACTIVITY.length - 1 ? "1px solid rgba(30,41,59,0.3)" : "none" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: `${ic.c}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: ic.c, fontWeight: 700, flexShrink: 0 }}>{ic.s}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 12, color: "#cbd5e1", margin: 0, lineHeight: 1.4 }}><span style={{ fontWeight: 600, color: ACTOR[a.agent] || "#e2e8f0" }}>{a.agent}</span> · {a.action}{a.to && <span style={{ color: "#60a5fa" }}> → {a.to}</span>}</p>
                      <span style={{ fontSize: 11, color: "#334155" }}>{a.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   KANBAN TAB
   ═══════════════════════════════════════════════════════ */

function KanbanTab({ onSelectFeature }) {
  const allTasks = FEATURES.flatMap(f => f.tasks.map(t => ({ ...t, featureName: f.name, featureId: f.id })));
  const columns = [
    { id: "queued", label: "Queued", accent: "#3b82f6" },
    { id: "in_progress", label: "In Progress", accent: "#8b5cf6" },
    { id: "done", label: "Done", accent: "#10b981" },
  ];

  return (
    <div style={{ display: "flex", gap: 12, padding: "16px 0", minHeight: 480 }}>
      {columns.map(col => {
        const tasks = allTasks.filter(t => t.status === col.id);
        return (
          <div key={col.id} style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 10px", borderBottom: `2px solid ${col.accent}35`, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{col.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", background: "rgba(30,41,59,0.7)", padding: "2px 8px", borderRadius: 10 }}>{tasks.length}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {tasks.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#334155" }}>No tasks</div>}
              {tasks.map(t => <TaskCard key={t.id} task={t} showFeature onClickFeature={() => onSelectFeature(t.featureId)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TREE / MINDMAP TAB
   ═══════════════════════════════════════════════════════ */

function TreeTab({ onSelectFeature }) {
  const [expanded, setExpanded] = useState(new Set(["f1", "f4"]));
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const toggleExpand = (id) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const handleWheel = useCallback(e => { e.preventDefault(); setZoom(z => Math.max(0.3, Math.min(1.5, z - e.deltaY * 0.001))); }, []);
  const handleDown = useCallback(e => { if (e.target.closest("[data-node]")) return; setDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); }, [pan]);
  const handleMove = useCallback(e => { if (!dragging) return; setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }, [dragging, dragStart]);
  const handleUp = useCallback(() => setDragging(false), []);

  const layout = useMemo(() => {
    const nodes = [];
    const edges = [];
    nodes.push({ id: "root", x: 0, y: 0, type: "root" });

    const spacing = 130;
    const startY = -(FEATURES.length - 1) * spacing / 2;

    FEATURES.forEach((f, fi) => {
      const fx = 280;
      const fy = startY + fi * spacing;
      const st = ST[f.status] || ST.queued;
      nodes.push({ id: f.id, x: fx, y: fy, type: "feature", data: f });
      edges.push({ from: "root", to: f.id, color: st.color });

      if (expanded.has(f.id)) {
        const ts = 48;
        const sy = fy - (f.tasks.length - 1) * ts / 2;
        f.tasks.forEach((t, ti) => {
          nodes.push({ id: t.id, x: fx + 250, y: sy + ti * ts, type: "task", data: t });
          edges.push({ from: f.id, to: t.id, color: `${(ST[t.status] || ST.queued).color}50` });
        });
      }
    });
    return { nodes, edges };
  }, [expanded]);

  const xs = layout.nodes.map(n => n.x);
  const ys = layout.nodes.map(n => n.y);
  const minX = Math.min(...xs) - 120, maxX = Math.max(...xs) + 220;
  const minY = Math.min(...ys) - 60, maxY = Math.max(...ys) + 60;

  return (
    <div style={{ position: "relative", height: 560, overflow: "hidden", borderRadius: 12 }}>
      {/* Controls */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", gap: 4 }}>
        {[{ l: "+", fn: () => setZoom(z => Math.min(1.5, z + 0.15)) }, { l: "−", fn: () => setZoom(z => Math.max(0.3, z - 0.15)) }].map(b => (
          <button key={b.l} onClick={b.fn} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(51,65,85,0.4)", background: "rgba(15,23,42,0.8)", color: "#94a3b8", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{b.l}</button>
        ))}
        <button onClick={() => { setZoom(0.85); setPan({ x: 0, y: 0 }); }} style={{ height: 30, borderRadius: 8, border: "1px solid rgba(51,65,85,0.4)", background: "rgba(15,23,42,0.8)", color: "#64748b", fontSize: 11, padding: "0 10px", cursor: "pointer", fontFamily: "inherit" }}>Reset</button>
        <button onClick={() => setExpanded(new Set(FEATURES.map(f => f.id)))} style={{ height: 30, borderRadius: 8, border: "1px solid rgba(51,65,85,0.4)", background: "rgba(15,23,42,0.8)", color: "#64748b", fontSize: 11, padding: "0 10px", cursor: "pointer", fontFamily: "inherit" }}>Expand all</button>
        <button onClick={() => setExpanded(new Set())} style={{ height: 30, borderRadius: 8, border: "1px solid rgba(51,65,85,0.4)", background: "rgba(15,23,42,0.8)", color: "#64748b", fontSize: 11, padding: "0 10px", cursor: "pointer", fontFamily: "inherit" }}>Collapse</button>
      </div>
      <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 10, fontSize: 10, color: "#334155" }}>{Math.round(zoom * 100)}% · drag to pan · click features to expand</div>

      <div onWheel={handleWheel} onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp} style={{ width: "100%", height: "100%", cursor: dragging ? "grabbing" : "grab", background: "radial-gradient(circle at 50% 50%, rgba(15,23,42,0.6) 0%, #080c16 100%)", position: "relative" }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}><pattern id="g" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="0.5" fill="#1e293b" /></pattern><rect width="100%" height="100%" fill="url(#g)" /></svg>

        <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", transition: dragging ? "none" : "transform 0.1s" }}>
          {/* Edges */}
          <svg style={{ position: "absolute", left: minX, top: minY, width: maxX - minX, height: maxY - minY, pointerEvents: "none", overflow: "visible" }}>
            {layout.edges.map((e, i) => {
              const f = layout.nodes.find(n => n.id === e.from);
              const t = layout.nodes.find(n => n.id === e.to);
              if (!f || !t) return null;
              const x1 = f.x - minX + (f.type === "root" ? 90 : 100);
              const y1 = f.y - minY;
              const x2 = t.x - minX;
              const y2 = t.y - minY;
              const mx = (x1 + x2) / 2;
              return <path key={i} d={`M${x1} ${y1} C${mx} ${y1},${mx} ${y2},${x2} ${y2}`} fill="none" stroke={e.color} strokeWidth={f.type === "root" ? 2 : 1} strokeDasharray={t.type === "task" ? "4 3" : "none"} opacity={0.6} />;
            })}
          </svg>

          {/* Nodes */}
          {layout.nodes.map(node => {
            if (node.type === "root") return (
              <div key={node.id} style={{ position: "absolute", left: node.x, top: node.y, transform: "translate(0,-50%)", zIndex: 3 }}>
                <div style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 14, padding: "14px 20px", textAlign: "center", minWidth: 180 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{PROJECT.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{FEATURES.length} features</div>
                </div>
              </div>
            );
            if (node.type === "feature") {
              const f = node.data;
              const st = ST[f.status] || ST.queued;
              const pc = PC[f.p] || PC.P0;
              return (
                <div key={node.id} data-node="true" style={{ position: "absolute", left: node.x, top: node.y, transform: "translate(0,-50%)", cursor: "pointer", zIndex: 2 }}
                  onClick={() => toggleExpand(f.id)} onDoubleClick={() => onSelectFeature(f.id)}
                >
                  <div style={{ background: "rgba(30,41,59,0.5)", border: `1px solid ${st.color}30`, borderLeft: `3px solid ${st.color}`, borderRadius: 10, padding: "10px 14px", minWidth: 160, maxWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{f.name}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: pc.bg, color: pc.text, marginLeft: "auto" }}>{f.p}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span>
                      <span style={{ fontSize: 10, color: "#475569" }}>{f.tasks.length} tasks</span>
                    </div>
                  </div>
                  <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, borderRadius: 4, background: "rgba(30,41,59,0.8)", border: "1px solid rgba(51,65,85,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#64748b" }}>{expanded.has(f.id) ? "−" : "+"}</div>
                </div>
              );
            }
            // task
            const t = node.data;
            const tc = TAG[t.tag] || TAG.Backend;
            const tst = ST[t.status] || ST.queued;
            const isDone = t.status === "done";
            return (
              <div key={node.id} data-node="true" style={{ position: "absolute", left: node.x, top: node.y, transform: "translate(0,-50%)", zIndex: 1 }}>
                <div style={{ background: "rgba(30,41,59,0.35)", border: "1px solid rgba(51,65,85,0.3)", borderRadius: 8, padding: "6px 10px", minWidth: 130, maxWidth: 170, opacity: isDone ? 0.5 : 1 }}>
                  <p style={{ fontSize: 11, color: isDone ? "#64748b" : "#cbd5e1", margin: 0, lineHeight: 1.3, textDecoration: isDone ? "line-through" : "none", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.title}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: tc.bg, color: tc.text }}>{t.tag}</span>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: tst.color }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   FEATURE DETAIL VIEW
   ═══════════════════════════════════════════════════════ */

function FeatureDetailView({ featureId, onBack }) {
  const feature = FEATURES.find(f => f.id === featureId);
  if (!feature) return null;

  const [openSf, setOpenSf] = useState(new Set(feature.subFeatures?.length ? [feature.subFeatures[0].id] : []));
  const [showReasoning, setShowReasoning] = useState(false);

  const st = ST[feature.status] || ST.planned;
  const pc = PC[feature.p] || PC.P0;
  const totalTasks = feature.tasks.length;
  const doneTasks = feature.tasks.filter(t => t.status === "done").length;
  const ai = feature.aiContext;
  const confColor = ai.confidence >= 0.8 ? "#34d399" : ai.confidence >= 0.6 ? "#fbbf24" : "#f87171";

  const toggleSf = id => setOpenSf(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const subFeatures = feature.subFeatures?.length ? feature.subFeatures : [{ id: "all", name: "All Tasks", status: feature.status, progress: feature.progress, dependsOn: [], tasks: feature.tasks }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 0" }}>
      {/* Breadcrumb + back */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <span onClick={onBack} style={{ color: "#475569", cursor: "pointer" }}>← Back</span>
        <span style={{ color: "#1e293b" }}>/</span>
        <span style={{ color: "#475569", cursor: "pointer" }} onClick={onBack}>Key Features</span>
        <span style={{ color: "#1e293b" }}>/</span>
        <span style={{ color: "#94a3b8" }}>{feature.name}</span>
      </div>

      {/* Header */}
      <div style={{ ...panel, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{feature.name}</h1>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>{feature.p}</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: st.bg, color: st.color }}>{st.label}</span>
            </div>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>{feature.desc}</p>
            {feature.owner && <div style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>Owner: <span style={{ color: ACTOR[feature.owner] || "#94a3b8", fontWeight: 600 }}>{feature.owner}</span></div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>{doneTasks}/{totalTasks}</div>
              <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>tasks</div>
            </div>
            <div style={{ width: 50, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: st.color }}>{feature.progress}%</div>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(30,41,59,0.6)", marginTop: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, background: st.color, width: `${feature.progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* AI context */}
          <div style={{ ...panel, padding: "14px 18px", borderColor: "rgba(139,92,246,0.12)", background: "linear-gradient(135deg, rgba(139,92,246,0.03) 0%, rgba(15,23,42,0.45) 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#c084fc" }}>✦</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#c084fc", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Breakdown</span>
                <span style={{ fontSize: 11, color: "#475569" }}>by <span style={{ color: ACTOR[ai.source], fontWeight: 600 }}>{ai.source}</span></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "#475569" }}>Confidence: <span style={{ color: confColor, fontWeight: 700 }}>{Math.round(ai.confidence * 100)}%</span></span>
                <button onClick={() => setShowReasoning(!showReasoning)} style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>{showReasoning ? "Hide" : "Why?"}</button>
              </div>
            </div>
            {showReasoning && (
              <div style={{ marginTop: 10, background: "rgba(30,41,59,0.35)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                {ai.reasoning}
                <div style={{ marginTop: 8 }}><button style={{ fontSize: 11, color: "#64748b", background: "rgba(30,41,59,0.5)", border: "1px solid rgba(51,65,85,0.3)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>↻ Regenerate</button></div>
              </div>
            )}
          </div>

          {/* Sub-features / tasks */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{feature.subFeatures?.length ? "Sub-Features & Tasks" : "Tasks"}</span>
          </div>

          {subFeatures.map(sf => {
            const sst = ST[sf.status] || ST.queued;
            const isOpen = openSf.has(sf.id);
            const sDone = sf.tasks.filter(t => t.status === "done").length;
            return (
              <div key={sf.id} style={{ ...panel, overflow: "hidden", borderLeft: `3px solid ${sf.status === "in_progress" ? "#3b82f6" : sf.status === "done" ? "#10b981" : "#1e293b"}` }}>
                <div onClick={() => toggleSf(sf.id)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                  <span style={{ fontSize: 10, color: "#475569", transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0)", display: "inline-block" }}>▶</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", flex: 1 }}>{sf.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: sst.bg, color: sst.color }}>{sst.label}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{sDone}/{sf.tasks.length}</span>
                  <div style={{ width: 50, height: 3, borderRadius: 2, background: "rgba(30,41,59,0.6)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 2, background: sst.color, width: sf.tasks.length > 0 ? `${(sDone / sf.tasks.length) * 100}%` : "0%" }} />
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderTop: "1px solid rgba(30,41,59,0.4)" }}>
                    {sf.tasks.map(task => {
                      const tst = ST[task.status] || ST.queued;
                      const tpc = PC[task.p] || PC.P0;
                      const ttc = TAG[task.tag] || TAG.Backend;
                      const isDone = task.status === "done";
                      return (
                        <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 0, padding: "9px 16px 9px 42px", borderTop: "1px solid rgba(30,41,59,0.2)", cursor: "pointer", transition: "background 0.1s", opacity: isDone ? 0.55 : 1 }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(30,41,59,0.2)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginRight: 8, background: tst.bg, border: isDone ? "none" : `1px solid ${tst.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: tst.color, fontWeight: 700 }}>{isDone ? "✓" : tst.label === "In Progress" ? "◉" : "○"}</div>
                          <span style={{ flex: 1, fontSize: 12.5, color: isDone ? "#64748b" : "#e2e8f0", textDecoration: isDone ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
                          <span style={{ width: 55, textAlign: "center", fontSize: 10, padding: "2px 6px", borderRadius: 4, background: ttc.bg, color: ttc.text }}>{task.tag}</span>
                          <span style={{ width: 30, textAlign: "center", fontSize: 10, fontWeight: 700, color: tpc.text }}>{task.p}</span>
                          <span style={{ width: 70, textAlign: "center", fontSize: 10, fontWeight: 600, color: tst.color }}>{tst.label}</span>
                          <span style={{ width: 65, textAlign: "right", fontSize: 11, fontWeight: 500, color: task.assignee ? (ACTOR[task.assignee] || "#94a3b8") : "#334155" }}>{task.assignee || "—"}</span>
                        </div>
                      );
                    })}
                    <div style={{ padding: "6px 16px 8px 42px" }}>
                      <button style={{ fontSize: 11, color: "#475569", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>+ Add task</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar */}
        <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Acceptance Criteria */}
          <div style={{ ...panel, padding: "14px 16px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Acceptance Criteria</span>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {(feature.acceptanceCriteria || []).map((c, i) => {
                const done = i < doneTasks && i < 2;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0" }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1, background: done ? "rgba(16,185,129,0.15)" : "rgba(30,41,59,0.4)", border: done ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(51,65,85,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: done ? "#34d399" : "transparent", cursor: "pointer" }}>{done ? "✓" : ""}</div>
                    <span style={{ fontSize: 12, color: done ? "#64748b" : "#cbd5e1", lineHeight: 1.4, textDecoration: done ? "line-through" : "none" }}>{c}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Links */}
          <div style={{ ...panel, padding: "14px 16px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick Links</span>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {["Design Doc", "API Spec", "GitHub Issue"].map(l => (
                <a key={l} href="#" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: "rgba(30,41,59,0.3)", border: "1px solid rgba(51,65,85,0.25)", color: "#94a3b8", fontSize: 12, textDecoration: "none" }}>
                  {l} <span style={{ marginLeft: "auto", fontSize: 10, color: "#334155" }}>↗</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════ */

export default function ProjectsApp() {
  const [activeNav, setActiveNav] = useState("Projects");
  const [activeTab, setActiveTab] = useState("Overview");
  const [selectedFeature, setSelectedFeature] = useState(null);

  const totalTasks = FEATURES.reduce((s, f) => s + f.tasks.length, 0);
  const doneTasks = FEATURES.reduce((s, f) => s + f.tasks.filter(t => t.status === "done").length, 0);

  const handleSelectFeature = (id) => { setSelectedFeature(id); };
  const handleBack = () => { setSelectedFeature(null); };

  return (
    <div style={{ minHeight: "100vh", background: "#080c16", color: "#e2e8f0", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: inherit; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
      `}</style>

      {/* Nav */}
      <header style={{ borderBottom: "1px solid rgba(30,41,59,0.7)", background: "rgba(8,12,22,0.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", height: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 32, flexShrink: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg, #3b82f6, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Claw Control</span>
          </div>
          <nav style={{ display: "flex", gap: 2 }}>
            {NAV_ITEMS.map(n => (
              <button key={n} onClick={() => setActiveNav(n)} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", whiteSpace: "nowrap", background: activeNav === n ? "rgba(30,41,59,0.7)" : "transparent", color: activeNav === n ? "#f1f5f9" : "#64748b", transition: "all 0.15s" }}>{n}</button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 20px" }}>
        {/* Project bar + tabs */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: 0, cursor: selectedFeature ? "pointer" : "default" }} onClick={handleBack}>{PROJECT.name}</h1>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: "rgba(16,185,129,0.12)", color: "#6ee7b7" }}>active</span>
            <span style={{ fontSize: 12, color: "#475569" }}>{FEATURES.length} features · {totalTasks} tasks · {doneTasks} done</span>
          </div>
          {!selectedFeature && (
            <div style={{ display: "flex", gap: 2 }}>
              {TABS.map(t => (
                <button key={t} onClick={() => setActiveTab(t)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: activeTab === t ? "rgba(30,41,59,0.6)" : "transparent", color: activeTab === t ? "#f1f5f9" : "#475569", transition: "all 0.15s" }}>{t}</button>
              ))}
            </div>
          )}
        </div>

        {/* Views */}
        <div style={{ ...panel, padding: selectedFeature ? "0 16px" : activeTab === "Tree" ? 0 : "0 16px", overflow: "hidden" }}>
          {selectedFeature ? (
            <FeatureDetailView featureId={selectedFeature} onBack={handleBack} />
          ) : activeTab === "Overview" ? (
            <OverviewTab onSelectFeature={handleSelectFeature} />
          ) : activeTab === "Kanban" ? (
            <KanbanTab onSelectFeature={handleSelectFeature} />
          ) : (
            <TreeTab onSelectFeature={handleSelectFeature} />
          )}
        </div>
      </div>
    </div>
  );
}
