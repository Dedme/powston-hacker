"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import CodeEditor, { type EditorMarker } from "@/components/CodeEditor";
import type { PowstonSuggestion } from "@/lib/powstonSuggestions";
import { compileTemplate } from "@/lib/compiler";

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
  parentVersionId?: string | null;
  helperSnippets?: HelperSnippet[];
};

type Template = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  authorName?: string | null;
  isPublished?: boolean;
  publishedAt?: string | null;
  currentVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
  currentVersion?: TemplateVersion | null;
  versions?: TemplateVersion[];
};

type HelperSnippet = {
  id: string;
  name: string;
  description?: string | null;
  code: string;
  tags?: string | null;
  isPublished?: boolean;
  authorName?: string | null;
  reviews?: { rating: number }[];
  createdAt?: string;
};

type RuleTestRun = {
  id: string;
  templateId: string;
  templateVersionId: string;
  testCaseId: string;
  inputJson: string;
  expectedAction?: string | null;
  expectedDescription?: string | null;
  actualAction?: string | null;
  actualDescription?: string | null;
  actualReasons?: string | null;
  status: string;
  createdAt: string;
};

type RuleTestCase = {
  id: string;
  templateId: string;
  templateVersionId: string;
  name: string;
  inputJson: string;
  expectedAction?: string | null;
  expectedDescription?: string | null;
  createdAt: string;
};

type Status = {
  tone: "idle" | "loading" | "success" | "error";
  message: string;
};

type FormState = {
  name: string;
  description: string;
  authorName: string;
  isPublished: boolean;
  title: string;
  message: string;
  userParams: string;
  aiTunables: string;
  helpers: string;
  main: string;
  helperSnippetIds: string[];
};

type SectionKey = "userParams" | "aiTunables" | "helpers" | "main";
type SidebarSectionKey = Exclude<SectionKey, "main">;

const emptySections = {
  userParams: "",
  aiTunables: "",
  helpers: "",
  main: ""
};

const sectionConfig: Array<[SidebarSectionKey, string, string]> = [
  ["userParams", "User params", "Inputs and defaults"],
  ["aiTunables", "AI tunables", "Parameters fed to AI"],
  ["helpers", "Helpers", "Shared helper functions"]
];

const defaultSectionState: Record<SidebarSectionKey, boolean> = {
  userParams: true,
  aiTunables: true,
  helpers: true
};

const buildDerivedSuggestions = (values: string[]) => {
  const suggestions: PowstonSuggestion[] = [];
  const seen = new Set<string>();

  const addSuggestion = (label: string, kind: PowstonSuggestion["kind"]) => {
    if (!label || seen.has(label)) {
      return;
    }
    seen.add(label);
    suggestions.push({
      label,
      kind,
      detail: "From other sections",
      documentation: "Defined in User Params / AI Tunables / Helpers."
    });
  };

  const assignmentPattern = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gm;
  const functionPattern = /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm;

  values.forEach((value) => {
    let match: RegExpExecArray | null;
    while ((match = assignmentPattern.exec(value)) !== null) {
      addSuggestion(match[1], "variable");
    }
    while ((match = functionPattern.exec(value)) !== null) {
      addSuggestion(match[1], "function");
    }
  });

  return suggestions;
};

