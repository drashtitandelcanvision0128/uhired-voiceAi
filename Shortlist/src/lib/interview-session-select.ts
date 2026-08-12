/**
 * Shared Prisma select for interview session hot paths (realtime start).
 * Avoids loading transcript turns during LIVE — turns are saved at complete.
 */
export const interviewSessionRealtimeSelect = {
  id: true,
  sessionType: true,
  status: true,
  updatedAt: true,
  durationMin: true,
  candidateName: true,
  companyName: true,
  domain: true,
  topic: true,
  positionTitle: true,
  jobDescription: true,
  keySkills: true,
  maxOptionalQuestions: true,
  pickedOptionalQuestionIds: true,
  candidate: { select: { name: true } },
  company: {
    select: {
      name: true,
      interviewerName: true,
      interviewerVoiceGender: true,
      interviewLanguage: true,
      atsWebhookUrl: true,
      atsWebhookSecret: true,
    },
  },
  questions: {
    orderBy: { orderIndex: "asc" as const },
    select: {
      id: true,
      prompt: true,
      isMandatory: true,
      orderIndex: true,
    },
  },
  requirement: {
    select: {
      title: true,
      domain: true,
      topic: true,
      jobDescription: true,
      keySkills: true,
      maxOptionalQuestions: true,
      interviewLanguage: true,
      questions: {
        orderBy: { orderIndex: "asc" as const },
        select: {
          id: true,
          prompt: true,
          isMandatory: true,
          orderIndex: true,
        },
      },
    },
  },
};
