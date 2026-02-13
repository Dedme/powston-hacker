"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";

// ─── Types ──────────────────────────────────────────────────────────────────

type Template = {
  id: string;
  name: string;
  slug: string;
  currentVersionId: string | null;
  versions?: TemplateVersion[];
};

type TemplateVersion = {
  id: string;
  templateId: string;
  title?: string | null;
  message?: string | null;
  userParams: string;
  aiTunables: string;
  helpers: string;
  main: string;
  compiled: string;
  createdAt: string;
};

type Suite = {
  id: string;
  templateId: string;
  name: string;
  description?: string | null;
  userParamsOverride?: string | null;
  aiTunablesOverride?: string | null;
  createdAt: string;
  testCases: SuiteTestCaseSummary[];
  suiteRuns: SuiteRunSummary[];
};

type SuiteTestCaseSummary = {
  id: string;
  name: string;
  expectedAction?: string | null;
};

type SuiteRunSummary = {
  id: string;
  passCount: number;
  failCount: number;
  errorCount: number;
  totalCount: number;
  createdAt: string;
};

type TestCase = {
  id: string;
  templateId: string;
  templateVersionId: string;
  suiteId?: string | null;
  name: string;
  inputJson: string;
  expectedAction?: string | null;
  expectedDescription?: string | null;
  createdAt: string;
};

type SuiteRunResult = {
  id: string;
  suiteId: string;
  templateVersionId: string;
  passCount: number;
  failCount: number;
  errorCount: number;
  totalCount: number;
  createdAt: string;
  userParamsSnapshot?: string | null;
  aiTunablesSnapshot?: string | null;
  runs: RunResult[];
};

