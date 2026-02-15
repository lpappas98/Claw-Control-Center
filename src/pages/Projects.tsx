import { useState, useEffect, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════ */

interface Project {
  id: string; name: string; tagline?: string; status: string;
  owner?: string; tags?: string[]; description?: string;
  updatedAt?: string; links?: { label: string; url: string; icon?: string }[];
}

interface Aspect {
  id: string; projectId: string; name: string; desc?: string;
  priority?: string; status?: string; progress?: number;
}

interface Task {
  id: string; title: string; lane: string; priority?: string;
  owner?: string; project?: string; aspect?: string;
  problem?: string; scope?: string; acceptanceCriteria?: string[];
  createdAt?: string; updatedAt?: string;
  statusHistory?: { at: string; from?: string; to: string; note?: string }[];
}

interface ActivityEvent {
  id?: string; message: string; createdAt: string;
  meta?: { worker?: string; actor?: string; eventType?: string };
}

/* ═══════════════════════════════════════════════════════
   COLORS & STYLES
   ═══════════════════════════════════════════════════════ */

const PC: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  P0: { bg: "rgba(239,68,68,0.1)", text: "#fca5a5", border: "rgba(239,68,68,0.2)", dot: "#f87171" },
  P1: { bg: "rgba(245,158,11,0.1)", text: "#fde68a", border: "rgba(245,158,11,0.2)", dot: "#fbbf24" },
  P2: { bg: "rgba(234,179,8,0.1)", text: "#fef08a", border: "rgba(234,179,8,0.2)", dot: "#facc15" },
  P3: { bg: "rgba(100,116,139,0.1)", text: "#cbd5e1", border: "rgba(100,116,139,0.2)", dot: "#94a3b8" },
};

