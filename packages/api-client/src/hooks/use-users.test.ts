import { beforeEach, describe, expect, it } from "vitest";
import { inviteMockUser, listMockUsers, resetUserMocks } from "../mocks";

describe("user mocks", () => {
  beforeEach(() => {
    resetUserMocks();
  });

  it("lists seed admin", () => {
    const users = listMockUsers();
    expect(users.some((u) => u.email === "admin@aiplane.local")).toBe(true);
  });

  it("invite adds an invited user", () => {
    const invited = inviteMockUser({
      email: "dev@example.com",
      name: "Dev",
      projectId: "proj_ackloop",
      role: "ROLE_DEVELOPER",
    });
    expect(invited.status).toBe("invited");
    expect(invited.roles).toEqual(["ROLE_DEVELOPER"]);
    expect(listMockUsers().some((u) => u.id === invited.id)).toBe(true);
  });

  it("rejects duplicate email", () => {
    expect(() =>
      inviteMockUser({
        email: "admin@aiplane.local",
        projectId: "proj_ackloop",
        role: "ROLE_VIEWER",
      }),
    ).toThrow(/already exists/);
  });
});
