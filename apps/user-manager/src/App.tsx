import {
  useApiKeys,
  useCreateApiKey,
  useInviteUser,
  useProjects,
  useRevokeApiKey,
  useUsers,
} from "@repo/api-client";
import type { APIKeyCreated, UserRole, UserStatus } from "@repo/types";
import { Badge, Button, Input, cn } from "@repo/ui";
import { IconKey, IconPlus, IconSearch, IconUserPlus, IconUsers } from "@tabler/icons-react";
import { type FormEvent, useMemo, useState } from "react";

type TabId = "users" | "api-keys";

const TABS: { id: TabId; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "api-keys", label: "API Keys" },
];

const INVITE_ROLES: UserRole[] = ["ROLE_ADMIN", "ROLE_DEVELOPER", "ROLE_VIEWER"];

const API_KEY_SCOPES = [
  "prompts:read",
  "prompts:write",
  "guardrails:read",
  "guardrails:evaluate",
  "usage:read",
  "usage:write",
] as const;

function statusBadgeClass(status: UserStatus): string {
  switch (status) {
    case "active":
      return "border-transparent bg-[#0d2a1a] text-success";
    case "invited":
      return "border-transparent bg-[#2a2000] text-warning";
    default:
      return "border-transparent bg-secondary text-muted-foreground";
  }
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function roleLabel(role: UserRole): string {
  return role.replace(/^ROLE_/, "");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export default function App() {
  const { data: projects = [] } = useProjects();
  const { data: users = [], isLoading: loadingUsers } = useUsers();
  const inviteUser = useInviteUser();

  const [tab, setTab] = useState<TabId>("users");
  const [userSearch, setUserSearch] = useState("");
  const [keySearch, setKeySearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [showCreateKey, setShowCreateKey] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteProjectId, setInviteProjectId] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("ROLE_DEVELOPER");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const effectiveInviteProjectId = inviteProjectId || projects[0]?.id || "";

  const [apiKeyProjectId, setApiKeyProjectId] = useState("");
  const effectiveApiKeyProjectId = apiKeyProjectId || projects[0]?.id || "";

  const { data: apiKeys = [], isLoading: loadingKeys } = useApiKeys({
    projectId: effectiveApiKeyProjectId,
  });
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();

  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<string[]>(["usage:read"]);
  const [keyExpiresAt, setKeyExpiresAt] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<APIKeyCreated | null>(null);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.status.toLowerCase().includes(q) ||
        (u.roles ?? []).some((r) => roleLabel(r).toLowerCase().includes(q)),
    );
  }, [users, userSearch]);

  const filteredKeys = useMemo(() => {
    const q = keySearch.trim().toLowerCase();
    if (!q) return apiKeys;
    return apiKeys.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.prefix.toLowerCase().includes(q) ||
        k.scopes.some((s) => s.toLowerCase().includes(q)),
    );
  }, [apiKeys, keySearch]);

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    setInviteError(null);
    if (!effectiveInviteProjectId) {
      setInviteError("Select a project first");
      return;
    }
    try {
      await inviteUser.mutateAsync({
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        projectId: effectiveInviteProjectId,
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteName("");
      setShowInvite(false);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Failed to invite user");
    }
  }

  function toggleScope(scope: string) {
    setKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function onCreateKey(event: FormEvent) {
    event.preventDefault();
    setKeyError(null);
    if (!effectiveApiKeyProjectId) {
      setKeyError("Select a project first");
      return;
    }
    if (keyScopes.length === 0) {
      setKeyError("Select at least one scope");
      return;
    }
    try {
      const expiresAt = keyExpiresAt.trim() ? new Date(keyExpiresAt).toISOString() : undefined;
      const created = await createApiKey.mutateAsync({
        projectId: effectiveApiKeyProjectId,
        name: keyName.trim(),
        scopes: keyScopes,
        expiresAt,
      });
      setCreatedSecret(created);
      setKeyName("");
      setKeyExpiresAt("");
      setKeyScopes(["usage:read"]);
      setShowCreateKey(false);
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : "Failed to create API key");
    }
  }

  async function onRevoke(id: string, name: string) {
    const confirmed = window.confirm(`Revoke API key “${name}”? This cannot be undone.`);
    if (!confirmed) return;
    await revokeApiKey.mutateAsync(id);
  }

  const fieldClass =
    "h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground";
  const panelClass = "rounded-[10px] border border-border bg-background p-3";
  const labelClass = "mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#12151f] text-foreground">
      <div
        role="tablist"
        aria-label="User Manager views"
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
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "users" ? (
          <section aria-labelledby="users-heading" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="users-heading" className="text-[15px] font-medium text-foreground">
                Users
              </h2>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 border border-input bg-secondary text-primary hover:bg-muted"
                onClick={() => setShowInvite((v) => !v)}
              >
                <IconUserPlus className="size-3.5" aria-hidden />
                Invite user
              </Button>
            </div>

            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
              <IconSearch className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              <Input
                aria-label="Search users"
                placeholder="Search users…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>

            {showInvite ? (
              <form
                className={cn(panelClass, "space-y-3")}
                onSubmit={onInvite}
                aria-label="Invite user"
              >
                <div className={labelClass}>Invite user</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm" htmlFor="invite-email">
                    <span className="font-medium">Email</span>
                    <Input
                      id="invite-email"
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="dev@example.com"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm" htmlFor="invite-name">
                    <span className="font-medium">Name</span>
                    <Input
                      id="invite-name"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Optional display name"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm" htmlFor="invite-project">
                    <span className="font-medium">Project</span>
                    <select
                      id="invite-project"
                      aria-label="Invite project"
                      className={fieldClass}
                      value={effectiveInviteProjectId}
                      onChange={(e) => setInviteProjectId(e.target.value)}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm" htmlFor="invite-role">
                    <span className="font-medium">Role</span>
                    <select
                      id="invite-role"
                      aria-label="Invite role"
                      className={fieldClass}
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    >
                      {INVITE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {inviteError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {inviteError}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={inviteUser.isPending}>
                    {inviteUser.isPending ? "Inviting…" : "Invite user"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowInvite(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}

            {loadingUsers ? (
              <p className="text-sm text-muted-foreground">Loading users…</p>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground/70">
                <IconUsers className="size-9" aria-hidden />
                <p className="text-sm">No users yet.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[10px] border border-border bg-background">
                <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_100px] gap-3 border-b border-border px-3.5 py-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70 sm:grid">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Roles</span>
                  <span className="text-right">Status</span>
                </div>
                <ul aria-label="User list" className="divide-y divide-border/60">
                  {filteredUsers.map((user) => (
                    <li
                      key={user.id}
                      className="grid grid-cols-1 gap-2 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_100px] sm:items-center sm:gap-3"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div
                          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary font-mono text-2xs font-medium text-primary"
                          aria-hidden
                        >
                          {initials(user.name)}
                        </div>
                        <span className="truncate text-sm font-medium text-foreground">
                          {user.name}
                        </span>
                      </div>
                      <span className="truncate text-sm text-muted-foreground">{user.email}</span>
                      <div className="flex flex-wrap gap-1">
                        {(user.roles ?? []).length > 0 ? (
                          user.roles?.map((role) => (
                            <Badge
                              key={role}
                              variant="outline"
                              className="rounded-full text-2xs font-normal"
                            >
                              {roleLabel(role)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground/70">—</span>
                        )}
                      </div>
                      <div className="sm:text-right">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium",
                            statusBadgeClass(user.status),
                          )}
                        >
                          {user.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ) : null}

        {tab === "api-keys" ? (
          <section aria-labelledby="api-keys-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="api-keys-heading" className="text-[15px] font-medium text-foreground">
                API Keys
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="API key project"
                  className={cn(fieldClass, "h-8 w-auto min-w-36")}
                  value={effectiveApiKeyProjectId}
                  onChange={(e) => setApiKeyProjectId(e.target.value)}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 border border-input bg-secondary text-primary hover:bg-muted"
                  onClick={() => setShowCreateKey((v) => !v)}
                >
                  <IconPlus className="size-3.5" aria-hidden />
                  New key
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
              <IconSearch className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              <Input
                aria-label="Search API keys"
                placeholder="Search API keys…"
                value={keySearch}
                onChange={(e) => setKeySearch(e.target.value)}
                className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>

            {showCreateKey ? (
              <form
                className={cn(panelClass, "space-y-3")}
                onSubmit={onCreateKey}
                aria-label="Create API key"
              >
                <div className={labelClass}>Create API key</div>
                <label className="flex flex-col gap-1 text-sm" htmlFor="api-key-name">
                  <span className="font-medium">Name</span>
                  <Input
                    id="api-key-name"
                    required
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="ci-ingest"
                  />
                </label>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Scopes</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {API_KEY_SCOPES.map((scope) => (
                      <label
                        key={scope}
                        className="flex items-center gap-2 text-sm"
                        htmlFor={`scope-${scope}`}
                      >
                        <input
                          id={`scope-${scope}`}
                          type="checkbox"
                          checked={keyScopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                        />
                        <span className="font-mono text-xs">{scope}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="flex flex-col gap-1 text-sm" htmlFor="api-key-expires">
                  <span className="font-medium">Expires (optional)</span>
                  <Input
                    id="api-key-expires"
                    type="datetime-local"
                    value={keyExpiresAt}
                    onChange={(e) => setKeyExpiresAt(e.target.value)}
                  />
                </label>
                {keyError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {keyError}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={createApiKey.isPending}>
                    {createApiKey.isPending ? "Creating…" : "Create API key"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCreateKey(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}

            {createdSecret ? (
              <div className={cn(panelClass, "space-y-3 border-primary/40")}>
                <div className={labelClass}>New API key secret</div>
                <output className="block text-sm text-muted-foreground">
                  Copy this key now — it will not be shown again.
                </output>
                <pre
                  aria-label="API key secret"
                  className="overflow-x-auto rounded-md border border-border bg-[#0a0d14] p-3 font-mono text-sm break-all whitespace-pre-wrap"
                >
                  {createdSecret.key}
                </pre>
                <p className="text-xs text-muted-foreground">
                  Prefix {createdSecret.prefix}… · scopes {createdSecret.scopes.join(", ")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setCreatedSecret(null)}
                >
                  Done — I copied the key
                </Button>
              </div>
            ) : null}

            {loadingKeys ? (
              <p className="text-sm text-muted-foreground">Loading API keys…</p>
            ) : filteredKeys.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground/70">
                <IconKey className="size-9" aria-hidden />
                <p className="text-sm">No API keys for this project.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[10px] border border-border bg-background">
                <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_120px_88px] gap-3 border-b border-border px-3.5 py-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70 lg:grid">
                  <span>Name</span>
                  <span>Prefix</span>
                  <span>Scopes</span>
                  <span>Created</span>
                  <span className="text-right">Actions</span>
                </div>
                <ul aria-label="API key list" className="divide-y divide-border/60">
                  {filteredKeys.map((key) => (
                    <li
                      key={key.id}
                      className="grid grid-cols-1 gap-2 px-3.5 py-2.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_120px_88px] lg:items-center lg:gap-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{key.name}</p>
                        {key.expiresAt ? (
                          <p className="text-2xs text-muted-foreground/70">
                            Expires {formatDate(key.expiresAt)}
                          </p>
                        ) : null}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{key.prefix}…</p>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((scope) => (
                          <Badge
                            key={scope}
                            variant="secondary"
                            className="rounded-full font-mono text-2xs font-normal"
                          >
                            {scope}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatDate(key.createdAt)}
                      </p>
                      <div className="lg:text-right">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="h-7"
                          disabled={revokeApiKey.isPending}
                          onClick={() => onRevoke(key.id, key.name)}
                        >
                          Revoke
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
