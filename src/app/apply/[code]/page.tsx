import type { Metadata } from "next";
import { ApplyPageClient } from "./apply-page-client";

export const metadata: Metadata = {
  title: "Apply for interview",
  description: "Enter your name and email to start this AI interview.",
};

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ApplyPageClient code={code} />;
}
