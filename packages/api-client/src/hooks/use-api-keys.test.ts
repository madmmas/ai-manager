import { beforeEach, describe, expect, it } from "vitest";
import { createMockApiKey, listMockApiKeys, resetApiKeyMocks, revokeMockApiKey } from "../mocks";

describe("api key mocks", () => {
  beforeEach(() => {
    resetApiKeyMocks();
  });

  it("lists by project without exposing raw key", () => {
    const listed = listMockApiKeys("proj_news_radar");
    expect(listed.length).toBeGreaterThan(0);
    expect(listed[0]).not.toHaveProperty("key");
    expect(listed[0].prefix).toMatch(/^aimg_/);
  });

  it("create returns raw key once and list hides it", () => {
    const created = createMockApiKey({
      projectId: "proj_ackloop",
      name: "ack-ingest",
      scopes: ["usage:write"],
    });
    expect(created.key).toMatch(/^aimg_/);
    expect(created.prefix).toBe(created.key.slice(0, 13));

    const listed = listMockApiKeys("proj_ackloop");
    const row = listed.find((k) => k.id === created.id);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty("key");
  });

  it("rejects unknown scopes", () => {
    expect(() =>
      createMockApiKey({
        projectId: "proj_ackloop",
        name: "bad",
        scopes: ["admin:all"],
      }),
    ).toThrow(/Unknown scope/);
  });

  it("revoke removes the key", () => {
    const created = createMockApiKey({
      projectId: "proj_ackloop",
      name: "temp",
      scopes: ["usage:read"],
    });
    revokeMockApiKey(created.id);
    expect(listMockApiKeys("proj_ackloop").find((k) => k.id === created.id)).toBeUndefined();
  });
});
