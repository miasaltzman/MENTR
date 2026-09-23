import type { MentorContext } from "@/lib/ai/context";

/** Development persona. Not special-cased anywhere in product code. */
export const demoStudent: MentorContext = {
  today: "2026-09-23",
  profile: {
    firstName: "Mia",
    userType: "college_student",
    location: "San Diego, CA",
    relocation: "open",
    preferredLocations: ["San Francisco Bay Area", "Seattle"],
    openToRemote: true,
    careerCertainty: "kind_of",
  },
  education: {
    level: "undergraduate",
    school: "San Diego State University",
    yearInSchool: "junior",
    expectedGraduation: "2028-05-15",
    majors: ["Artificial Intelligence"],
    minors: ["Data Science"],
  },
  professional: null,
  venture: null,
  preferences: {
    industries: ["Artificial intelligence", "Technology"],
    companiesAdmired: [],
    lifestylePriorities: ["Meaningful work", "Growth"],
    skillsToLearn: ["Product discovery", "SQL"],
    fiveYearVision:
      "Working as a product manager on AI products people actually use.",
    gradSchoolInterest: "no_idea",
    entrepreneurshipInterest: "kind_of",
  },
  careerInterests: [
    { label: "AI Product Management", certainty: "kind_of" },
    { label: "AI Solutions Engineering", certainty: "kind_of" },
    { label: "Technology Entrepreneurship", certainty: "no_idea" },
  ],
  goals: [
    { title: "Secure a strong internship", horizon: "year" },
    { title: "Understand the AI industry", horizon: "term" },
    { title: "Build relevant experience", horizon: "year" },
    { title: "Meet people working in AI", horizon: "term" },
    { title: "Graduate with a clear career path", horizon: "long_term" },
  ],
  skills: [
    { name: "Python", category: "technical", status: "current" },
    {
      name: "Machine learning fundamentals",
      category: "technical",
      status: "current",
    },
    { name: "Product discovery", category: "business", status: "target" },
    { name: "SQL", category: "technical", status: "target" },
  ],
  roadmap: null,
  recentActions: [],
  progress: { totalCompleted: 0, activeDaysLast7: 0 },
  memories: [],
  verifiedLinks: [],
};

/** A user who answered "not sure yet" to almost everything. */
export const exploringAdult: MentorContext = {
  today: "2026-09-23",
  profile: {
    firstName: null,
    userType: "exploring",
    location: null,
    relocation: "not_sure",
    preferredLocations: [],
    openToRemote: null,
    careerCertainty: "no_idea",
  },
  education: null,
  professional: null,
  venture: null,
  preferences: null,
  careerInterests: [],
  goals: [],
  skills: [],
  roadmap: null,
  recentActions: [],
  progress: { totalCompleted: 0, activeDaysLast7: 0 },
  memories: [],
  verifiedLinks: [],
};
