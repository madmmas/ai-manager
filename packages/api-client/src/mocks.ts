import type {
  APIKey,
  APIKeyCreated,
  EvaluatorResult,
  Guardrail,
  GuardrailSet,
  GuardrailSetEvaluateResponse,
  LLMProvider,
  ModelParameters,
  PlaygroundRunResponse,
  Project,
  Prompt,
  PromptVersion,
  PromptVersionStatus,
  UsageCostProjection,
  UsageEvent,
  UsageEventCreateInput,
  UsageEventIngestResponse,
  UsageProviderBreakdown,
  UsageSummary,
  User,
  UserRole,
} from "@repo/types";

/** In-memory fixtures used while the Spring API is not yet available. */
export const MOCK_PROJECTS: Project[] = [
  {
    id: "proj_news_radar",
    slug: "news-radar",
    name: "News Radar",
    createdAt: "2026-01-15T10:00:00.000Z",
  },
  {
    id: "proj_ackloop",
    slug: "ackloop",
    name: "Ackloop",
    createdAt: "2026-02-01T12:00:00.000Z",
  },
];

export let MOCK_PROMPTS: Prompt[] = [];
export let MOCK_PROMPT_VERSIONS: PromptVersion[] = [];
export let MOCK_GUARDRAILS: Guardrail[] = [];
export let MOCK_GUARDRAIL_SETS: GuardrailSet[] = [];
export let MOCK_USAGE_EVENTS: UsageEvent[] = [];
export let MOCK_API_KEYS: APIKey[] = [];
export let MOCK_USERS: User[] = [];

/** ISO timestamp `days` (and optional hours) before now — always in the past. */
function daysAgoIso(days: number, hoursAgo = 0): string {
  return new Date(Date.now() - days * 86_400_000 - hoursAgo * 3_600_000).toISOString();
}

/**
 * Seed usage rows across multiple days so the usages-data overview (#59) can
 * render KPIs + a time-series chart against mocks without ingesting first.
 * Built fresh on each reset so timestamps stay relative to "now".
 */
function buildInitialUsageEvents(): UsageEvent[] {
  return [
    {
      id: "ue_seed_01",
      projectId: "proj_news_radar",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      inputTokens: 1200,
      outputTokens: 400,
      latencyMs: 820,
      costUsd: 0.0096,
      status: "success",
      timestamp: daysAgoIso(0, 1),
    },
    {
      id: "ue_seed_02",
      projectId: "proj_news_radar",
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 800,
      outputTokens: 200,
      latencyMs: 410,
      costUsd: 0.00024,
      status: "success",
      timestamp: daysAgoIso(0, 5),
    },
    {
      id: "ue_seed_03",
      projectId: "proj_news_radar",
      provider: "anthropic",
      model: "claude-haiku-4-20250414",
      inputTokens: 500,
      outputTokens: 150,
      latencyMs: 290,
      costUsd: 0.001,
      status: "success",
      timestamp: daysAgoIso(1, 2),
    },
    {
      id: "ue_seed_04",
      projectId: "proj_news_radar",
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 2000,
      outputTokens: 600,
      latencyMs: 1100,
      costUsd: 0.011,
      status: "success",
      timestamp: daysAgoIso(2, 3),
    },
    {
      id: "ue_seed_05",
      projectId: "proj_news_radar",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      inputTokens: 900,
      outputTokens: 300,
      latencyMs: 750,
      costUsd: 0.0072,
      status: "success",
      timestamp: daysAgoIso(4, 1),
    },
    {
      id: "ue_seed_06",
      projectId: "proj_news_radar",
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 400,
      outputTokens: 100,
      latencyMs: 320,
      costUsd: 0.00012,
      status: "error",
      timestamp: daysAgoIso(6, 2),
    },
    {
      id: "ue_seed_07",
      projectId: "proj_news_radar",
      provider: "anthropic",
      model: "claude-haiku-4-20250414",
      inputTokens: 1500,
      outputTokens: 500,
      latencyMs: 540,
      costUsd: 0.0032,
      status: "success",
      timestamp: daysAgoIso(10, 1),
    },
    {
      id: "ue_seed_08",
      projectId: "proj_news_radar",
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 1000,
      outputTokens: 250,
      latencyMs: 980,
      costUsd: 0.005,
      status: "success",
      timestamp: daysAgoIso(18, 4),
    },
    {
      id: "ue_seed_09",
      projectId: "proj_ackloop",
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 300,
      outputTokens: 80,
      latencyMs: 260,
      costUsd: 0.00009,
      status: "success",
      timestamp: daysAgoIso(1, 3),
    },
    {
      id: "ue_seed_10",
      projectId: "proj_ackloop",
      provider: "anthropic",
      model: "claude-haiku-4-20250414",
      inputTokens: 700,
      outputTokens: 200,
      latencyMs: 480,
      costUsd: 0.00136,
      status: "success",
      timestamp: daysAgoIso(3, 2),
    },
  ];
}

