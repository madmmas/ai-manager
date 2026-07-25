import type { APIKey, APIKeyCreated } from "@repo/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiClient } from "../client";
import { useApiClient } from "../context";
import { createMockApiKey, listMockApiKeys, revokeMockApiKey } from "../mocks";

export type UseApiKeysParams = {
  projectId?: string;
};

export type ApiKeyCreateInput = {
  projectId: string;
  name: string;
  scopes: string[];
  expiresAt?: string;
};

export const apiKeyKeys = {
  all: ["api-keys"] as const,
  list: (params: UseApiKeysParams = {}) => [...apiKeyKeys.all, "list", params] as const,
};

async function fetchApiKeys(client: ApiClient, params: UseApiKeysParams): Promise<APIKey[]> {
  if (!params.projectId) return [];
  if (client.config.useMocks) {
    return listMockApiKeys(params.projectId);
  }
  return client.apiFetch<APIKey[]>("/api/v1/api-keys", {
    query: { projectId: params.projectId },
  });
}

/** List API keys for a project (prefix only — never the raw secret). */
export function useApiKeys(params: UseApiKeysParams = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: apiKeyKeys.list(params),
    queryFn: () => fetchApiKeys(client, params),
    enabled: Boolean(params.projectId),
  });
}

/** Create an API key; response includes the raw `key` once. */
export function useCreateApiKey() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApiKeyCreateInput): Promise<APIKeyCreated> => {
      if (client.config.useMocks) {
        return createMockApiKey(input);
      }
      return client.apiFetch<APIKeyCreated>("/api/v1/api-keys", {
        method: "POST",
        body: input,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiKeyKeys.all });
    },
  });
}

/** Hard-delete (revoke) an API key. */
export function useRevokeApiKey() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (client.config.useMocks) {
        revokeMockApiKey(id);
        return;
      }
      await client.apiFetch<void>(`/api/v1/api-keys/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiKeyKeys.all });
    },
  });
}
