import { useSyncExternalStore } from "react";

export type PendingCapture = {
  id: string;
  blob: Blob;
  url: string;
  source: "camera" | "device" | "import";
  capturedAt: string;
};

let items: PendingCapture[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const captureStore = {
  add(blob: Blob, source: PendingCapture["source"]) {
    items = [...items, { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob), source, capturedAt: new Date().toISOString() }];
    emit();
  },
  remove(id: string) {
    const it = items.find((i) => i.id === id);
    if (it) URL.revokeObjectURL(it.url);
    items = items.filter((i) => i.id !== id);
    emit();
  },
  /** Hand all pending captures to a consumer (object URLs stay valid). */
  take(): PendingCapture[] {
    const out = items;
    items = [];
    emit();
    return out;
  },
  get: () => items,
};

const EMPTY: PendingCapture[] = [];
export function usePendingCaptures() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => EMPTY,
  );
}
