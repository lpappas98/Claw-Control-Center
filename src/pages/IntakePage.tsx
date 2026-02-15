import { useState, useEffect, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════ */

interface Project {
  id: string;
  name: string;
  tagline?: string;
  description?: string;
}

interface AnalysisTask {
  title: string;
  tag: string;
  priority: string;
  assignee?: string;
  reasoning?: string;
}

interface AnalysisResult {
  tasks: AnalysisTask[];
  confidence: number;
  reasoning: string;
}

interface Intake {
  id: string;
  projectId: string;
  text: string;
  createdAt: string;
  analysis?: AnalysisResult;
}

interface AppProps {}

/* ═══════════════════════════════════════════════════════
   COLORS & STYLES
   ═══════════════════════════════════════════════════════ */

const COLORS = {
  bg: "#0f172a",
  fg: "#cbd5e1",
  card: "#1e293b",
  accent: "#3b82f6",
  success: "#10b981",
  error: "#f87171",
  warning: "#fbbf24",
};

const PRIORITY_COLORS: Record<string, { text: string; bg: string }> = {
  P0: { text: "#fca5a5", bg: "rgba(239,68,68,0.15)" },
  P1: { text: "#fde68a", bg: "rgba(245,158,11,0.15)" },
  P2: { text: "#fef08a", bg: "rgba(234,179,8,0.15)" },
  P3: { text: "#cbd5e1", bg: "rgba(100,116,139,0.15)" },
};

/* ═══════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════ */

interface ProjectSelectorProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}

function ProjectSelector({ projects, selectedId, onSelect, loading }: ProjectSelectorProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 14,
          fontWeight: 500,
          marginBottom: 8,
          color: COLORS.fg,
        }}
      >
        Select Project
      </label>
      <select
        value={selectedId || ""}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading}
        style={{
          width: "100%",
          padding: "8px 12px",
          background: COLORS.card,
          color: COLORS.fg,
          border: `1px solid rgba(148, 163, 184, 0.2)`,
          borderRadius: 8,
          fontSize: 14,
          fontFamily: "inherit",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <option value="">-- Choose a project --</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

interface IntakeInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  error?: string;
}

function IntakeInput({ value, onChange, onSubmit, loading, error }: IntakeInputProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 14,
          fontWeight: 500,
          marginBottom: 8,
          color: COLORS.fg,
        }}
      >
        Intake Description
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        placeholder="Describe the feature, problem, or requirement..."
        style={{
          width: "100%",
          minHeight: 120,
          padding: 12,
          background: COLORS.card,
          color: COLORS.fg,
          border: `1px solid rgba(148, 163, 184, 0.2)`,
          borderRadius: 8,
          fontSize: 14,
          fontFamily: "inherit",
          resize: "vertical",
          opacity: loading ? 0.6 : 1,
        }}
      />
      {error && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            background: `rgba(248, 113, 113, 0.1)`,
            color: "#fca5a5",
            borderRadius: 6,
            fontSize: 13,
            border: "1px solid rgba(248, 113, 113, 0.2)",
          }}
        >
          {error}
        </div>
      )}
      <button
        onClick={onSubmit}
        disabled={loading}
        style={{
          marginTop: 12,
          padding: "8px 16px",
          background: loading ? COLORS.card : COLORS.accent,
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 500,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!loading) (e.target as HTMLButtonElement).style.background = "#2563eb";
        }}
        onMouseLeave={(e) => {
          if (!loading) (e.target as HTMLButtonElement).style.background = COLORS.accent;
        }}
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>
    </div>
  );
}

interface AnalyzingAnimationProps {
  show: boolean;
}

function AnalyzingAnimation({ show }: AnalyzingAnimationProps) {
  if (!show) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: COLORS.card,
        borderRadius: 8,
        marginBottom: 16,
        border: `1px solid rgba(148, 163, 184, 0.2)`,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            width: 32,
            height: 32,
            marginBottom: 16,
            animation: "spin 1s linear infinite",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              border: `3px solid rgba(59, 130, 246, 0.2)`,
              borderTopColor: COLORS.accent,
              borderRadius: "50%",
            }}
          />
        </div>
        <p style={{ color: COLORS.fg, fontSize: 14, margin: 0 }}>
          Analyzing intake and generating tasks...
        </p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

interface ResultsViewProps {
  result: AnalysisResult;
  onRemoveTask: (index: number) => void;
  onAccept: () => void;
  loading?: boolean;
}