const DEFAULT_PARAMS: ModelParameters = {
  temperature: 0.2,
  maxTokens: 1024,
};

const INITIAL_PROMPTS: Prompt[] = [
  {
    id: "prompt_dedup_judge",
    projectId: "proj_news_radar",
    name: "news-radar/dedup-judge",
    description: "Decide whether two headlines refer to the same story.",
    tags: ["judge", "dedup"],
    activeVersionId: "ver_6",
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-07-01T14:30:00.000Z",
  },
  {
    id: "prompt_summary",
    projectId: "proj_news_radar",
    name: "news-radar/cluster-summary",
    description: "Summarise a cluster of related articles.",
    tags: ["summary"],
    activeVersionId: "ver_3",
    createdAt: "2026-03-10T11:00:00.000Z",
    updatedAt: "2026-06-20T08:15:00.000Z",
  },
  {
    id: "prompt_ack_triage",
    projectId: "proj_ackloop",
    name: "ackloop/incident-triage",
    description: "Classify inbound incident severity.",
    tags: ["triage"],
    createdAt: "2026-04-02T16:00:00.000Z",
    updatedAt: "2026-04-02T16:00:00.000Z",
  },
];

const INITIAL_PROMPT_VERSIONS: PromptVersion[] = [
  {
    id: "ver_5",
    promptId: "prompt_dedup_judge",
    version: 5,
    label: "baseline",
    model: "claude-sonnet-4-20250514",
    provider: "anthropic",
    systemPrompt: "You are a careful news deduplication judge.",
    userPromptTemplate:
      "Headline A: {{headline_a}}\nHeadline B: {{headline_b}}\nSame story? Reply yes or no.",
    parameters: { ...DEFAULT_PARAMS },
    status: "archived",
    createdBy: "dev@aiplane.local",
    createdAt: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "ver_6",
    promptId: "prompt_dedup_judge",
    version: 6,
    label: "active",
    model: "claude-sonnet-4-20250514",
    provider: "anthropic",
    systemPrompt: "You are a careful news deduplication judge.",
    userPromptTemplate:
      "Headline A: {{headline_a}}\nHeadline B: {{headline_b}}\nSame story? Reply yes or no with brief rationale.",
    parameters: { ...DEFAULT_PARAMS, temperature: 0.1 },
    status: "active",
    createdBy: "dev@aiplane.local",
    createdAt: "2026-07-01T14:30:00.000Z",
    metrics: {
      requestCount: 14200,
      avgLatencyMs: 124,
      errorRate: 0.003,
      avgCostUsd: 0.0003,
    },
  },
  {
    id: "ver_7",
    promptId: "prompt_dedup_judge",
    version: 7,
    label: "testing-candidate",
    model: "gpt-4o-mini",
    provider: "openai",
    systemPrompt: "You are a careful news deduplication judge.",
    userPromptTemplate:
      "A: {{headline_a}}\nB: {{headline_b}}\nAre these the same story? Answer YES or NO.",
    parameters: { ...DEFAULT_PARAMS },
    status: "testing",
    createdBy: "dev@aiplane.local",
    createdAt: "2026-07-10T09:00:00.000Z",
  },
  {
    id: "ver_8",
    promptId: "prompt_dedup_judge",
    version: 8,
    label: "draft-rewrite",
    model: "claude-sonnet-4-20250514",
    provider: "anthropic",
    systemPrompt: "You judge whether two headlines refer to the same news event.",
    userPromptTemplate: "Compare:\n1) {{headline_a}}\n2) {{headline_b}}",
    parameters: { ...DEFAULT_PARAMS },
    status: "draft",
    createdBy: "dev@aiplane.local",
    createdAt: "2026-07-20T11:00:00.000Z",
  },
  {
    id: "ver_3",
    promptId: "prompt_summary",
    version: 3,
    model: "gpt-4o-mini",
    provider: "openai",
    systemPrompt: "Summarise related news articles concisely.",
    userPromptTemplate: "Articles:\n{{articles}}\n\nWrite a 3-sentence cluster summary.",
    parameters: { temperature: 0.4, maxTokens: 512 },
    status: "active",
    createdBy: "dev@aiplane.local",
    createdAt: "2026-06-20T08:15:00.000Z",
    metrics: {
      requestCount: 6400,
      avgLatencyMs: 890,
      errorRate: 0.01,
      avgCostUsd: 0.0018,
    },
  },
  {
    id: "ver_ack_1",
    promptId: "prompt_ack_triage",
    version: 1,
    model: "claude-haiku-4-20250414",
    provider: "anthropic",
    systemPrompt: "Classify incident severity for on-call triage.",
    userPromptTemplate: "Incident:\n{{incident}}\n\nSeverity: critical|high|medium|low",
    parameters: { ...DEFAULT_PARAMS },
    status: "draft",
    createdBy: "dev@aiplane.local",
    createdAt: "2026-04-02T16:00:00.000Z",
  },
];