const ST: Record<string, { label: string; color: string; bg: string }> = {
  done: { label: "Done", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  in_progress: { label: "In Progress", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  development: { label: "In Progress", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  review: { label: "Review", color: "#c084fc", bg: "rgba(192,132,252,0.1)" },
  queued: { label: "Queued", color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  planned: { label: "Planned", color: "#f87171", bg: "rgba(239,68,68,0.08)" },
  proposed: { label: "Proposed", color: "#94a3b8", bg: "rgba(100,116,139,0.08)" },
  blocked: { label: "Blocked", color: "#f87171", bg: "rgba(239,68,68,0.1)" },
};

const ACTOR: Record<string, string> = {
  "dev-1": "#fb923c", "dev-2": "#f472b6", qa: "#34d399",
  pm: "#fbbf24", architect: "#60a5fa", Forge: "#fb923c",
  Patch: "#f472b6", Sentinel: "#34d399", TARS: "#fbbf24",
  Blueprint: "#60a5fa", Logan: "#94a3b8",
};

const ACT_ICON: Record<string, { s: string; c: string }> = {
  move: { s: "→", c: "#60a5fa" }, create: { s: "+", c: "#34d399" },
  done: { s: "✓", c: "#10b981" }, edit: { s: "✎", c: "#fbbf24" },
  review: { s: "◉", c: "#c084fc" }, start: { s: "▶", c: "#fbbf24" },
};

const TABS = ["Overview", "Tree", "Kanban"];

const panel: React.CSSProperties = {
  background: "rgba(15,23,42,0.45)",
  border: "1px solid rgba(30,41,59,0.55)",
  borderRadius: 14,
};

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function guessActivityType(msg: string): string {
  if (msg.includes("→ done") || msg.includes("completed")) return "done";
  if (msg.includes("created")) return "create";
  if (msg.includes("→")) return "move";
  if (msg.includes("review") || msg.includes("QA")) return "review";
  return "edit";
}

function laneToStatus(lane: string): string {
  if (lane === "done") return "done";
  if (lane === "development" || lane === "in_progress") return "in_progress";
  if (lane === "review") return "review";
  if (lane === "blocked") return "blocked";
  return "queued";
}

const AGENT_NAMES: Record<string, string> = {
  "dev-1": "Forge", "dev-2": "Patch", qa: "Sentinel",
  pm: "TARS", architect: "Blueprint",
};

function agentName(id: string | undefined): string {
  if (!id) return "—";
  return AGENT_NAMES[id] || id;
}

/* ═══════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════ */

function TaskCard({ task, showFeature, featureName, onClickFeature }: {
  task: Task; showFeature?: boolean; featureName?: string; onClickFeature?: () => void;
}) {
  const p = task.priority || "P2";
  const pc = PC[p] || PC.P2;
  const isDone = task.lane === "done";
  return (
    <div style={{
      background: "rgba(30,41,59,0.45)", border: "1px solid rgba(51,65,85,0.35)",
      borderLeft: `3px solid ${isDone ? "#10b981" : pc.dot}`,
      borderRadius: 8, padding: "10px 12px", cursor: "pointer",
      transition: "background 0.12s", opacity: isDone ? 0.6 : 1,
    }}
    onMouseEnter={e => { e.currentTarget.style.background = "rgba(30,41,59,0.65)"; }}
    onMouseLeave={e => { e.currentTarget.style.background = "rgba(30,41,59,0.45)"; }}
    >
      {showFeature && featureName && (
        <div style={{ fontSize: 10, color: "#475569", marginBottom: 3, cursor: "pointer" }}
          onClick={e => { e.stopPropagation(); onClickFeature?.(); }}>{featureName}</div>
      )}
      <p style={{
        fontSize: 12.5, color: isDone ? "#64748b" : "#e2e8f0", margin: 0, lineHeight: 1.4,
        textDecoration: isDone ? "line-through" : "none",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>{task.title}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: pc.text }}>{p}</span>
        {task.owner && (
          <span style={{ fontSize: 10, color: ACTOR[task.owner] || "#60a5fa", marginLeft: "auto", fontWeight: 500 }}>
            {agentName(task.owner)}
          </span>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ aspect, taskCount, doneCount, onClick }: {
  aspect: Aspect; taskCount: number; doneCount: number; onClick: () => void;
}) {
  const p = aspect.priority || "P2";
  const pc = PC[p] || PC.P2;
  const status = aspect.status || "queued";
  const st = ST[status] || ST.queued;
  const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
  return (
    <div onClick={onClick} style={{
      background: "rgba(30,41,59,0.35)", border: "1px solid rgba(51,65,85,0.3)",
      borderLeft: `3px solid ${status === "in_progress" || status === "development" ? "#3b82f6" : pc.dot}`,
      borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s",
    }}
    onMouseEnter={e => { e.currentTarget.style.background = "rgba(30,41,59,0.55)"; }}
    onMouseLeave={e => { e.currentTarget.style.background = "rgba(30,41,59,0.35)"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>{aspect.name}</h3>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`, flexShrink: 0 }}>{p}</span>
      </div>
      {aspect.desc && <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px", lineHeight: 1.4 }}>{aspect.desc}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span>
        {progress > 0 && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(30,41,59,0.6)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2, background: st.color, width: `${progress}%` }} />
            </div>
            <span style={{ fontSize: 10, color: "#475569" }}>{progress}%</span>
          </div>
        )}
        <span style={{ fontSize: 10, color: "#475569", marginLeft: "auto" }}>{taskCount} tasks</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════ */

function OverviewTab({ project, aspects, tasks, activity, onSelectFeature }: {
  project: Project; aspects: Aspect[]; tasks: Task[];
  activity: ActivityEvent[]; onSelectFeature: (id: string) => void;
}) {
  const stats = useMemo(() => {
    const open = tasks.filter(t => t.lane !== "done" && t.lane !== "blocked").length;
    const blocked = tasks.filter(t => t.lane === "blocked").length;
    const done = tasks.filter(t => t.lane === "done").length;
    return { open, blocked, done, total: tasks.length };
  }, [tasks]);
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const tags = project.tags || [];

  // Count tasks per aspect
  const aspectTaskCounts = useMemo(() => {
    const counts: Record<string, { total: number; done: number }> = {};
    aspects.forEach(a => { counts[a.id] = { total: 0, done: 0 }; });
    tasks.forEach(t => {
      if (t.aspect && counts[t.aspect]) {
        counts[t.aspect].total++;
        if (t.lane === "done") counts[t.aspect].done++;
      }
    });
    // Tasks without aspect get counted under "unassigned"
    const unassigned = tasks.filter(t => !t.aspect);
    if (unassigned.length > 0) {
      counts["_unassigned"] = { total: unassigned.length, done: unassigned.filter(t => t.lane === "done").length };
    }
    return counts;
  }, [aspects, tasks]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 0" }}>
      {/* Project header */}
      <div style={{ ...panel, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{project.name}</h1>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: project.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)", color: project.status === "active" ? "#6ee7b7" : "#64748b" }}>{project.status}</span>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{project.tagline || project.description || ""}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 12, flexWrap: "wrap" }}>
              {project.owner && <span style={{ color: "#94a3b8" }}>Owner: <span style={{ fontWeight: 600 }}>{project.owner}</span></span>}
              {tags.length > 0 && <>
                <span style={{ color: "#1e293b" }}>·</span>
                {tags.map(t => <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(100,116,139,0.12)", color: "#94a3b8" }}>{t}</span>)}
              </>}
              {project.updatedAt && <>
                <span style={{ color: "#1e293b" }}>·</span>
                <span style={{ color: "#475569" }}>updated {timeAgo(project.updatedAt)}</span>
              </>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
            {[{ l: "Open", v: stats.open, c: "#60a5fa" }, { l: "Blocked", v: stats.blocked, c: "#f87171" }, { l: "Done", v: stats.done, c: "#34d399" }].map(s => (
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
              <span style={{ fontSize: 10, fontWeight: 600, color: "#475569", background: "rgba(30,41,59,0.7)", padding: "2px 8px", borderRadius: 10 }}>{aspects.length}</span>
            </div>
          </div>
          {aspects.length === 0 ? (
            <p style={{ fontSize: 12, color: "#475569" }}>No features defined yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {aspects.map(a => {
                const counts = aspectTaskCounts[a.id] || { total: 0, done: 0 };
                return <FeatureCard key={a.id} aspect={a} taskCount={counts.total} doneCount={counts.done} onClick={() => onSelectFeature(a.id)} />;
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ width: 270, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Description */}
          <div style={{ ...panel, padding: "16px 18px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</span>
            <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6, marginTop: 8, whiteSpace: "pre-wrap" }}>{project.description || "No description."}</p>
          </div>

          {/* Activity */}
          <div style={{ ...panel, padding: "16px 18px", maxHeight: 320, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Activity</span>
              <span style={{ fontSize: 11, color: "#334155" }}>{activity.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {activity.length === 0 && <p style={{ fontSize: 12, color: "#475569" }}>No recent activity.</p>}
              {activity.map((a, i) => {
                const type = guessActivityType(a.message);
                const ic = ACT_ICON[type] || ACT_ICON.edit;
                const agent = a.meta?.worker || a.meta?.actor || "System";
                return (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < activity.length - 1 ? "1px solid rgba(30,41,59,0.3)" : "none" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: `${ic.c}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: ic.c, fontWeight: 700, flexShrink: 0 }}>{ic.s}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 12, color: "#cbd5e1", margin: 0, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: ACTOR[agent] || "#e2e8f0" }}>{agentName(agent)}</span> · {a.message}
                      </p>
                      <span style={{ fontSize: 11, color: "#334155" }}>{a.createdAt ? timeAgo(a.createdAt) : ""}</span>
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

function KanbanTab({ tasks, aspects, onSelectFeature }: {
  tasks: Task[]; aspects: Aspect[]; onSelectFeature: (id: string) => void;
}) {
  const aspectMap = useMemo(() => {
    const m: Record<string, string> = {};
    aspects.forEach(a => { m[a.id] = a.name; });
    return m;
  }, [aspects]);

  const columns = [
    { id: "queued", label: "Queued", accent: "#3b82f6", lanes: ["queued", "proposed"] },
    { id: "development", label: "In Progress", accent: "#8b5cf6", lanes: ["development", "in_progress"] },
    { id: "review", label: "Review", accent: "#c084fc", lanes: ["review"] },
    { id: "done", label: "Done", accent: "#10b981", lanes: ["done"] },
  ];

  return (
    <div style={{ display: "flex", gap: 12, padding: "16px 0", minHeight: 480 }}>
      {columns.map(col => {
        const colTasks = tasks.filter(t => col.lanes.includes(t.lane));
        return (
          <div key={col.id} style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 10px", borderBottom: `2px solid ${col.accent}35`, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{col.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", background: "rgba(30,41,59,0.7)", padding: "2px 8px", borderRadius: 10 }}>{colTasks.length}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {colTasks.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#334155" }}>No tasks</div>}
              {colTasks.map(t => (
                <TaskCard key={t.id} task={t} showFeature
                  featureName={t.aspect ? aspectMap[t.aspect] : undefined}
                  onClickFeature={() => t.aspect && onSelectFeature(t.aspect)} />
              ))}
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

function TreeTab({ project, aspects, tasks, onSelectFeature }: {
  project: Project; aspects: Aspect[]; tasks: Task[];
  onSelectFeature: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(aspects.slice(0, 2).map(a => a.id)));
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const toggleExpand = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(1.5, z - e.deltaY * 0.001)));
  }, []);

  const handleDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleUp = useCallback(() => setDragging(false), []);

  // Tasks grouped by aspect
  const tasksByAspect = useMemo(() => {
    const m: Record<string, Task[]> = {};
    aspects.forEach(a => { m[a.id] = []; });
    tasks.forEach(t => {
      if (t.aspect && m[t.aspect]) m[t.aspect].push(t);
    });
    return m;
  }, [aspects, tasks]);

  const layout = useMemo(() => {
    const nodes: { id: string; x: number; y: number; type: string; data?: any }[] = [];
    const edges: { from: string; to: string; color: string }[] = [];

    nodes.push({ id: "root", x: 0, y: 0, type: "root" });
    const spacing = 130;
    const startY = -(aspects.length - 1) * spacing / 2;

    aspects.forEach((a, fi) => {
      const fx = 280;
      const fy = startY + fi * spacing;
      const status = a.status || "queued";
      const st = ST[status] || ST.queued;
      const aTasks = tasksByAspect[a.id] || [];
      nodes.push({ id: a.id, x: fx, y: fy, type: "feature", data: { ...a, tasks: aTasks } });
      edges.push({ from: "root", to: a.id, color: st.color });

      if (expanded.has(a.id)) {
        const ts = 48;
        const sy = fy - (aTasks.length - 1) * ts / 2;
        aTasks.forEach((t, ti) => {
          nodes.push({ id: t.id, x: fx + 250, y: sy + ti * ts, type: "task", data: t });
          edges.push({ from: a.id, to: t.id, color: `${(ST[laneToStatus(t.lane)] || ST.queued).color}50` });
        });
      }
    });

    return { nodes, edges };
  }, [aspects, tasksByAspect, expanded]);

  const xs = layout.nodes.map(n => n.x);
  const ys = layout.nodes.map(n => n.y);
  const minX = Math.min(...xs, 0) - 120, maxX = Math.max(...xs, 500) + 220;
  const minY = Math.min(...ys, 0) - 60, maxY = Math.max(...ys, 100) + 60;

  return (
    <div style={{ position: "relative", height: 560, overflow: "hidden", borderRadius: 12 }}>
      {/* Controls */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", gap: 4 }}>
        {[{ l: "+", fn: () => setZoom(z => Math.min(1.5, z + 0.15)) }, { l: "−", fn: () => setZoom(z => Math.max(0.3, z - 0.15)) }].map(b => (
          <button key={b.l} onClick={b.fn} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(51,65,85,0.4)", background: "rgba(15,23,42,0.8)", color: "#94a3b8", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{b.l}</button>
        ))}
        <button onClick={() => { setZoom(0.85); setPan({ x: 0, y: 0 }); }} style={{ height: 30, borderRadius: 8, border: "1px solid rgba(51,65,85,0.4)", background: "rgba(15,23,42,0.8)", color: "#64748b", fontSize: 11, padding: "0 10px", cursor: "pointer", fontFamily: "inherit" }}>Reset</button>
        <button onClick={() => setExpanded(new Set(aspects.map(a => a.id)))} style={{ height: 30, borderRadius: 8, border: "1px solid rgba(51,65,85,0.4)", background: "rgba(15,23,42,0.8)", color: "#64748b", fontSize: 11, padding: "0 10px", cursor: "pointer", fontFamily: "inherit" }}>Expand all</button>
        <button onClick={() => setExpanded(new Set())} style={{ height: 30, borderRadius: 8, border: "1px solid rgba(51,65,85,0.4)", background: "rgba(15,23,42,0.8)", color: "#64748b", fontSize: 11, padding: "0 10px", cursor: "pointer", fontFamily: "inherit" }}>Collapse</button>
      </div>
      <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 10, fontSize: 10, color: "#334155" }}>{Math.round(zoom * 100)}% · drag to pan · click features to expand</div>

      <div onWheel={handleWheel} onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
        style={{ width: "100%", height: "100%", cursor: dragging ? "grabbing" : "grab", background: "radial-gradient(circle at 50% 50%, rgba(15,23,42,0.6) 0%, #080c16 100%)", position: "relative" }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <pattern id="g" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="0.5" fill="#1e293b" /></pattern>
          <rect width="100%" height="100%" fill="url(#g)" />
        </svg>

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
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{project.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{aspects.length} features</div>
                </div>
              </div>
            );

            if (node.type === "feature") {
              const a = node.data;
              const status = a.status || "queued";
              const st = ST[status] || ST.queued;
              const p = a.priority || "P2";
              const pc = PC[p] || PC.P2;
              const aTasks = a.tasks || [];
              return (
                <div key={node.id} data-node="true" style={{ position: "absolute", left: node.x, top: node.y, transform: "translate(0,-50%)", cursor: "pointer", zIndex: 2 }}
                  onClick={() => toggleExpand(a.id)} onDoubleClick={() => onSelectFeature(a.id)}>
                  <div style={{ background: "rgba(30,41,59,0.5)", border: `1px solid ${st.color}30`, borderLeft: `3px solid ${st.color}`, borderRadius: 10, padding: "10px 14px", minWidth: 160, maxWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{a.name}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: pc.bg, color: pc.text, marginLeft: "auto" }}>{p}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span>
                      <span style={{ fontSize: 10, color: "#475569" }}>{aTasks.length} tasks</span>
                    </div>
                  </div>
                  <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, borderRadius: 4, background: "rgba(30,41,59,0.8)", border: "1px solid rgba(51,65,85,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#64748b" }}>{expanded.has(a.id) ? "−" : "+"}</div>
                </div>
              );
            }

            // task node
            const t = node.data as Task;
            const tst = ST[laneToStatus(t.lane)] || ST.queued;
            const isDone = t.lane === "done";
            return (
              <div key={node.id} data-node="true" style={{ position: "absolute", left: node.x, top: node.y, transform: "translate(0,-50%)", zIndex: 1 }}>
                <div style={{ background: "rgba(30,41,59,0.35)", border: "1px solid rgba(51,65,85,0.3)", borderRadius: 8, padding: "6px 10px", minWidth: 130, maxWidth: 170, opacity: isDone ? 0.5 : 1 }}>
                  <p style={{ fontSize: 11, color: isDone ? "#64748b" : "#cbd5e1", margin: 0, lineHeight: 1.3, textDecoration: isDone ? "line-through" : "none", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.title}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: (PC[t.priority || "P2"] || PC.P2).text }}>{t.priority || "P2"}</span>
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

function FeatureDetailView({ aspect, tasks, onBack }: {
  aspect: Aspect; tasks: Task[]; onBack: () => void;
}) {
  const [openAll, setOpenAll] = useState(true);
  const p = aspect.priority || "P2";
  const pc = PC[p] || PC.P2;
  const status = aspect.status || "queued";
  const st = ST[status] || ST.queued;
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.lane === "done").length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 0" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <span onClick={onBack} style={{ color: "#475569", cursor: "pointer" }}>← Back</span>
        <span style={{ color: "#1e293b" }}>/</span>
        <span style={{ color: "#475569", cursor: "pointer" }} onClick={onBack}>Key Features</span>
        <span style={{ color: "#1e293b" }}>/</span>
        <span style={{ color: "#94a3b8" }}>{aspect.name}</span>
      </div>

      {/* Header */}
      <div style={{ ...panel, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{aspect.name}</h1>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>{p}</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: st.bg, color: st.color }}>{st.label}</span>
            </div>
            {aspect.desc && <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>{aspect.desc}</p>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>{doneTasks}/{totalTasks}</div>
              <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>tasks</div>
            </div>
            <div style={{ width: 50, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: st.color }}>{progress}%</div>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(30,41,59,0.6)", marginTop: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, background: st.color, width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tasks list */}
      <div style={{ ...panel, overflow: "hidden", borderLeft: `3px solid ${st.color}` }}>
        <div onClick={() => setOpenAll(!openAll)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
          <span style={{ fontSize: 10, color: "#475569", transition: "transform 0.2s", transform: openAll ? "rotate(90deg)" : "rotate(0)", display: "inline-block" }}>▶</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", flex: 1 }}>All Tasks</span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{doneTasks}/{totalTasks}</span>
          <div style={{ width: 50, height: 3, borderRadius: 2, background: "rgba(30,41,59,0.6)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, background: st.color, width: totalTasks > 0 ? `${(doneTasks / totalTasks) * 100}%` : "0%" }} />
          </div>
        </div>

        {openAll && (
          <div style={{ borderTop: "1px solid rgba(30,41,59,0.4)" }}>
            {tasks.length === 0 && <div style={{ padding: "16px 42px", fontSize: 12, color: "#475569" }}>No tasks assigned to this feature.</div>}
            {tasks.map(task => {
              const tst = ST[laneToStatus(task.lane)] || ST.queued;
              const tpc = PC[task.priority || "P2"] || PC.P2;
              const isDone = task.lane === "done";
              return (
                <div key={task.id} style={{
                  display: "flex", alignItems: "center", gap: 0, padding: "9px 16px 9px 42px",
                  borderTop: "1px solid rgba(30,41,59,0.2)", cursor: "pointer",
                  transition: "background 0.1s", opacity: isDone ? 0.55 : 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(30,41,59,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginRight: 8, background: tst.bg, border: isDone ? "none" : `1px solid ${tst.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: tst.color, fontWeight: 700 }}>
                    {isDone ? "✓" : task.lane === "development" ? "◉" : "○"}
                  </div>
                  <span style={{ flex: 1, fontSize: 12.5, color: isDone ? "#64748b" : "#e2e8f0", textDecoration: isDone ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
                  <span style={{ width: 30, textAlign: "center", fontSize: 10, fontWeight: 700, color: tpc.text }}>{task.priority || "P2"}</span>
                  <span style={{ width: 70, textAlign: "center", fontSize: 10, fontWeight: 600, color: tst.color }}>{tst.label}</span>
                  <span style={{ width: 65, textAlign: "right", fontSize: 11, fontWeight: 500, color: task.owner ? (ACTOR[task.owner] || "#94a3b8") : "#334155" }}>{agentName(task.owner)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════ */

export default function ProjectsApp() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  // API state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [aspects, setAspects] = useState<Aspect[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  const project = projects.find(p => p.id === selectedProjectId) || null;

  // Fetch projects
  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then((data: Project[]) => {
      setProjects(data);
      if (data.length > 0 && !selectedProjectId) setSelectedProjectId(data[0].id);
    }).catch(() => {});
  }, []);

  // Fetch aspects + tasks + activity when project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    fetch(`/api/aspects?projectId=${selectedProjectId}`).then(r => r.json()).then(setAspects).catch(() => setAspects([]));
    fetch(`/api/tasks?project=${selectedProjectId}`).then(r => r.json()).then(setTasks).catch(() => setTasks([]));
    fetch("/api/activity?limit=15").then(r => r.json()).then(setActivity).catch(() => setActivity([]));
  }, [selectedProjectId]);

  // Poll tasks every 8s
  useEffect(() => {
    if (!selectedProjectId) return;
    const iv = setInterval(() => {
      fetch(`/api/tasks?project=${selectedProjectId}`).then(r => r.json()).then(setTasks).catch(() => {});
    }, 8000);
    return () => clearInterval(iv);
  }, [selectedProjectId]);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.lane === "done").length;

  // Tasks for selected feature
  const featureTasks = useMemo(() => {
    if (!selectedFeature) return [];
    return tasks.filter(t => t.aspect === selectedFeature);
  }, [tasks, selectedFeature]);

  const selectedAspect = aspects.find(a => a.id === selectedFeature) || null;

  if (projects.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#475569", fontSize: 14 }}>
        Loading projects...
      </div>
    );
  }

  if (!project) return null;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 20px" }}>
      {/* Project bar + tabs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: 0, cursor: selectedFeature ? "pointer" : "default" }}
            onClick={() => setSelectedFeature(null)}>{project.name}</h1>
          <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: project.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)", color: project.status === "active" ? "#6ee7b7" : "#64748b" }}>{project.status}</span>
          <span style={{ fontSize: 12, color: "#475569" }}>{aspects.length} features · {totalTasks} tasks · {doneTasks} done</span>
        </div>
        {!selectedFeature && (
          <div style={{ display: "flex", gap: 2 }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                background: activeTab === t ? "rgba(30,41,59,0.6)" : "transparent",
                color: activeTab === t ? "#f1f5f9" : "#475569",
                transition: "all 0.15s",
              }}>{t}</button>
            ))}
          </div>
        )}
      </div>

      {/* Views */}
      <div style={{ ...panel, padding: selectedFeature ? "0 16px" : activeTab === "Tree" ? 0 : "0 16px", overflow: "hidden" }}>
        {selectedFeature && selectedAspect ? (
          <FeatureDetailView aspect={selectedAspect} tasks={featureTasks} onBack={() => setSelectedFeature(null)} />
        ) : activeTab === "Overview" ? (
          <OverviewTab project={project} aspects={aspects} tasks={tasks} activity={activity} onSelectFeature={setSelectedFeature} />
        ) : activeTab === "Kanban" ? (
          <KanbanTab tasks={tasks} aspects={aspects} onSelectFeature={setSelectedFeature} />
        ) : (
          <TreeTab project={project} aspects={aspects} tasks={tasks} onSelectFeature={setSelectedFeature} />
        )}
      </div>
    </div>
  );
}
