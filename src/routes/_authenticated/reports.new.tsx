import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Camera, ImagePlus, Maximize2, ScanLine, Search, Star, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  extFor, fmtDate, makeReportNumber, qk, removeFiles, requireUid, todayISO, uploadFile, useClinics, useLocations, usePatients, validateImage,
  type Media, type Patient,
} from "@/lib/data";
import { captureStore } from "@/lib/capture-store";
import { PatientForm } from "@/components/patient-form";
import { SignedImage, Viewer } from "@/components/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Search = { patient?: string | undefined; edit?: string | undefined };
export const Route = createFileRoute("/_authenticated/reports/new")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s["patient"] === "string" ? { patient: s["patient"] } : {}),
    ...(typeof s["edit"] === "string" ? { edit: s["edit"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "New Report — EasyScope" },
      { name: "description", content: "Create a clinical report with photographs and findings." },
      { property: "og:title", content: "New Report — EasyScope" },
      { property: "og:description", content: "Clinical report editor." },
    ],
  }),
  component: ReportEditor,
});

type Item =
  | { key: string; kind: "existing"; media: Media }
  | { key: string; kind: "new"; blob: Blob; url: string; source: string; capturedAt: string };

function ReportEditor() {
  const { patient: patientParam, edit } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: patients = [] } = usePatients();
  const { data: clinics = [] } = useClinics();
  const { data: locations = [] } = useLocations();

  const [patientId, setPatientId] = useState<string | undefined>(patientParam);
  const [items, setItems] = useState<Item[]>([]);
  const [removed, setRemoved] = useState<Media[]>([]);
  const [findings, setFindings] = useState("");
  const [notes, setNotes] = useState("");
  const [examDate, setExamDate] = useState(todayISO());
  const [reportDate, setReportDate] = useState(todayISO());
  const [clinicChoice, setClinicChoice] = useState("primary");
  const [loaded, setLoaded] = useState(!edit);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);
  const [newPatient, setNewPatient] = useState(false);
  const [view, setView] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pending = captureStore.take();
    if (pending.length) setItems((it) => [...it, ...pending.map((p) => ({ key: p.id, kind: "new" as const, blob: p.blob, url: p.url, source: p.source, capturedAt: p.capturedAt }))]);
  }, []);

  useEffect(() => {
    if (!edit) return;
    (async () => {
      const { data: r, error } = await supabase.from("reports").select("*").eq("id", edit).single();
      if (error) { toast.error("Report not found"); return; }
      const { data: m } = await supabase.from("clinical_media").select("*").eq("report_id", edit).order("sort_order");
      setPatientId(r.patient_id);
      setFindings(r.diagnosis_findings);
      setNotes(r.additional_notes);
      setExamDate(r.examination_date ?? "");
      setReportDate(r.report_date);
      setClinicChoice(r.clinic_location_id ?? "primary");
      setItems((it) => [...(m ?? []).map((x) => ({ key: x.id, kind: "existing" as const, media: x })), ...it]);
      setLoaded(true);
    })();
  }, [edit]);

  const patient = patients.find((p) => p.id === patientId);

  function addFiles(files: FileList | null, source: string) {
    if (!files) return;
    const add: Item[] = [];
    for (const f of Array.from(files)) {
      const err = validateImage(f);
      if (err) { toast.error(`${f.name}: ${err}`); continue; }
      add.push({ key: crypto.randomUUID(), kind: "new", blob: f, url: URL.createObjectURL(f), source, capturedAt: new Date(f.lastModified || Date.now()).toISOString() });
    }
    setItems((it) => [...it, ...add]);
  }
  const move = (i: number, d: number) => setItems((it) => {
    const n = [...it];
    const j = i + d;
    if (j < 0 || j >= n.length) return it;
    [n[i], n[j]] = [n[j]!, n[i]!];
    return n;
  });
  const makeCover = (i: number) => setItems((it) => [it[i]!, ...it.filter((_, k) => k !== i)]);
  const remove = (i: number) => setItems((it) => {
    const x = it[i]!;
    if (x.kind === "existing") setRemoved((r) => [...r, x.media]);
    return it.filter((_, k) => k !== i);
  });

  async function save() {
    if (!patient) { toast.error("Select a patient first"); return; }
    if (!items.length && !findings.trim() && !notes.trim()) { toast.error("Add at least one photograph or some findings"); return; }
    setSaving(true);
    try {
      const uid = await requireUid();
      const primary = clinics[0];
      const fields = {
        patient_id: patient.id,
        clinic_id: primary?.id ?? null,
        clinic_location_id: clinicChoice === "primary" ? null : clinicChoice,
        report_date: reportDate || todayISO(),
        examination_date: examDate || null,
        diagnosis_findings: findings,
        additional_notes: notes,
      };
      let reportId = edit;
      if (edit) {
        const { error } = await supabase.from("reports").update({ ...fields, pdf_url: null }).eq("id", edit);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("reports").insert({ ...fields, doctor_id: uid, report_number: makeReportNumber() }).select("id").single();
        if (error) throw error;
        reportId = data.id;
      }
      if (removed.length) {
        await removeFiles(removed.map((m) => m.file_url));
        await supabase.from("clinical_media").delete().in("id", removed.map((m) => m.id));
      }
      for (let i = 0; i < items.length; i++) {
        const it = items[i]!;
        if (it.kind === "existing") {
          await supabase.from("clinical_media").update({ sort_order: i }).eq("id", it.media.id);
        } else {
          const type = it.blob.type || "image/jpeg";
          const path = await uploadFile(it.blob, `media/${patient.id}`, extFor(type));
          const { error } = await supabase.from("clinical_media").insert({
            doctor_id: uid, patient_id: patient.id, report_id: reportId!, file_url: path, file_type: type,
            file_name: `image-${i + 1}.${extFor(type)}`, capture_source: it.source, captured_at: it.capturedAt, sort_order: i,
          });
          if (error) throw error;
        }
      }
      await Promise.all([qc.invalidateQueries({ queryKey: qk.reports }), qc.invalidateQueries({ queryKey: qk.media })]);
      toast.success("Report saved");
      navigate({ to: "/reports/$id", params: { id: reportId! } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-28 md:pb-0">
      <h1 className="text-2xl font-semibold md:text-3xl">{edit ? "Edit Report" : "New Report"}</h1>

      <Card step="1" title="Patient">
        {patient ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">{patient.name}</div>
              <div className="text-sm text-muted-foreground">{patient.age} yrs · {patient.gender}{patient.phone ? ` · ${patient.phone}` : ""}{patient.patient_id ? ` · ID ${patient.patient_id}` : ""}</div>
            </div>
            {!edit && <Button variant="outline" onClick={() => setPicker(true)}>Change</Button>}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="h-12" onClick={() => setPicker(true)}><Search className="h-4 w-4" /> Select patient</Button>
            <Button variant="outline" className="h-12" onClick={() => setNewPatient(true)}><UserPlus className="h-4 w-4" /> Create new patient</Button>
          </div>
        )}
      </Card>

      <Card step="2" title="Clinical Photographs">
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="h-14 flex-col gap-1 text-xs" onClick={() => camRef.current?.click()}><Camera className="h-5 w-5" /> Capture Photo</Button>
          <Button variant="outline" className="h-14 flex-col gap-1 text-xs" onClick={() => fileRef.current?.click()}><ImagePlus className="h-5 w-5" /> Select from Phone</Button>
          <Button asChild variant="outline" className="h-14 flex-col gap-1 text-xs"><Link to="/scan" search={{ patient: patientId }}><ScanLine className="h-5 w-5" /> Scan / Device</Link></Button>
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files, "camera"); e.target.value = ""; }} />
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { addFiles(e.target.files, "import"); e.target.value = ""; }} />
        {items.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((it, i) => (
              <div key={it.key} className="overflow-hidden rounded-xl border bg-card">
                <button className="relative block w-full" onClick={() => setView(i)}>
                  {it.kind === "new" ? <img src={it.url} alt={`Image ${i + 1}`} className="aspect-square w-full object-cover" /> : <SignedImage path={it.media.file_url} className="aspect-square w-full" />}
                  <span className="absolute left-2 top-2 rounded-md bg-card/90 px-1.5 py-0.5 text-xs font-semibold">{i === 0 ? "Cover" : `#${i + 1}`}</span>
                  <Maximize2 className="absolute right-2 top-2 h-4 w-4 text-primary-foreground drop-shadow" />
                </button>
                <div className="flex items-center justify-between p-1">
                  <div className="flex">
                    <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></IconBtn>
                    <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === items.length - 1}><ArrowDown className="h-4 w-4" /></IconBtn>
                    <IconBtn label="Set as cover" onClick={() => makeCover(i)} disabled={i === 0}><Star className="h-4 w-4" /></IconBtn>
                  </div>
                  <IconBtn label="Remove" onClick={() => remove(i)}><X className="h-4 w-4 text-destructive" /></IconBtn>
                </div>
                <div className="px-2 pb-2 text-[11px] text-muted-foreground">{fmtDate(it.kind === "new" ? it.capturedAt : it.media.captured_at)} · {it.kind === "new" ? it.source : it.media.capture_source}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card step="3" title="Diagnosis / Findings">
        <Textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={7} placeholder="Enter diagnosis, findings, observations, or clinical interpretation…" className="text-base" />
        <Label className="mt-4 block">Additional Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Advice, follow-up, prescriptions…" className="mt-1.5 text-base" />
      </Card>

      <Card step="4" title="Details">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5"><Label>Examination date</Label><Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="h-11" /></div>
          <div className="grid gap-1.5"><Label>Report date</Label><Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="h-11" /></div>
          <div className="grid gap-1.5">
            <Label>Clinic</Label>
            <Select value={clinicChoice} onValueChange={setClinicChoice}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">{clinics[0]?.clinic_name || "Main clinic"}</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.location_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-card p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <Button className="h-12 w-full text-base md:w-auto md:px-8" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save & Generate PDF"}</Button>
      </div>

      <PatientPicker open={picker} onOpenChange={setPicker} patients={patients} onPick={(p) => { setPatientId(p.id); setPicker(false); }} onNew={() => { setPicker(false); setNewPatient(true); }} />
      <PatientForm open={newPatient} onOpenChange={setNewPatient} onSaved={(p) => setPatientId(p.id)} />
      <Viewer
        items={items.map((it) => ({ id: it.key, src: it.kind === "new" ? it.url : undefined, path: it.kind === "existing" ? it.media.file_url : undefined, title: patient?.name ?? "" }))}
        index={view} onIndex={setView} onClose={() => setView(null)}
      />
    </div>
  );
}

