import { ApiClientProvider, resetGuardrailMocks } from "@repo/api-client";
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

describe("Guardrail App", () => {
  beforeEach(() => {
    resetGuardrailMocks();
  });

  it("renders mock-style list, create, and test panel", async () => {
    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    expect(screen.getByRole("heading", { name: "Guardrails" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New guardrail" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search guardrails…")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Test panel" })).toBeInTheDocument();

    expect(await screen.findByText("Block Secret Keyword")).toBeInTheDocument();
    expect(screen.getAllByText("block").length).toBeGreaterThan(0);
  });

  it("runs the test panel against the active set", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    expect(await screen.findByLabelText("Guardrail set")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run test" }));

    expect(await screen.findByText("Blocked (short-circuited)")).toBeInTheDocument();
    const results = screen.getByLabelText("Evaluator results");
    expect(within(results).getByText("fail")).toBeInTheDocument();
  });

  it("creates a rule from the New guardrail form", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: "New guardrail" }));
    const nameInput = await screen.findByPlaceholderText("block-secrets");
    await user.clear(nameInput);
    await user.type(nameInput, "ui-new-rule");
    await user.click(screen.getByRole("button", { name: "Add rule" }));

    const rules = await screen.findByRole("list", { name: "Rules" });
    expect(await within(rules).findByText("Ui New Rule")).toBeInTheDocument();
  });
});
