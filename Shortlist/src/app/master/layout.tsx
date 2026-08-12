import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MasterSessionWatcher } from "@/components/master-session-watcher";
import { MASTER_SESSION_COOKIE, verifyMasterSessionToken } from "@/lib/master-auth";

type MasterLayoutProps = {
  children: ReactNode;
};

export default async function MasterLayout({ children }: MasterLayoutProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get(MASTER_SESSION_COOKIE)?.value;
  if (!verifyMasterSessionToken(token)) {
    redirect("/master-login");
  }

  return (
    <>
      {children}
      <MasterSessionWatcher />
    </>
  );
}
