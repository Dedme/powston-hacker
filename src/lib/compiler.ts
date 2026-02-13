export type TemplateSections = {
  userParams: string;
  aiTunables: string;
  helpers: string;
  helperSnippets?: string[];
  main: string;
};

const normalize = (value: string) => value.trim().replace(/\n{3,}/g, "\n\n");

export const compileTemplate = (sections: TemplateSections) => {
  const userParams = normalize(sections.userParams ?? "");
  const aiTunables = normalize(sections.aiTunables ?? "");
  const helpers = normalize(sections.helpers ?? "");
  const snippetHelpers = (sections.helperSnippets ?? [])
    .map((snippet) => normalize(snippet))
    .filter(Boolean)
    .join("\n\n");
  const main = normalize(sections.main ?? "");
  const combinedHelpers = [helpers, snippetHelpers].filter(Boolean).join("\n\n");

  return [
    "# === USER PARAMS ===",
    userParams,
    "",
    "# === AI TUNABLES ===",
    aiTunables,
    "",
    "# === HELPERS ===",
    combinedHelpers,
    "",
    "# === MAIN ===",
    main,
    ""
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
};
