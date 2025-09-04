import { serial, text, pgTable, timestamp, integer, jsonb, boolean, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Articles raw table - stores fetched arXiv papers
export const articlesRawTable = pgTable('articles_raw', {
  arxiv_id: text('arxiv_id').primaryKey(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  authors: jsonb('authors').$type<string[]>().notNull(),
  published: timestamp('published').notNull(),
  categories: jsonb('categories').$type<string[]>().notNull(),
  run_id: uuid('run_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Articles enriched table - stores LLM classification results
export const articlesEnrichedTable = pgTable('articles_enriched', {
  id: serial('id').primaryKey(),
  arxiv_id: text('arxiv_id').notNull().references(() => articlesRawTable.arxiv_id),
  run_id: uuid('run_id').notNull(),
  primary_category: text('primary_category').notNull(),
  secondary_categories: jsonb('secondary_categories').$type<string[]>().notNull(),
  potential_impact: integer('potential_impact').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Weekly reports table - stores generated trend reports
export const weeklyReportsTable = pgTable('weekly_reports', {
  id: serial('id').primaryKey(),
  run_id: uuid('run_id').notNull(),
  subject: text('subject').notNull(),
  body_markdown: text('body_markdown').notNull(),
  body_html: text('body_html').notNull(),
  emailed: boolean('emailed').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const articlesRawRelations = relations(articlesRawTable, ({ many }) => ({
  enrichedData: many(articlesEnrichedTable)
}));

export const articlesEnrichedRelations = relations(articlesEnrichedTable, ({ one }) => ({
  rawData: one(articlesRawTable, {
    fields: [articlesEnrichedTable.arxiv_id],
    references: [articlesRawTable.arxiv_id]
  })
}));

// TypeScript types for the table schemas
export type ArticleRaw = typeof articlesRawTable.$inferSelect;
export type NewArticleRaw = typeof articlesRawTable.$inferInsert;

export type ArticleEnriched = typeof articlesEnrichedTable.$inferSelect;
export type NewArticleEnriched = typeof articlesEnrichedTable.$inferInsert;

export type WeeklyReport = typeof weeklyReportsTable.$inferSelect;
export type NewWeeklyReport = typeof weeklyReportsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  articlesRaw: articlesRawTable,
  articlesEnriched: articlesEnrichedTable,
  weeklyReports: weeklyReportsTable
};

export const tableRelations = {
  articlesRawRelations,
  articlesEnrichedRelations
};