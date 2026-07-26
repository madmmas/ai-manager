import {
  useCreateGuardrail,
  useCreateGuardrailSet,
  useEvaluateGuardrailSet,
  useGuardrailSets,
  useGuardrails,
  useProjects,
  useUpdateGuardrail,
  useUpdateGuardrailSet,
} from "@repo/api-client";
import type {
  EvaluatorResult,
  Guardrail,
  GuardrailAction,
  GuardrailStage,
  GuardrailType,
} from "@repo/types";
import { Badge, Button, Input, cn } from "@repo/ui";
import {
  IconBan,
  IconPlus,
  IconRegex,
  IconRobot,
  IconRuler,
  IconSearch,
  IconShieldCheck,
  IconUserShield,
} from "@tabler/icons-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

const EVALUATOR_TYPES: GuardrailType[] = ["keyword-blocklist", "regex-filter", "max-length"];
const STAGES: GuardrailStage[] = ["input", "output", "both"];
const ACTIONS: GuardrailAction[] = ["block", "warn", "redact", "log-only"];

function buildConfig(type: GuardrailType, raw: string): Record<string, unknown> {
  if (type === "keyword-blocklist") {
    return {
      keywords: raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }
  if (type === "regex-filter") {
    return {
      patterns: raw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }
  const maxChars = Number(raw);
  if (!Number.isFinite(maxChars) || maxChars < 0) {
    throw new Error("maxChars must be a non-negative number");
  }
  return { maxChars };
}

function configHint(type: GuardrailType): string {
  switch (type) {
    case "keyword-blocklist":
      return "Comma-separated keywords";
    case "regex-filter":
      return "One regex pattern per line";
    case "max-length":
      return "Max character count";
    default:
      return "Config";
  }
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [removed] = next.splice(index, 1);
  next.splice(target, 0, removed);
  return next;
}

function displayTitle(name: string): string {
  return name
    .split(/[-_/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stageLabel(stage: GuardrailStage): string {
  return stage === "both" ? "input + output" : stage;
}

function ruleDescription(rule: Guardrail): string {
  const stage = stageLabel(rule.stage);
  const config = rule.config as Record<string, unknown>;

  if (rule.type === "keyword-blocklist" && Array.isArray(config.keywords)) {
    const keywords = config.keywords as string[];
    const shown = keywords.slice(0, 2).join(", ");
    const extra = keywords.length > 2 ? ` +${keywords.length - 2}` : "";
    return `${stage} · blocks: ${shown}${extra}`;
  }
  if (rule.type === "regex-filter" && Array.isArray(config.patterns)) {
    const patterns = config.patterns as string[];
    return `${stage} · ${patterns.length} pattern${patterns.length === 1 ? "" : "s"}`;
  }
  if (rule.type === "max-length" && typeof config.maxChars === "number") {
    return `${stage} · max ${config.maxChars} chars`;
  }
  if (rule.type === "pii-detection" && Array.isArray(config.entities)) {
    return `${stage} · ${(config.entities as string[]).join(", ")}`;
  }
  if (rule.type === "custom-llm-judge" && typeof config.judgePromptId === "string") {
    return `${stage} · uses ${config.judgePromptId}`;
  }
  return `${stage} · ${rule.type}`;
}

function actionBadgeClass(action: GuardrailAction): string {
  switch (action) {
    case "block":
      return "border-transparent bg-[#0d2a1a] text-success";
    case "redact":
    case "warn":
      return "border-transparent bg-[#2a2000] text-warning";
    default:
      return "border-transparent bg-secondary text-muted-foreground";
  }
}

function ruleIcon(rule: Guardrail) {
  switch (rule.type) {
    case "keyword-blocklist":
      return { Icon: IconBan, tone: "amber" as const };
    case "regex-filter":
      return { Icon: IconRegex, tone: "red" as const };
    case "max-length":
      return { Icon: IconRuler, tone: "amber" as const };
    case "pii-detection":
      return { Icon: IconUserShield, tone: "red" as const };
    case "custom-llm-judge":
      return { Icon: IconRobot, tone: "blue" as const };
    default:
      return { Icon: IconShieldCheck, tone: "blue" as const };
  }
}

function iconToneClass(tone: "amber" | "red" | "blue"): string {
  switch (tone) {
    case "red":
      return "bg-[#2a0d0d] text-[#f87171]";
    case "blue":
      return "bg-[#0d1a2a] text-primary";
    default:
      return "bg-[#2a2000] text-warning";
  }
}

function EnableToggle({
  enabled,
  disabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative h-[18px] w-8 shrink-0 rounded-full transition-colors disabled:opacity-50",
        enabled ? "bg-[#0d2a1a]" : "border border-border bg-secondary",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-3.5 rounded-full bg-foreground transition-[left]",
          enabled ? "left-4" : "left-0.5",
        )}
      />
    </button>
  );
}

export default function App() {
  const { data: projects = [] } = useProjects();
  const [projectId, setProjectId] = useState<string>("");
  const effectiveProjectId = projectId || projects[0]?.id || "";

  const { data: guardrails = [], isLoading: loadingRules } = useGuardrails({
    projectId: effectiveProjectId,
  });
  const { data: sets = [], isLoading: loadingSets } = useGuardrailSets({
    projectId: effectiveProjectId,
  });

  const createGuardrail = useCreateGuardrail();
  const updateGuardrail = useUpdateGuardrail();
  const createSet = useCreateGuardrailSet();
  const updateSet = useUpdateGuardrailSet();
  const evaluateSet = useEvaluateGuardrailSet();

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<GuardrailType>("keyword-blocklist");
  const [ruleStage, setRuleStage] = useState<GuardrailStage>("input");
  const [ruleAction, setRuleAction] = useState<GuardrailAction>("block");
  const [ruleConfig, setRuleConfig] = useState("secret, classified");
  const [ruleError, setRuleError] = useState<string | null>(null);

  const [setName, setSetName] = useState("");
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const selectedSet = useMemo(
    () => sets.find((s) => s.id === selectedSetId) ?? sets[0],
    [sets, selectedSetId],
  );
  const effectiveSetId = selectedSet?.id ?? "";

  const [memberIds, setMemberIds] = useState<string[]>([]);
  useEffect(() => {
    setMemberIds(selectedSet?.guardrailIds ?? []);
  }, [selectedSet]);

  const [inputText, setInputText] = useState("This contains a secret token.");
  const [outputText, setOutputText] = useState("");
  const [runAll, setRunAll] = useState(false);
  const [results, setResults] = useState<EvaluatorResult[]>([]);
  const [evalMeta, setEvalMeta] = useState<{ blocked: boolean; shortCircuited: boolean } | null>(
    null,
  );

  const guardrailById = useMemo(() => {
    const map = new Map<string, Guardrail>();
    for (const g of guardrails) map.set(g.id, g);
    return map;
  }, [guardrails]);

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guardrails;
    return guardrails.filter(
      (rule) =>
        rule.name.toLowerCase().includes(q) ||
        rule.type.toLowerCase().includes(q) ||
        rule.action.toLowerCase().includes(q) ||
        ruleDescription(rule).toLowerCase().includes(q),
    );
  }, [guardrails, search]);

  async function onCreateRule(event: FormEvent) {
    event.preventDefault();
    setRuleError(null);
    if (!effectiveProjectId) {
      setRuleError("Select a project first");
      return;
    }
    try {
      const config = buildConfig(ruleType, ruleConfig);
      await createGuardrail.mutateAsync({
        projectId: effectiveProjectId,
        name: ruleName.trim(),
        type: ruleType,
        stage: ruleStage,
        action: ruleAction,
        config,
      });
      setRuleName("");
      setShowCreate(false);
    } catch (error) {
      setRuleError(error instanceof Error ? error.message : "Failed to create rule");
    }
  }

  async function onToggleEnabled(rule: Guardrail) {
    await updateGuardrail.mutateAsync({ id: rule.id, enabled: !rule.enabled });
  }

  async function onCreateSet(event: FormEvent) {
    event.preventDefault();
    if (!effectiveProjectId || !setName.trim()) return;
    const created = await createSet.mutateAsync({
      projectId: effectiveProjectId,
      name: setName.trim(),
      shortCircuitOnBlock: true,
      guardrailIds: [],
    });
    setSetName("");
    setSelectedSetId(created.id);
  }

  async function onSaveOrdering() {
    if (!effectiveSetId) return;
    await updateSet.mutateAsync({ id: effectiveSetId, guardrailIds: memberIds });
  }

  function onAddMember(guardrailId: string) {
    if (!guardrailId || memberIds.includes(guardrailId)) return;
    setMemberIds((prev) => [...prev, guardrailId]);
  }

  async function onRunTest() {
    if (!effectiveSetId) return;
    const response = await evaluateSet.mutateAsync({
      id: effectiveSetId,
      input: inputText,
      output: outputText,
      shortCircuitOnBlock: runAll ? false : undefined,
    });
    setResults(response.results);
    setEvalMeta({ blocked: response.blocked, shortCircuited: response.shortCircuited });
  }

  const fieldClass =
    "h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground";
  const panelClass = "rounded-[10px] border border-border bg-background p-3";
  const labelClass = "mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#12151f] text-foreground">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <section aria-labelledby="guardrails-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="guardrails-heading" className="text-[15px] font-medium text-foreground">
              Guardrails
            </h2>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 border border-input bg-secondary text-primary hover:bg-muted"
              onClick={() => setShowCreate((v) => !v)}
            >
              <IconPlus className="size-3.5" aria-hidden />
              New guardrail
            </Button>
          </div>

          <label className="flex max-w-xs flex-col gap-1 text-sm">
            <span className="sr-only">Project</span>
            <select
              aria-label="Project"
              className={fieldClass}
              value={effectiveProjectId}
              onChange={(e) => setProjectId(e.target.value)}
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
              aria-label="Search guardrails"
              placeholder="Search guardrails…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>

          {showCreate ? (
            <form
              className={cn(panelClass, "space-y-3")}
              onSubmit={onCreateRule}
              aria-label="Create rule"
            >
              <div className={labelClass}>Create rule</div>
              <label className="flex flex-col gap-1 text-sm" htmlFor="guardrail-rule-name">
                <span className="font-medium">Name</span>
                <Input
                  id="guardrail-rule-name"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="block-secrets"
                />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Type</span>
                  <select
                    aria-label="Evaluator type"
                    className={fieldClass}
                    value={ruleType}
                    onChange={(e) => {
                      const next = e.target.value as GuardrailType;
                      setRuleType(next);
                      setRuleConfig(
                        next === "keyword-blocklist"
                          ? "secret, classified"
                          : next === "regex-filter"
                            ? "\\d{3}-\\d{2}-\\d{4}"
                            : "500",
                      );
                    }}
                  >
                    {EVALUATOR_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Stage</span>
                  <select
                    aria-label="Stage"
                    className={fieldClass}
                    value={ruleStage}
                    onChange={(e) => setRuleStage(e.target.value as GuardrailStage)}
                  >
                    {STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Action</span>
                  <select
                    aria-label="Action"
                    className={fieldClass}
                    value={ruleAction}
                    onChange={(e) => setRuleAction(e.target.value as GuardrailAction)}
                  >
                    {ACTIONS.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{configHint(ruleType)}</span>
                <textarea
                  aria-label="Rule config"
                  className="min-h-20 rounded-md border border-border bg-[#0a0d14] px-3 py-2 font-mono text-xs text-muted-foreground"
                  value={ruleConfig}
                  onChange={(e) => setRuleConfig(e.target.value)}
                />
              </label>
              {ruleError ? (
                <p className="text-sm text-destructive" role="alert">
                  {ruleError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={createGuardrail.isPending}>
                  {createGuardrail.isPending ? "Saving…" : "Add rule"}
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

          {loadingRules ? (
            <p className="text-sm text-muted-foreground">Loading rules…</p>
          ) : filteredRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules yet for this project.</p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Rules">
              {filteredRules.map((rule) => {
                const { Icon, tone } = ruleIcon(rule);
                return (
                  <li
                    key={rule.id}
                    className="flex items-center gap-2.5 rounded-[10px] border border-border bg-background px-3.5 py-2.5"
                  >
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md",
                        iconToneClass(tone),
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {displayTitle(rule.name)}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground/70">
                        {ruleDescription(rule)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium",
                          actionBadgeClass(rule.action),
                        )}
                      >
                        {rule.action}
                      </span>
                      <EnableToggle
                        enabled={rule.enabled}
                        disabled={updateGuardrail.isPending}
                        label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                        onToggle={() => void onToggleEnabled(rule)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="sets-heading" className="grid gap-2.5 lg:grid-cols-2">
          <div className={panelClass}>
            <h3 id="sets-heading" className="mb-3 text-sm font-medium">
              Guardrail sets
            </h3>
            {loadingSets ? (
              <p className="text-sm text-muted-foreground">Loading sets…</p>
            ) : (
              <label className="mb-3 flex flex-col gap-1 text-sm">
                <span className="font-medium">Active set</span>
                <select
                  aria-label="Guardrail set"
                  className={fieldClass}
                  value={effectiveSetId}
                  onChange={(e) => setSelectedSetId(e.target.value)}
                >
                  {sets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <form className="mb-3 flex gap-2" onSubmit={onCreateSet}>
              <Input
                aria-label="New set name"
                placeholder="production-input"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
              />
              <Button type="submit" size="sm" variant="secondary" disabled={createSet.isPending}>
                Create set
              </Button>
            </form>

            <div className="space-y-2">
              <p className="text-sm font-medium">Member order</p>
              {memberIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members — add a rule below.</p>
              ) : (
                <ol className="space-y-2">
                  {memberIds.map((id, index) => {
                    const rule = guardrailById.get(id);
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                      >
                        <span className="text-sm">
                          {index + 1}. {rule?.name ?? id}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={`Move ${rule?.name ?? id} up`}
                            onClick={() => setMemberIds((prev) => moveItem(prev, index, -1))}
                          >
                            Up
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={`Move ${rule?.name ?? id} down`}
                            onClick={() => setMemberIds((prev) => moveItem(prev, index, 1))}
                          >
                            Down
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Remove ${rule?.name ?? id}`}
                            onClick={() =>
                              setMemberIds((prev) => prev.filter((memberId) => memberId !== id))
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Add rule to set"
                  className="h-9 min-w-48 rounded-md border border-border bg-background px-2"
                  defaultValue=""
                  onChange={(e) => {
                    onAddMember(e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="" disabled>
                    Add rule…
                  </option>
                  {guardrails
                    .filter((g) => !memberIds.includes(g.id))
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  onClick={onSaveOrdering}
                  disabled={!effectiveSetId || updateSet.isPending}
                >
                  Save order
                </Button>
              </div>
            </div>
          </div>

          <div className={panelClass}>
            <h3 className="mb-3 text-sm font-medium">Test panel</h3>
            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Sample input</span>
                <textarea
                  aria-label="Sample input"
                  className="min-h-24 rounded-md border border-border bg-[#0a0d14] px-3 py-2 text-sm"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Sample output</span>
                <textarea
                  aria-label="Sample output"
                  className="min-h-20 rounded-md border border-border bg-[#0a0d14] px-3 py-2 text-sm"
                  value={outputText}
                  onChange={(e) => setOutputText(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={runAll}
                  onChange={(e) => setRunAll(e.target.checked)}
                />
                Run all rules (disable short-circuit)
              </label>
              <Button
                type="button"
                size="sm"
                onClick={onRunTest}
                disabled={!effectiveSetId || evaluateSet.isPending}
              >
                {evaluateSet.isPending ? "Evaluating…" : "Run test"}
              </Button>
              {evalMeta ? (
                <p className="text-sm" aria-live="polite">
                  {evalMeta.blocked ? "Blocked" : "Passed"}
                  {evalMeta.shortCircuited ? " (short-circuited)" : ""}
                </p>
              ) : null}
              {results.length > 0 ? (
                <ul className="space-y-2" aria-label="Evaluator results">
                  {results.map((result, index) => (
                    <li
                      key={`${result.guardrailId}-${result.stage}-${index}`}
                      className="rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {result.name} · {result.stage}
                        </span>
                        <Badge variant={result.passed ? "secondary" : "destructive"}>
                          {result.passed ? "pass" : "fail"}
                        </Badge>
                      </div>
                      {!result.passed ? (
                        <p className="mt-1 text-muted-foreground">{result.reason}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
