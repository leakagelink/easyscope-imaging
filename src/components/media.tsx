import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ImageOff, Trash2, X } from "lucide-react";
import { useSignedUrl } from "@/lib/data";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignedImage({ path, className, alt = "Clinical photograph" }: { path: string | null | undefined; className?: string; alt?: string }) {
  const { data, isError } = useSignedUrl(path);
  if (isError) return <div className={cn("flex items-center justify-center bg-muted", className)}><ImageOff className="h-5 w-5 text-muted-foreground" /></div>;
  if (!data) return <div className={cn("animate-pulse bg-muted", className)} />;
  return <img src={data} alt={alt} className={cn("object-cover", className)} loading="lazy" />;
}

export type ViewerItem = {
  id: string;
  path?: string | undefined;
  src?: string | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
  patientId?: string | undefined;
  reportId?: string | null | undefined;
};

function ViewerImage({ item }: { item: ViewerItem }) {
  const { data } = useSignedUrl(item.src ? null : item.path);
  const src = item.src ?? data;
  return src ? <img src={src} alt="Clinical photograph" className="max-h-full max-w-full object-contain" /> : <div className="h-10 w-10 animate-spin rounded-full border-2 border-viewer-foreground/30 border-t-viewer-foreground" />;
}

export function Viewer({
  items, index, onIndex, onClose, onDelete,
}: {
  items: ViewerItem[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDelete?: (item: ViewerItem) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [index]);
  const item = index !== null ? items[index] : null;
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[100dvh] max-w-none flex-col gap-0 border-0 bg-viewer p-0 text-viewer-foreground sm:max-w-none sm:rounded-none [&>button]:hidden">
        <DialogTitle className="sr-only">Image viewer</DialogTitle>
        {item && (
          <>
            <div className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{item.title}</div>
                <div className="truncate text-xs opacity-70">{item.subtitle}</div>
              </div>
              <div className="flex items-center gap-1">
                <span className="mr-2 text-xs opacity-70">{index! + 1} / {items.length}</span>
                <Button size="icon" variant="ghost" className="text-viewer-foreground hover:bg-viewer-foreground/10 hover:text-viewer-foreground" onClick={onClose} aria-label="Close"><X /></Button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
              <ViewerImage item={item} />
              {index! > 0 && (
                <button className="absolute left-2 rounded-full bg-viewer-foreground/10 p-3" onClick={() => onIndex(index! - 1)} aria-label="Previous"><ChevronLeft /></button>
              )}
              {index! < items.length - 1 && (
                <button className="absolute right-2 rounded-full bg-viewer-foreground/10 p-3" onClick={() => onIndex(index! + 1)} aria-label="Next"><ChevronRight /></button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 p-4">
              {item.patientId && (
                <Button asChild variant="secondary" size="sm"><Link to="/patients/$id" params={{ id: item.patientId }} onClick={onClose}>Open patient</Link></Button>
              )}
              {item.reportId && (
                <Button asChild variant="secondary" size="sm"><Link to="/reports/$id" params={{ id: item.reportId }} onClick={onClose}>Open report</Link></Button>
              )}
              {onDelete && (confirm ? (
                <Button size="sm" variant="destructive" onClick={() => onDelete(item)}>Confirm delete</Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
