import { useState, useEffect, useCallback } from "react";

/* ── Types ────────────────────────────────────────────── */
interface Project {
  id: string;
  name: string;
  status: string;
  description: string;
  tagline?: string;
  owner?: string;
  tags?: string[];
  updatedAt?: string;
}

interface Aspect {
  id: string;
  name: string;
  description: string;
  projectId: string;
  priority?: string;
  status?: string;
  progress?: number;
}

interface ActivityEvent {
  id?: string;
  message: string;
  createdAt: string;
  meta?: { worker?: string; actor?: string; eventType?: string };
}

/* ── Colors ───────────────────────────────────────────── */
const PC: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  P0: { bg: "rgba(239,68,68,0.1)", text: "#fca5a5", border: "rgba(239,68,68,0.2)", dot: "#f87171" },
  P1: { bg: "rgba(245,158,11,0.1)", text: "#fde68a", border: "rgba(245,158,11,0.2)", dot: "#fbbf24" },
  P2: { bg: "rgba(234,179,8,0.1)", text: "#fef08a", border: "rgba(234,179,8,0.2)", dot: "#facc15" },
};

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  in_progress: { label: "In Progress", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  planned: { label: "Planned", color: "#f87171", bg: "rgba(239,68,68,0.08)" },
  done: { label: "Done", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  queued: { label: "Queued", color: "#94a3b8", bg: "rgba(100,116,139,0.1)" },
};

const ACT_ICON: Record<string, { symbol: string; color: string }> = {
  move: { symbol: "→", color: "#60a5fa" },
  create: { symbol: "+", color: "#34d399" },
  edit: { symbol: "✎", color: "#fbbf24" },
  done: { symbol: "✓", color: "#10b981" },
  review: { symbol: "◉", color: "#c084fc" },
};

const TABS = ["Overview", "Tree", "Kanban"];

/* ── Styles ───────────────────────────────────────────── */
const panel: React.CSSProperties = {
  background: "rgba(15,23,42,0.45)",
  border: "1px solid rgba(30,41,59,0.55)",
  borderRadius: 14,
  overflow: "hidden",
};

/* ── Helpers ──────────────────────────────────────────── */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function guessActivityType(msg: string | undefined): string {
  if (!msg) return "edit";
  if (msg.includes("completed") || msg.includes("→ done")) return "done";
  if (msg.includes("created")) return "create";
  if (msg.includes("→")) return "move";
  if (msg.includes("review") || msg.includes("QA")) return "review";
  return "edit";
}

/* ── Components ───────────────────────────────────────── */

function Sidebar({ projects, activeProjectId, onSelect }: {
  projects: Project[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Projects</span>
        <button style={{
          fontSize: 11, fontWeight: 500, color: "#64748b",
          background: "rgba(30,41,59,0.5)", border: "1px solid rgba(51,65,85,0.3)",
          borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
        }}>+ New</button>
      </div>
      {projects.map(p => {
        const active = p.id === activeProjectId;
        return (
          <div key={p.id} onClick={() => onSelect(p.id)} style={{
            padding: "10px 12px", borderRadius: 10, cursor: "pointer",
            background: active ? "rgba(59,130,246,0.08)" : "transparent",
            border: active ? "1px solid rgba(59,130,246,0.15)" : "1px solid transparent",
            transition: "all 0.15s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: active ? "#e2e8f0" : "#94a3b8" }}>{p.name}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, marginLeft: "auto",
                background: p.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)",
                color: p.status === "active" ? "#6ee7b7" : "#64748b",
              }}>{p.status || "active"}</span>
            </div>
            <p style={{ fontSize: 11, color: "#475569", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.description || p.tagline || ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ProjectHeader({ project, stats }: {
  project: Project;
  stats: { open: number; blocked: number; done: number; total: number };
}) {
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const tags = project.tags || [];
  return (
    <div style={{ ...panel, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{project.name}</h1>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5,
              background: project.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)",
              color: project.status === "active" ? "#6ee7b7" : "#64748b",
            }}>{project.status || "active"}</span>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
            {project.tagline || project.description || ""}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: "#475569" }}>Owner:</span> {project.owner || "—"}
            </span>
            {tags.length > 0 && <>
              <span style={{ color: "#1e293b" }}>·</span>
              <div style={{ display: "flex", gap: 4 }}>
                {tags.map(t => (
                  <span key={t} style={{
                    fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 4,
                    background: "rgba(100,116,139,0.12)", color: "#94a3b8",
                  }}>{t}</span>
                ))}
              </div>
            </>}
            {project.updatedAt && <>
              <span style={{ color: "#1e293b" }}>·</span>
              <span style={{ fontSize: 11, color: "#475569" }}>updated {timeAgo(project.updatedAt)}</span>
            </>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { label: "Open", value: stats.open, color: "#60a5fa" },
              { label: "Blocked", value: stats.blocked, color: "#f87171" },
              { label: "Done", value: stats.done, color: "#34d399" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ width: 64, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>{pct}%</div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>complete</div>
            <div style={{ height: 3, borderRadius: 2, background: "rgba(30,41,59,0.6)", marginTop: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #3b82f6, #10b981)", width: `${pct}%`, transition: "width 0.3s" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ feature }: { feature: Aspect }) {
  const p = feature.priority || "P2";
  const pc = PC[p] || PC.P2;
  const status = feature.status || "planned";
  const st = STATUS[status] || STATUS.planned;
  const progress = feature.progress || 0;

  return (
    <div style={{
      background: "rgba(30,41,59,0.35)",
      border: "1px solid rgba(51,65,85,0.3)",
      borderLeft: `3px solid ${status === "in_progress" ? "#3b82f6" : pc.dot}`,
      borderRadius: 10,
      padding: "14px 16px",
      cursor: "pointer",
      transition: "all 0.15s",
      display: "flex", flexDirection: "column", gap: 8,
    }}
    onMouseEnter={e => { e.currentTarget.style.background = "rgba(30,41,59,0.55)"; e.currentTarget.style.borderColor = "rgba(71,85,105,0.4)"; }}
    onMouseLeave={e => { e.currentTarget.style.background = "rgba(30,41,59,0.35)"; e.currentTarget.style.borderColor = "rgba(51,65,85,0.3)"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>{feature.name}</h3>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0", lineHeight: 1.45 }}>{feature.description}</p>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, flexShrink: 0,
          background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`,
        }}>{p}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
          background: st.bg, color: st.color,
        }}>{st.label}</span>
        {progress > 0 && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(30,41,59,0.6)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2, background: st.color, width: `${progress}%`, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 10, color: "#475569", fontWeight: 500 }}>{progress}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityItem({ item }: { item: ActivityEvent }) {
  const type = guessActivityType(item.message);
  const icon = ACT_ICON[type] || ACT_ICON.edit;
  const agent = item.meta?.worker || item.meta?.actor || "System";
  const action = item.message;

  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(30,41,59,0.3)" }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
        background: `${icon.color}15`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, color: icon.color, fontWeight: 700,
      }}>{icon.symbol}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 12, color: "#cbd5e1", margin: 0, lineHeight: 1.45 }}>
          <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{agent}</span>
          {" · "}
          {action}
        </p>
        <span style={{ fontSize: 11, color: "#334155" }}>{item.createdAt ? timeAgo(item.createdAt) : ""}</span>
      </div>
    </div>
  );
}

function QuickLinks({ links }: { links: { label: string; url: string; icon: string }[] }) {
  return (
    <div>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick Links</span>
      {links.length === 0 ? (
        <p style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>No links yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {links.map(l => (
            <a key={l.label} href={l.url} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 10px", borderRadius: 8,
              background: "rgba(30,41,59,0.3)",
              border: "1px solid rgba(51,65,85,0.25)",
              color: "#94a3b8", fontSize: 12, fontWeight: 500,
              textDecoration: "none", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(30,41,59,0.5)"; e.currentTarget.style.color = "#e2e8f0"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(30,41,59,0.3)"; e.currentTarget.style.color = "#94a3b8"; }}
            >
              <span>{l.icon}</span>
              {l.label}
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#334155" }}>↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DescriptionBlock({ description, onSave }: { description: string; onSave: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(description);

  useEffect(() => { setText(description); }, [description]);

  const handleDone = () => {
    setEditing(false);
    if (text !== description) onSave(text);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</span>
        <button onClick={() => editing ? handleDone() : setEditing(true)} style={{
          fontSize: 11, color: "#475569", background: "none", border: "none",
          cursor: "pointer", fontFamily: "inherit",
        }}>{editing ? "Done" : "Edit"}</button>
      </div>
      {editing ? (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          style={{
            width: "100%", background: "rgba(30,41,59,0.35)",
            border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8,
            padding: "10px 12px", fontSize: 12.5, color: "#cbd5e1",
            fontFamily: "inherit", lineHeight: 1.55, resize: "vertical",
            outline: "none",
          }}
        />
      ) : (
        <div style={{
          fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}>{text || "No description yet."}</div>
      )}
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────── */

export default function ProjectPage() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [aspects, setAspects] = useState<Aspect[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

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
    fetch("/api/activity?limit=10").then(r => r.json()).then(setActivity).catch(() => setActivity([]));
  }, [selectedProjectId]);

  // Compute stats from tasks
  const stats = {
    open: tasks.filter(t => t.lane !== "done" && t.lane !== "blocked").length,
    blocked: tasks.filter(t => t.lane === "blocked").length,
    done: tasks.filter(t => t.lane === "done").length,
    total: tasks.length,
  };

  const handleDescriptionSave = useCallback((text: string) => {
    if (!selectedProjectId) return;
    fetch(`/api/projects/${selectedProjectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: text }),
    }).catch(() => {});
  }, [selectedProjectId]);

  // Quick links placeholder (can be extended with project.links)
  const links: { label: string; url: string; icon: string }[] = [];

  if (projects.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#475569", fontSize: 14 }}>
        No projects found. Create one to get started.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 20, padding: "16px 0" }}>

      {/* Sidebar */}
      <Sidebar projects={projects} activeProjectId={selectedProjectId} onSelect={setSelectedProjectId} />

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Tab bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: "none", cursor: "pointer", fontFamily: "inherit",
              background: activeTab === t ? "rgba(30,41,59,0.6)" : "transparent",
              color: activeTab === t ? "#f1f5f9" : "#475569",
              transition: "all 0.15s",
            }}>{t}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button style={{
            fontSize: 11, fontWeight: 500, color: "#64748b",
            background: "rgba(30,41,59,0.4)", border: "1px solid rgba(51,65,85,0.3)",
            borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ fontSize: 13 }}>⚙</span> Settings
          </button>
        </div>

        {selectedProject && (
          <>
            {/* Project header */}
            <ProjectHeader project={selectedProject} stats={stats} />

            {activeTab === "Overview" && (
              /* Two-column layout: Features + sidebar info */
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

                {/* Features (main) */}
                <div style={{ flex: 1, minWidth: 0, ...panel, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Key Features</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: "#475569",
                        background: "rgba(30,41,59,0.7)", padding: "2px 8px", borderRadius: 10,
                      }}>{aspects.length}</span>
                    </div>
                    <button style={{
                      fontSize: 11, fontWeight: 500, color: "#60a5fa",
                      background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                    }}>+ Add Feature</button>
                  </div>
                  {aspects.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#475569" }}>No features defined yet.</p>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {aspects.map(f => <FeatureCard key={f.id} feature={f} />)}
                    </div>
                  )}
                </div>

                {/* Right sidebar: description + links + activity */}
                <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ ...panel, padding: "16px 18px" }}>
                    <DescriptionBlock description={selectedProject.description || ""} onSave={handleDescriptionSave} />
                  </div>
                  <div style={{ ...panel, padding: "16px 18px" }}>
                    <QuickLinks links={links} />
                  </div>
                  <div style={{ ...panel, padding: "16px 18px", maxHeight: 360, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Activity</span>
                      <span style={{ fontSize: 11, color: "#334155" }}>{activity.length} events</span>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto" }}>
                      {activity.map((a, i) => <ActivityItem key={i} item={a} />)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "Tree" && (
              <div style={{ ...panel, padding: "40px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "#475569" }}>Tree view coming soon.</p>
              </div>
            )}

            {activeTab === "Kanban" && (
              <div style={{ ...panel, padding: "40px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "#475569" }}>Kanban view coming soon.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
