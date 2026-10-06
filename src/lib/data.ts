import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Patient = Tables<"patients">;
export type Report = Tables<"reports">;
export type Media = Tables<"clinical_media">;
export type Doctor = Tables<"doctors">;
export type Clinic = Tables<"clinics">;
export type ClinicLocation = Tables<"clinic_locations">;
export type ReportWithPatient = Report & {
  patients: Pick<Patient, "name" | "age" | "gender" | "patient_id" | "phone"> | null;
};

export const BUCKET = "clinical";
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const qk = {
  patients: ["patients"] as const,
  reports: ["reports"] as const,
  media: ["media"] as const,
  doctor: ["doctor"] as const,
  clinics: ["clinics"] as const,
  locations: ["locations"] as const,
};

export async function requireUid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Please sign in again.");
  return id;
}

export function validateImage(file: File | Blob): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Only JPG, PNG or WebP images are allowed.";
  if (file.size > MAX_FILE_BYTES) return "Image is larger than 15 MB.";
  return null;
}

export async function fetchPatients() {
  const { data, error } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function fetchReports() {
  const { data, error } = await supabase
    .from("reports")
    .select("*, patients(name, age, gender, patient_id, phone)")
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ReportWithPatient[];
}
export async function fetchMedia() {
  const { data, error } = await supabase.from("clinical_media").select("*").order("captured_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function fetchDoctor(): Promise<Doctor> {
  const uid = await requireUid();
  const { data, error } = await supabase.from("doctors").select("*").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const ins = await supabase.from("doctors").insert({ user_id: uid }).select("*").single();
  if (ins.error) throw ins.error;
  return ins.data;
}
export async function fetchClinics(): Promise<Clinic[]> {
  const uid = await requireUid();
  const { data, error } = await supabase.from("clinics").select("*").order("is_primary", { ascending: false });
  if (error) throw error;
  if (data.length) return data;
  const ins = await supabase.from("clinics").insert({ doctor_id: uid, is_primary: true }).select("*").single();
  if (ins.error) throw ins.error;
  return [ins.data];
}
export async function fetchLocations() {
  const { data, error } = await supabase.from("clinic_locations").select("*").order("created_at");
  if (error) throw error;
  return data;
}

export const usePatients = () => useQuery({ queryKey: qk.patients, queryFn: fetchPatients });
export const useReports = () => useQuery({ queryKey: qk.reports, queryFn: fetchReports });
export const useMedia = () => useQuery({ queryKey: qk.media, queryFn: fetchMedia });
export const useDoctor = () => useQuery({ queryKey: qk.doctor, queryFn: fetchDoctor });
export const useClinics = () => useQuery({ queryKey: qk.clinics, queryFn: fetchClinics });
export const useLocations = () => useQuery({ queryKey: qk.locations, queryFn: fetchLocations });

export async function uploadFile(file: Blob, folder: string, ext: string, fixedName?: string) {
  const uid = await requireUid();
  const path = `${uid}/${folder}/${fixedName ?? crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: !!fixedName,
  });
  if (error) throw error;
  return path;
}

export function extFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "application/pdf") return "pdf";
  return "jpg";
}

export async function removeFiles(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from(BUCKET).remove(list);
}

export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed", path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export async function downloadBlob(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return data;
}

export function makeReportNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ES-${ymd}-${rnd}`;
}

export async function deletePatientCascade(p: Patient) {
  const [{ data: media }, { data: reps }] = await Promise.all([
    supabase.from("clinical_media").select("file_url").eq("patient_id", p.id),
    supabase.from("reports").select("pdf_url").eq("patient_id", p.id),
  ]);
  await removeFiles([...(media ?? []).map((m) => m.file_url), ...(reps ?? []).map((r) => r.pdf_url)]);
  const { error } = await supabase.from("patients").delete().eq("id", p.id);
  if (error) throw error;
}

export async function deleteReportCascade(r: Pick<Report, "id" | "pdf_url">) {
  const { data: media } = await supabase.from("clinical_media").select("id,file_url").eq("report_id", r.id);
  await removeFiles([...(media ?? []).map((m) => m.file_url), r.pdf_url]);
  if (media?.length) await supabase.from("clinical_media").delete().in("id", media.map((m) => m.id));
  const { error } = await supabase.from("reports").delete().eq("id", r.id);
  if (error) throw error;
}

export async function deleteMedia(m: Media) {
  await removeFiles([m.file_url]);
  const { error } = await supabase.from("clinical_media").delete().eq("id", m.id);
  if (error) throw error;
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const date = d.length === 10 ? new Date(d + "T00:00:00") : new Date(d);
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
