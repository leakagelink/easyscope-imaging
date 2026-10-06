import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { downloadBlob, fmtDate, type Clinic, type ClinicLocation, type Doctor, type Media, type Patient, type Report } from "./data";

type Img = { data: string; w: number; h: number; fmt: "JPEG" | "PNG" };

async function blobToImg(blob: Blob, fmt: "JPEG" | "PNG", max = 1600): Promise<Img> {
  const url = URL.createObjectURL(blob);
  try {
    const el = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(el.naturalWidth, el.naturalHeight));
    const w = Math.round(el.naturalWidth * scale);
    const h = Math.round(el.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    if (fmt === "JPEG") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(el, 0, 0, w, h);
    return { data: c.toDataURL(fmt === "JPEG" ? "image/jpeg" : "image/png", 0.9), w, h, fmt };
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function loadImg(path: string | null | undefined, fmt: "JPEG" | "PNG", max?: number) {
  if (!path) return null;
  try {
    return await blobToImg(await downloadBlob(path), fmt, max);
  } catch {
    return null;
  }
}

export type ReportBundle = {
  report: Report;
  patient: Patient;
  media: Media[];
  doctor: Doctor;
  clinic: Clinic | null;
  location: ClinicLocation | null;
};

export async function loadReportBundle(reportId: string): Promise<ReportBundle> {
  const { data: report, error } = await supabase.from("reports").select("*").eq("id", reportId).single();
  if (error) throw error;
  const uid = report.doctor_id;
  const [p, m, d, c, l] = await Promise.all([
    supabase.from("patients").select("*").eq("id", report.patient_id).single(),
    supabase.from("clinical_media").select("*").eq("report_id", reportId).order("sort_order"),
    supabase.from("doctors").select("*").eq("user_id", uid).maybeSingle(),
    report.clinic_id
      ? supabase.from("clinics").select("*").eq("id", report.clinic_id).maybeSingle()
      : supabase.from("clinics").select("*").eq("is_primary", true).limit(1).maybeSingle(),
    report.clinic_location_id
      ? supabase.from("clinic_locations").select("*").eq("id", report.clinic_location_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (p.error) throw p.error;
  return {
    report,
    patient: p.data,
    media: m.data ?? [],
    doctor: (d.data as Doctor) ?? ({ doctor_name: "", qualification: "", registration_number: "" } as Doctor),
    clinic: (c.data as Clinic | null) ?? null,
    location: (l.data as ClinicLocation | null) ?? null,
  };
}

export async function buildReportPdf(b: ReportBundle): Promise<Blob> {
  const { report, patient, media, doctor, clinic, location } = b;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 16, CW = W - M * 2;
  const ink: [number, number, number] = [28, 39, 56];
  const soft: [number, number, number] = [100, 112, 130];
  const accent: [number, number, number] = [20, 110, 140];
  const footerH = 16;

  const [logo, sig, stamp, cstamp, ...photos] = await Promise.all([
    loadImg(clinic?.logo_url, "PNG", 600),
    doctor.show_signature ? loadImg(doctor.signature_url, "PNG", 800) : null,
    doctor.show_stamp ? loadImg(doctor.stamp_url, "PNG", 800) : null,
    doctor.show_clinic_stamp ? loadImg(doctor.clinic_stamp_url, "PNG", 800) : null,
    ...media.map((m) => loadImg(m.file_url, "JPEG")),
  ]);

  const clinicName = location?.location_name || clinic?.clinic_name || "";
  const address = location?.address || clinic?.address || "";
  const phone = location?.phone || clinic?.phone || "";

  let y = M;
  // Header
  let tx = M;
  if (logo) {
    const h = 18, w = Math.min(40, (logo.w / logo.h) * h);
    doc.addImage(logo.data, logo.fmt, M, y, w, h);
    tx = M + w + 5;
  }
  doc.setTextColor(...ink).setFont("helvetica", "bold").setFontSize(15);
  doc.text(clinicName || "Clinic", tx, y + 5);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...soft);
  const contact = [address, [phone, clinic?.email, clinic?.website].filter(Boolean).join("  ·  ")].filter(Boolean);
  doc.text(doc.splitTextToSize(contact.join("\n"), 95), tx, y + 10);

  doc.setTextColor(...ink).setFont("helvetica", "bold").setFontSize(10.5);
  doc.text(doctor.doctor_name || "", W - M, y + 5, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...soft);
  if (doctor.qualification) doc.text(doctor.qualification, W - M, y + 10, { align: "right" });
  if (doctor.registration_number) doc.text(`Reg. No: ${doctor.registration_number}`, W - M, y + 14.5, { align: "right" });
  y += 24;
  doc.setDrawColor(...accent).setLineWidth(0.6).line(M, y, W - M, y);
  y += 9;

  doc.setTextColor(...accent).setFont("helvetica", "bold").setFontSize(13);
  doc.text("CLINICAL REPORT", M, y);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...soft);
  doc.text(`Report ID: ${report.report_number}`, W - M, y - 3, { align: "right" });
  doc.text(`Report Date: ${fmtDate(report.report_date)}`, W - M, y + 1.5, { align: "right" });
  if (report.examination_date) doc.text(`Examination: ${fmtDate(report.examination_date)}`, W - M, y + 6, { align: "right" });
  y += 10;

  // Patient box
  doc.setFillColor(244, 248, 250).setDrawColor(222, 230, 236).setLineWidth(0.2);
  doc.roundedRect(M, y, CW, 22, 2, 2, "FD");
  const cells: [string, string][] = [
    ["Patient Name", patient.name],
    ["Age / Gender", `${patient.age} yrs / ${patient.gender}`],
    ["Patient ID", patient.patient_id || "—"],
    ["Phone", patient.phone || "—"],
  ];
  cells.forEach(([k, v], i) => {
    const cx = M + 5 + (i % 2) * (CW / 2);
    const cy = y + 7 + Math.floor(i / 2) * 9;
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...soft).text(k.toUpperCase(), cx, cy - 1.5);
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...ink).text(v, cx, cy + 3);
  });
  y += 30;

  const ensure = (need: number) => {
    if (y + need > H - M - footerH) {
      doc.addPage();
      y = M;
    }
  };
  const section = (title: string) => {
    ensure(14);
    doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...accent).text(title, M, y);
    doc.setDrawColor(222, 230, 236).setLineWidth(0.2).line(M, y + 2, W - M, y + 2);
    y += 8;
  };

  const imgs = photos.filter((p): p is Img => !!p);
  if (imgs.length) {
    section("CLINICAL PHOTOGRAPHS");
    const cols = imgs.length === 1 ? 1 : 2;
    const gap = 5;
    const cellW = (CW - gap * (cols - 1)) / cols;
    const cellH = imgs.length === 1 ? 105 : 72;
    for (let i = 0; i < imgs.length; i += cols) {
      ensure(cellH + 8);
      for (let c = 0; c < cols && i + c < imgs.length; c++) {
        const im = imgs[i + c]!;
        const r = Math.min(cellW / im.w, cellH / im.h);
        const w = im.w * r, h = im.h * r;
        const x = M + c * (cellW + gap) + (cellW - w) / 2;
        doc.setFillColor(246, 248, 250).rect(M + c * (cellW + gap), y, cellW, cellH, "F");
        doc.addImage(im.data, "JPEG", x, y + (cellH - h) / 2, w, h);
        doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...soft);
        doc.text(`Image ${i + c + 1}`, M + c * (cellW + gap), y + cellH + 4);
      }
      y += cellH + 9;
    }
  }

  const paragraph = (text: string) => {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...ink);
    const lines = doc.splitTextToSize(text || "—", CW) as string[];
    for (const ln of lines) {
      ensure(5.5);
      doc.text(ln, M, y);
      y += 5;
    }
    y += 5;
  };
  section("DIAGNOSIS / FINDINGS");
  paragraph(report.diagnosis_findings);
  if (report.additional_notes.trim()) {
    section("ADDITIONAL NOTES");
    paragraph(report.additional_notes);
  }

  // Signature block
  ensure(42);
  y += 4;
  const sx = W - M - 60;
  let iy = y;
  let ix = M;
  for (const im of [stamp, cstamp]) {
    if (!im) continue;
    const h = 26, w = Math.min(40, (im.w / im.h) * h);
    doc.addImage(im.data, "PNG", ix, iy, w, h);
    ix += w + 6;
  }
  if (sig) {
    const h = 16, w = Math.min(55, (sig.w / sig.h) * h);
    doc.addImage(sig.data, "PNG", sx + (60 - w) / 2, iy, w, h);
  }
  iy += 19;
  doc.setDrawColor(...soft).setLineWidth(0.2).line(sx, iy, W - M, iy);
  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...ink).text(doctor.doctor_name || "Doctor", sx + 30, iy + 5, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...soft);
  if (doctor.qualification) doc.text(doctor.qualification, sx + 30, iy + 9, { align: "center" });
  if (doctor.registration_number) doc.text(`Reg. No: ${doctor.registration_number}`, sx + 30, iy + 13, { align: "center" });

  // Footers
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(222, 230, 236).line(M, H - M - 8, W - M, H - M - 8);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...soft);
    if (doctor.show_disclaimer && doctor.disclaimer_text)
      doc.text(doc.splitTextToSize(doctor.disclaimer_text, CW - 30), M, H - M - 4);
    doc.text(`Page ${p} of ${pages}`, W - M, H - M - 4, { align: "right" });
    doc.text("Generated with EasyScope", W - M, H - M, { align: "right" });
  }
  return doc.output("blob");
}

export function pdfFileName(b: ReportBundle) {
  return `${b.report.report_number}.pdf`;
}

export async function sharePdf(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "shared";
    }
  }
  downloadPdf(blob, filename);
  return "downloaded";
}

export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
