<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules
- Signed-in pages live under `src/routes/_authenticated/` (client-only layout); `/` redirects to `/dashboard`. Why: session lives in browser storage.
- All capture hardware goes through the `CaptureProvider` interface in `src/lib/device.ts`; a future native USB bridge plugs in there. Why: patient/report code never depends on hardware.
- Clinical files live in the private `clinical` bucket under `<userId>/...` and are shown via signed URLs. Why: patient privacy.
- Report PDFs are generated in the browser with jsPDF from saved data (`src/lib/pdf.ts`). Why: preview always matches the saved report and settings.
