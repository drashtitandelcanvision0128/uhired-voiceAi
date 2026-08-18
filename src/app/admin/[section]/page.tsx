import { redirect } from "next/navigation";
import AdminPageClient from "../admin-page-client";
import { isAdminSectionSlug } from "@/lib/admin-portal-routes";

type AdminSectionPageProps = {
  params: Promise<{ section: string }>;
};

export default async function AdminSectionPage({ params }: AdminSectionPageProps) {
  const { section } = await params;
  if (!isAdminSectionSlug(section) && section !== "invites" && section !== "openings" && section !== "interviewer") {
    redirect("/admin/dashboard");
  }
  return <AdminPageClient />;
}
