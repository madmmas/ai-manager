import type { Project } from "@repo/types";
import { cn } from "@repo/ui";
import { IconBell, IconLayoutSidebar, IconSearch, IconSettings, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useShellBreakpoint } from "../hooks/use-shell-breakpoint";
import { useTheme } from "../hooks/use-theme";
import type { NavId } from "../lib/nav";
import { AppSidebar } from "./app-sidebar";
import { BrandLogo } from "./brand-logo";
import { ProjectSwitcher } from "./project-switcher";
import { ThemeSwitcher } from "./theme-switcher";

const SIDEBAR_STORAGE_KEY = "aiplane-sidebar-open";

function getStoredSidebarOpen(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
  if (stored === null) return true;
  return stored !== "false";
}

interface DashboardLayoutProps {
  activeId: NavId;
  onSelectNav: (id: NavId) => void;
  project: Project | null;
  onProjectChange: (project: Project) => void;
  children: React.ReactNode;
}

/**
 * Host shell: 48px topbar + 160px / 48px sidebar (SPEC §5.1, mock layout).
 * Responsive: desktop expanded, compact icon-only, mobile overlay drawer.
 */
export function DashboardLayout({
  activeId,
  onSelectNav,
  project,
  onProjectChange,
  children,
}: DashboardLayoutProps) {
  const { theme } = useTheme();
  const breakpoint = useShellBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(getStoredSidebarOpen);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar]);

  // SPEC: <1280 icon-only unless user forces open on mobile overlay.
  const iconOnly = breakpoint === "compact" || (breakpoint === "desktop" && !sidebarOpen);
  const mobileDrawerOpen = breakpoint === "mobile" && sidebarOpen;
  const showFixedSidebar = breakpoint !== "mobile";

  const handleSelectNav = (id: NavId) => {
    onSelectNav(id);
    if (breakpoint === "mobile") {
      setSidebarOpen(false);
      localStorage.setItem(SIDEBAR_STORAGE_KEY, "false");
    }
  };

  return (
    <div className="flex min-h-svh w-full flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-3.5 backdrop-blur-md">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={breakpoint === "mobile" ? mobileDrawerOpen : !iconOnly}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground",
            "transition-colors hover:bg-surface-raised hover:text-foreground",
          )}
        >
          {mobileDrawerOpen ? (
            <IconX className="size-4" aria-hidden />
          ) : (
            <IconLayoutSidebar className="size-4" aria-hidden />
          )}
        </button>

        <BrandLogo theme={theme} collapsed height={24} />
        <div className="hidden h-5 w-px bg-border sm:block" />
        <ProjectSwitcher project={project} onProjectChange={onProjectChange} />

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Search (⌘K)"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground"
          >
            <IconSearch className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground"
          >
            <IconBell className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Settings"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground"
          >
            <IconSettings className="size-4" aria-hidden />
          </button>
          <ThemeSwitcher />
          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <div
            className="flex size-7 items-center justify-center rounded-full border border-border bg-surface-raised font-mono text-[10px] font-medium text-accent"
            title="madmmas"
            aria-label="Account"
          >
            MM
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {showFixedSidebar ? (
          <AppSidebar activeId={activeId} onSelect={handleSelectNav} collapsed={iconOnly} />
        ) : null}

        {mobileDrawerOpen ? (
          <>
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 z-30 bg-black/50"
              onClick={() => {
                setSidebarOpen(false);
                localStorage.setItem(SIDEBAR_STORAGE_KEY, "false");
              }}
            />
            <AppSidebar
              activeId={activeId}
              onSelect={handleSelectNav}
              collapsed={false}
              className="absolute inset-y-0 left-0 z-40 shadow-xl"
            />
          </>
        ) : null}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-code-bg">
          <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
