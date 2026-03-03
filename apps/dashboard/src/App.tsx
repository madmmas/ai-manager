import React, { Suspense, useState } from "react";

const PromptManagerApp = React.lazy(() => import("promptManager/App"));
const GuardrailApp = React.lazy(() => import("guardrail/App"));
const UserManagerApp = React.lazy(() => import("userManager/App"));
const UsagesDataApp = React.lazy(() => import("usagesData/App"));

function RemoteFallback() {
  return <div>Loading...</div>;
}

function RemoteErrorBoundary({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={<RemoteFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

type TabId = "dashboard" | "promptManager" | "guardrail" | "userManager" | "usagesData";

const TABS: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "promptManager", label: "Prompt Manager" },
  { id: "guardrail", label: "Guardrail" },
  { id: "userManager", label: "User Manager" },
  { id: "usagesData", label: "Usages Data" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.25rem" }}>AI Manager</h1>
        <nav style={{ display: "flex", gap: "0.5rem" }}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              style={{
                padding: "0.5rem 0.75rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                background: activeTab === id ? "#f0f0f0" : "transparent",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main style={{ flex: 1, padding: "1.5rem" }}>
        {activeTab === "dashboard" && (
          <p>Welcome to the AI Manager dashboard. Use the tabs above to open each micro-frontend.</p>
        )}
        {activeTab === "promptManager" && (
          <RemoteErrorBoundary fallback={<div>Failed to load Prompt Manager.</div>}>
            <PromptManagerApp />
          </RemoteErrorBoundary>
        )}
        {activeTab === "guardrail" && (
          <RemoteErrorBoundary fallback={<div>Failed to load Guardrail.</div>}>
            <GuardrailApp />
          </RemoteErrorBoundary>
        )}
        {activeTab === "userManager" && (
          <RemoteErrorBoundary fallback={<div>Failed to load User Manager.</div>}>
            <UserManagerApp />
          </RemoteErrorBoundary>
        )}
        {activeTab === "usagesData" && (
          <RemoteErrorBoundary fallback={<div>Failed to load Usages Data.</div>}>
            <UsagesDataApp />
          </RemoteErrorBoundary>
        )}
      </main>
    </div>
  );
}
