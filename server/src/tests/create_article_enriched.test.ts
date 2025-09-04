import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { articlesRawTable, articlesEnrichedTable } from '../db/schema';
import { type CreateArticleEnrichedInput, type CreateArticleRawInput } from '../schema';
import { createArticleEnriched, createArticlesEnrichedBulk } from '../handlers/create_article_enriched';
import { eq } from 'drizzle-orm';

// Test input for creating a raw article (prerequisite)
const testRawArticle: CreateArticleRawInput = {
  arxiv_id: '2024.01234',
  title: 'Test Article',
  summary: 'A test article summary',
  authors: ['Test Author'],
  published: new Date('2024-01-01'),
  categories: ['cs.AI'],
  run_id: '550e8400-e29b-41d4-a716-446655440000'
};

// Test input for creating enriched article
const testEnrichedInput: CreateArticleEnrichedInput = {
  arxiv_id: '2024.01234',
  run_id: '550e8400-e29b-41d4-a716-446655440000',
  primary_category: 'Foundation Models',
  secondary_categories: ['LLM Fine-tuning', 'Multimodality'],
  potential_impact: 4
};

describe('createArticleEnriched', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create prerequisite raw article
  async function createRawArticle() {
    await db.insert(articlesRawTable)
      .values({
        arxiv_id: testRawArticle.arxiv_id,
        title: testRawArticle.title,
        summary: testRawArticle.summary,
        authors: testRawArticle.authors,
        published: testRawArticle.published,
        categories: testRawArticle.categories,
        run_id: testRawArticle.run_id
      })
      .execute();
  }

  it('should create an enriched article', async () => {
    // Create prerequisite raw article
    await createRawArticle();

    const result = await createArticleEnriched(testEnrichedInput);

    // Basic field validation
    expect(result.arxiv_id).toEqual('2024.01234');
    expect(result.run_id).toEqual('550e8400-e29b-41d4-a716-446655440000');
    expect(result.primary_category).toEqual('Foundation Models');
    expect(result.secondary_categories).toEqual(['LLM Fine-tuning', 'Multimodality']);
    expect(result.potential_impact).toEqual(4);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save enriched article to database', async () => {
    // Create prerequisite raw article
    await createRawArticle();

    const result = await createArticleEnriched(testEnrichedInput);

    // Query database to verify insertion
    const enrichedArticles = await db.select()
      .from(articlesEnrichedTable)
      .where(eq(articlesEnrichedTable.id, result.id))
      .execute();

    expect(enrichedArticles).toHaveLength(1);
    const enriched = enrichedArticles[0];
    expect(enriched.arxiv_id).toEqual('2024.01234');
    expect(enriched.primary_category).toEqual('Foundation Models');
    expect(enriched.secondary_categories).toEqual(['LLM Fine-tuning', 'Multimodality']);
    expect(enriched.potential_impact).toEqual(4);
    expect(enriched.created_at).toBeInstanceOf(Date);
  });

  it('should enforce foreign key constraint with raw article', async () => {
    // Try to create enriched article without raw article - should fail
    await expect(createArticleEnriched(testEnrichedInput))
      .rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should handle minimal secondary categories', async () => {
    // Create prerequisite raw article
    await createRawArticle();

    const inputWithMinimalCategories: CreateArticleEnrichedInput = {
      ...testEnrichedInput,
      secondary_categories: []
    };

    const result = await createArticleEnriched(inputWithMinimalCategories);
    expect(result.secondary_categories).toEqual([]);
  });

  it('should handle maximum impact score', async () => {
    // Create prerequisite raw article
    await createRawArticle();

    const inputWithMaxImpact: CreateArticleEnrichedInput = {
      ...testEnrichedInput,
      potential_impact: 5
    };

    const result = await createArticleEnriched(inputWithMaxImpact);
    expect(result.potential_impact).toEqual(5);
  });
});

