import { ApiClientProvider } from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider
        config={{
          baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8080",
          useMocks: true,
        }}
      >
        <App />
      </ApiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
