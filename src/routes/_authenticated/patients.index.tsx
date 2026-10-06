import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Users } from "lucide-react";
import { fmtDate, useMedia, usePatients, useReports } from "@/lib/data";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { PatientForm } from "@/components/patient-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/patients/")({
  validateSearch: (s: Record<string, unknown>): { new?: boolean } => (s["new"] ? { new: true } : {}),
  head: () => ({
    meta: [
      { title: "Patients — EasyScope" },
      { name: "description", content: "Search and manage your patients." },
      { property: "og:title", content: "Patients — EasyScope" },
      { property: "og:description", content: "Patient records with reports and clinical images." },
    ],
  }),
  component: PatientsPage,
});

function PatientsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: patients = [], isLoading } = usePatients();
  const { data: reports = [] } = useReports();
  const { data: media = [] } = useMedia();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "recent" | "reports">("all");
  const [open, setOpen] = useState(!!search.new);

  const rows = useMemo(() => {
    const st = new Map<string, { r: number; i: number; last?: string }>();
    reports.forEach((r) => {
      const s = st.get(r.patient_id) ?? { r: 0, i: 0 };
      s.r++;
      if (!s.last || r.report_date > s.last) s.last = r.report_date;
      st.set(r.patient_id, s);
    });
    media.forEach((m) => {
      const s = st.get(m.patient_id) ?? { r: 0, i: 0 };
      s.i++;
      st.set(m.patient_id, s);
    });
    const term = q.trim().toLowerCase();
    let list = patients
      .filter((p) => !term || p.name.toLowerCase().includes(term) || (p.phone ?? "").includes(term) || (p.patient_id ?? "").toLowerCase().includes(term))
      .map((p) => ({ p, s: st.get(p.id) }));
    if (filter === "recent") list = list.filter(({ p }) => Date.now() - new Date(p.created_at).getTime() < 7 * 864e5);
    if (filter === "reports") list = list.filter(({ s }) => s?.last).sort((a, b) => (b.s!.last! > a.s!.last! ? 1 : -1));
    return list;
  }, [patients, reports, media, q, filter]);

  return (
    <div>
      <PageHeader title="Patients" subtitle={`${patients.length} patients`} actions={<Button className="h-11" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Patient</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or patient ID" className="h-11 pl-9" />
        </div>
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {([["all", "All"], ["recent", "Recently Added"], ["reports", "Recent Reports"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={cn("rounded-md px-3 py-2 text-sm font-medium", filter === k ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>{l}</button>
          ))}
        </div>
      </div>
      {!isLoading && rows.length === 0 ? (
        <EmptyState icon={Users} title={patients.length ? "No matching patients" : "No patients yet"} text={patients.length ? "Try a different search." : "Add your first patient to get started."} action={<Button onClick={() => setOpen(true)}>New Patient</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ p, s }) => (
            <Link key={p.id} to="/patients/$id" params={{ id: p.id }} className="rounded-2xl border bg-card p-4 shadow-card transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-sm text-muted-foreground">{p.age} yrs · {p.gender}{p.phone ? ` · ${p.phone}` : ""}</div>
                </div>
                {p.patient_id && <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{p.patient_id}</span>}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>{s?.r ?? 0} reports</span><span>{s?.i ?? 0} images</span><span>Last: {fmtDate(s?.last)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <PatientForm open={open} onOpenChange={setOpen} onSaved={(p) => navigate({ to: "/patients/$id", params: { id: p.id } })} />
    </div>
  );
}
