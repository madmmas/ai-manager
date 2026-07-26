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

  it("renders Users tab with invite and list", async () => {
    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    expect(screen.getByRole("tab", { name: "Users" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite user" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search users…")).toBeInTheDocument();

    expect(await screen.findByText("admin@aiplane.local")).toBeInTheDocument();
  });

  it("invites a user and adds them to the list", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    expect(await screen.findByText("admin@aiplane.local")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Invite user" }));
    await user.type(screen.getByPlaceholderText("dev@example.com"), "new.dev@example.com");
    await user.type(screen.getByPlaceholderText("Optional display name"), "New Dev");

    const form = screen.getByRole("form", { name: "Invite user" });
    await user.click(within(form).getByRole("button", { name: "Invite user" }));

    const list = screen.getByRole("list", { name: "User list" });
    expect(await within(list).findByText("new.dev@example.com")).toBeInTheDocument();
    expect(within(list).getByText("New Dev")).toBeInTheDocument();
    expect(within(list).getByText("invited")).toBeInTheDocument();
  });

  it("creates an API key showing the secret once and revokes from the list", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    await user.click(screen.getByRole("tab", { name: "API Keys" }));
    expect(await screen.findByText("news-radar-ingest")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New key" }));
    await user.type(screen.getByPlaceholderText("ci-ingest"), "ui-test-key");
    const createForm = screen.getByRole("form", { name: "Create API key" });
    await user.click(within(createForm).getByRole("button", { name: "Create API key" }));

    const secret = await screen.findByLabelText("API key secret");
    expect(secret).toHaveTextContent(/^aimg_/);
    expect(screen.getByText(/Copy this key now/i)).toBeInTheDocument();

    const list = screen.getByLabelText("API key list");
    expect(await within(list).findByText("ui-test-key")).toBeInTheDocument();
    expect(within(list).queryByText(/^aimg_[a-f0-9]{64}$/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Done — I copied the key" }));
    expect(screen.queryByLabelText("API key secret")).not.toBeInTheDocument();

    const uiKeyRow = within(list).getByText("ui-test-key").closest("li");
    expect(uiKeyRow).not.toBeNull();
    await user.click(within(uiKeyRow as HTMLElement).getByRole("button", { name: "Revoke" }));

    expect(within(list).queryByText("ui-test-key")).not.toBeInTheDocument();
  });
});
