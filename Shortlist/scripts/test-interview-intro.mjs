/**

 * Verifies interview introduction prompt builders and phase logic expectations.

 * Run: node scripts/test-interview-intro.mjs

 */

import assert from "node:assert/strict";

import {

  buildOpeningGreetingResponseInstructions,

  buildPostIntroductionResponseInstructions,

  buildNextQuestionResponseInstructions,

  buildCompanyRealtimeInstructions,

  buildPracticeRealtimeInstructions,

  isDeepInterviewQuestion,

  orderInterviewQuestionsForFlow,

  buildSkillBasedFallbackQuestions,

  orderMandatoryQuestions,

  prioritizeTechnicalQuestions,

  DEFAULT_BEHAVIORAL_FALLBACK,

  buildInterviewPacingInstructions,

} from "../src/lib/interview-prompt.ts";



function test(name, fn) {

  try {

    fn();

    console.log(`  ✓ ${name}`);

  } catch (error) {

    console.error(`  ✗ ${name}`);

    throw error;

  }

}



console.log("Interview introduction prompt tests\n");



test("company opening requires self-intro before questions", () => {

  const prompt = buildOpeningGreetingResponseInstructions({

    candidateName: "Alex",

    interviewerDisplayName: "Jordan Lee",

    companyName: "Acme Corp",

    sessionType: "COMPANY",

  });

  assert.match(prompt, /Alex/);

  assert.match(prompt, /Jordan Lee/);

  assert.match(prompt, /Acme Corp/);

  assert.match(prompt, /introduce themselves/i);

  assert.match(prompt, /Do NOT ask any technical/i);

  assert.match(prompt, /REQUIRED/i);

});



test("practice opening uses mock interviewer identity", () => {

  const prompt = buildOpeningGreetingResponseInstructions({

    candidateName: "Sam",

    interviewerDisplayName: null,

    companyName: null,

    sessionType: "PRACTICE",

  });

  assert.match(prompt, /mock practice interviewer/i);

  assert.match(prompt, /introduce themselves/i);

  assert.doesNotMatch(prompt, /predefined interview question/i);

});



test("post-intro company without key skills uses first predefined question", () => {

  const prompt = buildPostIntroductionResponseInstructions({ sessionType: "COMPANY" });

  assert.match(prompt, /just finished introducing themselves/i);

  assert.match(prompt, /FIRST predefined interview question/i);

  assert.match(prompt, /introduction phase is complete/i);

});



test("post-intro company with key skills assesses experience first", () => {

  const prompt = buildPostIntroductionResponseInstructions({

    sessionType: "COMPANY",

    keySkills: ["React", "TypeScript"],

  });

  assert.match(prompt, /hands-on experience/i);

  assert.match(prompt, /key skills/i);

  assert.match(prompt, /Do NOT ask behavioral/i);

  assert.doesNotMatch(prompt, /FIRST predefined interview question/i);

});



test("post-intro practice transitions to experience assessment", () => {

  const prompt = buildPostIntroductionResponseInstructions({ sessionType: "PRACTICE" });

  assert.match(prompt, /hands-on experience/i);

  assert.match(prompt, /Do NOT ask behavioral/i);

});



test("next question for practice keeps experience before behavioral", () => {

  const prompt = buildNextQuestionResponseInstructions({ sessionType: "PRACTICE" });

  assert.match(prompt, /hands-on experience/i);

  assert.match(prompt, /deeper behavioral/i);

  assert.doesNotMatch(prompt, /predefined interview question list/i);

});



test("next question for company with key skills enforces skill-first flow", () => {

  const prompt = buildNextQuestionResponseInstructions({

    sessionType: "COMPANY",

    keySkills: ["Node.js"],

  });

  assert.match(prompt, /each key skill/i);

  assert.match(prompt, /Only AFTER key-skill experience has been assessed/i);

  assert.match(prompt, /Do NOT ask behavioral/i);

});



test("next question for company without key skills uses predefined list", () => {

  const prompt = buildNextQuestionResponseInstructions({ sessionType: "COMPANY" });

  assert.match(prompt, /NEXT question/i);

  assert.match(prompt, /predefined interview question list/i);

  assert.doesNotMatch(prompt, /introduce themselves/i);

});



