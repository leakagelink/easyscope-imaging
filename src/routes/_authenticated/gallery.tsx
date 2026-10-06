import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Images, Search } from "lucide-react";
import { deleteMedia, fmtDate, qk, useMedia, usePatients, useReports } from "@/lib/data";
import { SignedImage, Viewer } from "@/components/media";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/gallery")({
  head: () => ({
    meta: [
      { title: "Clinical Gallery — EasyScope" },
      { name: "description", content: "All clinical photographs across patients." },
      { property: "og:title", content: "Clinical Gallery — EasyScope" },
      { property: "og:description", content: "Browse clinical photographs." },
    ],
  }),
  component: Gallery,
});

function Gallery() {
  const qc = useQueryClient();
  const { data: media = [], isLoading } = useMedia();
  const { data: patients = [] } = usePatients();
  const { data: reports = [] } = useReports();
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "recent">("all");
  const [pid, setPid] = useState("all");
  const [date, setDate] = useState("");
  const [view, setView] = useState<number | null>(null);

  const pName = (id: string) => patients.find((p) => p.id === id)?.name ?? "";
  const rNo = (id: string | null) => reports.find((r) => r.id === id)?.report_number ?? "";

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return media.filter((m) => {
      if (t && !pName(m.patient_id).toLowerCase().includes(t) && !rNo(m.report_id).toLowerCase().includes(t)) return false;
      if (f === "recent" && Date.now() - new Date(m.captured_at).getTime() > 7 * 864e5) return false;
      if (pid !== "all" && m.patient_id !== pid) return false;
      if (date && !m.captured_at.startsWith(date)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media, q, f, pid, date, patients, reports]);

  return (
    <div>
      <PageHeader title="Gallery" subtitle={`${media.length} clinical photographs`} />
      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient name or report ID" className="h-11 pl-9" />
        </div>
        <div className="flex gap-2">
          {(["all", "recent"] as const).map((k) => (
            <button key={k} onClick={() => setF(k)} className={cn("h-11 rounded-lg border px-4 text-sm font-medium", f === k ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground")}>{k === "all" ? "All" : "Recent"}</button>
          ))}
          <Select value={pid} onValueChange={setPid}>
            <SelectTrigger className="h-11 w-40"><SelectValue placeholder="Patient" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All patients</SelectItem>
              {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-auto" aria-label="Date" />
        </div>
      </div>
      {!isLoading && list.length === 0 ? (
        <EmptyState icon={Images} title={media.length ? "No matching images" : "No clinical photographs yet"} text="Photographs added to reports appear here." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {list.map((m, i) => (
            <button key={m.id} onClick={() => setView(i)} className="overflow-hidden rounded-xl border bg-card text-left">
              <SignedImage path={m.file_url} className="aspect-square w-full" />
              <div className="p-2">
                <div className="truncate text-xs font-semibold">{pName(m.patient_id)}</div>
                <div className="text-[11px] text-muted-foreground">{fmtDate(m.captured_at)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      <Viewer
        items={list.map((m) => ({ id: m.id, path: m.file_url, title: pName(m.patient_id), subtitle: `${new Date(m.captured_at).toLocaleString()}${m.report_id ? ` · ${rNo(m.report_id)}` : ""}`, patientId: m.patient_id, reportId: m.report_id }))}
        index={view} onIndex={setView} onClose={() => setView(null)}
        onDelete={async (it) => {
          await deleteMedia(media.find((m) => m.id === it.id)!);
          await qc.invalidateQueries({ queryKey: qk.media });
          setView(null);
          toast.success("Image deleted");
        }}
      />
    </div>
  );
}
