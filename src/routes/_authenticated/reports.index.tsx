import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Plus, Search, Share2, Trash2 } from "lucide-react";
import { deleteReportCascade, fmtDate, todayISO, useDoctor, useMedia, useReports } from "@/lib/data";
import { buildReportPdf, loadReportBundle, pdfFileName, sharePdf } from "@/lib/pdf";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({
    meta: [
      { title: "Previous Reports — EasyScope" },
      { name: "description", content: "Search, view and share saved clinical reports." },
      { property: "og:title", content: "Previous Reports — EasyScope" },
      { property: "og:description", content: "All saved clinical reports." },
    ],
  }),
  component: ReportsPage,
});

type F = "all" | "today" | "week" | "month" | "custom";

function ReportsPage() {
  const qc = useQueryClient();
  const { data: reports = [], isLoading } = useReports();
  const { data: media = [] } = useMedia();
  const { data: doctor } = useDoctor();
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sharing, setSharing] = useState<string | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const today = todayISO();
    const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const ms = today.slice(0, 8) + "01";
    return reports.filter((r) => {
      const docName = (doctor?.doctor_name ?? "").toLowerCase();
      if (t && !(r.patients?.name.toLowerCase().includes(t) || r.report_number.toLowerCase().includes(t) || docName.includes(t) || r.report_date.includes(t))) return false;
      if (f === "today") return r.report_date === today;
      if (f === "week") return r.report_date >= daysAgo(7);
      if (f === "month") return r.report_date >= ms;
      if (f === "custom") return (!from || r.report_date >= from) && (!to || r.report_date <= to);
      return true;
    });
  }, [reports, q, f, from, to, doctor]);

  async function share(id: string) {
    setSharing(id);
    try {
      const b = await loadReportBundle(id);
      const res = await sharePdf(await buildReportPdf(b), pdfFileName(b));
      await supabase.from("reports").update({ shared_at: new Date().toISOString() }).eq("id", id);
      if (res === "downloaded") toast.success("PDF downloaded");
    } catch (e) { toast.error((e as Error).message); } finally { setSharing(null); }
  }

  return (
    <div>
      <PageHeader title="Previous Reports" subtitle={`${reports.length} reports`} actions={<Button asChild className="h-11"><Link to="/reports/new"><Plus className="h-4 w-4" /> New Report</Link></Button>} />
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient, report ID, doctor or date" className="h-11 pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([["all", "All"], ["today", "Today"], ["week", "This week"], ["month", "This month"], ["custom", "Custom range"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setF(k)} className={cn("h-9 rounded-full border px-4 text-sm font-medium", f === k ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground")}>{l}</button>
          ))}
          {f === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-auto" />
              <span className="text-sm text-muted-foreground">to</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-auto" />
            </div>
          )}
        </div>
      </div>
      {!isLoading && list.length === 0 ? (
        <EmptyState icon={FileText} title={reports.length ? "No matching reports" : "No reports yet"} text={reports.length ? "Adjust your search or filters." : "Saved reports will appear here."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{r.patients?.name}</div>
                  <div className="text-xs text-muted-foreground">{r.report_number}</div>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", r.pdf_url ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{r.pdf_url ? "PDF saved" : "Draft"}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {fmtDate(r.report_date)} · {doctor?.doctor_name || "Doctor"} · {media.filter((m) => m.report_id === r.id).length} images · Modified {fmtDate(r.updated_at)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm"><Link to="/reports/$id" params={{ id: r.id }}>View</Link></Button>
                <Button asChild size="sm" variant="outline"><Link to="/reports/new" search={{ edit: r.id }}>Edit</Link></Button>
                <Button size="sm" variant="outline" disabled={sharing === r.id} onClick={() => share(r.id)}><Share2 className="h-4 w-4" /> {sharing === r.id ? "Preparing…" : "Share"}</Button>
                <Confirm
                  trigger={<Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>}
                  title="Delete report?"
                  text="This report, its PDF and its clinical photographs will be permanently deleted."
                  onConfirm={async () => {
                    try { await deleteReportCascade(r); await qc.invalidateQueries(); toast.success("Report deleted"); } catch (e) { toast.error((e as Error).message); }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
