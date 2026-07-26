import {
  useCreatePrompt,
  useCreatePromptVersion,
  useProjects,
  usePromotePromptVersion,
  usePromptVersions,
  usePrompts,
  useRunPlayground,
} from "@repo/api-client";
import type { LLMProvider, PlaygroundRunResponse, Prompt, PromptVersion } from "@repo/types";
import { Badge, Button, Input, cn } from "@repo/ui";
import {
  IconArrowUpCircle,
  IconBookmark,
  IconChevronDown,
  IconClock,
  IconColumns,
  IconDeviceFloppy,
  IconFileDiff,
  IconGitBranch,
  IconPlayerPlay,
  IconPlus,
  IconSearch,
  IconVersions,
} from "@tabler/icons-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type TabId = "library" | "editor" | "playground";

const TABS: { id: TabId; label: string }[] = [
  { id: "library", label: "Library" },
  { id: "editor", label: "Editor" },
  { id: "playground", label: "Playground" },
];

const PROVIDERS: LLMProvider[] = [
  "anthropic",
  "openai",
  "azure-openai",
  "bedrock",
  "ollama",
  "gemini",
];

const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  anthropic: ["claude-sonnet-4-20250514", "claude-haiku-4-20250414"],
  openai: ["gpt-4o", "gpt-4o-mini"],
  "azure-openai": ["gpt-4o", "gpt-4o-mini"],
  bedrock: ["anthropic.claude-sonnet-4"],
  ollama: ["llama3.2"],
  gemini: ["gemini-2.0-flash"],
};

/** Rough context-window labels for the editor model chip (mock parity). */
const MODEL_CONTEXT: Record<string, string> = {
  "claude-sonnet-4-20250514": "200k",
  "claude-haiku-4-20250414": "200k",
  "gpt-4o": "128k",
  "gpt-4o-mini": "128k",
  "anthropic.claude-sonnet-4": "200k",
  "llama3.2": "128k",
  "gemini-2.0-flash": "1M",
};

function formatCalls(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 1 : 1).replace(/\.0$/, "")}k`;
  return String(n);
}

function estimatePlaygroundCost(result: PlaygroundRunResponse | null): string {
  if (!result) return "—";
  const input = result.inputTokens ?? 0;
  const output = result.outputTokens ?? 0;
  if (!input && !output) return "—";
  // Lightweight display estimate (not billed) — keeps the mock metrics column filled.
  const usd = input * 0.00000025 + output * 0.00000125;
  return `$${usd.toFixed(4)}`;
}

function displayTitle(name: string): string {
  const slug = name.includes("/") ? name.slice(name.lastIndexOf("/") + 1) : name;
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusBadgeClass(status: PromptVersion["status"]): string {
  switch (status) {
    case "active":
      return "border-transparent bg-[#0d2a1a] text-success";
    case "testing":
      return "border-transparent bg-[#2a2000] text-warning";
    default:
      return "border-transparent bg-secondary text-muted-foreground";
  }
}

function canPromote(status: PromptVersion["status"]): boolean {
  return status === "draft" || status === "testing";
}

function promoteLabel(status: PromptVersion["status"]): string {
  if (status === "draft") return "Promote to testing";
  if (status === "testing") return "Promote to active";
  return "Promote";
}

function extractVariableNames(template: string): string[] {
  const names = new Set<string>();
  for (const match of template.matchAll(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g)) {
    names.add(match[1]);
  }
  return [...names];
}

function pickDisplayVersion(
  versions: PromptVersion[],
  activeVersionId?: string,
): PromptVersion | undefined {
  if (!versions.length) return undefined;
  return (
    versions.find((v) => v.id === activeVersionId) ??
    versions.find((v) => v.status === "active") ??
    versions[versions.length - 1]
  );
}

function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: PromptVersion["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium",
        statusBadgeClass(status),
      )}
    >
      {status === "active" || status === "testing" ? (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      ) : null}
      {status}
    </span>
  );
}

function PromptCard({
  prompt,
  selected,
  onSelect,
}: {
  prompt: Prompt;
  selected: boolean;
  onSelect: () => void;
}) {
  const { data: versions = [] } = usePromptVersions(prompt.id);
  const display = pickDisplayVersion(versions, prompt.activeVersionId);
  const latency = display?.metrics?.avgLatencyMs;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Open ${prompt.name}`}
      onClick={onSelect}
      className={cn(
        "rounded-[10px] border bg-background p-3 text-left transition-colors",
        selected ? "border-primary" : "border-border hover:border-input",
      )}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {displayTitle(prompt.name)}
          </div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground/70">{prompt.name}</div>
        </div>
        {display ? <StatusBadge status={display.status} /> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {display ? (
          <Badge
            variant="secondary"
            className="rounded-full font-mono text-2xs font-normal text-muted-foreground"
          >
            {display.model}
          </Badge>
        ) : null}
        {display ? (
          <span className="inline-flex items-center gap-0.5 text-2xs text-muted-foreground/70">
            <IconVersions className="size-3" aria-hidden />v{display.version}
          </span>
        ) : null}
        {latency != null ? (
          <span className="inline-flex items-center gap-0.5 text-2xs text-muted-foreground/70">
            <IconClock className="size-3" aria-hidden />
            {Math.round(latency)}ms
          </span>
        ) : null}
      </div>
    </button>
  );
}

