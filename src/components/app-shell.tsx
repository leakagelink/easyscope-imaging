import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, FilePlus2, FileText, Images, ScanLine, Settings, MoreHorizontal, LogOut, PanelLeftClose, PanelLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo, LogoMark } from "./logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/reports/new", label: "New Report", icon: FilePlus2 },
  { to: "/reports", label: "Previous Reports", icon: FileText },
  { to: "/gallery", label: "Gallery", icon: Images },
  { to: "/scan", label: "Device / Scan", icon: ScanLine },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [more, setMore] = useState(false);
  const signOut = useSignOut();

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-sidebar transition-[width] md:flex",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          {collapsed ? <LogoMark /> : <Logo />}
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/reports" }}
              className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-muted"
              activeProps={{ className: "!bg-sidebar-accent !text-sidebar-accent-foreground" }}
              title={n.label}
            >
              <n.icon className="h-5 w-5 shrink-0" />
              {!collapsed && n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 border-t p-3">
          <button onClick={() => setCollapsed((c) => !c)} className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted">
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            {!collapsed && "Collapse"}
          </button>
          <button onClick={signOut} className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted">
            <LogOut className="h-5 w-5" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      <main className={cn("pb-24 md:pb-10", collapsed ? "md:pl-[72px]" : "md:pl-64")}>
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-safe md:hidden">
        <div className="grid grid-cols-5">
          {[
            { to: "/dashboard", label: "Home", icon: LayoutDashboard },
            { to: "/patients", label: "Patients", icon: Users },
            { to: "/scan", label: "Scan", icon: ScanLine },
            { to: "/reports", label: "Reports", icon: FileText },
          ].map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/reports" }}
              className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
              activeProps={{ className: "!text-primary" }}
            >
              {n.to === "/scan" ? (
                <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card">
                  <n.icon className="h-6 w-6" />
                </span>
              ) : (
                <n.icon className="h-5 w-5" />
              )}
              {n.label}
            </Link>
          ))}
          <button onClick={() => setMore(true)} className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" /> More
          </button>
        </div>
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 p-2 pb-6">
            {nav.filter((n) => ["/reports/new", "/gallery", "/settings"].includes(n.to)).map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setMore(false)} className="flex h-12 items-center gap-3 rounded-lg px-3 font-medium hover:bg-muted">
                <n.icon className="h-5 w-5 text-primary" /> {n.label}
              </Link>
            ))}
            <button onClick={signOut} className="flex h-12 items-center gap-3 rounded-lg px-3 font-medium text-destructive hover:bg-muted">
              <LogOut className="h-5 w-5" /> Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: typeof Users; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
