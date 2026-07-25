import { ApiClientProvider, resetApiKeyMocks, resetUserMocks } from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider config={{ baseUrl: "http://localhost:8080", useMocks: true }}>
        {children}
      </ApiClientProvider>
    </QueryClientProvider>
  );
}

describe("User Manager App", () => {
  beforeEach(() => {
    resetUserMocks();
    resetApiKeyMocks();
  });

  it("renders Users and API keys section headings", async () => {
    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    expect(screen.getByRole("heading", { name: "User Manager" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invite user" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "API keys" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create API key" })).toBeInTheDocument();

    expect(await screen.findByText("admin@aiplane.local")).toBeInTheDocument();
    expect(await screen.findByText("news-radar-ingest")).toBeInTheDocument();
  });

  it("invites a user and adds them to the list", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    expect(await screen.findByText("admin@aiplane.local")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("dev@example.com"), "new.dev@example.com");
    await user.type(screen.getByPlaceholderText("Optional display name"), "New Dev");
    await user.click(screen.getByRole("button", { name: "Invite user" }));

    const usersHeading = screen.getByRole("heading", { name: "Users" });
    const usersSection = usersHeading.closest("section");
    expect(usersSection).not.toBeNull();
    expect(
      await within(usersSection as HTMLElement).findByText("new.dev@example.com"),
    ).toBeInTheDocument();
    expect(within(usersSection as HTMLElement).getByText("New Dev")).toBeInTheDocument();
    expect(within(usersSection as HTMLElement).getByText("invited")).toBeInTheDocument();
  });

  it("creates an API key showing the secret once and revokes from the list", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    expect(await screen.findByText("news-radar-ingest")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("ci-ingest"), "ui-test-key");
    await user.click(screen.getByRole("button", { name: "Create API key" }));

    const secret = await screen.findByLabelText("API key secret");
    expect(secret).toHaveTextContent(/^aimg_/);
    expect(screen.getByText(/Copy this key now/i)).toBeInTheDocument();

    const list = screen.getByLabelText("API key list");
    expect(await within(list).findByText("ui-test-key")).toBeInTheDocument();
    expect(within(list).queryByText(/^aimg_[a-f0-9]{64}$/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Done — I copied the key" }));
    expect(screen.queryByLabelText("API key secret")).not.toBeInTheDocument();

    const revokeButtons = within(list).getAllByRole("button", { name: "Revoke" });
    const uiKeyRow = within(list).getByText("ui-test-key").closest("li");
    expect(uiKeyRow).not.toBeNull();
    await user.click(within(uiKeyRow as HTMLElement).getByRole("button", { name: "Revoke" }));

    expect(within(list).queryByText("ui-test-key")).not.toBeInTheDocument();
    expect(revokeButtons.length).toBeGreaterThan(0);
  });
});
