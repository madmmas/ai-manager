import type { User, UserRole } from "@repo/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../context";
import { inviteMockUser, listMockUsers } from "../mocks";

export type InviteUserInput = {
  email: string;
  name?: string;
  projectId: string;
  role: UserRole;
};

export const userKeys = {
  all: ["users"] as const,
  list: () => [...userKeys.all, "list"] as const,
};

/** List users (`GET /api/v1/users`). */
export function useUsers() {
  const client = useApiClient();

  return useQuery({
    queryKey: userKeys.list(),
    queryFn: async (): Promise<User[]> => {
      if (client.config.useMocks) {
        return listMockUsers();
      }
      return client.apiFetch<User[]>("/api/v1/users");
    },
  });
}

/** Invite a user (`POST /api/v1/users/invite`). */
export function useInviteUser() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InviteUserInput): Promise<User> => {
      if (client.config.useMocks) {
        return inviteMockUser(input);
      }
      return client.apiFetch<User>("/api/v1/users/invite", {
        method: "POST",
        body: input,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