function ResultsView({ result, onRemoveTask, onAccept, loading }: ResultsViewProps) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid rgba(148, 163, 184, 0.2)`,
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px 0", color: COLORS.fg, fontSize: 16, fontWeight: 600 }}>
          Analysis Results
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: COLORS.fg,
            opacity: 0.8,
          }}
        >
          Confidence: {(result.confidence * 100).toFixed(0)}%
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: COLORS.fg, margin: "0 0 12px 0" }}>
          <strong>Reasoning:</strong> {result.reasoning}
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4
          style={{
            margin: "0 0 12px 0",
            color: COLORS.fg,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Generated Tasks ({result.tasks.length})
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {result.tasks.map((task, idx) => {
            const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.P3;
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 12,
                  background: COLORS.bg,
                  borderRadius: 6,
                  border: `1px solid rgba(148, 163, 184, 0.1)`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 6px",
                        background: priorityColor.bg,
                        color: priorityColor.text,
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      {task.priority}
                    </span>
                    {task.tag && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          background: "rgba(100, 116, 139, 0.2)",
                          color: COLORS.fg,
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                      >
                        {task.tag}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: COLORS.fg,
                      fontWeight: 500,
                    }}
                  >
                    {task.title}
                  </p>
                  {task.reasoning && (
                    <p
                      style={{
                        margin: "4px 0 0 0",
                        fontSize: 12,
                        color: COLORS.fg,
                        opacity: 0.7,
                      }}
                    >
                      {task.reasoning}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRemoveTask(idx)}
                  style={{
                    marginLeft: 12,
                    padding: "4px 8px",
                    background: "rgba(248, 113, 113, 0.15)",
                    color: "#fca5a5",
                    border: "1px solid rgba(248, 113, 113, 0.2)",
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={onAccept}
        disabled={loading || result.tasks.length === 0}
        style={{
          width: "100%",
          padding: "10px 16px",
          background:
            loading || result.tasks.length === 0
              ? COLORS.card
              : COLORS.success,
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 500,
          cursor:
            loading || result.tasks.length === 0
              ? "not-allowed"
              : "pointer",
          opacity:
            loading || result.tasks.length === 0 ? 0.6 : 1,
        }}
      >
        {loading ? "Creating Tasks..." : "Accept & Create Tasks"}
      </button>
    </div>
  );
}

interface IntakeHistoryProps {
  intakes: Intake[];
}

function IntakeHistory({ intakes }: IntakeHistoryProps) {
  if (intakes.length === 0) {
    return (
      <div
        style={{
          background: COLORS.card,
          border: `1px solid rgba(148, 163, 184, 0.2)`,
          borderRadius: 8,
          padding: 16,
          textAlign: "center",
          color: COLORS.fg,
          opacity: 0.7,
          fontSize: 13,
        }}
      >
        No recent intakes
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {intakes.map((intake) => (
        <div
          key={intake.id}
          style={{
            background: COLORS.card,
            border: `1px solid rgba(148, 163, 184, 0.2)`,
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 4,
            }}
          >
            <span style={{ color: COLORS.fg, fontSize: 13, fontWeight: 500, flex: 1 }}>
              {intake.text.substring(0, 50)}...
            </span>
            {intake.analysis && (
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  background: `rgba(16, 185, 129, 0.15)`,
                  color: "#6ee7b7",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                Analyzed
              </span>
            )}
          </div>
          <span style={{ color: COLORS.fg, opacity: 0.6, fontSize: 12 }}>
            {new Date(intake.createdAt).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function IntakePage({}: AppProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [intakeText, setIntakeText] = useState("");
  const [intakeId, setIntakeId] = useState<string>("");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [intakeHistory, setIntakeHistory] = useState<Intake[]>([]);
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);

  /* Load projects */
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setProjectsLoading(true);
        setProjectsError(null);
        const res = await fetch("http://localhost:8787/api/projects");
        if (!res.ok) throw new Error("Failed to load projects");
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setProjectsError(err.message || "Failed to load projects");
        setProjects([]);
      } finally {
        setProjectsLoading(false);
      }
    };
    loadProjects();
  }, []);

  /* Load intake history when project changes */
  useEffect(() => {
    if (!selectedProjectId) {
      setIntakeHistory([]);
      return;
    }

    const loadHistory = async () => {
      try {
        const res = await fetch(
          `http://localhost:8787/api/intakes?projectId=${selectedProjectId}&limit=5`
        );
        if (!res.ok) {
          console.warn("Failed to load intake history");
          setIntakeHistory([]);
          return;
        }
        const data = await res.json();
        setIntakeHistory(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn("Error loading intake history:", err);
        setIntakeHistory([]);
      }
    };

    loadHistory();
  }, [selectedProjectId]);

  /* Handle analysis */
  const handleAnalyze = useCallback(async () => {
    if (!selectedProjectId) {
      setAnalysisError("Please select a project");
      return;
    }
    if (!intakeText.trim()) {
      setAnalysisError("Please enter intake text");
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisError(null);
      setAnalysisResult(null);

      // Step 1: Create intake in database
      const createRes = await fetch("http://localhost:8787/api/intakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          text: intakeText,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.message || "Failed to create intake");
      }

      const createdIntake = await createRes.json();
      setIntakeId(createdIntake.id);

      // Step 2: Analyze the created intake
      const analyzeRes = await fetch("http://localhost:8787/api/analyze-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakeId: createdIntake.id,
        }),
      });

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        throw new Error(err.message || "Analysis failed");
      }

      const result = await analyzeRes.json();
      setAnalysisResult(result);
    } catch (err: any) {
      setAnalysisError(err.message || "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedProjectId, intakeText]);

  /* Handle task removal */
  const handleRemoveTask = useCallback((index: number) => {
    if (!analysisResult) return;
    const updated = {
      ...analysisResult,
      tasks: analysisResult.tasks.filter((_, i) => i !== index),
    };
    setAnalysisResult(updated);
  }, [analysisResult]);

  /* Handle accept */
  const handleAccept = useCallback(async () => {
    if (!analysisResult || analysisResult.tasks.length === 0) return;

    try {
      setIsCreatingTasks(true);

      // Create tasks via POST /api/tasks
      for (const task of analysisResult.tasks) {
        await fetch("http://localhost:8787/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            lane: "review",
            priority: task.priority,
            tag: task.tag,
            project: selectedProjectId,
            owner: task.assignee,
            problem: task.reasoning,
          }),
        });
      }

      // Reset form
      setIntakeText("");
      setAnalysisResult(null);
      setIntakeId("");
      setAnalysisError(null);

      // Reload history
      if (selectedProjectId) {
        const res = await fetch(
          `http://localhost:8787/api/intakes?projectId=${selectedProjectId}&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setIntakeHistory(Array.isArray(data) ? data : []);
        }
      }
    } catch (err: any) {
      setAnalysisError(err.message || "Failed to create tasks");
    } finally {
      setIsCreatingTasks(false);
    }
  }, [analysisResult, selectedProjectId]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.fg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: `1px solid rgba(148, 163, 184, 0.1)`,
          background: "rgba(15, 23, 42, 0.5)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Intake Management</h1>
        <p style={{ margin: "4px 0 0 0", opacity: 0.7, fontSize: 14 }}>
          Submit feature ideas and requirements, analyze them with AI, and create tasks
        </p>
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Input section */}
        <div
          style={{
            flex: 2,
            minWidth: 0,
            padding: 24,
            overflowY: "auto",
            borderRight: `1px solid rgba(148, 163, 184, 0.1)`,
          }}
        >
          {projectsError && (
            <div
              style={{
                padding: "12px 16px",
                background: `rgba(248, 113, 113, 0.1)`,
                color: "#fca5a5",
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 16,
                border: "1px solid rgba(248, 113, 113, 0.2)",
              }}
            >
              {projectsError}
            </div>
          )}

          <ProjectSelector
            projects={projects}
            selectedId={selectedProjectId}
            onSelect={setSelectedProjectId}
            loading={projectsLoading}
          />

          <IntakeInput
            value={intakeText}
            onChange={setIntakeText}
            onSubmit={handleAnalyze}
            loading={isAnalyzing}
            error={analysisError}
          />

          <AnalyzingAnimation show={isAnalyzing} />

          {analysisResult && !isAnalyzing && (
            <ResultsView
              result={analysisResult}
              onRemoveTask={handleRemoveTask}
              onAccept={handleAccept}
              loading={isCreatingTasks}
            />
          )}
        </div>

        {/* Right: History sidebar */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: 24,
            overflowY: "auto",
            background: "rgba(30, 41, 59, 0.3)",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px 0",
              fontSize: 16,
              fontWeight: 600,
              color: COLORS.fg,
            }}
          >
            Recent Intakes
          </h2>
          <IntakeHistory intakes={intakeHistory} />
        </div>
      </div>
    </div>
  );
}
