"use client";

import dynamic from "next/dynamic";
import clsx from "clsx";
import { useEffect, useMemo, useRef } from "react";
import { useMonaco } from "@monaco-editor/react";
import type { editor as MonacoEditorType } from "monaco-editor";
import {
  powstonBaseSuggestions,
  toUniqueSuggestions,
  type PowstonSuggestion
} from "@/lib/powstonSuggestions";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false
});

type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  height?: number | string;
  readOnly?: boolean;
  className?: string;
  suggestions?: PowstonSuggestion[];
  markers?: EditorMarker[];
};

export type EditorMarker = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity?: "error" | "warning" | "info";
};

const kindMap = {
  variable: 6,
  function: 1,
  constant: 21,
  property: 9,
  class: 7
} as const;

let globalSuggestions: any[] = [];
let providerRegistered = false;

export default function CodeEditor({
  value,
  onChange,
  language = "python",
  height = 240,
  readOnly = false,
  className,
  suggestions = [],
  markers = []
}: CodeEditorProps) {
  const monaco = useMonaco();
  const editorRef = useRef<MonacoEditorType.IStandaloneCodeEditor | null>(null);

  const completionItems = useMemo(
    () =>
      toUniqueSuggestions([...powstonBaseSuggestions, ...suggestions]).map((item) => ({
        label: item.label,
        kind: item.kind ? kindMap[item.kind] : 6,
        insertText: item.insertText ?? item.label,
        insertTextRules: item.insertText ? 4 : undefined,
        detail: item.detail,
        documentation: item.documentation
      })),
    [suggestions]
  );

  useEffect(() => {
    if (!monaco) {
      return;
    }
    globalSuggestions = completionItems;
    if (!providerRegistered) {
      monaco.languages.registerCompletionItemProvider("python", {
        provideCompletionItems: () => ({
          suggestions: globalSuggestions
        })
      });
      providerRegistered = true;
    }
  }, [monaco, completionItems]);

  useEffect(() => {
    if (!monaco || !editorRef.current) {
      return;
    }
    const model = editorRef.current.getModel();
    if (!model) {
      return;
    }
    const severityMap = {
      error: monaco.MarkerSeverity.Error,
      warning: monaco.MarkerSeverity.Warning,
      info: monaco.MarkerSeverity.Info
    } as const;

    monaco.editor.setModelMarkers(
      model,
      "powston",
      markers.map((marker) => ({
        ...marker,
        severity: severityMap[marker.severity ?? "error"]
      }))
    );
  }, [monaco, markers]);

  return (
    <div
      className={clsx("overflow-hidden rounded-xl border border-slate-700", className)}
      style={{ height }}
    >
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        theme="vs-dark"
        onChange={(next) => onChange?.(next ?? "")}
        onMount={(editor) => {
          editorRef.current = editor;
        }}
        options={{
          readOnly,
          minimap: { enabled: false },
          lineNumbers: "on",
          fontSize: 12,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          smoothScrolling: true,
          renderLineHighlight: "line",
          padding: { top: 12, bottom: 12 }
        }}
      />
    </div>
  );
}
