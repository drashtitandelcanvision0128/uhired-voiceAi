import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Master Login",
  description: "Sign in to the Uhired master admin portal to manage the full platform.",
};

export default function MasterLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
