import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk, requireUid, usePatients, type Patient } from "@/lib/data";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GENDERS = ["Male", "Female", "Other"];

export function PatientForm({ open, onOpenChange, patient, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patient?: Patient | null;
  onSaved?: (p: Patient) => void;
}) {
  const qc = useQueryClient();
  const { data: all = [] } = usePatients();
  const [f, setF] = useState({ name: "", age: "", gender: "", phone: "", patient_id: "", date_of_birth: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dupWarned, setDupWarned] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setDupWarned(false);
    setF({
      name: patient?.name ?? "",
      age: patient ? String(patient.age) : "",
      gender: patient?.gender ?? "",
      phone: patient?.phone ?? "",
      patient_id: patient?.patient_id ?? "",
      date_of_birth: patient?.date_of_birth ?? "",
    });
  }, [open, patient]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Patient name is required";
    const age = Number(f.age);
    if (f.age === "" || !Number.isInteger(age) || age < 0 || age > 150) e.age = "Enter a valid age (0–150)";
    if (!f.gender) e.gender = "Select gender";
    if (f.phone && !/^\+?[\d\s-]{7,16}$/.test(f.phone.trim())) e.phone = "Enter a valid phone number";
    setErrors(e);
    if (Object.keys(e).length) return;

    if (!patient && !dupWarned) {
      const dup = all.find(
        (p) =>
          (f.patient_id && p.patient_id === f.patient_id.trim()) ||
          (p.name.toLowerCase() === f.name.trim().toLowerCase() && (!f.phone || p.phone === f.phone.trim())),
      );
      if (dup) {
        setDupWarned(true);
        toast.warning(`A patient named "${dup.name}" already exists. Press Save again to create anyway.`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        name: f.name.trim(),
        age,
        gender: f.gender,
        phone: f.phone.trim() || null,
        patient_id: f.patient_id.trim() || null,
        date_of_birth: f.date_of_birth || null,
      };
      const res = patient
        ? await supabase.from("patients").update(payload).eq("id", patient.id).select("*").single()
        : await supabase.from("patients").insert({ ...payload, doctor_id: await requireUid() }).select("*").single();
      if (res.error) throw res.error;
      await qc.invalidateQueries({ queryKey: qk.patients });
      toast.success(patient ? "Patient updated" : "Patient saved");
      onOpenChange(false);
      onSaved?.(res.data);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{patient ? "Edit patient" : "New patient"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Patient Name *" error={errors.name}>
            <Input value={f.name} onChange={set("name")} placeholder="Full name" className="h-11" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age *" error={errors.age}>
              <Input value={f.age} onChange={set("age")} inputMode="numeric" placeholder="Years" className="h-11" />
            </Field>
            <Field label="Phone Number" error={errors.phone}>
              <Input value={f.phone} onChange={set("phone")} inputMode="tel" placeholder="+91…" className="h-11" />
            </Field>
          </div>
          <Field label="Gender *" error={errors.gender}>
            <div className="grid grid-cols-3 gap-2">
              {GENDERS.map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setF({ ...f, gender: g })}
                  className={cn("h-11 rounded-lg border text-sm font-medium transition-colors", f.gender === g ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted")}
                >
                  {g}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Patient ID (optional)">
              <Input value={f.patient_id} onChange={set("patient_id")} placeholder="e.g. OPD-1024" className="h-11" />
            </Field>
            <Field label="Date of Birth (optional)">
              <Input type="date" value={f.date_of_birth} onChange={set("date_of_birth")} className="h-11" />
            </Field>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11">Cancel</Button>
          <Button onClick={save} disabled={saving} className="h-11">{saving ? "Saving…" : "Save Patient"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
