import type { Metadata } from "next";
import { MarketingHomePage } from "@/components/marketing/site/home-page";

export const metadata: Metadata = {
  title: {
    absolute: "Uhired AI — AI-Powered Voice Interviews for Smarter Hiring",
  },
  description:
    "Uhired AI runs conversational voice interviews, automated screening, real-time transcription, and structured AI evaluation so teams hire faster and smarter.",
};

export default function HomePage() {
  return <MarketingHomePage />;
}