export default function App() {
  const { data: projects = [] } = useProjects();
  const [projectId, setProjectId] = useState("");
  const effectiveProjectId = projectId || projects[0]?.id || "";

  const { data: prompts = [], isLoading: loadingPrompts } = usePrompts({
    projectId: effectiveProjectId,
  });
  const createPrompt = useCreatePrompt();
  const createVersion = useCreatePromptVersion();
  const promoteVersion = usePromotePromptVersion();
  const runPlayground = useRunPlayground();

  const [tab, setTab] = useState<TabId>("library");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [selectedPromptId, setSelectedPromptId] = useState("");
  const selectedPrompt = useMemo(
    () => prompts.find((p) => p.id === selectedPromptId) ?? prompts[0],
    [prompts, selectedPromptId],
  );
  const effectivePromptId = selectedPrompt?.id ?? "";

  const { data: versions = [], isLoading: loadingVersions } = usePromptVersions(
    effectivePromptId || undefined,
  );

  const [selectedVersionId, setSelectedVersionId] = useState("");
  const selectedVersion = useMemo(() => {
    if (!versions.length) return undefined;
    return (
      versions.find((v) => v.id === selectedVersionId) ??
      versions.find((v) => v.id === selectedPrompt?.activeVersionId) ??
      versions[versions.length - 1]
    );
  }, [versions, selectedVersionId, selectedPrompt?.activeVersionId]);

  const filteredPrompts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [prompts, search]);

  const [promptName, setPromptName] = useState("");
  const [promptDescription, setPromptDescription] = useState("");
  const [promptTags, setPromptTags] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPromptTemplate, setUserPromptTemplate] = useState("");
  const [provider, setProvider] = useState<LLMProvider>("anthropic");
  const [model, setModel] = useState(PROVIDER_MODELS.anthropic[0]);
  const [temperature, setTemperature] = useState("0.2");
  const [maxTokens, setMaxTokens] = useState("1024");
  const [topP, setTopP] = useState("1.0");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [playgroundResult, setPlaygroundResult] = useState<PlaygroundRunResponse | null>(null);
  const [playgroundError, setPlaygroundError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedVersion) {
      setSystemPrompt("");
      setUserPromptTemplate("");
      setProvider("anthropic");
      setModel(PROVIDER_MODELS.anthropic[0]);
      setTemperature("0.2");
      setMaxTokens("1024");
      setTopP("1.0");
      setPlaygroundResult(null);
      setPlaygroundError(null);
      return;
    }
    setSystemPrompt(selectedVersion.systemPrompt);
    setUserPromptTemplate(selectedVersion.userPromptTemplate);
    setProvider(selectedVersion.provider);
    setModel(selectedVersion.model);
    setTemperature(String(selectedVersion.parameters.temperature));
    setMaxTokens(String(selectedVersion.parameters.maxTokens));
    setTopP(String(selectedVersion.parameters.topP ?? 1));
    setPlaygroundResult(null);
    setPlaygroundError(null);
  }, [selectedVersion]);

  const variableNames = useMemo(
    () => extractVariableNames(userPromptTemplate),
    [userPromptTemplate],
  );

  useEffect(() => {
    setVariableValues((prev) => {
      const next: Record<string, string> = {};
      for (const name of variableNames) {
        next[name] = prev[name] ?? "";
      }
      return next;
    });
  }, [variableNames]);

  function openPrompt(promptId: string) {
    setSelectedPromptId(promptId);
    setSelectedVersionId("");
    setTab("editor");
  }

  async function onCreatePrompt(event: FormEvent) {
    event.preventDefault();
    setCreateError(null);
    if (!effectiveProjectId) {
      setCreateError("Select a project first");
      return;
    }
    try {
      const created = await createPrompt.mutateAsync({
        projectId: effectiveProjectId,
        name: promptName.trim(),
        description: promptDescription.trim() || undefined,
        tags: promptTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setPromptName("");
      setPromptDescription("");
      setPromptTags("");
      setShowCreate(false);
      setSelectedPromptId(created.id);
      setSelectedVersionId("");
      setTab("editor");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create prompt");
    }
  }

  async function onSaveNewVersion() {
    setEditorError(null);
    if (!effectivePromptId) return;
    const temp = Number(temperature);
    const tokens = Number(maxTokens);
    const top = Number(topP);
    if (!Number.isFinite(temp) || temp < 0 || temp > 2) {
      setEditorError("Temperature must be between 0 and 2");
      return;
    }
    if (!Number.isFinite(tokens) || tokens < 1) {
      setEditorError("Max tokens must be a positive number");
      return;
    }
    try {
      const created = await createVersion.mutateAsync({
        promptId: effectivePromptId,
        model,
        provider,
        systemPrompt,
        userPromptTemplate,
        parameters: {
          temperature: temp,
          maxTokens: tokens,
          ...(Number.isFinite(top) ? { topP: top } : {}),
        },
      });
      setSelectedVersionId(created.id);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "Failed to save version");
    }
  }

  async function onPromote(versionId: string) {
    if (!effectivePromptId) return;
    await promoteVersion.mutateAsync({ promptId: effectivePromptId, versionId });
  }

  async function onRunPlayground() {
    setPlaygroundError(null);
    if (!effectivePromptId || !selectedVersion) return;
    try {
      const result = await runPlayground.mutateAsync({
        promptId: effectivePromptId,
        versionId: selectedVersion.id,
        provider,
        model,
        temperature: Number(temperature),
        maxTokens: Number(maxTokens),
        variables: variableValues,
      });
      setPlaygroundResult(result);
    } catch (error) {
      setPlaygroundError(error instanceof Error ? error.message : "Playground run failed");
      setPlaygroundResult(null);
    }
  }

  const fieldClass =
    "h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground";
  const areaClass =
    "min-h-[78px] w-full rounded-md border border-border bg-[#0a0d14] px-2.5 py-2 font-mono text-xs leading-relaxed text-muted-foreground";
  const panelClass = "rounded-[10px] border border-border bg-background p-3";
  const labelClass = "mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#12151f] text-foreground">
      <div
        role="tablist"
        aria-label="Prompt Manager views"
        className="flex shrink-0 gap-0 border-b border-border bg-background px-4"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            id={`tab-${item.id}`}
            onClick={() => setTab(item.id)}
            className={cn(
              "border-b-2 px-3.5 py-2.5 text-sm transition-colors",
              tab === item.id
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto p-4"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "library" ? (
          <section aria-labelledby="prompts-heading" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="prompts-heading" className="text-[15px] font-medium text-foreground">
                Prompts
              </h2>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 border border-input bg-secondary text-primary hover:bg-muted"
                onClick={() => setShowCreate((v) => !v)}
              >
                <IconPlus className="size-3.5" aria-hidden />
                New prompt
              </Button>
            </div>

            <label className="flex max-w-xs flex-col gap-1 text-sm">
              <span className="sr-only">Project</span>
              <select
                aria-label="Project"
                className={fieldClass}
                value={effectiveProjectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setSelectedPromptId("");
                  setSelectedVersionId("");
                }}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
              <IconSearch className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              <Input
                aria-label="Search prompts"
                placeholder="Search prompts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>

            {showCreate ? (
              <form
                className={cn(panelClass, "grid gap-3 sm:grid-cols-3")}
                onSubmit={onCreatePrompt}
                aria-label="Create prompt"
              >
                <label className="flex flex-col gap-1 text-sm" htmlFor="prompt-name">
                  <span className="font-medium">Name</span>
                  <Input
                    id="prompt-name"
                    required
                    value={promptName}
                    onChange={(e) => setPromptName(e.target.value)}
                    placeholder="news-radar/my-prompt"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm" htmlFor="prompt-description">
                  <span className="font-medium">Description</span>
                  <Input
                    id="prompt-description"
                    value={promptDescription}
                    onChange={(e) => setPromptDescription(e.target.value)}
                    placeholder="What this prompt does"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm" htmlFor="prompt-tags">
                  <span className="font-medium">Tags</span>
                  <Input
                    id="prompt-tags"
                    value={promptTags}
                    onChange={(e) => setPromptTags(e.target.value)}
                    placeholder="judge, dedup"
                  />
                </label>
                {createError ? (
                  <p className="text-sm text-destructive sm:col-span-3" role="alert">
                    {createError}
                  </p>
                ) : null}
                <div className="flex gap-2 sm:col-span-3">
                  <Button type="submit" size="sm" disabled={createPrompt.isPending}>
                    {createPrompt.isPending ? "Saving…" : "Create prompt"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}

            {loadingPrompts ? (
              <p className="text-sm text-muted-foreground">Loading prompts…</p>
            ) : filteredPrompts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No prompts yet for this project.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" aria-label="Prompt list">
                {filteredPrompts.map((prompt) => (
                  <li key={prompt.id}>
                    <PromptCard
                      prompt={prompt}
                      selected={prompt.id === effectivePromptId}
                      onSelect={() => openPrompt(prompt.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === "editor" ? (
          <section aria-labelledby="editor-heading" className="space-y-3">
            <h2 id="editor-heading" className="sr-only">
              Editor
            </h2>
            {!selectedPrompt ? (
              <p className="text-sm text-muted-foreground">Select a prompt from the Library.</p>
            ) : (
              <>
                <div className={panelClass}>
                  <div className={labelClass}>Version history — {selectedPrompt.name}</div>
                  {loadingVersions ? (
                    <p className="text-sm text-muted-foreground">Loading versions…</p>
                  ) : versions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No versions yet — save a draft from the editor.
                    </p>
                  ) : (
                    <ol
                      className="relative flex items-start gap-0 overflow-x-auto py-2"
                      aria-label="Prompt versions"
                    >
                      <div
                        className="pointer-events-none absolute top-[22px] right-2 left-2 h-px bg-border"
                        aria-hidden
                      />
                      {versions.map((version, index) => {
                        const selected = version.id === selectedVersion?.id;
                        const isActive = version.status === "active";
                        return (
                          <li key={version.id} className="relative z-[1] flex shrink-0 items-start">
                            {index > 0 ? <div className="w-3 shrink-0" aria-hidden /> : null}
                            <div className="flex w-14 flex-col items-center gap-1.5">
                              <button
                                type="button"
                                aria-pressed={selected}
                                aria-label={`Select version ${version.version}`}
                                onClick={() => setSelectedVersionId(version.id)}
                                className={cn(
                                  "flex size-6 items-center justify-center rounded-full border-[1.5px] font-mono text-2xs font-medium transition-colors",
                                  isActive
                                    ? "border-primary bg-secondary text-primary"
                                    : selected
                                      ? "border-muted-foreground bg-muted text-foreground shadow-[0_0_0_3px_#2e3248]"
                                      : "border-border bg-background text-muted-foreground",
                                )}
                              >
                                {version.version}
                              </button>
                              <span
                                className={cn(
                                  "text-center text-2xs leading-tight",
                                  isActive
                                    ? "font-medium text-primary"
                                    : "text-muted-foreground/70",
                                )}
                              >
                                {version.status}
                                <br />
                                {formatMonthDay(version.createdAt)}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>

                <div className="grid gap-2.5 lg:grid-cols-[1fr_196px]">
                  <div className="space-y-2">
                    <div className={panelClass}>
                      <div className={labelClass}>System prompt</div>
                      <textarea
                        aria-label="System prompt"
                        className={areaClass}
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                      />
                    </div>
                    <div className={panelClass}>
                      <div className={labelClass}>User prompt template</div>
                      <textarea
                        aria-label="User prompt template"
                        className={cn(areaClass, "min-h-28")}
                        value={userPromptTemplate}
                        onChange={(e) => setUserPromptTemplate(e.target.value)}
                      />
                      {variableNames.length > 0 ? (
                        <p className="mt-2 text-2xs text-muted-foreground/70">
                          Variables:{" "}
                          {variableNames.map((name, i) => (
                            <span key={name}>
                              {i > 0 ? ", " : null}
                              <span className="rounded-sm bg-[#2a2000] px-0.5 font-mono text-warning">
                                {`{{${name}}}`}
                              </span>
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled
                        title="Coming in a later phase"
                      >
                        <IconGitBranch className="size-3.5" aria-hidden />
                        Fork
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled
                        title="Coming in a later phase"
                      >
                        <IconFileDiff className="size-3.5" aria-hidden />
                        Diff
                      </Button>
                      <div className="ml-auto flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={onSaveNewVersion}
                          disabled={!effectivePromptId || createVersion.isPending}
                        >
                          <IconDeviceFloppy className="size-3.5" aria-hidden />
                          {createVersion.isPending ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 border border-input bg-secondary text-primary"
                          disabled={
                            !selectedVersion ||
                            !canPromote(selectedVersion.status) ||
                            promoteVersion.isPending
                          }
                          onClick={() => selectedVersion && onPromote(selectedVersion.id)}
                        >
                          <IconArrowUpCircle className="size-3.5" aria-hidden />
                          {selectedVersion ? promoteLabel(selectedVersion.status) : "Promote"}
                        </Button>
                      </div>
                    </div>
                    {editorError ? (
                      <p className="text-sm text-destructive" role="alert">
                        {editorError}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className={panelClass}>
                      <div className="mb-2 flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1.5">
                        <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden />
                        <select
                          aria-label="Model"
                          className="min-w-0 flex-1 appearance-none bg-transparent font-mono text-xs font-medium text-foreground outline-none"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                        >
                          {PROVIDER_MODELS[provider].map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                          {!PROVIDER_MODELS[provider].includes(model) ? (
                            <option value={model}>{model}</option>
                          ) : null}
                        </select>
                        <IconChevronDown
                          className="size-3 shrink-0 text-muted-foreground/50"
                          aria-hidden
                        />
                        <span className="shrink-0 font-mono text-2xs text-muted-foreground/70">
                          {MODEL_CONTEXT[model] ?? "—"}
                        </span>
                      </div>
                      <label className="mb-2 flex flex-col gap-1 text-sm">
                        <span className="sr-only">Provider</span>
                        <select
                          aria-label="Provider"
                          className={fieldClass}
                          value={provider}
                          onChange={(e) => {
                            const next = e.target.value as LLMProvider;
                            setProvider(next);
                            setModel(PROVIDER_MODELS[next][0]);
                          }}
                        >
                          {PROVIDERS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className={labelClass}>Parameters</div>
                      <div className="space-y-0 divide-y divide-border/60">
                        <div className="flex items-center justify-between gap-2 py-1.5 text-xs">
                          <label htmlFor="param-temperature" className="text-muted-foreground">
                            Temperature
                          </label>
                          <Input
                            id="param-temperature"
                            type="number"
                            step="0.1"
                            min="0"
                            max="2"
                            value={temperature}
                            onChange={(e) => setTemperature(e.target.value)}
                            className="h-7 w-16 border-0 bg-transparent px-0 text-right font-mono text-xs shadow-none focus-visible:ring-0"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 py-1.5 text-xs">
                          <label htmlFor="param-max-tokens" className="text-muted-foreground">
                            Max tokens
                          </label>
                          <Input
                            id="param-max-tokens"
                            type="number"
                            min="1"
                            value={maxTokens}
                            onChange={(e) => setMaxTokens(e.target.value)}
                            className="h-7 w-16 border-0 bg-transparent px-0 text-right font-mono text-xs shadow-none focus-visible:ring-0"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 py-1.5 text-xs">
                          <label htmlFor="param-top-p" className="text-muted-foreground">
                            Top P
                          </label>
                          <Input
                            id="param-top-p"
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={topP}
                            onChange={(e) => setTopP(e.target.value)}
                            className="h-7 w-16 border-0 bg-transparent px-0 text-right font-mono text-xs shadow-none focus-visible:ring-0"
                          />
                        </div>
                      </div>
                    </div>

                    <div className={panelClass}>
                      <div className={labelClass}>
                        {selectedVersion ? `v${selectedVersion.version} metrics` : "Metrics"}
                      </div>
                      <div className="space-y-0 divide-y divide-border/60 text-xs">
                        <div className="flex justify-between py-1.5">
                          <span className="text-muted-foreground">Calls</span>
                          <span className="font-mono font-medium">
                            {selectedVersion?.metrics
                              ? formatCalls(selectedVersion.metrics.requestCount)
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5">
                          <span className="text-muted-foreground">Avg latency</span>
                          <span className="font-mono font-medium">
                            {selectedVersion?.metrics
                              ? `${Math.round(selectedVersion.metrics.avgLatencyMs)}ms`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5">
                          <span className="text-muted-foreground">Avg cost</span>
                          <span className="font-mono font-medium">
                            {selectedVersion?.metrics
                              ? `$${selectedVersion.metrics.avgCostUsd.toFixed(4)}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5">
                          <span className="text-muted-foreground">Success</span>
                          <span className="font-mono font-medium">
                            {selectedVersion?.metrics
                              ? `${((1 - selectedVersion.metrics.errorRate) * 100).toFixed(1)}%`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}

        {tab === "playground" ? (
          <section aria-labelledby="playground-heading" className="space-y-3">
            <h2 id="playground-heading" className="sr-only">
              Playground
            </h2>
            {!selectedPrompt || !selectedVersion ? (
              <p className="text-sm text-muted-foreground">
                Select a prompt and version from the Library / Editor first.
              </p>
            ) : (
              <>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Testing{" "}
                    <strong className="font-medium text-foreground">{selectedPrompt.name}</strong>
                    {" · "}v{selectedVersion.version} ({selectedVersion.status})
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled
                    title="Side-by-side compare ships in Phase 6"
                  >
                    <IconColumns className="size-3.5" aria-hidden />
                    Compare
                  </Button>
                </div>

                <div className="grid gap-2.5 lg:grid-cols-[1fr_156px]">
                  <div className="space-y-2">
                    <div className={panelClass}>
                      <div className={labelClass}>Variables</div>
                      {variableNames.length === 0 ? (
                        <p className="mb-2 text-sm text-muted-foreground">
                          No {"{{variables}}"} in the user template — run with the current text.
                        </p>
                      ) : (
                        <div className="mb-2 flex flex-col gap-1.5">
                          {variableNames.map((name) => (
                            <label
                              key={name}
                              className="flex flex-col gap-0.5"
                              htmlFor={`var-${name}`}
                            >
                              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground/70">
                                {name}
                              </span>
                              <Input
                                id={`var-${name}`}
                                aria-label={`Variable ${name}`}
                                value={variableValues[name] ?? ""}
                                onChange={(e) =>
                                  setVariableValues((prev) => ({
                                    ...prev,
                                    [name]: e.target.value,
                                  }))
                                }
                                className="h-8 border-border bg-background font-mono text-xs"
                              />
                            </label>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={onRunPlayground}
                        disabled={runPlayground.isPending}
                        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-[#1d5c35] bg-[#0d2a1a] px-2 py-1.5 text-xs font-medium text-success hover:opacity-90 disabled:opacity-50"
                      >
                        <IconPlayerPlay className="size-3.5" aria-hidden />
                        {runPlayground.isPending ? "Running…" : "Run"}
                        <span className="text-2xs opacity-60">⌘↵</span>
                      </button>
                    </div>

                    <div className={panelClass}>
                      <div className={labelClass}>Response</div>
                      {playgroundError ? (
                        <p className="text-sm text-destructive" role="alert">
                          {playgroundError}
                        </p>
                      ) : null}
                      <pre
                        aria-label="Playground response"
                        className="min-h-[90px] overflow-x-auto rounded-md border border-border bg-[#0a0d14] p-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground"
                      >
                        {playgroundResult?.content ?? ""}
                      </pre>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="rounded-md bg-secondary p-2 text-center">
                      <div className="font-mono text-sm font-medium">
                        {playgroundResult ? `${playgroundResult.latencyMs}ms` : "—"}
                      </div>
                      <div className="mt-0.5 text-2xs text-muted-foreground/70">Latency</div>
                    </div>
                    <div className="rounded-md bg-secondary p-2 text-center">
                      <div className="font-mono text-sm font-medium">
                        {playgroundResult?.inputTokens ?? "—"}
                      </div>
                      <div className="mt-0.5 text-2xs text-muted-foreground/70">Input tokens</div>
                    </div>
                    <div className="rounded-md bg-secondary p-2 text-center">
                      <div className="font-mono text-sm font-medium">
                        {playgroundResult?.outputTokens ?? "—"}
                      </div>
                      <div className="mt-0.5 text-2xs text-muted-foreground/70">Output tokens</div>
                    </div>
                    <div className="rounded-md bg-secondary p-2 text-center">
                      <div className="font-mono text-sm font-medium">
                        {estimatePlaygroundCost(playgroundResult)}
                      </div>
                      <div className="mt-0.5 text-2xs text-muted-foreground/70">Cost</div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-0.5 h-7 w-full text-xs"
                      disabled
                      title="Save test ships with playground compare (Phase 6)"
                    >
                      <IconBookmark className="size-3.5" aria-hidden />
                      Save test
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
