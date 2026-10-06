/**
 * Device Integration Layer.
 * Every capture source implements CaptureProvider so the patient/report system never
 * depends on a specific piece of hardware. A future native USB-C / Lightning bridge
 * (Capacitor plugin exposing `EasyScopeDevice`) plugs in via `nativeBridgeProvider`.
 */
export type DeviceStatus =
  | "not_connected"
  | "searching"
  | "connected"
  | "preview"
  | "capturing"
  | "unavailable"
  | "denied";

export type VideoInput = { id: string; label: string; external: boolean };

export interface CaptureProvider {
  id: string;
  name: string;
  isSupported(): boolean;
  listInputs(): Promise<VideoInput[]>;
  start(video: HTMLVideoElement, inputId?: string): Promise<MediaStreamTrack | null>;
  stop(): void;
  capture(video: HTMLVideoElement): Promise<Blob>;
}

let stream: MediaStream | null = null;

function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")!.drawImage(video, 0, 0);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Capture failed"))), "image/jpeg", 0.92),
  );
}

export const browserCameraProvider: CaptureProvider = {
  id: "browser-camera",
  name: "Camera (browser / USB where supported)",
  isSupported: () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
  async listInputs() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => {
        const label = d.label || `Camera ${i + 1}`;
        const external = /usb|uvc|endoscope|scope|external/i.test(label);
        return { id: d.deviceId, label, external };
      });
  },
  async start(video, inputId) {
    this.stop();
    stream = await navigator.mediaDevices.getUserMedia({
      video: inputId
        ? { deviceId: { exact: inputId }, width: { ideal: 1920 }, height: { ideal: 1440 } }
        : { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    return stream.getVideoTracks()[0] ?? null;
  },
  stop() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  },
  capture: captureFrame,
};

type NativeBridge = { isAvailable(): Promise<boolean> };
function getNativeBridge(): NativeBridge | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } };
  return w.Capacitor?.Plugins?.EasyScopeDevice as NativeBridge | undefined;
}

/** Placeholder for the future native app. Reports unsupported on the web. */
export const nativeBridgeProvider: CaptureProvider = {
  id: "native-bridge",
  name: "EasyScope native device bridge",
  isSupported: () => !!getNativeBridge(),
  async listInputs() {
    return [];
  },
  async start() {
    throw new Error("Native device bridge is not available on this platform.");
  },
  stop() {},
  capture: captureFrame,
};

export function pickProvider(): CaptureProvider | null {
  if (nativeBridgeProvider.isSupported()) return nativeBridgeProvider;
  if (browserCameraProvider.isSupported()) return browserCameraProvider;
  return null;
}

type TorchCaps = MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number; step: number } };
export function trackCapabilities(track: MediaStreamTrack | null) {
  const caps = (track?.getCapabilities?.() ?? {}) as TorchCaps;
  return { torch: !!caps.torch, zoom: caps.zoom ?? null };
}
export async function setTorch(track: MediaStreamTrack, on: boolean) {
  await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
}
export async function setZoom(track: MediaStreamTrack, zoom: number) {
  await track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] });
}
