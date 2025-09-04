import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { articlesRawTable, articlesEnrichedTable } from '../db/schema';
import { ingestPapers } from '../handlers/ingest_papers';
import { eq } from 'drizzle-orm';

describe('ingestPapers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully ingest new papers', async () => {
    const result = await ingestPapers();

    // Verify basic result structure
    expect(result.run_id).toBeDefined();
    expect(typeof result.run_id).toBe('string');
    expect(result.total_new).toBeGreaterThanOrEqual(0);
    expect(typeof result.topic_counts).toBe('object');
    
    // Verify run_id is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(result.run_id)).toBe(true);
  });

  it('should store raw articles in database', async () => {
    const result = await ingestPapers();

    // Check that raw articles were stored
    const rawArticles = await db.select()
      .from(articlesRawTable)
      .where(eq(articlesRawTable.run_id, result.run_id))
      .execute();

    expect(rawArticles.length).toBe(result.total_new);

    // Verify structure of stored raw articles
    if (rawArticles.length > 0) {
      const firstArticle = rawArticles[0];
      expect(firstArticle.arxiv_id).toBeDefined();
      expect(firstArticle.title).toBeDefined();
      expect(firstArticle.summary).toBeDefined();
      expect(Array.isArray(firstArticle.authors)).toBe(true);
      expect(firstArticle.published).toBeInstanceOf(Date);
      expect(Array.isArray(firstArticle.categories)).toBe(true);
      expect(firstArticle.run_id).toBe(result.run_id);
      expect(firstArticle.created_at).toBeInstanceOf(Date);
    }
  });

  it('should store enriched articles with classifications', async () => {
    const result = await ingestPapers();

    // Check that enriched articles were stored
    const enrichedArticles = await db.select()
      .from(articlesEnrichedTable)
      .where(eq(articlesEnrichedTable.run_id, result.run_id))
      .execute();

    expect(enrichedArticles.length).toBe(result.total_new);

    // Verify structure of enriched articles
    if (enrichedArticles.length > 0) {
      const firstEnriched = enrichedArticles[0];
      expect(firstEnriched.id).toBeDefined();
      expect(firstEnriched.arxiv_id).toBeDefined();
      expect(firstEnriched.primary_category).toBeDefined();
      expect(Array.isArray(firstEnriched.secondary_categories)).toBe(true);
      expect(firstEnriched.potential_impact).toBeGreaterThanOrEqual(1);
      expect(firstEnriched.potential_impact).toBeLessThanOrEqual(5);
      expect(firstEnriched.run_id).toBe(result.run_id);
      expect(firstEnriched.created_at).toBeInstanceOf(Date);
    }
  });

  it('should maintain referential integrity between raw and enriched articles', async () => {
    const result = await ingestPapers();

    if (result.total_new > 0) {
      // Get all raw articles from this run
      const rawArticles = await db.select()
        .from(articlesRawTable)
        .where(eq(articlesRawTable.run_id, result.run_id))
        .execute();

      // Get all enriched articles from this run
      const enrichedArticles = await db.select()
        .from(articlesEnrichedTable)
        .where(eq(articlesEnrichedTable.run_id, result.run_id))
        .execute();

      // Each enriched article should have a corresponding raw article
      const rawArxivIds = new Set(rawArticles.map(a => a.arxiv_id));
      const enrichedArxivIds = new Set(enrichedArticles.map(a => a.arxiv_id));

      expect(enrichedArxivIds.size).toBe(rawArxivIds.size);
      enrichedArxivIds.forEach(id => {
        expect(rawArxivIds.has(id)).toBe(true);
      });
    }
  });

  it('should generate accurate topic counts', async () => {
    const result = await ingestPapers();

    // Verify topic counts match enriched articles
    const enrichedArticles = await db.select()
      .from(articlesEnrichedTable)
      .where(eq(articlesEnrichedTable.run_id, result.run_id))
      .execute();

    // Count primary categories manually
    const manualCounts: Record<string, number> = {};
    enrichedArticles.forEach(article => {
      const category = article.primary_category;
      manualCounts[category] = (manualCounts[category] || 0) + 1;
    });

    // Compare with returned topic counts
    expect(result.topic_counts).toEqual(manualCounts);

    // Verify total matches
    const totalFromCounts = Object.values(result.topic_counts).reduce((sum, count) => sum + count, 0);
    expect(totalFromCounts).toBe(result.total_new);
  });

  it('should handle deduplication correctly', async () => {
    // Run ingestion twice
    const firstResult = await ingestPapers();
    const secondResult = await ingestPapers();

    // Second run should find no new papers (deduplication working)
    expect(secondResult.total_new).toBe(0);
    expect(Object.keys(secondResult.topic_counts)).toHaveLength(0);

    // Verify total papers in database matches first run only
    const totalRawArticles = await db.select()
      .from(articlesRawTable)
      .execute();

    const totalEnrichedArticles = await db.select()
      .from(articlesEnrichedTable)
      .execute();

    expect(totalRawArticles.length).toBe(firstResult.total_new);
    expect(totalEnrichedArticles.length).toBe(firstResult.total_new);
  });

  it('should handle empty results gracefully', async () => {
    // First, ingest papers to fill database
    await ingestPapers();

    // Second ingestion should handle no new papers
    const result = await ingestPapers();

    expect(result.run_id).toBeDefined();
    expect(result.total_new).toBe(0);
    expect(result.topic_counts).toEqual({});
  });

  it('should assign valid primary categories', async () => {
    const result = await ingestPapers();

    if (result.total_new > 0) {
      const enrichedArticles = await db.select()
        .from(articlesEnrichedTable)
        .where(eq(articlesEnrichedTable.run_id, result.run_id))
        .execute();

      // Valid primary categories from schema
      const validCategories = [
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
      ];

      enrichedArticles.forEach(article => {
        expect(validCategories).toContain(article.primary_category);
        
        // Secondary categories should also be valid and not exceed 2
        expect(article.secondary_categories.length).toBeLessThanOrEqual(2);
        article.secondary_categories.forEach(category => {
          expect(validCategories).toContain(category);
        });
      });
    }
  });

  it('should assign valid potential impact scores', async () => {
    const result = await ingestPapers();

    if (result.total_new > 0) {
      const enrichedArticles = await db.select()
        .from(articlesEnrichedTable)
        .where(eq(articlesEnrichedTable.run_id, result.run_id))
        .execute();

      enrichedArticles.forEach(article => {
        expect(article.potential_impact).toBeGreaterThanOrEqual(1);
        expect(article.potential_impact).toBeLessThanOrEqual(5);
        expect(Number.isInteger(article.potential_impact)).toBe(true);
      });
    }
  });

  it('should store proper date formats', async () => {
    const result = await ingestPapers();

    if (result.total_new > 0) {
      const rawArticles = await db.select()
        .from(articlesRawTable)
        .where(eq(articlesRawTable.run_id, result.run_id))
        .execute();

      rawArticles.forEach(article => {
        expect(article.published).toBeInstanceOf(Date);
        expect(article.created_at).toBeInstanceOf(Date);
        expect(article.created_at.getTime()).toBeGreaterThan(Date.now() - 60000); // Within last minute
      });
    }
  });
});