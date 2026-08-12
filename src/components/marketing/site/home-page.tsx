import { Navbar } from "@/components/marketing/site/Navbar";
import { Footer } from "@/components/marketing/site/Footer";
import { MarketingBackground } from "@/components/marketing/site/marketing-page-shell";
import { Hero, TrustBar } from "@/components/marketing/site/Hero";
import {
  AboutSection,
  DynamicInterviewSection,
  FlowSection,
  VoiceAITechnology,
  VoiceInterviewSection,
} from "@/components/marketing/site/SectionsInterview";
import {
  AIScreeningSection,
  AnalyticsSection,
  EvaluationSection,
  ReportSection,
  TranscriptionSection,
} from "@/components/marketing/site/SectionsIntelligence";
import {
  CandidateExperience,
  InterviewTypesSection,
  JobCreationSection,
  LiveStatusSection,
  RecruiterDashboard,
} from "@/components/marketing/site/SectionsPlatform";
import {
  CTASection,
  MultiTenantSection,
  SecuritySection,
  WhyAndComparison,
} from "@/components/marketing/site/SectionsTrust";

export function MarketingHomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <MarketingBackground />
      <Navbar />
      <main>
        <Hero />
        <TrustBar />
        <AboutSection />
        <VoiceInterviewSection />
        <FlowSection />
        <AIScreeningSection />
        <EvaluationSection />
        <TranscriptionSection />
        <DynamicInterviewSection />
        <RecruiterDashboard />
        <JobCreationSection />
        <CandidateExperience />
        <VoiceAITechnology />
        <AnalyticsSection />
        <InterviewTypesSection />
        <LiveStatusSection />
        <ReportSection />
        <SecuritySection />
        <MultiTenantSection />
        <WhyAndComparison />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