type RunResult = {
  id: string;
  testCaseId: string;
  testCaseName?: string;
  expectedAction?: string | null;
  actualAction?: string | null;
  actualDescription?: string | null;
  actualReasons?: string | null;
  status: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const statusColor = (status: string) => {
  switch (status) {
    case "pass":
      return "text-emerald-400";
    case "fail":
      return "text-rose-400";
    case "error":
      return "text-orange-400";
    default:
      return "text-amber-400";
  }
};

const statusBg = (status: string) => {
  switch (status) {
    case "pass":
      return "bg-emerald-500/10 border-emerald-500/30";
    case "fail":
      return "bg-rose-500/10 border-rose-500/30";
    case "error":
      return "bg-orange-500/10 border-orange-500/30";
    default:
      return "bg-amber-500/10 border-amber-500/30";
  }
};

const formatReasons = (reasons: string) => {
  try {
    const parsed = JSON.parse(reasons);
    if (Array.isArray(parsed)) {
      return parsed
        .map(
          (r: { action?: string; description?: string }) =>
            `${r.action ?? "?"}: ${r.description ?? ""}`
        )
        .join("\n");
    }
    return reasons;
  } catch {
    return reasons;
  }
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function TestEngine() {
  // Templates + versions
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");

  // Suites
  const [suites, setSuites] = useState<Suite[]>([]);
  const [activeSuiteId, setActiveSuiteId] = useState<string>("");
  const [newSuiteName, setNewSuiteName] = useState("");

  // Test cases for active suite
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  // New test case form
  const [newTestName, setNewTestName] = useState("");
  const [newTestInput, setNewTestInput] = useState("{}");
  const [newTestExpected, setNewTestExpected] = useState("");

  // Variable overrides
  const [userParamsOverride, setUserParamsOverride] = useState("");
  const [aiTunablesOverride, setAiTunablesOverride] = useState("");

  // Suite run results
  const [suiteRunHistory, setSuiteRunHistory] = useState<SuiteRunResult[]>([]);
  const [latestRun, setLatestRun] = useState<SuiteRunResult | null>(null);

  // UI state
  const [isRunning, setIsRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<
    "cases" | "variables" | "results"
  >("cases");

  // ─── Data loading ───────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data);
        if (data.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Load versions when template changes
  useEffect(() => {
    if (!selectedTemplateId) return;
    fetch(`/api/templates/${selectedTemplateId}/versions`)
      .then((r) => r.json())
      .then((data) => {
        setVersions(data);
        const tmpl = templates.find((t) => t.id === selectedTemplateId);
        if (tmpl?.currentVersionId) {
          setSelectedVersionId(tmpl.currentVersionId);
        } else if (data.length > 0) {
          setSelectedVersionId(data[0].id);
        }
      })
      .catch(() => {});
  }, [selectedTemplateId, templates]);

  // Load suites when template changes
  const loadSuites = useCallback(() => {
    if (!selectedTemplateId) return;
    fetch(`/api/suites?templateId=${selectedTemplateId}`)
      .then((r) => r.json())
      .then((data) => {
        setSuites(data);
        if (data.length > 0 && !activeSuiteId) {
          setActiveSuiteId(data[0].id);
        }
      })
      .catch(() => {});
  }, [selectedTemplateId]);

  useEffect(() => {
    loadSuites();
  }, [loadSuites]);

  // Load test cases when active suite changes
  useEffect(() => {
    if (!activeSuiteId) {
      setTestCases([]);
      return;
    }
    fetch(
      `/api/tests?suiteId=${activeSuiteId}`
    )
      .then((r) => r.json())
      .then((data) => {
        setTestCases(data);
      })
      .catch(() => {});

    // Load suite override variables
    const suite = suites.find((s) => s.id === activeSuiteId);
    if (suite) {
      setUserParamsOverride(suite.userParamsOverride ?? "");
      setAiTunablesOverride(suite.aiTunablesOverride ?? "");
    }
  }, [activeSuiteId, suites, selectedTemplateId]);

  // Load suite run history
  useEffect(() => {
    if (!activeSuiteId) {
      setSuiteRunHistory([]);
      return;
    }
    fetch(`/api/suites/run?suiteId=${activeSuiteId}&limit=10`)
      .then((r) => r.json())
      .then((data) => {
        setSuiteRunHistory(data);
        if (data.length > 0) setLatestRun(data[0]);
      })
      .catch(() => {});
  }, [activeSuiteId]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handleCreateSuite = async () => {
    if (!newSuiteName.trim() || !selectedTemplateId) return;
    setError(null);
    try {
      const res = await fetch("/api/suites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          name: newSuiteName.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const suite = await res.json();
      setNewSuiteName("");
      loadSuites();
      setActiveSuiteId(suite.id);
      setNotice(`Suite "${suite.name}" created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create suite");
    }
  };

  const handleDeleteSuite = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/suites?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      if (activeSuiteId === id) setActiveSuiteId("");
      loadSuites();
      setNotice("Suite deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete suite");
    }
  };

  const handleAddTestCase = async () => {
    if (!newTestName.trim() || !activeSuiteId || !selectedVersionId) return;
    setError(null);
    try {
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          templateVersionId: selectedVersionId,
          name: newTestName.trim(),
          inputJson: JSON.parse(newTestInput),
          expectedAction: newTestExpected || null,
          suiteId: activeSuiteId,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNewTestName("");
      setNewTestInput("{}");
      setNewTestExpected("");
      // Reload test cases
      const data = await fetch(
        `/api/tests?suiteId=${activeSuiteId}`
      ).then((r) => r.json());
      setTestCases(data);
      loadSuites();
      setNotice("Test case added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add test");
    }
  };

  const handleDeleteTestCase = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/tests?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setTestCases((prev) => prev.filter((tc) => tc.id !== id));
      loadSuites();
      setNotice("Test case deleted.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete test case"
      );
    }
  };

  const handleSaveOverrides = async () => {
    if (!activeSuiteId) return;
    setError(null);
    try {
      const res = await fetch(`/api/suites?id=${activeSuiteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userParamsOverride: userParamsOverride || null,
          aiTunablesOverride: aiTunablesOverride || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      loadSuites();
      setNotice("Variable overrides saved.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save overrides"
      );
    }
  };

  const handleRunSuite = async () => {
    if (!activeSuiteId || !selectedVersionId) return;
    setIsRunning(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/suites/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suiteId: activeSuiteId,
          templateVersionId: selectedVersionId,
          userParamsOverride: userParamsOverride || null,
          aiTunablesOverride: aiTunablesOverride || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = (await res.json()) as SuiteRunResult;
      setLatestRun(result);
      setSuiteRunHistory((prev) => [result, ...prev]);
      setActivePanel("results");
      const summary = `${result.passCount} pass, ${result.failCount} fail, ${result.errorCount} error`;
      setNotice(`Suite run complete: ${summary}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run suite");
    } finally {
      setIsRunning(false);
    }
  };

  // ─── Derived ─────────────────────────────────────────────────────────────

  const activeSuite = suites.find((s) => s.id === activeSuiteId);
  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full gap-3">
      {/* ═══ LEFT: Suites + Template picker ═══ */}
      <div className="flex w-64 flex-shrink-0 flex-col gap-3 overflow-y-auto">
        {/* Template selector */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <h3 className="text-xs font-semibold text-white">Template</h3>
          <select
            className="mt-2 h-8 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-[11px] text-slate-100"
            value={selectedTemplateId}
            onChange={(e) => {
              setSelectedTemplateId(e.target.value);
              setActiveSuiteId("");
            }}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className="mt-1 h-8 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-[11px] text-slate-100"
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title || v.message || `v${v.createdAt.slice(0, 10)}`}
              </option>
            ))}
          </select>
        </div>

        {/* Suite list */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <h3 className="text-xs font-semibold text-white">Test Suites</h3>
          <ul className="mt-2 space-y-1">
            {suites.map((suite) => {
              const lastRun = suite.suiteRuns[0];
              return (
                <li key={suite.id}>
                  <button
                    type="button"
                    className={clsx(
                      "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px]",
                      activeSuiteId === suite.id
                        ? "bg-cobalt/20 text-white"
                        : "text-slate-300 hover:bg-slate-800/50"
                    )}
                    onClick={() => setActiveSuiteId(suite.id)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{suite.name}</span>
                      <span className="text-[9px] text-slate-500">
                        {suite.testCases.length} tests
                      </span>
                    </div>
                    {lastRun && (
                      <div className="flex items-center gap-1 text-[9px]">
                        <span className="text-emerald-400">
                          {lastRun.passCount}
                        </span>
                        <span className="text-slate-600">/</span>
                        <span className="text-rose-400">
                          {lastRun.failCount}
                        </span>
                        <span className="text-slate-600">/</span>
                        <span className="text-orange-400">
                          {lastRun.errorCount}
                        </span>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex gap-1">
            <input
              className="h-7 flex-1 rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-[11px] text-slate-100"
              placeholder="New suite name"
              value={newSuiteName}
              onChange={(e) => setNewSuiteName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateSuite()}
            />
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-2 text-[10px] text-slate-200 hover:border-slate-500"
              onClick={handleCreateSuite}
            >
              +
            </button>
          </div>
        </div>

        {/* Run button */}
        {activeSuite && (
          <button
            type="button"
            className={clsx(
              "rounded-xl py-3 text-sm font-semibold text-white shadow-lg",
              isRunning
                ? "cursor-wait bg-cobalt/50"
                : "bg-cobalt shadow-cobalt/30 hover:bg-cobalt/90"
            )}
            onClick={handleRunSuite}
            disabled={isRunning || testCases.length === 0}
          >
            {isRunning
              ? "Running..."
              : `Run Suite (${testCases.length} tests)`}
          </button>
        )}
      </div>

      {/* ═══ CENTER: Test cases / Variables ═══ */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
        {/* Notices */}
        {error && (
          <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-300">
            {notice}
          </div>
        )}

        {/* Panel tabs */}
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-1">
          {(["cases", "variables", "results"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={clsx(
                "flex-1 rounded-md px-3 py-1.5 text-[11px] font-medium capitalize",
                activePanel === tab
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              )}
              onClick={() => setActivePanel(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Test Cases Panel ── */}
        {activePanel === "cases" && activeSuite && (
          <div className="flex flex-col gap-3">
            {/* Existing test cases */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <h4 className="text-xs font-semibold text-white">
                Test Cases in &ldquo;{activeSuite.name}&rdquo;
              </h4>
              {testCases.length === 0 ? (
                <p className="mt-2 text-[11px] text-slate-500">
                  No test cases yet. Add one below.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {testCases.map((tc) => {
                    const runResult = latestRun?.runs.find(
                      (r) => r.testCaseId === tc.id
                    );
                    return (
                      <div
                        key={tc.id}
                        className={clsx(
                          "rounded-lg border p-2 text-[11px]",
                          runResult
                            ? statusBg(runResult.status)
                            : "border-slate-800"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-white">
                              {tc.name}
                            </span>
                            {tc.expectedAction && (
                              <span className="ml-2 text-[10px] text-slate-400">
                                expects:{" "}
                                <span className="text-slate-300">
                                  {tc.expectedAction}
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {runResult && (
                              <span
                                className={clsx(
                                  "text-[10px] font-semibold uppercase",
                                  statusColor(runResult.status)
                                )}
                              >
                                {runResult.status}
                                {runResult.actualAction &&
                                  runResult.status !== "pass" &&
                                  ` → ${runResult.actualAction}`}
                              </span>
                            )}
                            <button
                              type="button"
                              className="rounded border border-rose-800/50 px-1.5 py-0.5 text-[9px] text-rose-300 hover:border-rose-600"
                              onClick={() => handleDeleteTestCase(tc.id)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        {runResult && runResult.status !== "pass" && (
                          <div className="mt-1 text-[10px] text-slate-400">
                            {runResult.actualDescription}
                          </div>
                        )}
                        {runResult?.actualReasons &&
                          runResult.status !== "pass" && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-[9px] text-slate-500 hover:text-slate-300">
                                Decision trace
                              </summary>
                              <pre className="mt-1 max-h-32 overflow-y-auto rounded border border-slate-800 bg-slate-950/70 p-1.5 text-[9px] text-slate-300">
                                {formatReasons(runResult.actualReasons)}
                              </pre>
                            </details>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add test case */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <h4 className="text-xs font-semibold text-white">
                Add Test Case
              </h4>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  className="h-8 rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-[11px] text-slate-100"
                  placeholder="Test name"
                  value={newTestName}
                  onChange={(e) => setNewTestName(e.target.value)}
                />
                <input
                  className="h-8 rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-[11px] text-slate-100"
                  placeholder="Expected action (charge, export, etc.)"
                  value={newTestExpected}
                  onChange={(e) => setNewTestExpected(e.target.value)}
                  list="test-actions"
                />
              </div>
              <datalist id="test-actions">
                <option value="import" />
                <option value="export" />
                <option value="auto" />
                <option value="charge" />
                <option value="discharge" />
                <option value="idle" />
                <option value="fullstop" />
              </datalist>
              <textarea
                className="mt-2 h-40 w-full rounded-lg border border-slate-800 bg-slate-950/70 p-2 font-mono text-[11px] text-slate-100"
                placeholder="Test input JSON..."
                value={newTestInput}
                onChange={(e) => setNewTestInput(e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500"
                  onClick={() => {
                    try {
                      setNewTestInput(
                        JSON.stringify(JSON.parse(newTestInput), null, 2)
                      );
                    } catch {
                      setError("Invalid JSON");
                    }
                  }}
                >
                  Format
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-cobalt px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-cobalt/90"
                  onClick={handleAddTestCase}
                >
                  Add Test
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Variables Panel ── */}
        {activePanel === "variables" && activeSuite && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-white">
                  AI Tunables Override
                </h4>
                <span className="text-[9px] text-slate-500">
                  Leave blank to use template defaults
                </span>
              </div>
              <textarea
                className="mt-2 h-48 w-full rounded-lg border border-slate-800 bg-slate-950/70 p-2 font-mono text-[11px] text-slate-100"
                placeholder={
                  selectedVersion?.aiTunables || "# AI tunables..."
                }
                value={aiTunablesOverride}
                onChange={(e) => setAiTunablesOverride(e.target.value)}
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-white">
                  User Params Override
                </h4>
                <span className="text-[9px] text-slate-500">
                  Leave blank to use template defaults
                </span>
              </div>
              <textarea
                className="mt-2 h-48 w-full rounded-lg border border-slate-800 bg-slate-950/70 p-2 font-mono text-[11px] text-slate-100"
                placeholder={
                  selectedVersion?.userParams || "# User params..."
                }
                value={userParamsOverride}
                onChange={(e) => setUserParamsOverride(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-cobalt px-4 py-2 text-[11px] font-semibold text-white hover:bg-cobalt/90"
                onClick={handleSaveOverrides}
              >
                Save Overrides
              </button>
            </div>
          </div>
        )}

        {/* ── Results Panel ── */}
        {activePanel === "results" && (
          <div className="flex flex-col gap-3">
            {/* Latest run summary */}
            {latestRun && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white">
                    Latest Run
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {new Date(latestRun.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-3 flex gap-4">
                  <div className="flex flex-col items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
                    <span className="text-2xl font-bold text-emerald-400">
                      {latestRun.passCount}
                    </span>
                    <span className="text-[9px] uppercase text-emerald-400/70">
                      pass
                    </span>
                  </div>
                  <div className="flex flex-col items-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2">
                    <span className="text-2xl font-bold text-rose-400">
                      {latestRun.failCount}
                    </span>
                    <span className="text-[9px] uppercase text-rose-400/70">
                      fail
                    </span>
                  </div>
                  <div className="flex flex-col items-center rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2">
                    <span className="text-2xl font-bold text-orange-400">
                      {latestRun.errorCount}
                    </span>
                    <span className="text-[9px] uppercase text-orange-400/70">
                      error
                    </span>
                  </div>
                  <div className="flex flex-col items-center rounded-lg border border-slate-700 px-4 py-2">
                    <span className="text-2xl font-bold text-slate-300">
                      {latestRun.totalCount}
                    </span>
                    <span className="text-[9px] uppercase text-slate-500">
                      total
                    </span>
                  </div>
                </div>

                {/* Per-test results */}
                <div className="mt-4 space-y-1.5">
                  {latestRun.runs.map((run) => (
                    <details
                      key={run.id}
                      className={clsx(
                        "rounded-lg border p-2",
                        statusBg(run.status)
                      )}
                    >
                      <summary className="flex cursor-pointer items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span
                            className={clsx(
                              "font-semibold uppercase",
                              statusColor(run.status)
                            )}
                          >
                            {run.status}
                          </span>
                          <span className="text-white">
                            {run.testCaseName || run.testCaseId.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          {run.expectedAction && (
                            <span>exp: {run.expectedAction}</span>
                          )}
                          {run.actualAction && (
                            <span>got: {run.actualAction}</span>
                          )}
                        </div>
                      </summary>
                      <div className="mt-2 text-[10px] text-slate-300">
                        <p>{run.actualDescription || "-"}</p>
                        {run.actualReasons && (
                          <pre className="mt-1 max-h-32 overflow-y-auto rounded border border-slate-800 bg-slate-950/70 p-1.5 text-[9px]">
                            {formatReasons(run.actualReasons)}
                          </pre>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {/* Run history */}
            {suiteRunHistory.length > 1 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                <h4 className="text-xs font-semibold text-white">
                  Run History
                </h4>
                <div className="mt-2 space-y-1">
                  {suiteRunHistory.map((run, idx) => (
                    <button
                      key={run.id}
                      type="button"
                      className={clsx(
                        "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[10px]",
                        latestRun?.id === run.id
                          ? "bg-slate-800 text-white"
                          : "text-slate-400 hover:bg-slate-800/50"
                      )}
                      onClick={() => setLatestRun(run)}
                    >
                      <span>
                        Run #{suiteRunHistory.length - idx}{" "}
                        <span className="text-slate-500">
                          {new Date(run.createdAt).toLocaleString()}
                        </span>
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-400">
                          {run.passCount}
                        </span>
                        <span className="text-slate-600">/</span>
                        <span className="text-rose-400">{run.failCount}</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-orange-400">
                          {run.errorCount}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!latestRun && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-[11px] text-slate-500">
                No runs yet. Add test cases and click &ldquo;Run Suite&rdquo;.
              </div>
            )}
          </div>
        )}

        {/* No suite selected */}
        {!activeSuite && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center text-[11px] text-slate-500">
            Select or create a test suite to get started.
          </div>
        )}
      </div>
    </div>
  );
}