test("deep question detector flags behavioral and scenario prompts", () => {

  assert.equal(isDeepInterviewQuestion("Tell me about a time you handled conflict."), true);

  assert.equal(isDeepInterviewQuestion("What would you do if production went down?"), true);

  assert.equal(isDeepInterviewQuestion("How many years of React experience do you have?"), false);

});



test("question ordering puts experience prompts before deep follow-ups", () => {

  const ordered = orderInterviewQuestionsForFlow([

    "Tell me about a time you led a release.",

    "How familiar are you with Kubernetes?",

    "What would you do if a deploy failed at midnight?",

    "Describe your experience with CI/CD pipelines.",

  ]);

  assert.deepEqual(ordered, [

    "How familiar are you with Kubernetes?",

    "Describe your experience with CI/CD pipelines.",

    "Tell me about a time you led a release.",

    "What would you do if a deploy failed at midnight?",

  ]);

});



test("company realtime instructions order experience before behavioral in configured questions", () => {

  const prompt = buildCompanyRealtimeInstructions({

    candidateName: "Alex",

    companyName: "Acme",

    interviewerDisplayName: "Jordan",

    positionTitle: "Engineer",

    domain: "Engineering",

    topic: "Backend",

    jobDescription: null,

    keySkills: ["Python", "AWS"],

    mandatoryQuestions: [

      "Tell me about a time you debugged a production issue.",

      "How many years of Python experience do you have?",

    ],

    optionalQuestions: [],

    maxOptionalQuestions: 0,

    durationSec: 1800,

  });

  assert.match(prompt, /Configured interview questions/i);

  assert.match(prompt, /How many years of Python experience do you have\?/);

  const pythonIndex = prompt.indexOf("How many years of Python experience do you have?");

  const behavioralIndex = prompt.indexOf("Tell me about a time you debugged a production issue.");

  assert.ok(pythonIndex > 0 && behavioralIndex > 0);

  assert.ok(pythonIndex < behavioralIndex, "experience question should appear before behavioral question");

});



test("company realtime instructions expand MERN stack and enforce skill scope", () => {

  const prompt = buildCompanyRealtimeInstructions({

    candidateName: "Alex",

    companyName: "Acme",

    interviewerDisplayName: "Jordan",

    positionTitle: "Web Developer",

    domain: "Web Developer",

    topic: "MERN Stack",

    jobDescription: "Build full-stack web applications.",

    keySkills: ["MERN Stack"],

    mandatoryQuestions: [],

    optionalQuestions: [],

    maxOptionalQuestions: 0,

    durationSec: 1800,

  });

  assert.match(prompt, /MongoDB/i);

  assert.match(prompt, /React/i);

  assert.match(prompt, /Node\.js/i);

  assert.match(prompt, /SKILL SCOPE/i);

  assert.match(prompt, /Key-skill experience assessment/i);

  assert.doesNotMatch(prompt, /Cannot access/i);

});



/** Mirrors client-side phase gating for candidate responses. */

function simulatePhaseGate(phase) {

  if (phase === "opening") return "blocked";

  if (phase === "intro") return "post_intro";

  return "next_question";

}



test("phase gate blocks responses during opening", () => {

  assert.equal(simulatePhaseGate("opening"), "blocked");

});



test("phase gate uses post-intro on first candidate turn after opening", () => {

  assert.equal(simulatePhaseGate("intro"), "post_intro");

});



test("phase gate uses next question after intro complete", () => {

  assert.equal(simulatePhaseGate("questions"), "next_question");

});



test("next question prompts require follow-ups aligned with candidate responses", () => {

  const prompts = [

    buildNextQuestionResponseInstructions({ sessionType: "PRACTICE" }),

    buildNextQuestionResponseInstructions({ sessionType: "COMPANY", keySkills: ["React"] }),

    buildNextQuestionResponseInstructions({ sessionType: "COMPANY" }),

  ];

  for (const prompt of prompts) {

    assert.match(prompt, /relevant and well-aligned/i);

    assert.match(prompt, /what they (just )?(said|shared|mentioned)/i);

  }

});



test("skill assessment allows same-skill follow-up before advancing", () => {

  const prompt = buildNextQuestionResponseInstructions({

    sessionType: "COMPANY",

    keySkills: ["React", "TypeScript"],

  });

  assert.match(prompt, /shallow|vague|incomplete/i);

  assert.match(prompt, /same skill/i);

});



