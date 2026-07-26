import { ApiClientProvider, resetPromptMocks } from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
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

describe("Prompt Manager App", () => {
  beforeEach(() => {
    resetPromptMocks();
  });

  it("renders library tab with prompts heading and cards", async () => {
    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    expect(screen.getByRole("tab", { name: "Library" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Prompts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New prompt" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search prompts…")).toBeInTheDocument();

    expect(await screen.findByText("news-radar/dedup-judge")).toBeInTheDocument();
    expect(screen.getByText("Dedup Judge")).toBeInTheDocument();
  });

  it("creates a prompt via the New prompt form", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: "New prompt" }));
    const nameInput = await screen.findByPlaceholderText("news-radar/my-prompt");
    await user.clear(nameInput);
    await user.type(nameInput, "news-radar/ui-new-prompt");
    await user.type(screen.getByPlaceholderText("What this prompt does"), "created in test");
    await user.click(screen.getByRole("button", { name: "Create prompt" }));

    expect(await screen.findByRole("tab", { name: "Editor" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText(/Version history — news-radar\/ui-new-prompt/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Library" }));
    const list = screen.getByRole("list", { name: "Prompt list" });
    expect(await within(list).findByText("news-radar/ui-new-prompt")).toBeInTheDocument();
  });

  it("opens editor from a card, promotes, and runs playground", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    await user.click(await screen.findByRole("button", { name: /Open news-radar\/dedup-judge/i }));

    expect(screen.getByRole("tab", { name: "Editor" })).toHaveAttribute("aria-selected", "true");

    const timeline = await screen.findByLabelText("Prompt versions");
    expect(within(timeline).getByText(/draft/i)).toBeInTheDocument();

    await user.click(within(timeline).getByRole("button", { name: "Select version 8" }));
    expect(screen.getByRole("button", { name: "Promote to testing" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Playground" }));
    expect(screen.getByRole("button", { name: "Compare" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save test" })).toBeInTheDocument();
    await user.type(await screen.findByLabelText("Variable headline_a"), "Alpha headline");
    await user.type(screen.getByLabelText("Variable headline_b"), "Beta headline");
    await user.click(screen.getByRole("button", { name: /Run/i }));

    expect(await screen.findByLabelText("Playground response")).toHaveTextContent("Alpha headline");
    expect(screen.getByText(/\d+ms/)).toBeInTheDocument();
  });
});
