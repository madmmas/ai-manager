import {
  useCreatePrompt,
  useCreatePromptVersion,
  useProjects,
  usePromotePromptVersion,
  usePromptVersions,
  usePrompts,
  useRunPlayground,
  useUpdatePrompt,
} from "@repo/api-client";
import type { LLMProvider, PlaygroundRunResponse, PromptVersion } from "@repo/types";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@repo/ui";
import { type FormEvent, useEffect, useMemo, useState } from "react";

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

function statusBadgeVariant(
  status: PromptVersion["status"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "testing":
      return "secondary";
    case "draft":
      return "outline";
    default:
      return "outline";
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

export default function App() {
  const { data: projects = [] } = useProjects();
  const [projectId, setProjectId] = useState("");
  const effectiveProjectId = projectId || projects[0]?.id || "";

  const { data: prompts = [], isLoading: loadingPrompts } = usePrompts({
    projectId: effectiveProjectId,
  });
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  const createVersion = useCreatePromptVersion();
  const promoteVersion = usePromotePromptVersion();
  const runPlayground = useRunPlayground();

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

  const [promptName, setPromptName] = useState("");
  const [promptDescription, setPromptDescription] = useState("");
  const [promptTags, setPromptTags] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");

  useEffect(() => {
    if (!selectedPrompt) {
      setEditName("");
      setEditDescription("");
      setEditTags("");
      return;
    }
    setEditName(selectedPrompt.name);
    setEditDescription(selectedPrompt.description ?? "");
    setEditTags(selectedPrompt.tags.join(", "));
  }, [selectedPrompt]);

  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPromptTemplate, setUserPromptTemplate] = useState("");
  const [provider, setProvider] = useState<LLMProvider>("anthropic");
  const [model, setModel] = useState(PROVIDER_MODELS.anthropic[0]);
  const [temperature, setTemperature] = useState("0.2");
  const [maxTokens, setMaxTokens] = useState("1024");
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
      setSelectedPromptId(created.id);
      setSelectedVersionId("");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create prompt");
    }
  }

  async function onSavePromptMeta(event: FormEvent) {
    event.preventDefault();
    if (!effectivePromptId) return;
    await updatePrompt.mutateAsync({
      id: effectivePromptId,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      tags: editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  }

  async function onSaveNewVersion() {
    setEditorError(null);
    if (!effectivePromptId) return;
    const temp = Number(temperature);
    const tokens = Number(maxTokens);
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
        parameters: { temperature: temp, maxTokens: tokens },
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

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-6">
        <header className="space-y-2">
          <h2 className="text-lg font-medium tracking-tight text-foreground">Prompt Manager</h2>
          <p className="text-sm text-muted-foreground">
            Browse the prompt library, promote versions, edit drafts, and run the playground.
          </p>
          <label className="flex max-w-sm flex-col gap-1 text-sm">
            <span className="font-medium">Project</span>
            <select
              aria-label="Project"
              className="h-9 rounded-md border border-border bg-background px-3"
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
        </header>

        <section aria-labelledby="library-heading" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle id="library-heading">Library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingPrompts ? (
                <p className="text-sm text-muted-foreground">Loading prompts…</p>
              ) : prompts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No prompts yet for this project.</p>
              ) : (
                <ul className="space-y-2" aria-label="Prompt list">
                  {prompts.map((prompt) => {
                    const selected = prompt.id === effectivePromptId;
                    return (
                      <li key={prompt.id}>
                        <button
                          type="button"
                          className={`w-full rounded-md border px-3 py-2 text-left ${
                            selected
                              ? "border-primary bg-accent/40"
                              : "border-border hover:bg-muted/40"
                          }`}
                          aria-pressed={selected}
                          onClick={() => {
                            setSelectedPromptId(prompt.id);
                            setSelectedVersionId("");
                          }}
                        >
                          <p className="font-medium">{prompt.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {prompt.description || "No description"}
                          </p>
                          {prompt.tags.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {prompt.tags.map((tag) => (
                                <Badge key={tag} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={onCreatePrompt}>
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
                  <p className="text-sm text-destructive" role="alert">
                    {createError}
                  </p>
                ) : null}
                <Button type="submit" disabled={createPrompt.isPending}>
                  {createPrompt.isPending ? "Saving…" : "Create prompt"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        {selectedPrompt ? (
          <>
            <section aria-labelledby="meta-heading">
              <Card>
                <CardHeader>
                  <CardTitle id="meta-heading">Edit prompt</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-3 sm:grid-cols-3" onSubmit={onSavePromptMeta}>
                    <label className="flex flex-col gap-1 text-sm" htmlFor="edit-prompt-name">
                      <span className="font-medium">Name</span>
                      <Input
                        id="edit-prompt-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </label>
                    <label
                      className="flex flex-col gap-1 text-sm"
                      htmlFor="edit-prompt-description"
                    >
                      <span className="font-medium">Description</span>
                      <Input
                        id="edit-prompt-description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm" htmlFor="edit-prompt-tags">
                      <span className="font-medium">Tags</span>
                      <Input
                        id="edit-prompt-tags"
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                      />
                    </label>
                    <div className="sm:col-span-3">
                      <Button type="submit" variant="secondary" disabled={updatePrompt.isPending}>
                        Save prompt details
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </section>

            <section aria-labelledby="timeline-heading">
              <Card>
                <CardHeader>
                  <CardTitle id="timeline-heading">Version timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingVersions ? (
                    <p className="text-sm text-muted-foreground">Loading versions…</p>
                  ) : versions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No versions yet — save a draft from the editor.
                    </p>
                  ) : (
                    <ol className="flex flex-wrap items-stretch gap-2" aria-label="Prompt versions">
                      {versions.map((version, index) => {
                        const selected = version.id === selectedVersion?.id;
                        return (
                          <li key={version.id} className="flex items-center gap-2">
                            {index > 0 ? (
                              <span className="text-muted-foreground" aria-hidden>
                                —
                              </span>
                            ) : null}
                            <div
                              className={`min-w-40 rounded-md border px-3 py-2 ${
                                selected ? "border-primary bg-accent/30" : "border-border"
                              }`}
                            >
                              <button
                                type="button"
                                className="w-full text-left"
                                aria-pressed={selected}
                                aria-label={`Select version ${version.version}`}
                                onClick={() => setSelectedVersionId(version.id)}
                              >
                                <p className="text-sm font-medium">v{version.version}</p>
                                <p className="text-xs text-muted-foreground">{version.model}</p>
                              </button>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge variant={statusBadgeVariant(version.status)}>
                                  {version.status}
                                </Badge>
                                {canPromote(version.status) ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={promoteVersion.isPending}
                                    onClick={() => onPromote(version.id)}
                                  >
                                    {promoteLabel(version.status)}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </section>

            <section aria-labelledby="editor-heading" className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle id="editor-heading">Editor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">System prompt</span>
                    <textarea
                      aria-label="System prompt"
                      className="min-h-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">User prompt template</span>
                    <textarea
                      aria-label="User prompt template"
                      className="min-h-28 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={userPromptTemplate}
                      onChange={(e) => setUserPromptTemplate(e.target.value)}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">Provider</span>
                      <select
                        aria-label="Provider"
                        className="h-9 rounded-md border border-border bg-background px-2"
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
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">Model</span>
                      <select
                        aria-label="Model"
                        className="h-9 rounded-md border border-border bg-background px-2"
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
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-sm" htmlFor="param-temperature">
                      <span className="font-medium">Temperature</span>
                      <Input
                        id="param-temperature"
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm" htmlFor="param-max-tokens">
                      <span className="font-medium">Max tokens</span>
                      <Input
                        id="param-max-tokens"
                        type="number"
                        min="1"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(e.target.value)}
                      />
                    </label>
                  </div>
                  {editorError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {editorError}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    onClick={onSaveNewVersion}
                    disabled={!effectivePromptId || createVersion.isPending}
                  >
                    {createVersion.isPending ? "Saving…" : "Save as new version"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Playground</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {variableNames.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No {"{{variables}}"} in the user template — run with the current text.
                    </p>
                  ) : (
                    variableNames.map((name) => (
                      <label
                        key={name}
                        className="flex flex-col gap-1 text-sm"
                        htmlFor={`var-${name}`}
                      >
                        <span className="font-medium">{`{{${name}}}`}</span>
                        <Input
                          id={`var-${name}`}
                          aria-label={`Variable ${name}`}
                          value={variableValues[name] ?? ""}
                          onChange={(e) =>
                            setVariableValues((prev) => ({ ...prev, [name]: e.target.value }))
                          }
                        />
                      </label>
                    ))
                  )}
                  <Button
                    type="button"
                    onClick={onRunPlayground}
                    disabled={!selectedVersion || runPlayground.isPending}
                  >
                    {runPlayground.isPending ? "Running…" : "Run"}
                  </Button>
                  {playgroundError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {playgroundError}
                    </p>
                  ) : null}
                  {playgroundResult ? (
                    <div className="space-y-2" aria-live="polite">
                      <p className="text-sm text-muted-foreground">
                        Latency {playgroundResult.latencyMs} ms · {playgroundResult.provider}/
                        {playgroundResult.model}
                      </p>
                      <pre
                        aria-label="Playground response"
                        className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap"
                      >
                        {playgroundResult.content}
                      </pre>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
