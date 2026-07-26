import { cn } from "@repo/ui";
import React, { Suspense, useState } from "react";
import { RemoteLoadError } from "./remote-load-error";

function RemoteFallback({ name }: { name: string }) {
  return (
    <output className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
      Loading {name}…
    </output>
  );
}

class RemoteErrorBoundary extends React.Component<
  {
    remoteName: string;
    children: React.ReactNode;
    resetKey: number;
    onRetry: () => void;
  },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: Readonly<{ resetKey: number }>) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return <RemoteLoadError remoteName={this.props.remoteName} onRetry={this.props.onRetry} />;
    }
    return this.props.children;
  }
}

interface RemoteLoaderProps {
  remoteName: string;
  children: React.ReactNode;
  className?: string;
}

/** Suspense + error boundary wrapper for Module Federation remotes. */
export function RemoteLoader({ remoteName, children, className }: RemoteLoaderProps) {
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className={cn("flex h-full min-h-0 flex-1 flex-col", className)}>
      <RemoteErrorBoundary
        key={resetKey}
        remoteName={remoteName}
        resetKey={resetKey}
        onRetry={() => setResetKey((n) => n + 1)}
      >
        <Suspense fallback={<RemoteFallback name={remoteName} />}>{children}</Suspense>
      </RemoteErrorBoundary>
    </div>
  );
}
