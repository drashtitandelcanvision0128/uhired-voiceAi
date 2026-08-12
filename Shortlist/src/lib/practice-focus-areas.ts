export type PracticeFocusArea = {
  domain: string;
  topic: string;
  sampleQuestion: string;
  sampleFeedback: string;
};

/** Predefined focus areas for public practice sessions (candidate-facing). */
export const PRACTICE_FOCUS_AREAS: PracticeFocusArea[] = [
  {
    domain: "Software Engineering",
    topic: "Algorithms, system design, coding concepts, and technical problem-solving.",
    sampleQuestion:
      "Walk me through how you would design a URL shortener that handles 10,000 requests per second. What trade-offs would you consider?",
    sampleFeedback:
      "Strong answers cover hashing, database sharding, caching, and rate limiting — with clear trade-offs between consistency and availability.",
  },
  {
    domain: "Data Science & Analytics",
    topic: "Statistics, ML fundamentals, data interpretation, and analytical thinking.",
    sampleQuestion:
      "You notice model accuracy dropped 8% after deploying a new feature. How would you investigate and communicate this to stakeholders?",
    sampleFeedback:
      "Look for a structured approach: data drift checks, feature importance analysis, A/B test validation, and a clear business impact summary.",
  },
  {
    domain: "UI/UX & Design",
    topic: "Design thinking, user research, prototyping, and visual communication.",
    sampleQuestion:
      "Tell me about a time you had to redesign a flow based on user research. What did you change and how did you measure success?",
    sampleFeedback:
      "Great responses use the design process — research insights, iteration rationale, and metrics like task completion rate or NPS.",
  },
  {
    domain: "Product Management",
    topic: "Product sense, strategy frameworks, and execution logic.",
    sampleQuestion:
      "How would you prioritize three competing feature requests when engineering capacity is limited to one sprint?",
    sampleFeedback:
      "Strong PMs frame impact vs. effort, align with OKRs, involve stakeholders, and articulate what gets deferred and why.",
  },
  {
    domain: "Project Management",
    topic: "Execution planning, risk handling, and cross-team delivery.",
    sampleQuestion:
      "A critical dependency is delayed by two weeks. Walk me through how you would re-plan and keep stakeholders informed.",
    sampleFeedback:
      "Look for risk assessment, scope negotiation, updated timelines, escalation paths, and proactive communication cadence.",
  },
  {
    domain: "Sales & Business Development",
    topic: "Discovery, pitching, objection handling, and pipeline.",
    sampleQuestion:
      "A prospect says your solution is 40% more expensive than a competitor. How would you handle that objection?",
    sampleFeedback:
      "Effective answers reframe value over price, use discovery to understand true needs, and cite ROI or differentiation clearly.",
  },
  {
    domain: "Business Analyst",
    topic: "Problem framing, data interpretation, and stakeholder communication.",
    sampleQuestion:
      "Business users report that a dashboard metric doesn't match their expectations. How would you diagnose and resolve the discrepancy?",
    sampleFeedback:
      "Strong BAs validate data sources, trace calculation logic, reconcile definitions with stakeholders, and document the fix.",
  },
  {
    domain: "Marketing",
    topic: "Campaign strategy, digital channels, analytics, and brand positioning.",
    sampleQuestion:
      "You're launching a product in a crowded market with a limited budget. What channels would you prioritize and why?",
    sampleFeedback:
      "Look for audience segmentation, channel-fit reasoning, measurable KPIs, and a test-and-learn approach within budget constraints.",
  },
  {
    domain: "Human Resources",
    topic: "Talent assessment, employee relations, HR policy, and interviewing.",
    sampleQuestion:
      "Two high performers on the same team have a conflict affecting delivery. How would you mediate and prevent recurrence?",
    sampleFeedback:
      "Good HR answers cover private conversations, root-cause analysis, clear expectations, and follow-up to ensure lasting resolution.",
  },
  {
    domain: "Finance & Accounting",
    topic: "Financial analysis, accounting principles, modeling, and compliance.",
    sampleQuestion:
      "Walk me through how you would build a three-statement financial model for a SaaS company entering a new market.",
    sampleFeedback:
      "Strong models link revenue drivers, COGS, working capital, and cash flow — with clear assumptions and sensitivity analysis.",
  },
];

export const CUSTOM_FOCUS_AREA_TOPIC =
  "Tailored interview questions based on your specific role and experience.";

export const CUSTOM_FOCUS_AREA_SAMPLE_QUESTION =
  "Tell me about your most relevant experience for this role and a challenge you solved that demonstrates your core skills.";

export const CUSTOM_FOCUS_AREA_SAMPLE_FEEDBACK =
  "The AI tailors follow-up questions to your answer — probing depth, clarity, and role-specific competencies in real time.";

export const PRACTICE_PREVIEW_DURATION_MIN = 3;

export type PracticePreviewContent = {
  domain: string;
  topic: string;
  sampleQuestion: string;
  sampleFeedback: string;
};

export function getPracticePreviewContent(
  domain: string,
  customFocusArea?: string,
): PracticePreviewContent {
  const custom = customFocusArea?.trim();
  if (custom) {
    return {
      domain: custom,
      topic: CUSTOM_FOCUS_AREA_TOPIC,
      sampleQuestion: CUSTOM_FOCUS_AREA_SAMPLE_QUESTION,
      sampleFeedback: CUSTOM_FOCUS_AREA_SAMPLE_FEEDBACK,
    };
  }

  const match = PRACTICE_FOCUS_AREAS.find((area) => area.domain === domain);
  if (match) {
    return {
      domain: match.domain,
      topic: match.topic,
      sampleQuestion: match.sampleQuestion,
      sampleFeedback: match.sampleFeedback,
    };
  }

  return {
    domain: domain.trim() || "Your role",
    topic: CUSTOM_FOCUS_AREA_TOPIC,
    sampleQuestion: CUSTOM_FOCUS_AREA_SAMPLE_QUESTION,
    sampleFeedback: CUSTOM_FOCUS_AREA_SAMPLE_FEEDBACK,
  };
}
