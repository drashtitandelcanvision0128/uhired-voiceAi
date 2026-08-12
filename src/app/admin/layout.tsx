import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COMPANY_ADMIN_COOKIE, verifyCompanySessionToken } from "@/lib/company-admin-auth";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COMPANY_ADMIN_COOKIE)?.value;
  const isAuthenticated = await verifyCompanySessionToken(token);

  if (!isAuthenticated) {
    redirect("/company-login");
  }

  return children;
}