describe('createArticlesEnrichedBulk', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create multiple prerequisite raw articles
  async function createMultipleRawArticles() {
    const rawArticles = [
      {
        ...testRawArticle,
        arxiv_id: '2024.01234'
      },
      {
        ...testRawArticle,
        arxiv_id: '2024.01235',
        title: 'Second Test Article'
      },
      {
        ...testRawArticle,
        arxiv_id: '2024.01236',
        title: 'Third Test Article'
      }
    ];

    await db.insert(articlesRawTable)
      .values(rawArticles)
      .execute();
  }

  it('should bulk create multiple enriched articles', async () => {
    // Create prerequisite raw articles
    await createMultipleRawArticles();

    const bulkInput: CreateArticleEnrichedInput[] = [
      {
        ...testEnrichedInput,
        arxiv_id: '2024.01234',
        primary_category: 'Foundation Models'
      },
      {
        ...testEnrichedInput,
        arxiv_id: '2024.01235',
        primary_category: 'LLM Fine-tuning'
      },
      {
        ...testEnrichedInput,
        arxiv_id: '2024.01236',
        primary_category: 'Multimodality'
      }
    ];

    const results = await createArticlesEnrichedBulk(bulkInput);

    expect(results).toHaveLength(3);
    expect(results[0].arxiv_id).toEqual('2024.01234');
    expect(results[0].primary_category).toEqual('Foundation Models');
    expect(results[1].arxiv_id).toEqual('2024.01235');
    expect(results[1].primary_category).toEqual('LLM Fine-tuning');
    expect(results[2].arxiv_id).toEqual('2024.01236');
    expect(results[2].primary_category).toEqual('Multimodality');

    // Verify all have IDs and timestamps
    results.forEach(result => {
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });
  });

  it('should save all bulk enriched articles to database', async () => {
    // Create prerequisite raw articles
    await createMultipleRawArticles();

    const bulkInput: CreateArticleEnrichedInput[] = [
      {
        ...testEnrichedInput,
        arxiv_id: '2024.01234'
      },
      {
        ...testEnrichedInput,
        arxiv_id: '2024.01235'
      }
    ];

    await createArticlesEnrichedBulk(bulkInput);

    // Query database to verify all insertions
    const enrichedArticles = await db.select()
      .from(articlesEnrichedTable)
      .execute();

    expect(enrichedArticles).toHaveLength(2);
    expect(enrichedArticles.map(a => a.arxiv_id).sort()).toEqual(['2024.01234', '2024.01235']);
  });

  it('should handle empty bulk input', async () => {
    const results = await createArticlesEnrichedBulk([]);
    expect(results).toHaveLength(0);
  });

  it('should enforce foreign key constraints in bulk operation', async () => {
    // Try to bulk create enriched articles without raw articles - should fail
    const bulkInput: CreateArticleEnrichedInput[] = [
      {
        ...testEnrichedInput,
        arxiv_id: 'nonexistent.01234'
      }
    ];

    await expect(createArticlesEnrichedBulk(bulkInput))
      .rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should handle mixed valid and invalid foreign keys correctly', async () => {
    // Create one valid raw article
    await db.insert(articlesRawTable)
      .values({
        ...testRawArticle,
        arxiv_id: '2024.01234'
      })
      .execute();

    // Mix of valid and invalid foreign keys should fail completely
    const bulkInput: CreateArticleEnrichedInput[] = [
      {
        ...testEnrichedInput,
        arxiv_id: '2024.01234' // Valid
      },
      {
        ...testEnrichedInput,
        arxiv_id: 'nonexistent.01235' // Invalid
      }
    ];

    await expect(createArticlesEnrichedBulk(bulkInput))
      .rejects.toThrow(/violates foreign key constraint/i);

    // Verify no records were inserted due to transaction rollback
    const enrichedArticles = await db.select()
      .from(articlesEnrichedTable)
      .execute();
    expect(enrichedArticles).toHaveLength(0);
  });
});