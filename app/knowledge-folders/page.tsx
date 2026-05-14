import type { Metadata } from "next";
import { KnowledgeFoldersView } from "@/components/pcdi/knowledge-folders-view";

export const metadata: Metadata = {
  title: "Knowledge folders — RESOLV MACHINE",
  description: "Create folders, upload PDFs, and connect SharePoint sources.",
};

export default function KnowledgeFoldersPage() {
  return <KnowledgeFoldersView />;
}