test("company and practice realtime instructions require response-aligned follow-ups", () => {

  const company = buildCompanyRealtimeInstructions({

    candidateName: "Alex",

    companyName: "Acme",

    interviewerDisplayName: "Jordan",

    positionTitle: "Engineer",

    domain: "Engineering",

    topic: "Backend",

    jobDescription: null,

    keySkills: ["Python"],

    mandatoryQuestions: ["How do you handle production incidents?"],

    optionalQuestions: [],

    maxOptionalQuestions: 0,

    durationSec: 1800,

  });

  const practice = buildPracticeRealtimeInstructions({

    candidateName: "Sam",

    domain: "Engineering",

    topic: "Backend",

    durationSec: 1800,

  });

  assert.match(company, /relevant and well-aligned/i);

  assert.match(practice, /relevant and well-aligned/i);

});



test("skill-based fallback generates technical questions from key skills", () => {

  const questions = buildSkillBasedFallbackQuestions(

    ["React", "Node.js", "PostgreSQL"],

    "Senior Full Stack Engineer",

    5,

  );

  assert.equal(questions.length, 4);

  assert.match(questions[0].prompt, /React/i);

  assert.match(questions[1].prompt, /Node\.js/i);

  assert.match(questions[2].prompt, /PostgreSQL/i);

  assert.match(questions[3].prompt, /Senior Full Stack Engineer/i);

});



test("orderMandatoryQuestions puts experience before behavioral", () => {

  const ordered = orderMandatoryQuestions([

    {

      prompt: "Tell me about a time you handled a production outage.",

      expectedAnswer: null,

      gradingRubric: null,

      difficulty: "medium",

    },

    {

      prompt: "How many years of Kubernetes experience do you have?",

      expectedAnswer: null,

      gradingRubric: null,

      difficulty: "medium",

    },

  ]);

  assert.match(ordered[0].prompt, /Kubernetes/i);

  assert.match(ordered[1].prompt, /production outage/i);

});



test("prioritizeTechnicalQuestions groups technical before behavioral", () => {

  const prioritized = prioritizeTechnicalQuestions([

    {

      prompt: "Describe a conflict with a teammate.",

      expectedAnswer: null,

      gradingRubric: null,

      difficulty: "medium",

    },

    {

      prompt: "Explain how you design REST APIs.",

      expectedAnswer: null,

      gradingRubric: null,

      difficulty: "medium",

    },

  ]);

  assert.match(prioritized[0].prompt, /REST APIs/i);

  assert.ok(isDeepInterviewQuestion(prioritized[1].prompt));

});



test("company realtime instructions include role-specific focus", () => {

  const prompt = buildCompanyRealtimeInstructions({

    candidateName: "Alex",

    companyName: "Acme",

    interviewerDisplayName: "Jordan",

    positionTitle: "DevOps Engineer",

    domain: "Engineering",

    topic: "Infrastructure",

    jobDescription: "Manage Kubernetes clusters and CI/CD pipelines.",

    keySkills: ["Kubernetes", "Terraform"],

    mandatoryQuestions: [],

    optionalQuestions: [],

    maxOptionalQuestions: 0,

    durationSec: 1800,

  });

  assert.match(prompt, /ROLE-SPECIFIC FOCUS/i);

  assert.match(prompt, /DevOps Engineer/i);

  assert.match(prompt, /Kubernetes clusters/i);

});



test("default behavioral fallback is defined", () => {

  assert.match(DEFAULT_BEHAVIORAL_FALLBACK.prompt, /background/i);

});



test("long interviews include pacing instructions and discourage early closing", () => {

  const pacing = buildInterviewPacingInstructions(20);

  assert.match(pacing, /20 minutes/i);

  assert.match(pacing, /Do NOT rush through questions or close early/i);

  const company = buildCompanyRealtimeInstructions({

    candidateName: "Alex",

    companyName: "Acme",

    interviewerDisplayName: "Jordan",

    positionTitle: "Engineer",

    domain: "Engineering",

    topic: "Backend",

    jobDescription: null,

    keySkills: ["Python"],

    mandatoryQuestions: ["Describe your Python experience."],

    optionalQuestions: [],

    maxOptionalQuestions: 0,

    durationSec: 1200,

  });

  assert.match(company, /PACING \(CRITICAL\)/i);

  assert.match(company, /Do NOT give closing remarks or end the interview until/i);

  assert.match(company, /additional role-relevant follow-ups/i);

});



console.log("\nAll interview introduction tests passed.");


