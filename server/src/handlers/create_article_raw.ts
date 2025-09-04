import { db } from '../db';
import { articlesRawTable } from '../db/schema';
import { type CreateArticleRawInput, type ArticleRaw } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Creates a new raw article entry in the database.
 * Handles deduplication based on arxiv_id.
 */
export async function createArticleRaw(input: CreateArticleRawInput): Promise<ArticleRaw> {
  try {
    // Try to insert the new article
    const result = await db.insert(articlesRawTable)
      .values({
        arxiv_id: input.arxiv_id,
        title: input.title,
        summary: input.summary,
        authors: input.authors,
        published: input.published,
        categories: input.categories,
        run_id: input.run_id
      })
      .onConflictDoNothing()
      .returning()
      .execute();

    // If insert was successful (no conflict), return the new record
    if (result.length > 0) {
      return result[0];
    }

    // If there was a conflict, fetch the existing record
    const existingArticle = await db.select()
      .from(articlesRawTable)
      .where(eq(articlesRawTable.arxiv_id, input.arxiv_id))
      .execute();

    if (existingArticle.length === 0) {
      throw new Error(`Failed to create or retrieve article with arxiv_id: ${input.arxiv_id}`);
    }

    return existingArticle[0];
  } catch (error) {
    console.error('Article creation failed:', error);
    throw error;
  }
}

/**
 * Bulk inserts multiple raw articles with deduplication.
 */
export async function createArticlesRawBulk(inputs: CreateArticleRawInput[]): Promise<ArticleRaw[]> {
  try {
    if (inputs.length === 0) {
      return [];
    }

    // Perform bulk insert with conflict resolution
    const insertedArticles = await db.insert(articlesRawTable)
      .values(inputs.map(input => ({
        arxiv_id: input.arxiv_id,
        title: input.title,
        summary: input.summary,
        authors: input.authors,
        published: input.published,
        categories: input.categories,
        run_id: input.run_id
      })))
      .onConflictDoNothing()
      .returning()
      .execute();

    // If some articles were skipped due to conflicts, we need to fetch them
    if (insertedArticles.length < inputs.length) {
      const insertedIds = new Set(insertedArticles.map(article => article.arxiv_id));
      const conflictedIds = inputs
        .map(input => input.arxiv_id)
        .filter(id => !insertedIds.has(id));

      // Fetch existing articles for the conflicted IDs
      const existingArticles = await db.select()
        .from(articlesRawTable)
        .where(eq(articlesRawTable.arxiv_id, conflictedIds[0])) // Start with first ID
        .execute();

      // For multiple IDs, we'd need to use an IN clause or multiple queries
      // For simplicity, let's fetch them one by one if needed
      const allExistingArticles: ArticleRaw[] = [];
      for (const conflictedId of conflictedIds) {
        const existing = await db.select()
          .from(articlesRawTable)
          .where(eq(articlesRawTable.arxiv_id, conflictedId))
          .execute();
        allExistingArticles.push(...existing);
      }

      return [...insertedArticles, ...allExistingArticles];
    }

    return insertedArticles;
  } catch (error) {
    console.error('Bulk article creation failed:', error);
    throw error;
  }
}