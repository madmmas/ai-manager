import {
  useApiKeys,
  useCreateApiKey,
  useInviteUser,
  useProjects,
  useRevokeApiKey,
  useUsers,
} from "@repo/api-client";
import type { APIKeyCreated, UserRole, UserStatus } from "@repo/types";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@repo/ui";
import { type FormEvent, useState } from "react";

const INVITE_ROLES: UserRole[] = ["ROLE_ADMIN", "ROLE_DEVELOPER", "ROLE_VIEWER"];

const API_KEY_SCOPES = [
  "prompts:read",
  "prompts:write",
  "guardrails:read",
  "guardrails:evaluate",
  "usage:read",
  "usage:write",
] as const;

function statusBadgeVariant(
  status: UserStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "invited":
      return "secondary";
    case "disabled":
      return "outline";
    default:
      return "outline";
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

export default function App() {
  const { data: projects = [] } = useProjects();
  const { data: users = [], isLoading: loadingUsers } = useUsers();
  const inviteUser = useInviteUser();

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
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : "Failed to create API key");
    }
  }

  async function onRevoke(id: string, name: string) {
    const confirmed = window.confirm(`Revoke API key “${name}”? This cannot be undone.`);
    if (!confirmed) return;
    await revokeApiKey.mutateAsync(id);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">User Manager</h2>
        <p className="text-sm text-muted-foreground">
          Invite users, assign roles, and manage project API keys.
        </p>
      </header>

      <section aria-labelledby="users-heading" className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle id="users-heading">Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingUsers ? (
              <p className="text-sm text-muted-foreground">Loading users…</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            ) : (
              <ul className="space-y-2" aria-label="User list">
                {users.map((user) => (
                  <li key={user.id} className="rounded-md border border-border px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Badge variant={statusBadgeVariant(user.status)}>{user.status}</Badge>
                    </div>
                    {(user.roles?.length ?? 0) > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {user.roles?.map((role) => (
                          <Badge key={role} variant="outline">
                            {roleLabel(role)}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invite user</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onInvite}>
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
                  className="h-9 rounded-md border border-border bg-background px-3"
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
                  className="h-9 rounded-md border border-border bg-background px-3"
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
              {inviteError ? (
                <p className="text-sm text-destructive" role="alert">
                  {inviteError}
                </p>
              ) : null}
              <Button type="submit" disabled={inviteUser.isPending}>
                {inviteUser.isPending ? "Inviting…" : "Invite user"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="api-keys-heading" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle id="api-keys-heading">API keys</CardTitle>
            <label className="flex max-w-xs flex-col gap-1 text-sm" htmlFor="api-key-project">
              <span className="font-medium">Project</span>
              <select
                id="api-key-project"
                aria-label="API key project"
                className="h-9 rounded-md border border-border bg-background px-3"
                value={effectiveApiKeyProjectId}
                onChange={(e) => setApiKeyProjectId(e.target.value)}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingKeys ? (
              <p className="text-sm text-muted-foreground">Loading API keys…</p>
            ) : apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">No API keys for this project.</p>
            ) : (
              <ul className="space-y-2" aria-label="API key list">
                {apiKeys.map((key) => (
                  <li
                    key={key.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{key.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{key.prefix}…</p>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((scope) => (
                          <Badge key={scope} variant="secondary">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created {formatDate(key.createdAt)}
                        {key.expiresAt ? ` · Expires ${formatDate(key.expiresAt)}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={revokeApiKey.isPending}
                      onClick={() => onRevoke(key.id, key.name)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create API key</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={onCreateKey}>
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
                        <span>{scope}</span>
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
                <Button type="submit" disabled={createApiKey.isPending}>
                  {createApiKey.isPending ? "Creating…" : "Create API key"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {createdSecret ? (
            <Card>
              <CardHeader>
                <CardTitle>New API key secret</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <output className="block text-sm text-muted-foreground">
                  Copy this key now — it will not be shown again.
                </output>
                <pre
                  aria-label="API key secret"
                  className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-sm break-all whitespace-pre-wrap"
                >
                  {createdSecret.key}
                </pre>
                <p className="text-xs text-muted-foreground">
                  Prefix {createdSecret.prefix}… · scopes {createdSecret.scopes.join(", ")}
                </p>
                <Button type="button" variant="secondary" onClick={() => setCreatedSecret(null)}>
                  Done — I copied the key
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}
