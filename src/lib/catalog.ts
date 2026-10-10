/**
 * Marketing copy for the landing page. Exam configuration (question counts,
 * timing, free limit) lives in the database; slugs must match.
 */
export interface CatalogEntry {
  slug: string;
  examCode: string;
  name: string;
  shortName: string;
  level: string;
  description: string;
  domains: string[];
}

export const CATALOG: CatalogEntry[] = [
  {
    slug: "saa-c03",
    examCode: "SAA-C03",
    name: "AWS Certified Solutions Architect – Associate",
    shortName: "Solutions Architect – Associate",
    level: "Associate",
    description:
      "Prepare for the AWS Solutions Architect – Associate certification through scenario-based practice questions.",
    domains: [
      "Secure architectures",
      "Resilient architectures",
      "High-performing architectures",
      "Cost-optimized architectures",
    ],
  },
  {
    slug: "aif-c01",
    examCode: "AIF-C01",
    name: "AWS Certified AI Practitioner",
    shortName: "AI Practitioner",
    level: "Foundational",
    description:
      "Build confidence in AWS AI, machine learning, generative AI, foundation models, and responsible AI concepts.",
    domains: [
      "AI and ML fundamentals",
      "Generative AI fundamentals",
      "Applications of foundation models",
      "Responsible AI, security and governance",
    ],
  },
];

export const FREE_QUESTIONS_PER_CERT = 20;

export const BRAND = "Cloud Certification Simulator";

export const DISCLAIMER =
  "Cloud Certification Simulator is an independent practice platform. It is not affiliated with, endorsed by, or sponsored by any cloud provider or certification body, including Amazon Web Services, Inc. and its affiliates. AWS and related marks are trademarks of Amazon.com, Inc. or its affiliates. Practice questions are original and are not actual exam questions.";

/**
 * Shown only when the plans table can't be read (e.g. before the database is
 * set up). Deliberately has no prices — prices come from the database.
 */
export const FALLBACK_PLANS = [
  {
    id: "free",
    name: "Free",
    description: "Try both simulators before you subscribe.",
    billing_interval: "none" as const,
    amount_cents: 0,
    currency: "usd",
    stripe_price_id: null,
    features: ["20 practice questions per certification", "Answers and explanations", "Learning Mode"],
    is_active: true,
    sort_order: 1,
  },
  {
    id: "premium_monthly",
    name: "Monthly Premium",
    description: "Full simulator access, billed monthly.",
    billing_interval: "month" as const,
    amount_cents: null,
    currency: "usd",
    stripe_price_id: null,
    features: ["Full question bank for both certifications", "Timed mock exams", "Progress and topic analytics"],
    is_active: true,
    sort_order: 2,
  },
  {
    id: "premium_annual",
    name: "Annual Premium",
    description: "Full simulator access, billed once a year.",
    billing_interval: "year" as const,
    amount_cents: null,
    currency: "usd",
    stripe_price_id: null,
    features: ["Everything in Monthly Premium", "One payment per year"],
    is_active: true,
    sort_order: 3,
  },
];
