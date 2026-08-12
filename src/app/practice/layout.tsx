import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata: Metadata = {
  title: "AI Mock Interview Practice by Role",
  description:
    "Free mock interview practice with an AI interview coach for PM, software engineering, data science, marketing, and more. Get real-time feedback before your next interview.",
};

export default function PracticeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