const INITIAL_GUARDRAILS: Guardrail[] = [
  {
    id: "gr_block_pii_hint",
    projectId: "proj_news_radar",
    name: "block-secret-keyword",
    type: "keyword-blocklist",
    stage: "input",
    config: { keywords: ["classified", "secret"] },
    enabled: true,
    action: "block",
    blockMessage: "Contains a blocked keyword",
    createdAt: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "gr_max_input",
    projectId: "proj_news_radar",
    name: "max-input-length",
    type: "max-length",
    stage: "input",
    config: { maxChars: 500 },
    enabled: true,
    action: "warn",
    createdAt: "2026-07-01T10:05:00.000Z",
  },
  {
    id: "gr_email_regex",
    projectId: "proj_news_radar",
    name: "block-emails",
    type: "regex-filter",
    stage: "both",
    config: { patterns: ["[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"] },
    enabled: true,
    action: "block",
    createdAt: "2026-07-02T09:00:00.000Z",
  },
];

const INITIAL_GUARDRAIL_SETS: GuardrailSet[] = [
  {
    id: "gs_news_input",
    projectId: "proj_news_radar",
    name: "news-radar-input",
    shortCircuitOnBlock: true,
    guardrailIds: ["gr_block_pii_hint", "gr_max_input", "gr_email_regex"],
    createdAt: "2026-07-03T12:00:00.000Z",
  },
];

/** Reset mutable mock collections (call from tests between cases). */
export function resetGuardrailMocks(): void {
  MOCK_GUARDRAILS = structuredClone(INITIAL_GUARDRAILS);
  MOCK_GUARDRAIL_SETS = structuredClone(INITIAL_GUARDRAIL_SETS);
}

/** Reset mutable prompt/version fixtures (call from tests between cases). */
export function resetPromptMocks(): void {
  MOCK_PROMPTS = structuredClone(INITIAL_PROMPTS);
  MOCK_PROMPT_VERSIONS = structuredClone(INITIAL_PROMPT_VERSIONS);
}

resetGuardrailMocks();
resetPromptMocks();
resetUsageMocks();
resetApiKeyMocks();
resetUserMocks();

export function listMockProjects(): Project[] {
  return MOCK_PROJECTS;
}

export function listMockPrompts(projectId?: string): Prompt[] {
  if (!projectId) return [...MOCK_PROMPTS];
  return MOCK_PROMPTS.filter((prompt) => prompt.projectId === projectId);
}

export function getMockPrompt(id: string): Prompt | undefined {
  return MOCK_PROMPTS.find((p) => p.id === id);
}

export function createMockPrompt(
  input: Omit<Prompt, "id" | "createdAt" | "updatedAt" | "tags" | "activeVersionId"> & {
    id?: string;
    tags?: string[];
    activeVersionId?: string;
  },
): Prompt {
  const now = new Date().toISOString();
  const prompt: Prompt = {
    id: input.id ?? `prompt_mock_${Date.now()}`,
    projectId: input.projectId,
    name: input.name,
    description: input.description,
    tags: input.tags ?? [],
    activeVersionId: input.activeVersionId,
    createdAt: now,
    updatedAt: now,
  };
  MOCK_PROMPTS = [...MOCK_PROMPTS, prompt];
  return prompt;
}

