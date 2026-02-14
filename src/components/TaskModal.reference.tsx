import { useState } from "react";

const MOCK_EPIC = {
  id: "tc-test-001",
  title: "User Authentication System",
  type: "Epic",
  owner: "Unassigned",
  status: "Development",
  priority: "P0",
  created: "2/11/2026, 10:36:14 PM",
  updated: "2/11/2026, 10:36:14 PM",
  historyCount: 1,
};

const STATUSES = ["Backlog", "Planning", "Development", "Testing", "Done"];
const PRIORITIES = ["P0", "P1", "P2", "P3"];

const Badge = ({ children, variant = "default" }) => {
  const styles = {
    p0: "bg-red-500/15 text-red-400 border border-red-500/20",
    epic: "bg-violet-500/15 text-violet-400 border border-violet-500/20",
    default: "bg-slate-700/50 text-slate-300 border border-slate-600/30",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${styles[variant] || styles.default}`}>
      {children}
    </span>
  );
};

const FieldLabel = ({ children }) => (
  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{children}</label>
);

const TextArea = ({ label, placeholder, rows = 3 }) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <textarea
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-slate-800/50 border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 resize-none transition-all"
    />
  </div>
);

const Select = ({ label, value, options }) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <div className="relative">
      <select
        defaultValue={value}
        className="w-full appearance-none bg-slate-800/50 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 pr-8 transition-all cursor-pointer"
      >
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
);

const Input = ({ label, value, placeholder }) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <input
      type="text"
      defaultValue={value}
      placeholder={placeholder}
      className="w-full bg-slate-800/50 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
    />
  </div>
);

export default function EpicDetailModal() {
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("details");

  const epic = MOCK_EPIC;

  if (!open) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <button onClick={() => setOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors">Open Modal</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        style={{ animation: "fadeIn 0.15s ease-out" }}
      />

      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
        style={{ animation: "slideUp 0.2s ease-out" }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-700/40">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="epic">Epic</Badge>
              <span className="text-xs text-slate-500 font-mono">{epic.id}</span>
            </div>
            <input
              type="text"
              defaultValue={epic.title}
              className="w-full text-lg font-semibold text-slate-100 bg-transparent border-none outline-none focus:ring-0 p-0 placeholder-slate-500"
              placeholder="Enter title..."
            />
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-slate-700/40">
          {["details", "history"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors relative ${activeTab === tab ? "text-blue-400" : "text-slate-400 hover:text-slate-200"}`}
            >
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-full" />}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-96 overflow-y-auto space-y-5">
          {activeTab === "details" && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Select label="Status" value={epic.status} options={STATUSES} />
                <Select label="Priority" value={epic.priority} options={PRIORITIES} />
                <Input label="Owner" value={epic.owner} placeholder="Assign owner..." />
              </div>

              <div className="border-t border-slate-700/30" />

              <TextArea label="Problem" placeholder="Why does this task exist?" rows={3} />
              <TextArea label="Scope" placeholder="What is in/out of scope?" rows={3} />
              <TextArea label="Acceptance Criteria" placeholder="One criterion per line" rows={4} />

              <div className="border-t border-slate-700/30" />

              <div className="flex items-center gap-6 text-xs text-slate-500">
                <span>Created <span className="text-slate-400">{epic.created}</span></span>
                <span>Updated <span className="text-slate-400">{epic.updated}</span></span>
                <span><span className="text-slate-400">{epic.historyCount}</span> event</span>
              </div>
            </>
          )}

          {activeTab === "history" && (
            <div className="py-8 text-center text-sm text-slate-500">
              <svg className="w-8 h-8 mx-auto mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              1 event in history
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/40 bg-slate-900/80">
          <button className="text-xs text-slate-500 hover:text-slate-300 font-mono transition-colors">Copy JSON</button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
            >Cancel</button>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-600/20">Save Changes</button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.98) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>
    </div>
  );
}
