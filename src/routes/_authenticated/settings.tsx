import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extFor, qk, removeFiles, requireUid, uploadFile, useClinics, useDoctor, useLocations, validateImage, type ClinicLocation } from "@/lib/data";
import { SignedImage } from "@/components/media";
import { Confirm } from "@/components/confirm";
import { PageHeader, useSignOut } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — EasyScope" },
      { name: "description", content: "Doctor profile, signature, stamps and clinic details." },
      { property: "og:title", content: "Settings — EasyScope" },
      { property: "og:description", content: "Configure your reports." },
    ],
  }),
  component: SettingsPage,
});

type Doc = { doctor_name: string; qualification: string; registration_number: string; signature_url: string | null; stamp_url: string | null; clinic_stamp_url: string | null; show_signature: boolean; show_stamp: boolean; show_clinic_stamp: boolean; show_disclaimer: boolean; disclaimer_text: string };
type Cl = { clinic_name: string; logo_url: string | null; address: string; phone: string; email: string; website: string };

function SettingsPage() {
  const qc = useQueryClient();
  const signOut = useSignOut();
  const { data: doctor } = useDoctor();
  const { data: clinics } = useClinics();
  const { data: locations = [] } = useLocations();
  const clinic = clinics?.[0];
  const [d, setD] = useState<Doc | null>(null);
  const [c, setC] = useState<Cl | null>(null);
  const [saving, setSaving] = useState(false);
  const [loc, setLoc] = useState<ClinicLocation | "new" | null>(null);

  useEffect(() => { if (doctor && !d) setD({ ...doctor }); }, [doctor, d]);
  useEffect(() => { if (clinic && !c) setC({ ...clinic }); }, [clinic, c]);
  if (!d || !c || !doctor || !clinic) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

  async function save() {
    setSaving(true);
    try {
      const r1 = await supabase.from("doctors").update(d!).eq("id", doctor!.id);
      if (r1.error) throw r1.error;
      const r2 = await supabase.from("clinics").update(c!).eq("id", clinic!.id);
      if (r2.error) throw r2.error;
      await Promise.all([qc.invalidateQueries({ queryKey: qk.doctor }), qc.invalidateQueries({ queryKey: qk.clinics })]);
      toast.success("Settings saved successfully.");
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }

  const tf = <T extends Record<string, unknown>>(obj: T, set: (v: T) => void, k: keyof T, label: string, ph?: string) => (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input value={(obj[k] as string) ?? ""} onChange={(e) => set({ ...obj, [k]: e.target.value })} placeholder={ph} className="h-11" />
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <PageHeader title="Settings" subtitle="These details appear on every generated report." />

      <Section title="Doctor Profile">
        <div className="grid gap-3 sm:grid-cols-2">
          {tf(d, setD, "doctor_name", "Doctor Name", "Dr. Full Name")}
          {tf(d, setD, "qualification", "Qualification", "MBBS, MS (ENT)")}
          {tf(d, setD, "registration_number", "Medical Registration Number")}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <ImageSlot label="Doctor Signature" path={d.signature_url} onChange={(p) => setD({ ...d, signature_url: p })} />
          <ImageSlot label="Doctor Stamp" path={d.stamp_url} onChange={(p) => setD({ ...d, stamp_url: p })} />
          <ImageSlot label="Clinic / Practice Stamp" path={d.clinic_stamp_url} onChange={(p) => setD({ ...d, clinic_stamp_url: p })} />
        </div>
        <div className="mt-5 divide-y rounded-xl border">
          {([["show_signature", "Show doctor signature on every report"], ["show_stamp", "Show doctor stamp on every report"], ["show_clinic_stamp", "Show clinic/practice stamp on every report"], ["show_disclaimer", "Show disclaimer footer"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center justify-between gap-3 p-3 text-sm font-medium">
              {l}<Switch checked={d[k]} onCheckedChange={(v) => setD({ ...d, [k]: v })} />
            </label>
          ))}
        </div>
        {d.show_disclaimer && <Textarea className="mt-3" rows={2} value={d.disclaimer_text} onChange={(e) => setD({ ...d, disclaimer_text: e.target.value })} />}
      </Section>

      <Section title="Main Clinic">
        <div className="grid gap-3 sm:grid-cols-2">
          {tf(c, setC, "clinic_name", "Clinic Name")}
          {tf(c, setC, "phone", "Phone Number")}
          {tf(c, setC, "email", "Email")}
          {tf(c, setC, "website", "Website")}
        </div>
        <div className="mt-3">{tf(c, setC, "address", "Main Clinic Address")}</div>
        <div className="mt-4 max-w-[220px]"><ImageSlot label="Clinic Logo" path={c.logo_url} onChange={(p) => setC({ ...c, logo_url: p })} /></div>
      </Section>

      <Section title="Additional Clinic Locations" action={<Button variant="outline" onClick={() => setLoc("new")}><Plus className="h-4 w-4" /> Add Clinic</Button>}>
        {locations.length === 0 ? <p className="text-sm text-muted-foreground">No additional locations.</p> : (
          <div className="divide-y rounded-xl border">
            {locations.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 p-3">
                <div><div className="font-medium">{l.location_name}</div><div className="text-xs text-muted-foreground">{[l.address, l.phone].filter(Boolean).join(" · ")}</div></div>
                <div className="flex">
                  <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setLoc(l)}><Pencil className="h-4 w-4" /></Button>
                  <Confirm trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>} title="Delete clinic location?" text={`Remove "${l.location_name}"?`}
                    onConfirm={async () => { await supabase.from("clinic_locations").delete().eq("id", l.id); qc.invalidateQueries({ queryKey: qk.locations }); }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Button variant="outline" className="h-11" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-card p-3 md:bottom-0 md:left-auto md:right-0 md:w-auto md:border-0 md:bg-transparent md:p-6">
        <Button className="h-12 w-full px-8 text-base" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Settings"}</Button>
      </div>

      <LocationDialog value={loc} clinicId={clinic.id} onClose={() => setLoc(null)} />
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

function ImageSlot({ label, path, onChange }: { label: string; path: string | null; onChange: (p: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(f?: File) {
    if (!f) return;
    const err = validateImage(f);
    if (err) return toast.error(err);
    setBusy(true);
    try { onChange(await uploadFile(f, "branding", extFor(f.type))); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/40">
        {path ? <SignedImage path={path} className="h-full w-full !object-contain p-2" alt={label} /> : <span className="text-xs text-muted-foreground">PNG with transparent background</span>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => ref.current?.click()}><Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : path ? "Replace" : "Upload"}</Button>
        {path && <Confirm trigger={<Button size="sm" variant="ghost" className="text-destructive">Remove</Button>} title={`Remove ${label.toLowerCase()}?`} text="It will no longer appear on reports after you save settings." action="Remove"
          onConfirm={() => { removeFiles([path]); onChange(null); }} />}
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

function LocationDialog({ value, clinicId, onClose }: { value: ClinicLocation | "new" | null; clinicId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ location_name: "", address: "", phone: "" });
  useEffect(() => {
    if (value) setF(value === "new" ? { location_name: "", address: "", phone: "" } : { location_name: value.location_name, address: value.address, phone: value.phone });
  }, [value]);
  async function save() {
    if (!f.location_name.trim()) return toast.error("Clinic name is required");
    const r = value === "new"
      ? await supabase.from("clinic_locations").insert({ ...f, clinic_id: clinicId, doctor_id: await requireUid() })
      : await supabase.from("clinic_locations").update(f).eq("id", (value as ClinicLocation).id);
    if (r.error) return toast.error(r.error.message);
    await qc.invalidateQueries({ queryKey: qk.locations });
    onClose();
  }
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{value === "new" ? "Add clinic" : "Edit clinic"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Clinic Name</Label><Input className="h-11" value={f.location_name} onChange={(e) => setF({ ...f, location_name: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Address</Label><Input className="h-11" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Phone</Label><Input className="h-11" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        </div>
        <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
