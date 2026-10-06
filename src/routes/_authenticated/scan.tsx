import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, FlipHorizontal, Flashlight, ImagePlus, Pause, Play, RotateCcw, Check, X, Info } from "lucide-react";
import { browserCameraProvider, pickProvider, setTorch, setZoom, trackCapabilities, type DeviceStatus, type VideoInput } from "@/lib/device";
import { captureStore, usePendingCaptures } from "@/lib/capture-store";
import { validateImage } from "@/lib/data";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/scan")({
  validateSearch: (s: Record<string, unknown>): { patient?: string } => ({ patient: typeof s.patient === "string" ? s.patient : undefined }),
  head: () => ({
    meta: [
      { title: "Device / Scan — EasyScope" },
      { name: "description", content: "Capture clinical photographs from a camera or compatible device." },
      { property: "og:title", content: "Device / Scan — EasyScope" },
      { property: "og:description", content: "Live capture for clinical imaging." },
    ],
  }),
  component: ScanPage,
});

const STATUS: Record<DeviceStatus, string> = {
  not_connected: "Device not connected",
  searching: "Searching for device…",
  connected: "Device connected",
  preview: "Camera preview available",
  capturing: "Capturing…",
  unavailable: "Device unavailable",
  denied: "Camera permission denied",
};