export default function RuleStudio() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    authorName: "",
    isPublished: false,
    title: "",
    message: "",
    ...emptySections,
    helperSnippetIds: []
  });
  const [compiled, setCompiled] = useState("");
  const [status, setStatus] = useState<Status>({ tone: "idle", message: "" });
  const [isWorking, setIsWorking] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showHelperModal, setShowHelperModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyTab, setHistoryTab] = useState<
    "history" | "preview" | "metrics" | "community" | "test"
  >("history");
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [testInput, setTestInput] = useState("{\n  \n}");
  const [testFields, setTestFields] = useState<Array<{ key: string; value: string }>>([
    { key: "", value: "" }
  ]);
  const [applyTestOverrides, setApplyTestOverrides] = useState(true);
  const [expectedAction, setExpectedAction] = useState("");
  const [expectedDescription, setExpectedDescription] = useState("");
  const [testName, setTestName] = useState("");
  const [testCases, setTestCases] = useState<RuleTestCase[]>([]);
  const [testCasesLoading, setTestCasesLoading] = useState(false);
  const [testRuns, setTestRuns] = useState<RuleTestRun[]>([]);
  const [testRunsLoading, setTestRunsLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testNotice, setTestNotice] = useState<string | null>(null);
  const [drawerWidth, setDrawerWidth] = useState(720);
  const [isDrawerResizing, setIsDrawerResizing] = useState(false);
  const drawerResizeStart = useRef({ x: 0, width: 720 });
  const [diffSplit, setDiffSplit] = useState(50);
  const [isDiffResizing, setIsDiffResizing] = useState(false);
  const diffResizeStart = useRef({ x: 0, split: 50 });
  const diffContainerRef = useRef<HTMLDivElement | null>(null);
  const [helperSearch, setHelperSearch] = useState("");
  const [helperSnippets, setHelperSnippets] = useState<HelperSnippet[]>([]);
  const [validationMarkers, setValidationMarkers] = useState<{
    userParams: EditorMarker[];
    aiTunables: EditorMarker[];
    main: EditorMarker[];
  }>({ userParams: [], aiTunables: [], main: [] });
  const [validationErrors, setValidationErrors] = useState<
    { section: string; line: number; message: string }[]
  >([]);
  const [helperForm, setHelperForm] = useState({
    name: "",
    description: "",
    code: "",
    tags: "",
    rating: 0,
    comment: "",
    isPublished: false,
    authorName: ""
  });
  const [sectionOpen, setSectionOpen] = useState<Record<SidebarSectionKey, boolean>>(
    defaultSectionState
  );
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ x: 0, width: 420 });

  const compiledDisplay = compiled || "# Compile a template to preview the output.";

  const derivedSuggestions = useMemo(
    () => buildDerivedSuggestions([form.userParams, form.aiTunables, form.helpers]),
    [form.userParams, form.aiTunables, form.helpers]
  );

  const activeTemplate = useMemo(
    () => templates.find((template: Template) => template.id === activeId) ?? null,
    [templates, activeId]
  );

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [versions, selectedVersionId]
  );

  const compareVersion = useMemo(
    () => versions.find((version) => version.id === compareVersionId) ?? null,
    [versions, compareVersionId]
  );

  const buildLineDiff = (leftText: string, rightText: string) => {
    const leftLines = leftText.split("\n");
    const rightLines = rightText.split("\n");
    const leftLength = leftLines.length;
    const rightLength = rightLines.length;
    const dp = Array.from({ length: leftLength + 1 }, () =>
      Array(rightLength + 1).fill(0)
    );

    for (let i = leftLength - 1; i >= 0; i -= 1) {
      for (let j = rightLength - 1; j >= 0; j -= 1) {
        if (leftLines[i] === rightLines[j]) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    const diff: { left: string; right: string; status: "same" | "added" | "removed"; line: number }[] = [];
    let i = 0;
    let j = 0;
    let line = 1;

    while (i < leftLength && j < rightLength) {
      if (leftLines[i] === rightLines[j]) {
        diff.push({ left: leftLines[i], right: rightLines[j], status: "same", line });
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        diff.push({ left: leftLines[i], right: "", status: "removed", line });
        i += 1;
      } else {
        diff.push({ left: "", right: rightLines[j], status: "added", line });
        j += 1;
      }
      line += 1;
    }

    while (i < leftLength) {
      diff.push({ left: leftLines[i], right: "", status: "removed", line });
      i += 1;
      line += 1;
    }

    while (j < rightLength) {
      diff.push({ left: "", right: rightLines[j], status: "added", line });
      j += 1;
      line += 1;
    }

    return diff;
  };

  const diffLines = useMemo(
    () => buildLineDiff(selectedVersion?.compiled ?? "", compareVersion?.compiled ?? ""),
    [selectedVersion?.compiled, compareVersion?.compiled]
  );

  const loadTemplates = async () => {
    const response = await fetch("/api/templates", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return (await response.json()) as Template[];
  };

  const loadHelperSnippets = async (query?: string) => {
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    const response = await fetch(`/api/helpers${params}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return (await response.json()) as HelperSnippet[];
  };

  const loadVersions = async (templateId: string) => {
    setVersionsLoading(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/versions`, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as TemplateVersion[];
      setVersions(data);
      setSelectedVersionId((prev) => prev ?? data[0]?.id ?? null);
      setCompareVersionId((prev) => prev ?? (data[1]?.id ?? data[0]?.id ?? null));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load versions";
      setStatus({ tone: "error", message });
    } finally {
      setVersionsLoading(false);
    }
  };

  const loadTestRuns = async (templateId: string, templateVersionId?: string | null) => {
    setTestRunsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("templateId", templateId);
      if (templateVersionId) {
        params.set("templateVersionId", templateVersionId);
      }
      params.set("limit", "20");
      const response = await fetch(`/api/tests/run?${params.toString()}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as RuleTestRun[];
      setTestRuns(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load test runs";
      setStatus({ tone: "error", message });
    } finally {
      setTestRunsLoading(false);
    }
  };

  const loadTestCases = async (templateId: string, templateVersionId?: string | null) => {
    setTestCasesLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("templateId", templateId);
      if (templateVersionId) {
        params.set("templateVersionId", templateVersionId);
      }
      const response = await fetch(`/api/tests?${params.toString()}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as RuleTestCase[];
      setTestCases(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load tests";
      setStatus({ tone: "error", message });
    } finally {
      setTestCasesLoading(false);
    }
  };

  const parseFieldValue = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === "") {
      return "";
    }
    if (trimmed === "true") {
      return true;
    }
    if (trimmed === "false") {
      return false;
    }
    if (trimmed === "null") {
      return null;
    }
    if (!Number.isNaN(Number(trimmed)) && trimmed !== "") {
      return Number(trimmed);
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  };

  const buildTestInput = () => {
    let base: Record<string, unknown> = {};
    try {
      base = JSON.parse(testInput || "{}") as Record<string, unknown>;
    } catch {
      throw new Error("Invalid JSON input.");
    }

    const merged = { ...base };
    testFields.forEach((field) => {
      const key = field.key.trim();
      if (!key) {
        return;
      }
      merged[key] = parseFieldValue(field.value);
    });

    return merged;
  };

  const buildOverrides = () => {
    const overrides: Record<string, unknown> = {};
    testFields.forEach((field) => {
      const key = field.key.trim();
      if (!key) {
        return;
      }
      overrides[key] = parseFieldValue(field.value);
    });
    return overrides;
  };

  const formatReasons = (reasons?: string | null) => {
    if (!reasons) {
      return null;
    }
    try {
      const parsed = JSON.parse(reasons);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return reasons;
    }
  };

  const hydrateFromTemplate = (template: Template) => {
    const version = template.currentVersion ?? template.versions?.[0];
    setActiveId(template.id);
    setForm({
      name: template.name,
      description: template.description ?? "",
      authorName: template.authorName ?? "",
      isPublished: template.isPublished ?? false,
      title: version?.title ?? "",
      message: version?.message ?? "",
      userParams: version?.userParams ?? "",
      aiTunables: version?.aiTunables ?? "",
      helpers: version?.helpers ?? "",
      main: version?.main ?? "",
      helperSnippetIds: version?.helperSnippets?.map((snippet) => snippet.id) ?? []
    });
    setCompiled(version?.compiled ?? "");
  };

  const refresh = async (pickId?: string | null) => {
    const data = await loadTemplates();
    setTemplates(data);
    if (pickId) {
      const match = data.find((template) => template.id === pickId);
      if (match) {
        hydrateFromTemplate(match);
        return;
      }
    }
    if (!activeId && data.length > 0) {
      hydrateFromTemplate(data[0]);
    }
  };

  useEffect(() => {
    refresh().catch((error) =>
      setStatus({ tone: "error", message: error.message })
    );
  }, []);

  useEffect(() => {
    loadHelperSnippets(helperSearch)
      .then(setHelperSnippets)
      .catch((error) => setStatus({ tone: "error", message: error.message }));
  }, [helperSearch]);

  useEffect(() => {
    if (!showHistoryDrawer || !activeId) {
      return;
    }
    loadVersions(activeId).catch(() => undefined);
  }, [showHistoryDrawer, activeId]);

  useEffect(() => {
    if (!showHistoryDrawer || !activeId) {
      return;
    }
    loadTestRuns(activeId, selectedVersionId).catch(() => undefined);
  }, [showHistoryDrawer, activeId, selectedVersionId]);

  useEffect(() => {
    if (!showHistoryDrawer || !activeId) {
      return;
    }
    loadTestCases(activeId, selectedVersionId).catch(() => undefined);
  }, [showHistoryDrawer, activeId, selectedVersionId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("powston.sectionVisibility");
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Partial<Record<SidebarSectionKey, boolean>>;
      setSectionOpen((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      "powston.sectionVisibility",
      JSON.stringify(sectionOpen)
    );
  }, [sectionOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("powston.sidebarWidth");
    if (!stored) {
      return;
    }
    const parsed = Number.parseInt(stored, 10);
    if (!Number.isNaN(parsed)) {
      setSidebarWidth(parsed);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("powston.sidebarWidth", String(sidebarWidth));
  }, [sidebarWidth]);

  const resetToNew = () => {
    setActiveId(null);
    setForm({
      name: "",
      description: "",
      authorName: "",
      isPublished: false,
      title: "",
      message: "",
      ...emptySections,
      helperSnippetIds: []
    });
    setCompiled("");
  };

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev: FormState) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    setIsWorking(true);
    setStatus({ tone: "loading", message: "Creating template..." });
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const created = (await response.json()) as Template;
      await refresh(created.id);
      setStatus({ tone: "success", message: "Template created." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus({ tone: "error", message });
    } finally {
      setIsWorking(false);
    }
  };

  const handleSave = async () => {
    if (!activeId) {
      return handleCreate();
    }
    setIsWorking(true);
    setStatus({ tone: "loading", message: "Saving new version..." });
    try {
      const response = await fetch(`/api/templates/${activeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const updated = (await response.json()) as Template;
      await refresh(updated.id);
      setStatus({ tone: "success", message: "Version saved." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus({ tone: "error", message });
    } finally {
      setIsWorking(false);
    }
  };

  const openSaveModal = () => {
    setShowSaveModal(true);
  };

  const openHistoryDrawer = () => {
    if (!activeId) {
      setStatus({ tone: "error", message: "Select a rule to view history." });
      return;
    }
    setShowHistoryDrawer(true);
    setHistoryTab("history");
  };

  const handleSaveFromModal = async () => {
    setShowSaveModal(false);
    await handleSave();
  };

  const handleCompile = async () => {
    setIsWorking(true);
    setStatus({ tone: "loading", message: "Compiling sections..." });
    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userParams: form.userParams,
          aiTunables: form.aiTunables,
          helpers: form.helpers,
          helperSnippetIds: form.helperSnippetIds,
          main: form.main
        })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as { compiled: string };
      setCompiled(data.compiled);
      setStatus({ tone: "success", message: "Compiled successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus({ tone: "error", message });
    } finally {
      setIsWorking(false);
    }
  };

  const handleValidate = async () => {
    setIsWorking(true);
    setStatus({ tone: "loading", message: "Validating with Powston..." });
    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compiled: compiled || undefined,
          userParams: form.userParams,
          aiTunables: form.aiTunables,
          helpers: form.helpers,
          helperSnippetIds: form.helperSnippetIds,
          main: form.main
        })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as {
        message?: string;
        ok?: boolean;
        details?: { status?: boolean; report?: [number, string][] };
      };
      const report = Array.isArray(data.details?.report) ? data.details?.report : [];
      if (report.length > 0) {
        const compiledForMap = compileTemplate({
          userParams: form.userParams,
          aiTunables: form.aiTunables,
          helpers: form.helpers,
          helperSnippets: helperSnippets
            .filter((snippet) => form.helperSnippetIds.includes(snippet.id))
            .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
            .map((snippet) => snippet.code),
          main: form.main
        });
        const { markersBySection, errors } = mapReportToMarkers(report, compiledForMap);
        setValidationMarkers(markersBySection);
        setValidationErrors(errors);
        setStatus({
          tone: "error",
          message: data.message || "Validation failed."
        });
      } else {
        setValidationMarkers({ userParams: [], aiTunables: [], main: [] });
        setValidationErrors([]);
        setStatus({
          tone: "success",
          message: data.message || "Validation complete."
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus({ tone: "error", message });
      setValidationMarkers({ userParams: [], aiTunables: [], main: [] });
      setValidationErrors([]);
    } finally {
      setIsWorking(false);
    }
  };

  const handleFormatTestJson = () => {
    setTestError(null);
    try {
      const parsed = JSON.parse(testInput || "{}");
      setTestInput(JSON.stringify(parsed, null, 2));
      setTestNotice("Formatted JSON.");
    } catch {
      setTestError("Invalid JSON input.");
    }
  };

  const handleCopyTestJson = async () => {
    setTestError(null);
    try {
      await navigator.clipboard.writeText(testInput);
      setTestNotice("Copied JSON to clipboard.");
    } catch {
      setTestError("Unable to copy to clipboard.");
    }
  };

  const handlePasteTestJson = async () => {
    setTestError(null);
    try {
      const text = await navigator.clipboard.readText();
      setTestInput(text);
      setTestNotice("Pasted JSON from clipboard.");
    } catch {
      setTestError("Unable to read clipboard.");
    }
  };

  const handleAddTestField = () => {
    setTestFields((prev) => [...prev, { key: "", value: "" }]);
  };

  const handleRemoveTestField = (index: number) => {
    setTestFields((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateTestField = (index: number, key: "key" | "value", value: string) => {
    setTestFields((prev) =>
      prev.map((field, idx) => (idx === index ? { ...field, [key]: value } : field))
    );
  };

  const handleCreateTest = async () => {
    setTestError(null);
    setTestNotice(null);
    if (!activeId) {
      setTestError("Select a rule before creating tests.");
      return;
    }
    const versionId = selectedVersionId ?? activeTemplate?.currentVersion?.id;
    if (!versionId) {
      setTestError("Select a version before creating tests.");
      return;
    }
    if (!testName.trim()) {
      setTestError("Add a test name before creating.");
      return;
    }

    let inputJson: Record<string, unknown>;
    try {
      inputJson = buildTestInput();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON input.";
      setTestError(message);
      return;
    }

    setIsWorking(true);
    try {
      const response = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: activeId,
          templateVersionId: versionId,
          name: testName.trim(),
          inputJson,
          expectedAction: expectedAction || null,
          expectedDescription: expectedDescription || null
        })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const testCase = (await response.json()) as RuleTestCase;
      setTestCases((prev) => [testCase, ...prev]);
      setTestNotice("Test created.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create test.";
      setTestError(message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleRunTest = async (testCaseId: string) => {
    setTestError(null);
    setTestNotice(null);
    setIsWorking(true);
    try {
      const overrides = applyTestOverrides ? buildOverrides() : null;
      const response = await fetch("/api/tests/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testCaseId,
          overrides: overrides && Object.keys(overrides).length ? overrides : undefined
        })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const run = (await response.json()) as RuleTestRun;
      setTestRuns((prev) => [run, ...prev]);
      setTestNotice("Test run completed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to run test.";
      setTestError(message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleLoadTest = (testCase: RuleTestCase) => {
    try {
      const formatted = JSON.stringify(JSON.parse(testCase.inputJson || "{}"), null, 2);
      setTestInput(formatted);
    } catch {
      setTestInput(testCase.inputJson);
    }
    setTestName(testCase.name);
    setExpectedAction(testCase.expectedAction ?? "");
    setExpectedDescription(testCase.expectedDescription ?? "");
    setTestNotice(`Loaded test "${testCase.name}" into editor.`);
  };

  const handleDeleteTest = async (testCaseId: string) => {
    setTestError(null);
    setTestNotice(null);
    setIsWorking(true);
    try {
      const response = await fetch(`/api/tests?id=${testCaseId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setTestCases((prev) => prev.filter((tc) => tc.id !== testCaseId));
      setTestRuns((prev) => prev.filter((r) => r.testCaseId !== testCaseId));
      setTestNotice("Test deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete test.";
      setTestError(message);
    } finally {
      setIsWorking(false);
    }
  };

  const toggleSection = (key: SidebarSectionKey) => {
    setSectionOpen((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleHelperSnippet = (id: string) => {
    setForm((prev) => {
      const exists = prev.helperSnippetIds.includes(id);
      return {
        ...prev,
        helperSnippetIds: exists
          ? prev.helperSnippetIds.filter((item) => item !== id)
          : [...prev.helperSnippetIds, id]
      };
    });
  };

  const handleCreateHelper = async () => {
    if (!helperForm.name.trim() || !helperForm.code.trim()) {
      setStatus({ tone: "error", message: "Helper name and code are required." });
      return;
    }
    setIsWorking(true);
    try {
      const tags = helperForm.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const response = await fetch("/api/helpers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: helperForm.name,
          description: helperForm.description,
          code: helperForm.code,
          tags,
          isPublished: helperForm.isPublished,
          authorName: helperForm.authorName,
          rating: helperForm.rating || undefined,
          comment: helperForm.comment || undefined
        })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const created = (await response.json()) as HelperSnippet;
      setHelperSnippets((prev) => [created, ...prev]);
      setForm((prev) => ({
        ...prev,
        helperSnippetIds: prev.helperSnippetIds.includes(created.id)
          ? prev.helperSnippetIds
          : [...prev.helperSnippetIds, created.id]
      }));
      setHelperForm({
        name: "",
        description: "",
        code: "",
        tags: "",
        rating: 0,
        comment: "",
        isPublished: false,
        authorName: ""
      });
      setShowHelperModal(false);
      setStatus({ tone: "success", message: "Helper snippet created." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus({ tone: "error", message });
    } finally {
      setIsWorking(false);
    }
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeStart.current = { x: event.clientX, width: sidebarWidth };
    setIsResizing(true);

    const handleMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - resizeStart.current.x;
      const next = resizeStart.current.width - delta;
      setSidebarWidth(next);
    };

    const handleUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const handleDiffResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    diffResizeStart.current = { x: event.clientX, split: diffSplit };
    setIsDiffResizing(true);

    const handleMove = (moveEvent: PointerEvent) => {
      if (!diffContainerRef.current) {
        return;
      }
      const width = diffContainerRef.current.getBoundingClientRect().width;
      if (!width) {
        return;
      }
      const delta = moveEvent.clientX - diffResizeStart.current.x;
      const next = diffResizeStart.current.split + (delta / width) * 100;
      const clamped = Math.min(80, Math.max(20, next));
      setDiffSplit(clamped);
    };

    const handleUp = () => {
      setIsDiffResizing(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const handleDrawerResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    drawerResizeStart.current = { x: event.clientX, width: drawerWidth };
    setIsDrawerResizing(true);

    const handleMove = (moveEvent: PointerEvent) => {
      const delta = drawerResizeStart.current.x - moveEvent.clientX;
      const next = drawerResizeStart.current.width + delta;
      const clamped = Math.min(1200, Math.max(520, next));
      setDrawerWidth(clamped);
    };

    const handleUp = () => {
      setIsDrawerResizing(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  function mapReportToMarkers(report: [number, string][], compiledText: string) {
    const lines = compiledText.split("\n");
    const headerIndex = (label: string) =>
      lines.findIndex((line) => line.trim() === `# === ${label} ===`);

    const headers = [
      { key: "userParams", label: "USER PARAMS" },
      { key: "aiTunables", label: "AI TUNABLES" },
      { key: "helpers", label: "HELPERS" },
      { key: "main", label: "MAIN" }
    ]
      .map((entry) => ({
        ...entry,
        index: headerIndex(entry.label)
      }))
      .filter((entry) => entry.index >= 0)
      .sort((a, b) => a.index - b.index);

    const markersBySection = {
      userParams: [] as EditorMarker[],
      aiTunables: [] as EditorMarker[],
      main: [] as EditorMarker[]
    };
    const errors: { section: string; line: number; message: string }[] = [];

    report.forEach(([line, message]) => {
      if (typeof line !== "number") {
        return;
      }
      const header = headers.findLast((entry) => line > entry.index + 1);
      if (!header) {
        return;
      }
      const headerLine = header.index + 1;
      const localLine = line - headerLine;
      if (localLine < 1) {
        return;
      }
      if (header.key === "helpers") {
        errors.push({ section: "Helpers", line: localLine, message });
        return;
      }

      const marker: EditorMarker = {
        startLineNumber: localLine,
        startColumn: 1,
        endLineNumber: localLine,
        endColumn: 1,
        message,
        severity: "error"
      };

      if (header.key === "userParams") {
        markersBySection.userParams.push(marker);
        errors.push({ section: "User Params", line: localLine, message });
      }
      if (header.key === "aiTunables") {
        markersBySection.aiTunables.push(marker);
        errors.push({ section: "AI Tunables", line: localLine, message });
      }
      if (header.key === "main") {
        markersBySection.main.push(marker);
        errors.push({ section: "Main", line: localLine, message });
      }
    });

    return { markersBySection, errors };
  }

  return (
    <section className="grid h-full min-h-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-3 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Rules</h2>
          <button
            className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-200 hover:border-slate-500"
            onClick={resetToNew}
          >
            New
          </button>
        </div>
        <div className="mt-3 flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {templates.length === 0 ? (
            <p className="text-xs text-slate-400">No templates yet. Start a new one!</p>
          ) : (
            templates.map((template: Template) => (
              <button
                key={template.id}
                className={clsx(
                  "flex flex-col rounded-lg border px-2.5 py-1.5 text-left transition",
                  activeId === template.id
                    ? "border-cobalt bg-cobalt/20 text-white"
                    : "border-slate-800 bg-slate-950/60 text-slate-200 hover:border-slate-700"
                )}
                onClick={() => hydrateFromTemplate(template)}
              >
                <span className="text-xs font-semibold">{template.name}</span>
                <span className="text-[10px] text-slate-400">{template.slug}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 shadow-xl">
          <div className="flex flex-1 items-center gap-2">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">Name</label>
            <input
              className="h-8 flex-1 rounded-lg border border-slate-700 bg-white px-3 text-xs"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              placeholder="Fraud ruleset"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:border-slate-500"
              onClick={openHistoryDrawer}
            >
              History & Views
            </button>
            <button
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:border-slate-500"
              onClick={handleCompile}
              disabled={isWorking}
            >
              Compile
            </button>
            <button
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:border-slate-500"
              onClick={handleValidate}
              disabled={isWorking}
            >
              Validate
            </button>
            <button
              className="rounded-full bg-cobalt px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-cobalt/30 hover:bg-cobalt/90"
              onClick={openSaveModal}
              disabled={isWorking || form.name.trim().length === 0}
            >
              {activeTemplate ? "Save" : "Create"}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex min-h-0 flex-1 gap-2">
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50">
              <CodeEditor
                value={form.main}
                onChange={(value) => setField("main", value)}
                height="100%"
                suggestions={derivedSuggestions}
                markers={validationMarkers.main}
              />
            </div>

            <div
              className={clsx(
                "flex w-2 cursor-col-resize items-center justify-center rounded-full bg-slate-900/80",
                isResizing && "bg-cobalt/50"
              )}
              onPointerDown={handleResizeStart}
              role="separator"
              aria-orientation="vertical"
            >
              <span className="h-8 w-0.5 rounded-full bg-slate-700" />
            </div>

            <div
              className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/40 p-3"
              style={{ width: sidebarWidth }}
            >
              {sectionConfig.map(([key, title, hint]) => (
                <div key={key} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-left"
                    onClick={() => toggleSection(key)}
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{title}</p>
                      <p className="text-[10px] text-slate-400">{hint}</p>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {sectionOpen[key] ? "Hide" : "Show"}
                    </span>
                  </button>
                  {sectionOpen[key] && (
                    <div className="mt-2">
                      {key === "helpers" ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              className="h-8 flex-1 rounded-lg border border-slate-800 bg-slate-900/70 px-2 text-[11px] text-slate-100"
                              placeholder="Search helper snippets"
                              value={helperSearch}
                              onChange={(event) => setHelperSearch(event.target.value)}
                            />
                            <button
                              className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-500"
                              type="button"
                              onClick={() => setShowHelperModal(true)}
                            >
                              New
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                            {helperSnippets.length === 0 ? (
                              <p className="text-[10px] text-slate-400">No helpers found.</p>
                            ) : (
                              <ul className="flex flex-col gap-2">
                                {helperSnippets.map((snippet) => (
                                  <li key={snippet.id} className="flex items-start gap-2">
                                    <input
                                      type="checkbox"
                                      className="mt-0.5"
                                      checked={form.helperSnippetIds.includes(snippet.id)}
                                      onChange={() => toggleHelperSnippet(snippet.id)}
                                    />
                                    <div className="flex-1">
                                      <p className="text-[11px] font-semibold text-slate-100">
                                        {snippet.name}
                                      </p>
                                      <p className="text-[10px] text-slate-400">
                                        {snippet.description || "No description"}
                                      </p>
                                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                                        <span>
                                          ⭐{" "}
                                          {snippet.reviews?.length
                                            ? (
                                                snippet.reviews.reduce((sum, review) => sum + review.rating, 0) /
                                                snippet.reviews.length
                                              ).toFixed(1)
                                            : "-"}
                                        </span>
                                        {snippet.tags && (
                                          <span>
                                            {snippet.tags
                                              .split(",")
                                              .map((tag) => tag.trim())
                                              .filter(Boolean)
                                              .slice(0, 3)
                                              .join(" · ")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ) : (
                        <CodeEditor
                          value={form[key]}
                          onChange={(value) => setField(key, value)}
                          height={200}
                          markers={
                            key === "userParams"
                              ? validationMarkers.userParams
                              : key === "aiTunables"
                                ? validationMarkers.aiTunables
                                : undefined
                          }
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white">Compiled output</p>
                  <span className="text-[10px] text-slate-400">Preview</span>
                </div>
                <div className="mt-2">
                  <CodeEditor value={compiledDisplay} readOnly height={200} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <h3 className="text-xs font-semibold text-white">Status</h3>
                <p
                  className={clsx(
                    "mt-2 rounded-lg border px-2 py-1 text-[11px]",
                    status.tone === "error" && "border-red-500/60 text-red-200",
                    status.tone === "success" && "border-emerald-500/60 text-emerald-200",
                    status.tone === "loading" && "border-slate-600 text-slate-200",
                    status.tone === "idle" && "border-slate-700 text-slate-400"
                  )}
                >
                  {status.message || "Ready."}
                </p>
                {validationErrors.length > 0 && (
                  <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1 text-[10px] text-rose-200">
                    {validationErrors.map((issue, index) => (
                      <li key={`${issue.line}-${index}`}>
                        {issue.section} line {issue.line}: {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Save details</h3>
                <p className="text-xs text-slate-400">
                  Optional metadata stored with this version.
                </p>
              </div>
              <button
                className="text-xs text-slate-400 hover:text-slate-200"
                onClick={() => setShowSaveModal(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <label className="text-xs uppercase tracking-wide text-slate-400">Description</label>
              <input
                className="h-9 rounded-lg border border-slate-700 bg-white px-3 text-sm"
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
                placeholder="Short notes about this template"
              />

              <label className="text-xs uppercase tracking-wide text-slate-400">Version title</label>
              <input
                className="h-9 rounded-lg border border-slate-700 bg-white px-3 text-sm"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Initial draft"
              />

              <label className="text-xs uppercase tracking-wide text-slate-400">Change notes</label>
              <input
                className="h-9 rounded-lg border border-slate-700 bg-white px-3 text-sm"
                value={form.message}
                onChange={(event) => setField("message", event.target.value)}
                placeholder="Added helper for velocity"
              />

              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Publish to library</p>
                  <p className="text-[11px] text-slate-400">Expose this template in /library.</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(event) => setField("isPublished", event.target.checked)}
                />
              </div>

              <label className="text-xs uppercase tracking-wide text-slate-400">Author name</label>
              <input
                className="h-9 rounded-lg border border-slate-700 bg-white px-3 text-sm"
                value={form.authorName}
                onChange={(event) => setField("authorName", event.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-white hover:border-slate-500"
                onClick={() => setShowSaveModal(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-cobalt px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cobalt/30 hover:bg-cobalt/90"
                onClick={handleSaveFromModal}
                disabled={isWorking}
                type="button"
              >
                {activeTemplate ? "Save version" : "Create template"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showHelperModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">New helper snippet</h3>
                <p className="text-xs text-slate-400">
                  Create a reusable helper snippet for this workspace.
                </p>
              </div>
              <button
                className="text-xs text-slate-400 hover:text-slate-200"
                onClick={() => setShowHelperModal(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <label className="text-xs uppercase tracking-wide text-slate-400">Name</label>
              <input
                className="h-9 rounded-lg border border-slate-700 bg-white px-3 text-sm"
                value={helperForm.name}
                onChange={(event) =>
                  setHelperForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Energy helper"
              />

              <label className="text-xs uppercase tracking-wide text-slate-400">Description</label>
              <input
                className="h-9 rounded-lg border border-slate-700 bg-white px-3 text-sm"
                value={helperForm.description}
                onChange={(event) =>
                  setHelperForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Short description"
              />

              <label className="text-xs uppercase tracking-wide text-slate-400">Code</label>
              <CodeEditor
                value={helperForm.code}
                onChange={(value) => setHelperForm((prev) => ({ ...prev, code: value }))}
                height={200}
              />

              <label className="text-xs uppercase tracking-wide text-slate-400">Tags</label>
              <input
                className="h-9 rounded-lg border border-slate-700 bg-white px-3 text-sm"
                value={helperForm.tags}
                onChange={(event) =>
                  setHelperForm((prev) => ({ ...prev, tags: event.target.value }))
                }
                placeholder="comma, separated, tags"
              />

              <label className="text-xs uppercase tracking-wide text-slate-400">Rating (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                className="h-9 rounded-lg border border-slate-700 bg-white px-3 text-sm"
                value={helperForm.rating || ""}
                onChange={(event) =>
                  setHelperForm((prev) => ({
                    ...prev,
                    rating: Number(event.target.value) || 0
                  }))
                }
                placeholder="5"
              />

              <label className="text-xs uppercase tracking-wide text-slate-400">Comment</label>
              <input
                className="h-9 rounded-lg border border-slate-700 bg-white px-3 text-sm"
                value={helperForm.comment}
                onChange={(event) =>
                  setHelperForm((prev) => ({ ...prev, comment: event.target.value }))
                }
                placeholder="Why is this helper useful?"
              />

              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Publish to library</p>
                  <p className="text-[11px] text-slate-400">Make this snippet public.</p>
                </div>
                <input
                  type="checkbox"
                  checked={helperForm.isPublished}
                  onChange={(event) =>
                    setHelperForm((prev) => ({
                      ...prev,
                      isPublished: event.target.checked
                    }))
                  }
                />
              </div>

              <label className="text-xs uppercase tracking-wide text-slate-400">Author name</label>
              <input
                className="h-9 rounded-lg border border-slate-700 bg-white px-3 text-sm"
                value={helperForm.authorName}
                onChange={(event) =>
                  setHelperForm((prev) => ({ ...prev, authorName: event.target.value }))
                }
                placeholder="Your name"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-white hover:border-slate-500"
                onClick={() => setShowHelperModal(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-cobalt px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cobalt/30 hover:bg-cobalt/90"
                onClick={handleCreateHelper}
                disabled={isWorking}
                type="button"
              >
                Create helper
              </button>
            </div>
          </div>
        </div>
      )}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/70">
          <div className="relative flex h-full flex-col border-l border-slate-800 bg-slate-950" style={{ width: drawerWidth }}>
            <div
              className={clsx(
                "absolute left-0 top-0 flex h-full w-2 cursor-col-resize items-center justify-center",
                isDrawerResizing && "bg-cobalt/20"
              )}
              onPointerDown={handleDrawerResizeStart}
              role="separator"
              aria-orientation="vertical"
            >
              <span className="h-16 w-0.5 rounded-full bg-slate-700" />
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-white">History & Views</h3>
                <p className="text-xs text-slate-400">
                  {activeTemplate?.name || "Select a rule"}
                </p>
              </div>
              <button
                className="text-xs text-slate-400 hover:text-slate-200"
                onClick={() => setShowHistoryDrawer(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-900 px-5 py-3 text-xs">
              {([
                { key: "history", label: "History" },
                { key: "preview", label: "Preview" },
                { key: "metrics", label: "Metrics" },
                { key: "community", label: "Community" },
                { key: "test", label: "Test Engine" }
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  className={clsx(
                    "rounded-full border px-3 py-1",
                    historyTab === tab.key
                      ? "border-cobalt bg-cobalt/20 text-white"
                      : "border-slate-700 text-slate-300 hover:border-slate-500"
                  )}
                  onClick={() => setHistoryTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              {historyTab === "history" && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">Versions</h4>
                      <span className="text-[10px] text-slate-400">
                        {versionsLoading ? "Loading..." : `${versions.length} total`}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div>
                        <label className="text-[10px] uppercase text-slate-400">Primary</label>
                        <select
                          className="mt-1 h-8 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
                          value={selectedVersionId ?? ""}
                          onChange={(event) => setSelectedVersionId(event.target.value)}
                        >
                          {versions.map((version) => (
                            <option key={version.id} value={version.id}>
                              {version.title || "Untitled"} · {new Date(version.createdAt).toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-slate-400">Compare</label>
                        <select
                          className="mt-1 h-8 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
                          value={compareVersionId ?? ""}
                          onChange={(event) => setCompareVersionId(event.target.value)}
                        >
                          {versions.map((version) => (
                            <option key={version.id} value={version.id}>
                              {version.title || "Untitled"} · {new Date(version.createdAt).toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">Diff</h4>
                      <span className="text-[10px] text-slate-400">Compiled output</span>
                    </div>
                    <div
                      className="mt-3 grid gap-3"
                      ref={diffContainerRef}
                      style={{ gridTemplateColumns: `${diffSplit}% 10px ${100 - diffSplit}%` }}
                    >
                      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                        <p className="text-[10px] uppercase text-slate-400">Primary</p>
                        <div className="mt-2 space-y-1 text-[11px] text-slate-200">
                          {diffLines.map((line) => (
                            <div
                              key={`left-${line.line}`}
                              className={clsx(
                                "font-mono",
                                line.status === "removed" && "text-rose-300",
                                line.status === "added" && "text-slate-500"
                              )}
                            >
                              {line.left || " "}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div
                        className={clsx(
                          "flex cursor-col-resize items-center justify-center rounded-full bg-slate-900/80",
                          isDiffResizing && "bg-cobalt/50"
                        )}
                        onPointerDown={handleDiffResizeStart}
                        role="separator"
                        aria-orientation="vertical"
                      >
                        <span className="h-10 w-0.5 rounded-full bg-slate-700" />
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                        <p className="text-[10px] uppercase text-slate-400">Compare</p>
                        <div className="mt-2 space-y-1 text-[11px] text-slate-200">
                          {diffLines.map((line) => (
                            <div
                              key={`right-${line.line}`}
                              className={clsx(
                                "font-mono",
                                line.status === "added" && "text-emerald-200",
                                line.status === "removed" && "text-slate-500"
                              )}
                            >
                              {line.right || " "}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {historyTab === "preview" && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <h4 className="text-xs font-semibold text-white">Compiled preview</h4>
                  <div className="mt-2">
                    <CodeEditor value={selectedVersion?.compiled ?? ""} readOnly height={360} />
                  </div>
                </div>
              )}

              {historyTab === "metrics" && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <h4 className="text-xs font-semibold text-white">Validation metrics</h4>
                  <p className="mt-2 text-[11px] text-slate-300">{status.message}</p>
                  {validationErrors.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-[11px] text-rose-200">
                      {validationErrors.map((issue, index) => (
                        <li key={`${issue.section}-${index}`}>
                          {issue.section} line {issue.line}: {issue.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[11px] text-slate-500">No validation errors yet.</p>
                  )}
                  <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-[11px] font-semibold text-white">Recent test runs</h5>
                      <span className="text-[10px] text-slate-400">
                        {testRunsLoading ? "Loading..." : `${testRuns.length} runs`}
                      </span>
                    </div>
                    {testRuns.length === 0 ? (
                      <p className="mt-2 text-[11px] text-slate-500">No test runs yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-[11px] text-slate-200">
                        {testRuns.slice(0, 5).map((run) => (
                          <li key={run.id} className="rounded-md border border-slate-800 px-2 py-1">
                            <details>
                              <summary className="flex cursor-pointer items-center justify-between">
                                <span className="text-slate-400">
                                  {new Date(run.createdAt).toLocaleString()}
                                </span>
                                <span
                                  className={clsx(
                                    "text-[10px] uppercase",
                                    run.status === "pass" && "text-emerald-300",
                                    run.status === "fail" && "text-rose-300",
                                    run.status === "error" && "text-orange-300",
                                    run.status === "pending" && "text-amber-300"
                                  )}
                                >
                                  {run.status}
                                </span>
                              </summary>
                              <div className="mt-2 text-[10px] text-slate-300">
                                <p>Expected action: {run.expectedAction || "-"}</p>
                                <p>Expected description: {run.expectedDescription || "-"}</p>
                                <p>Actual action: {run.actualAction || "-"}</p>
                                <p>Actual description: {run.actualDescription || "-"}</p>
                              </div>
                              {run.status === "error" && run.actualDescription && (
                                <pre className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-orange-800/50 bg-orange-950/20 p-2 text-[10px] text-orange-200 whitespace-pre-wrap">
{run.actualDescription}
                                </pre>
                              )}
                              {run.actualReasons && (
                                <pre className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-[10px] text-slate-200">
{formatReasons(run.actualReasons)}
                                </pre>
                              )}
                            </details>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {historyTab === "test" && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">Saved tests</h4>
                      <span className="text-[10px] text-slate-400">
                        {testCasesLoading ? "Loading..." : `${testCases.length} tests`}
                      </span>
                    </div>
                    {testCases.length === 0 ? (
                      <p className="mt-2 text-[11px] text-slate-500">
                        No saved tests yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-[11px] text-slate-200">
                        {testCases.map((testCase) => (
                          <li
                            key={testCase.id}
                            className="rounded-md border border-slate-800 px-2 py-2"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-white">{testCase.name}</p>
                                <p className="text-[10px] text-slate-400">
                                  {new Date(testCase.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-500"
                                  type="button"
                                  onClick={() => handleLoadTest(testCase)}
                                  disabled={isWorking}
                                >
                                  Load
                                </button>
                                <button
                                  className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-500"
                                  type="button"
                                  onClick={() => handleRunTest(testCase.id)}
                                  disabled={isWorking}
                                >
                                  Run
                                </button>
                                <button
                                  className="rounded-full border border-rose-800/50 px-2 py-1 text-[10px] text-rose-300 hover:border-rose-600"
                                  type="button"
                                  onClick={() => handleDeleteTest(testCase.id)}
                                  disabled={isWorking}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 text-[10px] text-slate-300">
                              Expected: {testCase.expectedAction || "-"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">Test inputs</h4>
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-500"
                          type="button"
                          onClick={handlePasteTestJson}
                        >
                          Paste JSON
                        </button>
                        <button
                          className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-500"
                          type="button"
                          onClick={handleFormatTestJson}
                        >
                          Format
                        </button>
                        <button
                          className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-500"
                          type="button"
                          onClick={handleCopyTestJson}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <CodeEditor
                        value={testInput}
                        onChange={setTestInput}
                        language="json"
                        height={220}
                      />
                    </div>
                    {testError && (
                      <p className="mt-2 text-[11px] text-rose-300">{testError}</p>
                    )}
                    {testNotice && (
                      <p className="mt-2 text-[11px] text-emerald-300">{testNotice}</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">Common fields</h4>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] text-slate-300">
                          <input
                            type="checkbox"
                            checked={applyTestOverrides}
                            onChange={(event) => setApplyTestOverrides(event.target.checked)}
                          />
                          Apply on run
                        </label>
                        <button
                          className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-500"
                          type="button"
                          onClick={handleAddTestField}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-2">
                      {testFields.map((field, index) => (
                        <div key={`field-${index}`} className="flex items-center gap-2">
                          <input
                            className="h-8 w-1/3 rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-[11px] text-slate-100"
                            placeholder="key"
                            value={field.key}
                            onChange={(event) =>
                              handleUpdateTestField(index, "key", event.target.value)
                            }
                          />
                          <input
                            className="h-8 flex-1 rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-[11px] text-slate-100"
                            placeholder="value"
                            value={field.value}
                            onChange={(event) =>
                              handleUpdateTestField(index, "value", event.target.value)
                            }
                          />
                          <button
                            className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-500"
                            type="button"
                            onClick={() => handleRemoveTestField(index)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <h4 className="text-xs font-semibold text-white">Expected outcome</h4>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <input
                        className="h-8 rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-[11px] text-slate-100"
                        placeholder="Test name"
                        value={testName}
                        onChange={(event) => setTestName(event.target.value)}
                      />
                      <input
                        className="h-8 rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-[11px] text-slate-100"
                        placeholder="Expected action (e.g. charge)"
                        value={expectedAction}
                        onChange={(event) => setExpectedAction(event.target.value)}
                        list="powston-actions"
                      />
                      <input
                        className="h-8 rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-[11px] text-slate-100"
                        placeholder="Expected description"
                        value={expectedDescription}
                        onChange={(event) => setExpectedDescription(event.target.value)}
                      />
                    </div>
                    <datalist id="powston-actions">
                      <option value="charge" />
                      <option value="discharge" />
                      <option value="idle" />
                      <option value="export" />
                      <option value="import" />
                    </datalist>
                    <div className="mt-3 flex items-center justify-end">
                      <button
                        className="rounded-full bg-cobalt px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-cobalt/30 hover:bg-cobalt/90"
                        type="button"
                        onClick={handleCreateTest}
                        disabled={isWorking}
                      >
                        Create test
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">Recent runs</h4>
                      <span className="text-[10px] text-slate-400">
                        {testRunsLoading ? "Loading..." : `${testRuns.length} runs`}
                      </span>
                    </div>
                    {testRuns.length === 0 ? (
                      <p className="mt-2 text-[11px] text-slate-500">No runs yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-[11px] text-slate-200">
                        {testRuns.slice(0, 6).map((run) => (
                          <li key={run.id} className="rounded-md border border-slate-800 px-2 py-1">
                            <details>
                              <summary className="flex cursor-pointer items-center justify-between">
                                <span className="text-slate-400">
                                  {new Date(run.createdAt).toLocaleString()}
                                </span>
                                <span
                                  className={clsx(
                                    "text-[10px] uppercase",
                                    run.status === "pass" && "text-emerald-300",
                                    run.status === "fail" && "text-rose-300",
                                    run.status === "error" && "text-orange-300",
                                    run.status === "pending" && "text-amber-300"
                                  )}
                                >
                                  {run.status}
                                </span>
                              </summary>
                              <div className="mt-2 text-[10px] text-slate-300">
                                <p>Expected action: {run.expectedAction || "-"}</p>
                                <p>Expected description: {run.expectedDescription || "-"}</p>
                                <p>Actual action: {run.actualAction || "-"}</p>
                                <p>Actual description: {run.actualDescription || "-"}</p>
                              </div>
                              {run.status === "error" && run.actualDescription && (
                                <pre className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-orange-800/50 bg-orange-950/20 p-2 text-[10px] text-orange-200 whitespace-pre-wrap">
{run.actualDescription}
                                </pre>
                              )}
                              {run.actualReasons && (
                                <pre className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-[10px] text-slate-200">
{formatReasons(run.actualReasons)}
                                </pre>
                              )}
                            </details>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {historyTab === "community" && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <h4 className="text-xs font-semibold text-white">Community</h4>
                  <div className="mt-3 space-y-2 text-[11px] text-slate-300">
                    <p>
                      <span className="text-slate-400">Published:</span>{" "}
                      {activeTemplate?.isPublished ? "Yes" : "No"}
                    </p>
                    <p>
                      <span className="text-slate-400">Author:</span>{" "}
                      {activeTemplate?.authorName || "Unknown"}
                    </p>
                    <p>
                      <span className="text-slate-400">Published at:</span>{" "}
                      {activeTemplate?.publishedAt
                        ? new Date(activeTemplate.publishedAt).toLocaleString()
                        : "-"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