export function updateMockPrompt(
  id: string,
  patch: Partial<Pick<Prompt, "name" | "description" | "tags" | "activeVersionId">>,
): Prompt {
  const idx = MOCK_PROMPTS.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error(`Prompt not found: ${id}`);
  const updated: Prompt = {
    ...MOCK_PROMPTS[idx],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  MOCK_PROMPTS = MOCK_PROMPTS.map((p, i) => (i === idx ? updated : p));
  return updated;
}

export function listMockPromptVersions(promptId: string): PromptVersion[] {
  return MOCK_PROMPT_VERSIONS.filter((v) => v.promptId === promptId).sort(
    (a, b) => a.version - b.version,
  );
}

export function getMockPromptVersion(
  promptId: string,
  versionId: string,
): PromptVersion | undefined {
  return MOCK_PROMPT_VERSIONS.find((v) => v.promptId === promptId && v.id === versionId);
}

export type CreateMockPromptVersionInput = {
  label?: string;
  model: string;
  provider: LLMProvider;
  systemPrompt?: string;
  userPromptTemplate?: string;
  parameters?: ModelParameters;
  createdBy?: string;
  id?: string;
};

export function createMockPromptVersion(
  promptId: string,
  input: CreateMockPromptVersionInput,
): PromptVersion {
  if (!getMockPrompt(promptId)) throw new Error(`Prompt not found: ${promptId}`);
  const existing = listMockPromptVersions(promptId);
  const nextVersion = existing.reduce((max, v) => Math.max(max, v.version), 0) + 1;
  const version: PromptVersion = {
    id: input.id ?? `ver_mock_${Date.now()}`,
    promptId,
    version: nextVersion,
    label: input.label,
    model: input.model,
    provider: input.provider,
    systemPrompt: input.systemPrompt ?? "",
    userPromptTemplate: input.userPromptTemplate ?? "",
    parameters: input.parameters ?? { ...DEFAULT_PARAMS },
    status: "draft",
    createdBy: input.createdBy?.trim() || "dev@aiplane.local",
    createdAt: new Date().toISOString(),
  };
  MOCK_PROMPT_VERSIONS = [...MOCK_PROMPT_VERSIONS, version];
  return version;
}

const PROMOTE_NEXT: Partial<Record<PromptVersionStatus, PromptVersionStatus>> = {
  draft: "testing",
  testing: "active",
};

export function promoteMockPromptVersion(promptId: string, versionId: string): PromptVersion {
  const version = getMockPromptVersion(promptId, versionId);
  if (!version) throw new Error(`Prompt version not found: ${versionId}`);
  const next = PROMOTE_NEXT[version.status];
  if (!next) {
    throw new Error(`Cannot promote from status: ${version.status}`);
  }
  return updateMockPromptVersionStatus(promptId, versionId, next);
}

export function updateMockPromptVersionStatus(
  promptId: string,
  versionId: string,
  status: PromptVersionStatus,
): PromptVersion {
  const version = getMockPromptVersion(promptId, versionId);
  if (!version) throw new Error(`Prompt version not found: ${versionId}`);

  if (status === "active") {
    MOCK_PROMPT_VERSIONS = MOCK_PROMPT_VERSIONS.map((v) => {
      if (v.promptId !== promptId) return v;
      if (v.id === versionId) return { ...v, status: "active" };
      if (v.status === "active") return { ...v, status: "archived" };
      return v;
    });
    updateMockPrompt(promptId, { activeVersionId: versionId });
  } else {
    MOCK_PROMPT_VERSIONS = MOCK_PROMPT_VERSIONS.map((v) =>
      v.id === versionId && v.promptId === promptId ? { ...v, status } : v,
    );
  }

  const updated = getMockPromptVersion(promptId, versionId);
  if (!updated) throw new Error(`Prompt version not found: ${versionId}`);
  return updated;
}

export type RunMockPlaygroundInput = {
  versionId?: string;
  variables?: Record<string, string>;
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
};

export function runMockPlayground(
  promptId: string,
  input: RunMockPlaygroundInput,
): PlaygroundRunResponse {
  const prompt = getMockPrompt(promptId);
  if (!prompt) throw new Error(`Prompt not found: ${promptId}`);

  const versionId = input.versionId || prompt.activeVersionId;
  if (!versionId) throw new Error("No versionId provided and prompt has no active version");
  const version = getMockPromptVersion(promptId, versionId);
  if (!version) throw new Error(`Prompt version not found: ${versionId}`);

  const variables = input.variables ?? {};
  let rendered = version.userPromptTemplate;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.split(`{{${key}}}`).join(value);
  }

  const latencyMs = 42 + Object.keys(variables).length * 3;
  return {
    content: `[mock ${input.provider}/${input.model}] Completed playground run.\n\n${rendered}`,
    inputTokens: Math.max(12, Math.ceil(rendered.length / 4)),
    outputTokens: 48,
    latencyMs,
    provider: input.provider,
    model: input.model,
    blockedByGuardrail: false,
  };
}

