import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <rect width="40" height="40" rx="11" className="fill-primary" />
      <circle cx="20" cy="18" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary-foreground" />
      <circle cx="20" cy="18" r="3.5" className="fill-primary-foreground" />
      <path d="M26.5 24.5 L32 32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary-foreground" />
    </svg>
  );
}

export function Logo({ className, tagline }: { className?: string; tagline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-tight">
        <div className="font-display text-lg font-bold tracking-tight">
          Easy<span className="text-primary">Scope</span>
        </div>
        {tagline && <div className="text-[11px] text-muted-foreground">Smarter Visualization for Better Care</div>}
      </div>
    </div>
  );
}
