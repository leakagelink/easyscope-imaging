import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FilePlus2, FileText, Images, ScanLine, Settings, UserPlus, Users } from "lucide-react";
import { fmtDate, useClinics, useDoctor, useMedia, usePatients, useReports } from "@/lib/data";
import { Logo } from "@/components/logo";
import { EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — EasyScope" },
      { name: "description", content: "Overview of patients, reports and clinical images." },
      { property: "og:title", content: "Dashboard — EasyScope" },
      { property: "og:description", content: "Your clinic at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: patients = [] } = usePatients();
  const { data: reports = [] } = useReports();
  const { data: media = [] } = useMedia();
  const { data: doctor } = useDoctor();
  const { data: clinics } = useClinics();
  const clinic = clinics?.[0];

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const thisMonth = reports.filter((r) => new Date(r.report_date) >= monthStart).length;
  const stats = useMemo(() => {
    const m = new Map<string, { reports: number; images: number; last?: string }>();
    for (const r of reports) {
      const s = m.get(r.patient_id) ?? { reports: 0, images: 0 };
      s.reports++;
      if (!s.last || r.report_date > s.last) s.last = r.report_date;
      m.set(r.patient_id, s);
    }
    for (const x of media) {
      const s = m.get(x.patient_id) ?? { reports: 0, images: 0 };
      s.images++;
      m.set(x.patient_id, s);
    }
    return m;
  }, [reports, media]);

  const initial = (doctor?.doctor_name || "D").replace(/^dr\.?\s*/i, "").charAt(0).toUpperCase();

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div className="md:hidden"><Logo /></div>
        <div className="hidden md:block">
          <p className="text-sm text-muted-foreground">{clinic?.clinic_name || "Set up your clinic in Settings"}</p>
          <h1 className="text-3xl font-semibold">Welcome{doctor?.doctor_name ? `, ${doctor.doctor_name}` : ""}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Settings"><Link to="/settings"><Settings className="h-5 w-5" /></Link></Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground">{initial}</div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total Patients", patients.length],
          ["Total Reports", reports.length],
          ["Reports This Month", thisMonth],
          ["Photos Stored", media.length],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="text-xs font-medium text-muted-foreground">{l}</div>
            <div className="mt-2 font-display text-3xl font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { to: "/patients", label: "New Patient", icon: UserPlus, search: { new: true } },
          { to: "/reports/new", label: "New Report", icon: FilePlus2 },
          { to: "/scan", label: "Scan / Connect Device", icon: ScanLine },
          { to: "/gallery", label: "Gallery", icon: Images },
        ].map((a, i) => (
          <Link
            key={a.label}
            to={a.to}
            search={a.search as never}
            className={`flex h-20 items-center gap-3 rounded-2xl border px-4 font-semibold transition-colors ${i < 2 ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "bg-card hover:bg-muted"}`}
          >
            <a.icon className="h-6 w-6 shrink-0" /> <span className="text-sm leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Patients</h2>
            <Link to="/patients" className="text-sm font-medium text-primary">View all</Link>
          </div>
          {patients.length === 0 ? (
            <EmptyState icon={Users} title="No patients yet" text="Add your first patient to start capturing and reporting." action={<Button asChild><Link to="/patients" search={{ new: true }}>Add Patient</Link></Button>} />
          ) : (
            <div className="divide-y rounded-2xl border bg-card shadow-card">
              {patients.slice(0, 5).map((p) => {
                const s = stats.get(p.id);
                return (
                  <Link key={p.id} to="/patients/$id" params={{ id: p.id }} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.age} yrs · {p.gender}{p.phone ? ` · ${p.phone}` : ""}</div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <div>{s?.reports ?? 0} reports · {s?.images ?? 0} images</div>
                      <div>Last: {fmtDate(s?.last)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Reports</h2>
            <Link to="/reports" className="text-sm font-medium text-primary">View all</Link>
          </div>
          {reports.length === 0 ? (
            <EmptyState icon={FileText} title="No reports yet" text="Create a report with clinical photographs and findings." action={<Button asChild><Link to="/reports/new">Create Report</Link></Button>} />
          ) : (
            <div className="divide-y rounded-2xl border bg-card shadow-card">
              {reports.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{r.patients?.name}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(r.report_date)} · {doctor?.doctor_name || "Doctor"} · {r.pdf_url ? "PDF saved" : "Draft"}</div>
                  </div>
                  <Button asChild size="sm" variant="outline"><Link to="/reports/$id" params={{ id: r.id }}>View / Share</Link></Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
