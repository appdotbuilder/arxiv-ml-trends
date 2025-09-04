import { db } from '../db';
import { articlesEnrichedTable, articlesRawTable } from '../db/schema';
import { type TopicCount } from '../schema';
import { eq, desc, and, sql } from 'drizzle-orm';

/**
 * Aggregates paper counts by primary topic for a specific run_id.
 * Selects representative papers for each topic based on impact and recency.
 */
export async function getTopicAggregations(runId: string): Promise<TopicCount[]> {
  try {
    // First, get all enriched articles for this run with their raw data
    const enrichedArticles = await db.select()
      .from(articlesEnrichedTable)
      .innerJoin(articlesRawTable, eq(articlesEnrichedTable.arxiv_id, articlesRawTable.arxiv_id))
      .where(eq(articlesEnrichedTable.run_id, runId))
      .orderBy(desc(articlesEnrichedTable.potential_impact), desc(articlesRawTable.published))
      .execute();

    // Group articles by primary category
    const topicGroups = new Map<string, typeof enrichedArticles>();
    
    for (const article of enrichedArticles) {
      const category = article.articles_enriched.primary_category;
      if (!topicGroups.has(category)) {
        topicGroups.set(category, []);
      }
      topicGroups.get(category)!.push(article);
    }

    // Build topic aggregations with representative papers
    const topicCounts: TopicCount[] = [];
    
    for (const [category, articles] of topicGroups.entries()) {
      // Take up to 3 representative papers (highest impact and most recent)
      const representativePapers = articles.slice(0, 3).map(article => ({
        arxiv_id: article.articles_raw.arxiv_id,
        title: article.articles_raw.title,
        summary: article.articles_raw.summary,
        authors: article.articles_raw.authors as string[],
        published: article.articles_raw.published,
        potential_impact: article.articles_enriched.potential_impact
      }));

      topicCounts.push({
        primary_category: category as any, // Type assertion since we know it's a valid enum value
        count: articles.length,
        representative_papers: representativePapers
      });
    }

    // Sort by count (descending) for consistent ordering
    return topicCounts.sort((a, b) => b.count - a.count);
    
  } catch (error) {
    console.error('Topic aggregations query failed:', error);
    throw error;
  }
}

/**
 * Gets topic counts as a simple record for API responses.
 */
export async function getTopicCounts(runId: string): Promise<Record<string, number>> {
  try {
    // Use SQL aggregation for efficient counting
    const results = await db.select({
      primary_category: articlesEnrichedTable.primary_category,
      count: sql<number>`cast(count(*) as int)`
    })
      .from(articlesEnrichedTable)
      .where(eq(articlesEnrichedTable.run_id, runId))
      .groupBy(articlesEnrichedTable.primary_category)
      .execute();

    // Convert to record format
    const topicCounts: Record<string, number> = {};
    for (const result of results) {
      topicCounts[result.primary_category] = result.count;
    }

    return topicCounts;
    
  } catch (error) {
    console.error('Topic counts query failed:', error);
    throw error;
  }
}