export function listMockGuardrails(projectId?: string): Guardrail[] {
  if (!projectId) return [...MOCK_GUARDRAILS];
  return MOCK_GUARDRAILS.filter((g) => g.projectId === projectId);
}

export function listMockGuardrailSets(projectId?: string): GuardrailSet[] {
  if (!projectId) return [...MOCK_GUARDRAIL_SETS];
  return MOCK_GUARDRAIL_SETS.filter((s) => s.projectId === projectId);
}

export function getMockGuardrail(id: string): Guardrail | undefined {
  return MOCK_GUARDRAILS.find((g) => g.id === id);
}

export function getMockGuardrailSet(id: string): GuardrailSet | undefined {
  return MOCK_GUARDRAIL_SETS.find((s) => s.id === id);
}

export function createMockGuardrail(
  input: Omit<Guardrail, "id" | "createdAt"> & { id?: string },
): Guardrail {
  const guardrail: Guardrail = {
    ...input,
    id: input.id ?? `gr_mock_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  MOCK_GUARDRAILS = [...MOCK_GUARDRAILS, guardrail];
  return guardrail;
}

export function updateMockGuardrail(id: string, patch: Partial<Guardrail>): Guardrail {
  const idx = MOCK_GUARDRAILS.findIndex((g) => g.id === id);
  if (idx < 0) throw new Error(`Guardrail not found: ${id}`);
  const updated = { ...MOCK_GUARDRAILS[idx], ...patch, id };
  MOCK_GUARDRAILS = MOCK_GUARDRAILS.map((g, i) => (i === idx ? updated : g));
  return updated;
}

export function createMockGuardrailSet(
  input: Omit<GuardrailSet, "id" | "createdAt"> & { id?: string },
): GuardrailSet {
  const set: GuardrailSet = {
    ...input,
    id: input.id ?? `gs_mock_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  MOCK_GUARDRAIL_SETS = [...MOCK_GUARDRAIL_SETS, set];
  return set;
}

export function updateMockGuardrailSet(id: string, patch: Partial<GuardrailSet>): GuardrailSet {
  const idx = MOCK_GUARDRAIL_SETS.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error(`Guardrail set not found: ${id}`);
  const updated = { ...MOCK_GUARDRAIL_SETS[idx], ...patch, id };
  MOCK_GUARDRAIL_SETS = MOCK_GUARDRAIL_SETS.map((s, i) => (i === idx ? updated : s));
  return updated;
}

function evaluateRule(guardrail: Guardrail, text: string): EvaluatorResult {
  if (!guardrail.enabled) {
    return {
      guardrailId: guardrail.id,
      name: guardrail.name,
      type: guardrail.type,
      stage: guardrail.stage,
      passed: true,
      reason: "",
    };
  }

  const config = guardrail.config as Record<string, unknown>;
  let passed = true;
  let reason = "";
  let matchedFragment: string | undefined;

  if (guardrail.type === "keyword-blocklist") {
    const keywords = Array.isArray(config.keywords) ? (config.keywords as string[]) : [];
    const lower = text.toLowerCase();
    for (const keyword of keywords) {
      if (keyword && lower.includes(String(keyword).toLowerCase())) {
        passed = false;
        matchedFragment = String(keyword);
        reason = guardrail.blockMessage ?? `Blocked keyword: ${keyword}`;
        break;
      }
    }
  } else if (guardrail.type === "regex-filter") {
    const patterns = Array.isArray(config.patterns) ? (config.patterns as string[]) : [];
    for (const pattern of patterns) {
      try {
        const match = new RegExp(String(pattern)).exec(text);
        if (match) {
          passed = false;
          matchedFragment = match[0];
          reason = guardrail.blockMessage ?? `Blocked by regex: ${pattern}`;
          break;
        }
      } catch {
        reason = `Invalid regex: ${pattern}`;
        passed = false;
        break;
      }
    }
  } else if (guardrail.type === "max-length") {
    const maxChars = Number(config.maxChars ?? 0);
    if (text.length > maxChars) {
      passed = false;
      reason = guardrail.blockMessage ?? `Text length ${text.length} exceeds max of ${maxChars}`;
    }
  }

  return {
    guardrailId: guardrail.id,
    name: guardrail.name,
    type: guardrail.type,
    stage: guardrail.stage,
    passed,
    reason,
    action: passed ? null : guardrail.action,
    matchedFragment: matchedFragment ?? null,
  };
}

export function testMockGuardrail(id: string, text: string): EvaluatorResult {
  const guardrail = getMockGuardrail(id);
  if (!guardrail) throw new Error(`Guardrail not found: ${id}`);
  return evaluateRule(guardrail, text);
}

export function evaluateMockGuardrailSet(
  id: string,
  input: string,
  output: string,
  shortCircuitOnBlock?: boolean,
): GuardrailSetEvaluateResponse {
  const set = getMockGuardrailSet(id);
  if (!set) throw new Error(`Guardrail set not found: ${id}`);
  const shortCircuit = shortCircuitOnBlock ?? set.shortCircuitOnBlock;
  const results: EvaluatorResult[] = [];
  let blocked = false;
  let shortCircuited = false;

  for (const guardrailId of set.guardrailIds) {
    const guardrail = getMockGuardrail(guardrailId);
    if (!guardrail || !guardrail.enabled) continue;

    const stages: Array<"input" | "output"> = [];
    if (guardrail.stage === "input" || guardrail.stage === "both") stages.push("input");
    if (guardrail.stage === "output" || guardrail.stage === "both") stages.push("output");

    for (const stage of stages) {
      const result = {
        ...evaluateRule(guardrail, stage === "input" ? input : output),
        stage,
      };
      results.push(result);
      if (!result.passed && result.action === "block") {
        blocked = true;
        if (shortCircuit) {
          shortCircuited = true;
          return { blocked, shortCircuited, results };
        }
      }
    }
  }

  return { blocked, shortCircuited, results };
}

/** Reset mutable usage event fixtures (call from tests between cases). */
export function resetUsageMocks(): void {
  MOCK_USAGE_EVENTS = buildInitialUsageEvents();
}

const ALLOWED_API_KEY_SCOPES = new Set([
  "prompts:read",
  "prompts:write",
  "guardrails:read",
  "guardrails:evaluate",
  "usage:read",
  "usage:write",
]);

function buildInitialApiKeys(): APIKey[] {
  return [
    {
      id: "akey_mock_01",
      projectId: "proj_news_radar",
      name: "news-radar-ingest",
      prefix: "aimg_abcd1234",
      scopes: ["usage:write", "usage:read"],
      createdAt: "2026-03-01T10:00:00.000Z",
    },
  ];
}

function buildInitialUsers(): User[] {
  return [
    {
      id: "user_admin",
      email: "admin@aiplane.local",
      name: "AIPlane Admin",
      status: "active",
      roles: ["ROLE_ADMIN"],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];
}

export function resetApiKeyMocks(): void {
  MOCK_API_KEYS = structuredClone(buildInitialApiKeys());
}

export function resetUserMocks(): void {
  MOCK_USERS = structuredClone(buildInitialUsers());
}

export function listMockApiKeys(projectId: string): APIKey[] {
  if (!projectId?.trim()) throw new Error("projectId is required");
  return MOCK_API_KEYS.filter((k) => k.projectId === projectId).map((k) => ({ ...k }));
}

export function createMockApiKey(input: {
  projectId: string;
  name: string;
  scopes: string[];
  expiresAt?: string;
}): APIKeyCreated {
  if (!input.projectId?.trim()) throw new Error("projectId is required");
  if (!input.name?.trim()) throw new Error("name is required");
  if (!MOCK_PROJECTS.some((p) => p.id === input.projectId)) {
    throw new Error(`Unknown projectId: ${input.projectId}`);
  }
  if (!input.scopes?.length) throw new Error("scopes must not be empty");
  for (const scope of input.scopes) {
    if (!ALLOWED_API_KEY_SCOPES.has(scope)) {
      throw new Error(`Unknown scope: ${scope}`);
    }
  }
  if (MOCK_API_KEYS.some((k) => k.projectId === input.projectId && k.name === input.name.trim())) {
    throw new Error(`API key already exists for name: ${input.name.trim()}`);
  }

  const secret = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(
    "",
  );
  const rawKey = `aimg_${secret}`;
  const prefix = rawKey.slice(0, 13);
  const created: APIKeyCreated = {
    id: `akey_mock_${Date.now().toString(36)}`,
    projectId: input.projectId,
    name: input.name.trim(),
    prefix,
    scopes: [...input.scopes],
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
    key: rawKey,
  };
  const { key: _omitKey, ...listed } = created;
  void _omitKey;
  MOCK_API_KEYS = [listed, ...MOCK_API_KEYS];
  return created;
}

export function revokeMockApiKey(id: string): void {
  const before = MOCK_API_KEYS.length;
  MOCK_API_KEYS = MOCK_API_KEYS.filter((k) => k.id !== id);
  if (MOCK_API_KEYS.length === before) {
    throw new Error(`API key not found: ${id}`);
  }
}

export function listMockUsers(): User[] {
  return [...MOCK_USERS];
}

export function inviteMockUser(input: {
  email: string;
  name?: string;
  projectId: string;
  role: UserRole;
}): User {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("email is required");
  if (!MOCK_PROJECTS.some((p) => p.id === input.projectId)) {
    throw new Error(`Unknown projectId: ${input.projectId}`);
  }
  if (MOCK_USERS.some((u) => u.email.toLowerCase() === email)) {
    throw new Error(`User already exists for email: ${email}`);
  }
  const user: User = {
    id: `user_mock_${Date.now().toString(36)}`,
    email,
    name: input.name?.trim() || email,
    status: "invited",
    roles: [input.role],
    createdAt: new Date().toISOString(),
  };
  MOCK_USERS = [...MOCK_USERS, user];
  return user;
}

const ALLOWED_PROVIDERS = new Set<LLMProvider>([
  "anthropic",
  "openai",
  "azure-openai",
  "bedrock",
  "ollama",
  "gemini",
]);

const ALLOWED_STATUSES = new Set(["success", "error", "guardrail-blocked"]);

/** Mirrors `aiplane.cost-rates.rates` defaults in api-server application.yml. */
const MOCK_COST_RATES: Record<string, { inputUsdPer1k: number; outputUsdPer1k: number }> = {
  "claude-sonnet-4-20250514": { inputUsdPer1k: 0.003, outputUsdPer1k: 0.015 },
  "claude-haiku-4-20250414": { inputUsdPer1k: 0.0008, outputUsdPer1k: 0.004 },
  "gpt-4o": { inputUsdPer1k: 0.0025, outputUsdPer1k: 0.01 },
  "gpt-4o-mini": { inputUsdPer1k: 0.00015, outputUsdPer1k: 0.0006 },
};

function computeMockCost(model: string, inputTokens: number, outputTokens: number): number {
  const rate = MOCK_COST_RATES[model];
  if (!rate) return 0;
  const cost =
    (inputTokens / 1000) * rate.inputUsdPer1k + (outputTokens / 1000) * rate.outputUsdPer1k;
  return Math.round(cost * 1e8) / 1e8;
}

/**
 * In-memory stand-in for `POST /api/v1/usage/events`. Mirrors server all-or-nothing
 * validation so the usages-data MFE (#59) can develop against mocks first.
 */
export function ingestMockUsageEvents(events: UsageEventCreateInput[]): UsageEventIngestResponse {
  if (!events.length) {
    throw new Error("events must be a non-empty array");
  }

  const errors: string[] = [];
  const prepared: UsageEvent[] = [];

  for (let i = 0; i < events.length; i++) {
    const item = events[i];
    try {
      prepared.push(toMockUsageEvent(item));
    } catch (err) {
      errors.push(`[${i}] ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (errors.length) {
    throw new Error(errors.join("; "));
  }

  MOCK_USAGE_EVENTS = [...MOCK_USAGE_EVENTS, ...prepared];
  return { accepted: prepared.length, events: prepared };
}

function toMockUsageEvent(input: UsageEventCreateInput): UsageEvent {
  if (!input.projectId?.trim()) throw new Error("projectId is required");
  if (!input.model?.trim()) throw new Error("model is required");
  if (!ALLOWED_PROVIDERS.has(input.provider)) {
    throw new Error(`Unknown LLM provider: ${input.provider}`);
  }
  if (!ALLOWED_STATUSES.has(input.status)) {
    throw new Error(`Unknown usage event status: ${input.status}`);
  }

  const projectExists = MOCK_PROJECTS.some((p) => p.id === input.projectId);
  if (!projectExists) throw new Error(`Unknown projectId: ${input.projectId}`);

  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const latencyMs = input.latencyMs ?? 0;
  const model = input.model.trim();
  const costUsd =
    input.costUsd === undefined ? computeMockCost(model, inputTokens, outputTokens) : input.costUsd;
  if (inputTokens < 0) throw new Error("inputTokens must be >= 0");
  if (outputTokens < 0) throw new Error("outputTokens must be >= 0");
  if (latencyMs < 0) throw new Error("latencyMs must be >= 0");
  if (costUsd < 0) throw new Error("costUsd must be >= 0");

  return {
    id: input.id?.trim() || `ue_mock_${Date.now()}_${MOCK_USAGE_EVENTS.length}`,
    projectId: input.projectId.trim(),
    promptId: input.promptId,
    promptVersionId: input.promptVersionId,
    apiKeyId: input.apiKeyId,
    provider: input.provider,
    model,
    inputTokens,
    outputTokens,
    latencyMs,
    costUsd,
    status: input.status,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}

function parsePeriodRange(period: string, now = new Date()): { from: Date; to: Date } {
  const relative = /^(\d+)d$/.exec(period);
  if (relative) {
    const days = Number(relative[1]);
    if (days <= 0) throw new Error("period day count must be > 0");
    return { from: new Date(now.getTime() - days * 86_400_000), to: now };
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split("-").map(Number);
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));
    return { from, to };
  }
  throw new Error("period must be 7d, 30d, or yyyy-MM");
}

/** In-memory stand-in for `GET /api/v1/usage/summary`. */
export function getMockUsageSummary(projectId: string, period: string): UsageSummary {
  if (!projectId?.trim()) throw new Error("projectId is required");
  const projectExists = MOCK_PROJECTS.some((p) => p.id === projectId);
  if (!projectExists) throw new Error(`Unknown projectId: ${projectId}`);

  const { from, to } = parsePeriodRange(period.trim());
  const events = MOCK_USAGE_EVENTS.filter((e) => {
    if (e.projectId !== projectId) return false;
    const ts = new Date(e.timestamp).getTime();
    // Inclusive upper bound so events stamped "now" are visible immediately in mocks.
    return ts >= from.getTime() && ts <= to.getTime();
  });

  const byProviderMap = new Map<LLMProvider, UsageProviderBreakdown>();
  for (const e of events) {
    const row = byProviderMap.get(e.provider) ?? {
      provider: e.provider,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
    row.requests += 1;
    row.inputTokens += e.inputTokens;
    row.outputTokens += e.outputTokens;
    row.costUsd += e.costUsd;
    byProviderMap.set(e.provider, row);
  }

  const byProvider = [...byProviderMap.values()];
  return {
    projectId,
    period: period.trim(),
    totalRequests: events.length,
    totalInputTokens: byProvider.reduce((s, r) => s + r.inputTokens, 0),
    totalOutputTokens: byProvider.reduce((s, r) => s + r.outputTokens, 0),
    totalCostUsd: byProvider.reduce((s, r) => s + r.costUsd, 0),
    byProvider,
  };
}

/** In-memory stand-in for `GET /api/v1/usage/events`. */
export function listMockUsageEvents(
  projectId: string,
  from: string,
  to: string,
  limit = 500,
): UsageEvent[] {
  if (!projectId?.trim()) throw new Error("projectId is required");
  const projectExists = MOCK_PROJECTS.some((p) => p.id === projectId);
  if (!projectExists) throw new Error(`Unknown projectId: ${projectId}`);
  if (!from || !to) throw new Error("from and to are required (ISO-8601 instants)");

  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    throw new Error("from and to must be valid ISO-8601 instants");
  }
  if (fromMs > toMs) throw new Error("from must be <= to");

  return MOCK_USAGE_EVENTS.filter((e) => {
    if (e.projectId !== projectId) return false;
    const ts = new Date(e.timestamp).getTime();
    return ts >= fromMs && ts <= toMs;
  })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/** In-memory stand-in for `GET /api/v1/usage/costs/projection` (avg daily × 30). */
export function getMockUsageCostProjection(projectId: string): UsageCostProjection {
  if (!projectId?.trim()) throw new Error("projectId is required");
  const projectExists = MOCK_PROJECTS.some((p) => p.id === projectId);
  if (!projectExists) throw new Error(`Unknown projectId: ${projectId}`);

  const now = Date.now();
  const fromMs = now - 7 * 86_400_000;
  const windowCost = MOCK_USAGE_EVENTS.filter((e) => {
    if (e.projectId !== projectId) return false;
    const ts = new Date(e.timestamp).getTime();
    return ts >= fromMs && ts <= now;
  }).reduce((sum, e) => sum + e.costUsd, 0);

  const avgDailyCostUsd = Math.round((windowCost / 7) * 1e8) / 1e8;
  return {
    projectId,
    windowDays: 7,
    avgDailyCostUsd,
    projectedMonthlyCostUsd: Math.round(avgDailyCostUsd * 30 * 1e8) / 1e8,
  };
}
