import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, Pencil, Save, Share2, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteReportCascade, fmtDate, qk, uploadFile } from "@/lib/data";
import { buildReportPdf, downloadPdf, loadReportBundle, pdfFileName, sharePdf } from "@/lib/pdf";
import { SignedImage } from "@/components/media";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  head: () => ({
    meta: [
      { title: "Report Preview — EasyScope" },
      { name: "description", content: "Preview, save and share the clinical report PDF." },
      { property: "og:title", content: "Report Preview — EasyScope" },
      { property: "og:description", content: "Clinical report preview." },
    ],
  }),
  component: ReportView,
});

function ReportView() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const bundle = useQuery({ queryKey: ["bundle", id], queryFn: () => loadReportBundle(id) });
  const pdf = useQuery({
    queryKey: ["pdf", id, bundle.data?.report.updated_at],
    enabled: !!bundle.data,
    queryFn: () => buildReportPdf(bundle.data!),
    staleTime: Infinity,
  });
  const url = useMemo(() => (pdf.data ? URL.createObjectURL(pdf.data) : null), [pdf.data]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (bundle.isError) return <div className="rounded-2xl border bg-card p-8 text-center">Report not found. <Link to="/reports" className="text-primary">Back to reports</Link></div>;
  const b = bundle.data;

  async function savePdf() {
    if (!b || !pdf.data) return;
    setBusy("save");
    try {
      const path = await uploadFile(pdf.data, "reports", "pdf", b.report.id);
      await supabase.from("reports").update({ pdf_url: path }).eq("id", b.report.id);
      downloadPdf(pdf.data, pdfFileName(b));
      await qc.invalidateQueries({ queryKey: qk.reports });
      toast.success("PDF saved to patient's reports");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }
  async function share() {
    if (!b || !pdf.data) return;
    setBusy("share");
    try {
      const r = await sharePdf(pdf.data, pdfFileName(b));
      await supabase.from("reports").update({ shared_at: new Date().toISOString() }).eq("id", b.report.id);
      if (r === "downloaded") toast.success("Sharing isn't supported here — PDF downloaded instead");
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Report Preview</h1>
          {b && <p className="text-sm text-muted-foreground">{b.patient.name} · {b.report.report_number} · {fmtDate(b.report.report_date)}</p>}
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={() => navigate({ to: "/reports" })}><X /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button asChild variant="outline" className="h-11"><Link to="/reports/new" search={{ edit: id }}><Pencil className="h-4 w-4" /> Edit Report</Link></Button>
        <Button className="h-11" disabled={!pdf.data || !!busy} onClick={savePdf}><Save className="h-4 w-4" /> {busy === "save" ? "Saving…" : "Save PDF"}</Button>
        <Button className="h-11" variant="secondary" disabled={!pdf.data || !!busy} onClick={share}><Share2 className="h-4 w-4" /> Share PDF</Button>
        <Button variant="outline" className="h-11" disabled={!pdf.data} onClick={() => b && pdf.data && downloadPdf(pdf.data, pdfFileName(b))}><Download className="h-4 w-4" /> Download</Button>
        {b && (
          <Confirm
            trigger={<Button variant="ghost" className="h-11 text-destructive"><Trash2 className="h-4 w-4" /> Delete</Button>}
            title="Delete report?" text="This report, its PDF and its clinical photographs will be permanently deleted."
            onConfirm={async () => { await deleteReportCascade(b.report); await qc.invalidateQueries(); toast.success("Report deleted"); navigate({ to: "/reports" }); }}
          />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-2xl border bg-muted shadow-card">
          {url ? (
            <>
              <iframe src={url} title="Report PDF" className="h-[75dvh] w-full bg-card" />
              <a href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 border-t bg-card p-3 text-sm font-medium text-primary"><ExternalLink className="h-4 w-4" /> Open PDF full screen</a>
            </>
          ) : (
            <div className="flex h-[60dvh] items-center justify-center text-sm text-muted-foreground">{pdf.isError ? "Could not generate PDF" : "Generating PDF…"}</div>
          )}
        </div>
        {b && (
          <aside className="space-y-4">
            <div className="rounded-2xl border bg-card p-4">
              <div className="text-xs font-semibold text-muted-foreground">PATIENT</div>
              <Link to="/patients/$id" params={{ id: b.patient.id }} className="mt-1 block font-semibold text-primary">{b.patient.name}</Link>
              <div className="text-sm text-muted-foreground">{b.patient.age} yrs · {b.patient.gender}</div>
            </div>
            {b.media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {b.media.map((m) => <SignedImage key={m.id} path={m.file_url} className="aspect-square w-full rounded-lg" />)}
              </div>
            )}
            <div className="rounded-2xl border bg-card p-4">
              <div className="text-xs font-semibold text-muted-foreground">DIAGNOSIS / FINDINGS</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{b.report.diagnosis_findings || "—"}</p>
              {b.report.additional_notes && (<><div className="mt-4 text-xs font-semibold text-muted-foreground">ADDITIONAL NOTES</div><p className="mt-1 whitespace-pre-wrap text-sm">{b.report.additional_notes}</p></>)}
            </div>
            {!b.doctor.doctor_name && (
              <p className="rounded-xl bg-accent p-3 text-sm text-accent-foreground">Tip: add your name, qualification and signature in <Link to="/settings" className="font-semibold underline">Settings</Link> so they appear on every report.</p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
