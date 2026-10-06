import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FilePlus2, Pencil, Trash2 } from "lucide-react";
import { deleteMedia, deletePatientCascade, fmtDate, qk, useDoctor, useMedia, usePatients, useReports } from "@/lib/data";
import { SignedImage, Viewer } from "@/components/media";
import { PatientForm } from "@/components/patient-form";
import { Confirm } from "@/components/confirm";
import { EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Images } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/$id")({
  head: () => ({
    meta: [
      { title: "Patient — EasyScope" },
      { name: "description", content: "Patient clinical profile, media and reports." },
      { property: "og:title", content: "Patient — EasyScope" },
      { property: "og:description", content: "Patient clinical profile." },
    ],
  }),
  component: PatientPage,
});

function PatientPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: patients, isLoading } = usePatients();
  const { data: allReports = [] } = useReports();
  const { data: allMedia = [] } = useMedia();
  const { data: doctor } = useDoctor();
  const [edit, setEdit] = useState(false);
  const [view, setView] = useState<number | null>(null);

  const p = patients?.find((x) => x.id === id);
  const reports = allReports.filter((r) => r.patient_id === id);
  const media = allMedia.filter((m) => m.patient_id === id);
  const repNo = (rid: string | null) => reports.find((r) => r.id === rid)?.report_number;

  const timeline = useMemo(() => {
    if (!p) return [];
    const ev: { at: string; text: string }[] = [{ at: p.created_at, text: "Patient created" }];
    media.forEach((m) => ev.push({ at: m.captured_at, text: `Photo ${m.capture_source === "import" ? "imported" : "captured"}` }));
    reports.forEach((r) => {
      ev.push({ at: r.created_at, text: `Report ${r.report_number} created` });
      if (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 60000) ev.push({ at: r.updated_at, text: `Report ${r.report_number} edited` });
      if (r.shared_at) ev.push({ at: r.shared_at, text: `Report ${r.report_number} shared` });
    });
    return ev.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [p, media, reports]);

  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
  if (!p) return <EmptyState icon={Images} title="Patient not found" text="This patient may have been deleted." action={<Button asChild><Link to="/patients">Back to patients</Link></Button>} />;

  const lastReport = reports[0]?.report_date;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{p.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{p.age} yrs · {p.gender}{p.phone ? ` · ${p.phone}` : ""}{p.patient_id ? ` · ID ${p.patient_id}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-11"><Link to="/reports/new" search={{ patient: p.id }}><FilePlus2 className="h-4 w-4" /> New Report</Link></Button>
            <Button variant="outline" className="h-11" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Edit Details</Button>
            <Confirm
              trigger={<Button variant="outline" className="h-11 text-destructive"><Trash2 className="h-4 w-4" /> Delete</Button>}
              title="Delete patient?"
              text="Delete this patient and all associated reports and clinical photographs? This cannot be undone."
              action="Delete permanently"
              onConfirm={async () => {
                try {
                  await deletePatientCascade(p);
                  await qc.invalidateQueries();
                  toast.success("Patient deleted");
                  navigate({ to: "/patients" });
                } catch (e) { toast.error((e as Error).message); }
              }}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="media">
        <TabsList className="h-11 w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="media">Media ({media.length})</TabsTrigger>
          <TabsTrigger value="reports">Reports ({reports.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="info">
          <dl className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
            {[["Full name", p.name], ["Age", `${p.age} years`], ["Gender", p.gender], ["Phone", p.phone || "—"], ["Patient ID", p.patient_id || "—"], ["Date of birth", fmtDate(p.date_of_birth)], ["Created", fmtDate(p.created_at)], ["Last report", fmtDate(lastReport)]].map(([k, v]) => (
              <div key={k} className="bg-card p-4"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 font-medium">{v}</dd></div>
            ))}
          </dl>
        </TabsContent>
        <TabsContent value="media">
          {media.length === 0 ? <EmptyState icon={Images} title="No clinical photographs" text="Photos added to this patient's reports appear here." /> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {media.map((m, i) => (
                <button key={m.id} onClick={() => setView(i)} className="overflow-hidden rounded-xl border bg-card text-left">
                  <SignedImage path={m.file_url} className="aspect-square w-full" />
                  <div className="p-2 text-xs text-muted-foreground">{fmtDate(m.captured_at)}{m.report_id ? ` · ${repNo(m.report_id) ?? ""}` : ""}</div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="reports">
          {reports.length === 0 ? <EmptyState icon={FilePlus2} title="No reports" text="Create the first report for this patient." action={<Button asChild><Link to="/reports/new" search={{ patient: p.id }}>New Report</Link></Button>} /> : (
            <div className="divide-y rounded-2xl border bg-card">
              {reports.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-semibold">{r.report_number}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(r.report_date)} · {doctor?.doctor_name || "Doctor"} · {media.filter((m) => m.report_id === r.id).length} images</div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline"><Link to="/reports/$id" params={{ id: r.id }}>View / Share</Link></Button>
                    <Button asChild size="sm" variant="ghost"><Link to="/reports/new" search={{ edit: r.id }}>Edit</Link></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="timeline">
          <ol className="space-y-4 rounded-2xl border bg-card p-5">
            {timeline.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div><div className="text-sm font-medium">{e.text}</div><div className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</div></div>
              </li>
            ))}
          </ol>
        </TabsContent>
      </Tabs>

      <Viewer
        items={media.map((m) => ({ id: m.id, path: m.file_url, title: p.name, subtitle: `${new Date(m.captured_at).toLocaleString()}${m.report_id ? ` · ${repNo(m.report_id) ?? ""}` : ""}`, reportId: m.report_id }))}
        index={view}
        onIndex={setView}
        onClose={() => setView(null)}
        onDelete={async (it) => {
          const m = media.find((x) => x.id === it.id)!;
          await deleteMedia(m);
          await qc.invalidateQueries({ queryKey: qk.media });
          setView(null);
          toast.success("Image deleted");
        }}
      />
      <PatientForm open={edit} onOpenChange={setEdit} patient={p} />
    </div>
  );
}
