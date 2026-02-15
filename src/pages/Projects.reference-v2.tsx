import { useState } from "react";

/* ── Data ─────────────────────────────────────────────── */
const PROJECTS = [
  { name: "Claw Control Center", status: "active", desc: "Local-first control surface" },
  { name: "Task Manager", status: "paused", desc: "Simple kanban + queue" },
];

const PROJECT = {
  name: "Claw Control Center",
  tagline: "Local-first control surface for OpenClaw + projects.",
  status: "active",
  owner: "Logan",
  ownerMode: "single-user local mode",
  tags: ["local", "operator", "ux"],
  configurable: true,
  updated: "32m ago",
  description: 'Local-first control surface for OpenClaw + projects.\n\n(fake) Success looks like: fast orientation, clear feature specs, and smooth execution via Kanban.',
  stats: { open: 5, blocked: 1, done: 12, total: 18 },
};

const FEATURES = [
  { id: "f1", name: "Auth + identities", desc: "Local auth, sessions, and role-based permissions.", p: "P0", status: "in_progress", progress: 40 },
  { id: "f2", name: "Login / unlock flow", desc: "Quick unlock for local instance + optional passcode.", p: "P1", status: "planned", progress: 0 },
  { id: "f3", name: "Tool permissions matrix", desc: "Allow/deny rules for exec/browser/messaging, etc.", p: "P0", status: "planned", progress: 0 },
  { id: "f4", name: "Projects hub UX", desc: "Overview / Tree / Kanban with deep feature specs.", p: "P0", status: "in_progress", progress: 65 },
  { id: "f5", name: "Project overview dashboard", desc: "High-signal project homepage: priorities, links, activity.", p: "P0", status: "planned", progress: 0 },
  { id: "f6", name: "Feature tree map", desc: "Hierarchy + dependency view with feature spec pages.", p: "P0", status: "planned", progress: 0 },
];

const ACTIVITY = [
  { agent: "Logan", action: 'Moved "Design Settings nav + sections"', to: "In progress", time: "14m ago", type: "move" },
  { agent: "TARS", action: 'Created feature: "Feature tree map"', time: "54m ago", type: "create" },
  { agent: "Logan", action: "Updated project summary and links", time: "3h ago", type: "edit" },
  { agent: "Forge", action: 'Completed: "Auth session middleware"', time: "4h ago", type: "done" },
  { agent: "Blueprint", action: 'Spec review: "Tool permissions matrix"', time: "5h ago", type: "review" },
];

const LINKS = [
  { label: "GitHub Repo", url: "#", icon: "⚙" },
  { label: "Design Doc", url: "#", icon: "📄" },
  { label: "API Spec", url: "#", icon: "🔗" },
];

const NAV_ITEMS = ["Mission Control", "Projects", "Activity", "Kanban", "Recurring", "Integrations", "System", "Config", "Docs"];
const TABS = ["Overview", "Tree", "Kanban"];

/* ── Colors ───────────────────────────────────────────── */
const PC = {
  P0: { bg: "rgba(239,68,68,0.1)", text: "#fca5a5", border: "rgba(239,68,68,0.2)", dot: "#f87171" },
  P1: { bg: "rgba(245,158,11,0.1)", text: "#fde68a", border: "rgba(245,158,11,0.2)", dot: "#fbbf24" },
  P2: { bg: "rgba(234,179,8,0.1)", text: "#fef08a", border: "rgba(234,179,8,0.2)", dot: "#facc15" },
};

