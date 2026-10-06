import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EasyScope — Clinical Imaging & Reporting" },
      { name: "description", content: "Capture clinical photographs, create professional reports and share PDFs with EasyScope." },
      { property: "og:title", content: "EasyScope — Clinical Imaging & Reporting" },
      { property: "og:description", content: "Smarter Visualization for Better Care." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
