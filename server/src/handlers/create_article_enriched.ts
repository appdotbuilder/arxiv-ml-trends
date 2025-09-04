import { db } from '../db';
import { articlesEnrichedTable } from '../db/schema';
import { type CreateArticleEnrichedInput, type ArticleEnriched } from '../schema';

/**
 * Creates a new enriched article entry with LLM classification results.
 * Links to existing raw article data via arxiv_id.
 */
export async function createArticleEnriched(input: CreateArticleEnrichedInput): Promise<ArticleEnriched> {
  try {
    // Insert enriched article record
    const result = await db.insert(articlesEnrichedTable)
      .values({
        arxiv_id: input.arxiv_id,
        run_id: input.run_id,
        primary_category: input.primary_category as string,
        secondary_categories: input.secondary_categories as string[],
        potential_impact: input.potential_impact
      })
      .returning()
      .execute();

    // Convert the database result back to the expected schema type
    const dbResult = result[0];
    return {
      ...dbResult,
      primary_category: dbResult.primary_category as ArticleEnriched['primary_category'],
      secondary_categories: dbResult.secondary_categories as ArticleEnriched['secondary_categories']
    };
  } catch (error) {
    console.error('Enriched article creation failed:', error);
    throw error;
  }
}

/**
 * Bulk inserts multiple enriched articles for efficient processing.
 */
export async function createArticlesEnrichedBulk(inputs: CreateArticleEnrichedInput[]): Promise<ArticleEnriched[]> {
  try {
    if (inputs.length === 0) {
      return [];
    }

    // Perform bulk insert into articles_enriched table
    const values = inputs.map(input => ({
      arxiv_id: input.arxiv_id,
      run_id: input.run_id,
      primary_category: input.primary_category as string,
      secondary_categories: input.secondary_categories as string[],
      potential_impact: input.potential_impact
    }));

    const result = await db.insert(articlesEnrichedTable)
      .values(values)
      .returning()
      .execute();

    // Convert database results back to expected schema types
    return result.map(dbResult => ({
      ...dbResult,
      primary_category: dbResult.primary_category as ArticleEnriched['primary_category'],
      secondary_categories: dbResult.secondary_categories as ArticleEnriched['secondary_categories']
    }));
  } catch (error) {
    console.error('Bulk enriched articles creation failed:', error);
    throw error;
  }
}