const STATUS = {
  in_progress: { label: "In Progress", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  planned: { label: "Planned", color: "#f87171", bg: "rgba(239,68,68,0.08)" },
  done: { label: "Done", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
};

const ACT_ICON = {
  move: { symbol: "→", color: "#60a5fa" },
  create: { symbol: "+", color: "#34d399" },
  edit: { symbol: "✎", color: "#fbbf24" },
  done: { symbol: "✓", color: "#10b981" },
  review: { symbol: "◉", color: "#c084fc" },
};

/* ── Styles ───────────────────────────────────────────── */
const panel = {
  background: "rgba(15,23,42,0.45)",
  border: "1px solid rgba(30,41,59,0.55)",
  borderRadius: 14,
  overflow: "hidden",
};

/* ── Components ───────────────────────────────────────── */

function Sidebar({ activeProject }) {
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
      {PROJECTS.map(p => {
        const active = p.name === activeProject;
        return (
          <div key={p.name} style={{
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
              }}>{p.status}</span>
            </div>
            <p style={{ fontSize: 11, color: "#475569", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

function ProjectHeader() {
  const pct = Math.round((PROJECT.stats.done / PROJECT.stats.total) * 100);
  return (
    <div style={{ ...panel, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
        {/* Left: name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{PROJECT.name}</h1>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5,
              background: "rgba(16,185,129,0.12)", color: "#6ee7b7",
            }}>active</span>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{PROJECT.tagline}</p>

          {/* Meta chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: "#475569" }}>Owner:</span> {PROJECT.owner}
            </span>
            <span style={{ color: "#1e293b" }}>·</span>
            <div style={{ display: "flex", gap: 4 }}>
              {PROJECT.tags.map(t => (
                <span key={t} style={{
                  fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 4,
                  background: "rgba(100,116,139,0.12)", color: "#94a3b8",
                }}>{t}</span>
              ))}
            </div>
            <span style={{ color: "#1e293b" }}>·</span>
            <span style={{ fontSize: 11, color: "#475569" }}>updated {PROJECT.updated}</span>
          </div>
        </div>

        {/* Right: progress ring + stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
          {/* Stats */}
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { label: "Open", value: PROJECT.stats.open, color: "#60a5fa" },
              { label: "Blocked", value: PROJECT.stats.blocked, color: "#f87171" },
              { label: "Done", value: PROJECT.stats.done, color: "#34d399" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Mini progress bar */}
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

function FeatureCard({ feature }) {
  const pc = PC[feature.p] || PC.P0;
  const st = STATUS[feature.status] || STATUS.planned;

  return (
    <div style={{
      background: "rgba(30,41,59,0.35)",
      border: "1px solid rgba(51,65,85,0.3)",
      borderLeft: `3px solid ${feature.status === "in_progress" ? "#3b82f6" : pc.dot}`,
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
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0", lineHeight: 1.45 }}>{feature.desc}</p>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, flexShrink: 0,
          background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`,
        }}>{feature.p}</span>
      </div>

      {/* Bottom: status + progress */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
          background: st.bg, color: st.color,
        }}>{st.label}</span>
        {feature.progress > 0 && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(30,41,59,0.6)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2, background: st.color, width: `${feature.progress}%`, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 10, color: "#475569", fontWeight: 500 }}>{feature.progress}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityItem({ item }) {
  const icon = ACT_ICON[item.type] || ACT_ICON.edit;
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
          <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{item.agent}</span>
          {" · "}
          {item.action}
          {item.to && <span style={{ color: "#60a5fa" }}> → {item.to}</span>}
        </p>
        <span style={{ fontSize: 11, color: "#334155" }}>{item.time}</span>
      </div>
    </div>
  );
}

function QuickLinks() {
  return (
    <div>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick Links</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
        {LINKS.map(l => (
          <a key={l.label} href={l.url} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 10px", borderRadius: 8,
            background: "rgba(30,41,59,0.3)",
            border: "1px solid rgba(51,65,85,0.25)",
            color: "#94a3b8", fontSize: 12, fontWeight: 500,
            textDecoration: "none",
            transition: "all 0.15s",
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
    </div>
  );
}

function DescriptionBlock() {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(PROJECT.description);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</span>
        <button onClick={() => setEditing(!editing)} style={{
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
        }}>{text}</div>
      )}
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────── */

export default function ProjectPage() {
  const [activeNav, setActiveNav] = useState("Projects");
  const [activeTab, setActiveTab] = useState("Overview");

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

      {/* ── Nav ── */}
      <header style={{
        borderBottom: "1px solid rgba(30,41,59,0.7)",
        background: "rgba(8,12,22,0.95)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 30,
      }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", height: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 32, flexShrink: 0 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: "linear-gradient(135deg, #3b82f6, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em" }}>Claw Control</span>
          </div>
          <nav style={{ display: "flex", gap: 2, overflowX: "auto" }}>
            {NAV_ITEMS.map(n => (
              <button key={n} onClick={() => setActiveNav(n)} style={{
                padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                whiteSpace: "nowrap", border: "none", cursor: "pointer",
                background: activeNav === n ? "rgba(30,41,59,0.7)" : "transparent",
                color: activeNav === n ? "#f1f5f9" : "#64748b",
                transition: "all 0.15s",
              }}>{n}</button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "16px 20px", display: "flex", gap: 20 }}>

        {/* Sidebar */}
        <Sidebar activeProject={PROJECT.name} />

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

          {/* Project header */}
          <ProjectHeader />

          {/* Two-column layout: Features + sidebar info */}
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

            {/* Features (main) */}
            <div style={{ flex: 1, minWidth: 0, ...panel, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Key Features</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: "#475569",
                    background: "rgba(30,41,59,0.7)", padding: "2px 8px", borderRadius: 10,
                  }}>{FEATURES.length}</span>
                </div>
                <button style={{
                  fontSize: 11, fontWeight: 500, color: "#60a5fa",
                  background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                }}>+ Add Feature</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {FEATURES.map(f => <FeatureCard key={f.id} feature={f} />)}
              </div>
            </div>

            {/* Right sidebar: description + links + activity */}
            <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Description */}
              <div style={{ ...panel, padding: "16px 18px" }}>
                <DescriptionBlock />
              </div>

              {/* Quick Links */}
              <div style={{ ...panel, padding: "16px 18px" }}>
                <QuickLinks />
              </div>

              {/* Activity */}
              <div style={{ ...panel, padding: "16px 18px", maxHeight: 360, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Activity</span>
                  <span style={{ fontSize: 11, color: "#334155" }}>{ACTIVITY.length} events</span>
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {ACTIVITY.map((a, i) => <ActivityItem key={i} item={a} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