function Card({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">{step}</span>{title}
      </h2>
      {children}
    </section>
  );
}
function IconBtn({ label, children, ...p }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button aria-label={label} title={label} className="rounded-md p-2 hover:bg-muted disabled:opacity-30" {...p}>{children}</button>;
}

function PatientPicker({ open, onOpenChange, patients, onPick, onNew }: { open: boolean; onOpenChange: (o: boolean) => void; patients: Patient[]; onPick: (p: Patient) => void; onNew: () => void }) {
  const [q, setQ] = useState("");
  const t = q.toLowerCase();
  const list = patients.filter((p) => !t || p.name.toLowerCase().includes(t) || (p.phone ?? "").includes(t) || (p.patient_id ?? "").toLowerCase().includes(t));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] sm:max-w-md">
        <DialogHeader><DialogTitle>Select patient</DialogTitle></DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or ID" className="h-11" autoFocus />
        <div className="max-h-[50dvh] divide-y overflow-y-auto rounded-lg border">
          {list.map((p) => (
            <button key={p.id} onClick={() => onPick(p)} className="block w-full p-3 text-left hover:bg-muted">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.age} yrs · {p.gender}{p.phone ? ` · ${p.phone}` : ""}</div>
            </button>
          ))}
          {list.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No patients found</div>}
        </div>
        <Button variant="outline" className="h-11" onClick={onNew}><UserPlus className="h-4 w-4" /> Create new patient</Button>
      </DialogContent>
    </Dialog>
  );
}
