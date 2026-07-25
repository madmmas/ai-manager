import type { IsoDateTime, UserRole, UserStatus } from "./common";

export interface ProjectMembership {
  projectId: string;
  role: UserRole;
}

/** Persisted user record (User Manager MFE). */
export interface User {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  createdAt?: IsoDateTime;
  memberships?: ProjectMembership[];
  /** Flattened roles from memberships — returned by list/invite APIs. */
  roles?: UserRole[];
}

/**
 * Authenticated session principal (shell Zustand `currentUser`).
 * Distinct from `User` so the client can carry roles without a full membership list.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
}

export interface APIKey {
  id: string;
  projectId: string;
  name: string;
  /** Visible prefix e.g. `aimg_ab12…` — full key is only returned at creation. */
  prefix: string;
  scopes: string[];
  createdAt: IsoDateTime;
  lastUsedAt?: IsoDateTime;
  expiresAt?: IsoDateTime;
}

/** Response from `POST /api/v1/api-keys` — full secret shown once. */
export interface APIKeyCreated extends APIKey {
  key: string;
}