function ScanPage() {
  const { patient } = Route.useSearch();
  const navigate = useNavigate();
  const pending = usePendingCaptures();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<DeviceStatus>("not_connected");
  const [inputs, setInputs] = useState<VideoInput[]>([]);
  const [inputId, setInputId] = useState<string | undefined>();
  const [track, setTrack] = useState<MediaStreamTrack | null>(null);
  const [torch, setTorchOn] = useState(false);
  const [zoom, setZoomV] = useState<number | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const provider = pickProvider() ?? browserCameraProvider;
  const caps = trackCapabilities(track);

  async function start(id?: string) {
    if (!provider.isSupported() || !videoRef.current) { setStatus("unavailable"); return; }
    setStatus("searching");
    try {
      const t = await provider.start(videoRef.current, id);
      setTrack(t);
      setInputs(await provider.listInputs());
      setInputId(t?.getSettings().deviceId ?? id);
      const c = trackCapabilities(t);
      setZoomV(c.zoom ? c.zoom.min : null);
      setTorchOn(false);
      setFrozen(false);
      setStatus("preview");
    } catch (e) {
      setStatus((e as Error).name === "NotAllowedError" ? "denied" : "unavailable");
    }
  }

  useEffect(() => {
    start();
    return () => provider.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function capture() {
    if (!videoRef.current || status !== "preview") return;
    setStatus("capturing");
    try {
      const blob = await provider.capture(videoRef.current);
      setShot({ blob, url: URL.createObjectURL(blob) });
    } finally { setStatus("preview"); }
  }
  function usePhoto() {
    if (!shot) return;
    captureStore.add(shot.blob, inputs.find((i) => i.id === inputId)?.external ? "device" : "camera");
    URL.revokeObjectURL(shot.url);
    setShot(null);
    toast.success("Photo added");
  }
  function switchCam() {
    if (inputs.length < 2) return;
    const idx = inputs.findIndex((i) => i.id === inputId);
    start(inputs[(idx + 1) % inputs.length].id);
  }
  function toggleFreeze() {
    const v = videoRef.current;
    if (!v) return;
    if (frozen) v.play(); else v.pause();
    setFrozen(!frozen);
  }
  function importFiles(files: FileList | null) {
    for (const f of Array.from(files ?? [])) {
      const err = validateImage(f);
      if (err) toast.error(`${f.name}: ${err}`); else captureStore.add(f, "import");
    }
  }

  const live = status === "preview" || status === "capturing";
  const unavailable = status === "unavailable" || status === "denied";

  return (
    <div className="-mx-4 -my-5 flex min-h-[calc(100dvh-4rem)] flex-col bg-viewer text-viewer-foreground md:mx-0 md:my-0 md:min-h-[80dvh] md:rounded-2xl">
      <div className="flex items-center justify-between p-4">
        <Logo className="[&_div]:text-viewer-foreground" />
        <span className={cn("rounded-full px-3 py-1 text-xs font-medium", live ? "bg-success text-primary-foreground" : "bg-viewer-foreground/15")}>{STATUS[status]}</span>
      </div>

      <div className="relative mx-4 flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-viewer-foreground/5">
        <video ref={videoRef} playsInline muted className={cn("h-full max-h-[60dvh] w-full object-contain", (!live || shot) && "hidden")} />
        {shot && <img src={shot.url} alt="Captured" className="h-full max-h-[60dvh] w-full object-contain" />}
        {unavailable && !shot && (
          <div className="max-w-sm p-6 text-center">
            <Info className="mx-auto h-8 w-8 opacity-70" />
            <p className="mt-3 text-sm">
              {status === "denied"
                ? "Camera access was blocked. Allow camera permission in your browser settings, or import images instead."
                : "Your device cannot be accessed directly on this platform. Capture using the device camera/app and import the image here."}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="secondary" onClick={() => start()}>Try again</Button>
              <Button onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /> Import photos</Button>
            </div>
          </div>
        )}
        {status === "searching" && <div className="h-10 w-10 animate-spin rounded-full border-2 border-viewer-foreground/30 border-t-viewer-foreground" />}
      </div>

      {live && !shot && caps.zoom && zoom !== null && (
        <div className="mx-6 mt-3 flex items-center gap-3 text-xs">
          Zoom
          <Slider min={caps.zoom.min} max={caps.zoom.max} step={caps.zoom.step || 0.1} value={[zoom]} onValueChange={([z]) => { setZoomV(z); if (track) setZoom(track, z); }} />
        </div>
      )}

      <div className="p-4">
        {shot ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" className="h-14 text-base" onClick={() => { URL.revokeObjectURL(shot.url); setShot(null); }}><RotateCcw className="h-5 w-5" /> Retake</Button>
            <Button className="h-14 text-base" onClick={usePhoto}><Check className="h-5 w-5" /> Use Photo</Button>
          </div>
        ) : (
          <div className="flex items-center justify-around">
            <CtrlBtn label="Import" onClick={() => fileRef.current?.click()}><ImagePlus /></CtrlBtn>
            <CtrlBtn label="Switch" onClick={switchCam} disabled={inputs.length < 2}><FlipHorizontal /></CtrlBtn>
            <button aria-label="Capture photo" onClick={capture} disabled={!live} className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-viewer-foreground/80 bg-primary disabled:opacity-40">
              <Camera className="h-8 w-8" />
            </button>
            <CtrlBtn label="Light" onClick={() => { if (track) { setTorch(track, !torch); setTorchOn(!torch); } }} disabled={!caps.torch} active={torch}><Flashlight /></CtrlBtn>
            <CtrlBtn label={frozen ? "Resume" : "Freeze"} onClick={toggleFreeze} disabled={!live}>{frozen ? <Play /> : <Pause />}</CtrlBtn>
          </div>
        )}
        {inputs.length > 1 && !shot && <p className="mt-2 text-center text-[11px] opacity-60">{inputs.find((i) => i.id === inputId)?.label}</p>}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { importFiles(e.target.files); e.target.value = ""; }} />

      {pending.length > 0 && (
        <div className="border-t border-viewer-foreground/10 p-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {pending.map((p) => (
              <div key={p.id} className="relative shrink-0">
                <img src={p.url} alt="Pending capture" className="h-16 w-16 rounded-lg object-cover" />
                <button aria-label="Remove" onClick={() => captureStore.remove(p.id)} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
          <Button className="mt-2 h-12 w-full text-base" onClick={() => navigate({ to: "/reports/new", search: { patient } })}>
            Continue to report ({pending.length})
          </Button>
        </div>
      )}
      <p className="px-4 pb-4 text-center text-[11px] opacity-60">
        USB endoscopes work here only if your phone/browser exposes them as a camera. Otherwise capture in the device's own app and tap Import.
      </p>
    </div>
  );
}

function CtrlBtn({ label, children, onClick, disabled, active }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-1 text-[11px] disabled:opacity-30" aria-label={label}>
      <span className={cn("flex h-12 w-12 items-center justify-center rounded-full bg-viewer-foreground/10 [&_svg]:h-5 [&_svg]:w-5", active && "bg-primary")}>{children}</span>
      {label}
    </button>
  );
}
