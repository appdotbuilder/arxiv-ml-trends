import { z } from 'zod';

// ArXiv article raw data schema
export const articleRawSchema = z.object({
  arxiv_id: z.string(),
  title: z.string(),
  summary: z.string(),
  authors: z.array(z.string()),
  published: z.coerce.date(),
  categories: z.array(z.string()),
  run_id: z.string().uuid(),
  created_at: z.coerce.date()
});

export type ArticleRaw = z.infer<typeof articleRawSchema>;

// Input schema for creating raw articles
export const createArticleRawInputSchema = z.object({
  arxiv_id: z.string(),
  title: z.string(),
  summary: z.string(),
  authors: z.array(z.string()),
  published: z.coerce.date(),
  categories: z.array(z.string()),
  run_id: z.string().uuid()
});

export type CreateArticleRawInput = z.infer<typeof createArticleRawInputSchema>;

// Primary category enum
export const primaryCategoryEnum = z.enum([
  "Foundation Models",
  "LLM Fine-tuning",
  "Parameter-Efficient Fine-tuning (PEFT)",
  "Retrieval-Augmented Generation (RAG)",
  "Model Quantization",
  "Agentic AI / AI Agents",
  "Multimodality",
  "Reinforcement Learning",
  "Computer Vision (Specific Techniques)",
  "Natural Language Processing (Specific Techniques)",
  "Ethical AI / AI Safety",
  "Efficient AI / AI Optimization",
  "Data-centric AI",
  "Other"
]);

export type PrimaryCategory = z.infer<typeof primaryCategoryEnum>;

// LLM classification result schema
export const llmClassificationSchema = z.object({
  primary_category: primaryCategoryEnum,
  secondary_categories: z.array(primaryCategoryEnum).max(2),
  potential_impact: z.number().int().min(1).max(5)
});

export type LlmClassification = z.infer<typeof llmClassificationSchema>;

// Enriched article schema
export const articleEnrichedSchema = z.object({
  id: z.number(),
  arxiv_id: z.string(),
  run_id: z.string().uuid(),
  primary_category: primaryCategoryEnum,
  secondary_categories: z.array(primaryCategoryEnum),
  potential_impact: z.number().int().min(1).max(5),
  created_at: z.coerce.date()
});

export type ArticleEnriched = z.infer<typeof articleEnrichedSchema>;

// Input schema for creating enriched articles
export const createArticleEnrichedInputSchema = z.object({
  arxiv_id: z.string(),
  run_id: z.string().uuid(),
  primary_category: primaryCategoryEnum,
  secondary_categories: z.array(primaryCategoryEnum).max(2),
  potential_impact: z.number().int().min(1).max(5)
});

export type CreateArticleEnrichedInput = z.infer<typeof createArticleEnrichedInputSchema>;

// Ingestion run result schema
export const ingestionRunResultSchema = z.object({
  run_id: z.string().uuid(),
  total_new: z.number().int().nonnegative(),
  topic_counts: z.record(z.string(), z.number().int().nonnegative())
});

export type IngestionRunResult = z.infer<typeof ingestionRunResultSchema>;

// Report generation schema
export const reportGenerationInputSchema = z.object({
  run_id: z.string().uuid(),
  preview_only: z.boolean().optional().default(false)
});

export type ReportGenerationInput = z.infer<typeof reportGenerationInputSchema>;

// Report result schema
export const reportResultSchema = z.object({
  subject: z.string(),
  body_markdown: z.string(),
  body_html: z.string(),
  emailed: z.boolean()
});

export type ReportResult = z.infer<typeof reportResultSchema>;

// Weekly report schema for database storage
export const weeklyReportSchema = z.object({
  id: z.number(),
  run_id: z.string().uuid(),
  subject: z.string(),
  body_markdown: z.string(),
  body_html: z.string(),
  emailed: z.boolean(),
  created_at: z.coerce.date()
});

export type WeeklyReport = z.infer<typeof weeklyReportSchema>;

// Input schema for creating weekly reports
export const createWeeklyReportInputSchema = z.object({
  run_id: z.string().uuid(),
  subject: z.string(),
  body_markdown: z.string(),
  body_html: z.string(),
  emailed: z.boolean()
});

export type CreateWeeklyReportInput = z.infer<typeof createWeeklyReportInputSchema>;

// Health check schema
export const healthCheckSchema = z.object({
  status: z.literal("ok")
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;

// Topic count aggregation schema
export const topicCountSchema = z.object({
  primary_category: primaryCategoryEnum,
  count: z.number().int().nonnegative(),
  representative_papers: z.array(z.object({
    arxiv_id: z.string(),
    title: z.string(),
    summary: z.string(),
    authors: z.array(z.string()),
    published: z.coerce.date(),
    potential_impact: z.number().int().min(1).max(5)
  }))
});

export type TopicCount = z.infer<typeof topicCountSchema>;

// Latest report response schema
export const latestReportResponseSchema = z.object({
  subject: z.string(),
  body_html: z.string(),
  created_at: z.coerce.date()
});

export type LatestReportResponse = z.infer<typeof latestReportResponseSchema>;