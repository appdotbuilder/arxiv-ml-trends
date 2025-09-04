import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { articlesRawTable, articlesEnrichedTable } from '../db/schema';
import { type CreateArticleRawInput, type CreateArticleEnrichedInput } from '../schema';
import { getTopicAggregations, getTopicCounts } from '../handlers/get_topic_aggregations';

// Test data
const testRunId = '123e4567-e89b-12d3-a456-426614174000';
const testRunId2 = '223e4567-e89b-12d3-a456-426614174000';

const rawArticle1: CreateArticleRawInput = {
  arxiv_id: '2024.01001',
  title: 'Foundation Model Advances',
  summary: 'A comprehensive study of foundation model architectures.',
  authors: ['Alice Smith', 'Bob Jones'],
  published: new Date('2024-01-15'),
  categories: ['cs.LG', 'cs.AI'],
  run_id: testRunId
};

const rawArticle2: CreateArticleRawInput = {
  arxiv_id: '2024.01002',
  title: 'RAG System Improvements',
  summary: 'Novel approaches to retrieval-augmented generation.',
  authors: ['Carol Wilson'],
  published: new Date('2024-01-16'),
  categories: ['cs.CL', 'cs.IR'],
  run_id: testRunId
};

const rawArticle3: CreateArticleRawInput = {
  arxiv_id: '2024.01003',
  title: 'Another Foundation Model',
  summary: 'More foundation model research.',
  authors: ['Dave Brown'],
  published: new Date('2024-01-14'),
  categories: ['cs.LG'],
  run_id: testRunId
};

const rawArticle4: CreateArticleRawInput = {
  arxiv_id: '2024.01004',
  title: 'Different Run Article',
  summary: 'Article from different run.',
  authors: ['Eve Davis'],
  published: new Date('2024-01-17'),
  categories: ['cs.AI'],
  run_id: testRunId2
};

const enrichedArticle1: CreateArticleEnrichedInput = {
  arxiv_id: '2024.01001',
  run_id: testRunId,
  primary_category: 'Foundation Models',
  secondary_categories: ['Efficient AI / AI Optimization'],
  potential_impact: 5
};

const enrichedArticle2: CreateArticleEnrichedInput = {
  arxiv_id: '2024.01002',
  run_id: testRunId,
  primary_category: 'Retrieval-Augmented Generation (RAG)',
  secondary_categories: ['Natural Language Processing (Specific Techniques)'],
  potential_impact: 4
};

const enrichedArticle3: CreateArticleEnrichedInput = {
  arxiv_id: '2024.01003',
  run_id: testRunId,
  primary_category: 'Foundation Models',
  secondary_categories: [],
  potential_impact: 3
};

const enrichedArticle4: CreateArticleEnrichedInput = {
  arxiv_id: '2024.01004',
  run_id: testRunId2,
  primary_category: 'Other',
  secondary_categories: [],
  potential_impact: 2
};

describe('getTopicAggregations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for non-existent run_id', async () => {
    const result = await getTopicAggregations('00000000-0000-0000-0000-000000000000');
    expect(result).toEqual([]);
  });

  it('should aggregate topics correctly with representative papers', async () => {
    // Insert test data
    await db.insert(articlesRawTable).values([rawArticle1, rawArticle2, rawArticle3]);
    await db.insert(articlesEnrichedTable).values([enrichedArticle1, enrichedArticle2, enrichedArticle3]);

    const result = await getTopicAggregations(testRunId);

    expect(result).toHaveLength(2);

    // Should be sorted by count (descending)
    const foundationModels = result[0];
    const ragTopic = result[1];

    expect(foundationModels.primary_category).toBe('Foundation Models');
    expect(foundationModels.count).toBe(2);
    expect(foundationModels.representative_papers).toHaveLength(2);

    expect(ragTopic.primary_category).toBe('Retrieval-Augmented Generation (RAG)');
    expect(ragTopic.count).toBe(1);
    expect(ragTopic.representative_papers).toHaveLength(1);
  });

  it('should order representative papers by impact and recency', async () => {
    // Insert test data
    await db.insert(articlesRawTable).values([rawArticle1, rawArticle3]);
    await db.insert(articlesEnrichedTable).values([enrichedArticle1, enrichedArticle3]);

    const result = await getTopicAggregations(testRunId);

    expect(result).toHaveLength(1);
    const foundationModels = result[0];
    
    // First paper should have higher impact (5 vs 3)
    expect(foundationModels.representative_papers[0].potential_impact).toBe(5);
    expect(foundationModels.representative_papers[0].arxiv_id).toBe('2024.01001');
    
    // Second paper should have lower impact
    expect(foundationModels.representative_papers[1].potential_impact).toBe(3);
    expect(foundationModels.representative_papers[1].arxiv_id).toBe('2024.01003');
  });

  it('should include all required fields in representative papers', async () => {
    // Insert test data
    await db.insert(articlesRawTable).values([rawArticle1]);
    await db.insert(articlesEnrichedTable).values([enrichedArticle1]);

    const result = await getTopicAggregations(testRunId);

    expect(result).toHaveLength(1);
    const paper = result[0].representative_papers[0];

    expect(paper.arxiv_id).toBe('2024.01001');
    expect(paper.title).toBe('Foundation Model Advances');
    expect(paper.summary).toBe('A comprehensive study of foundation model architectures.');
    expect(paper.authors).toEqual(['Alice Smith', 'Bob Jones']);
    expect(paper.published).toBeInstanceOf(Date);
    expect(paper.potential_impact).toBe(5);
    expect(typeof paper.potential_impact).toBe('number');
  });

  it('should filter by run_id correctly', async () => {
    // Insert data for two different runs
    await db.insert(articlesRawTable).values([rawArticle1, rawArticle4]);
    await db.insert(articlesEnrichedTable).values([enrichedArticle1, enrichedArticle4]);

    const result1 = await getTopicAggregations(testRunId);
    const result2 = await getTopicAggregations(testRunId2);

    expect(result1).toHaveLength(1);
    expect(result1[0].primary_category).toBe('Foundation Models');
    expect(result1[0].count).toBe(1);

    expect(result2).toHaveLength(1);
    expect(result2[0].primary_category).toBe('Other');
    expect(result2[0].count).toBe(1);
  });

  it('should limit representative papers to 3', async () => {
    // Create 5 articles in same category
    const manyArticles = [];
    const manyEnriched = [];
    
    for (let i = 1; i <= 5; i++) {
      manyArticles.push({
        arxiv_id: `2024.0100${i}`,
        title: `Foundation Model ${i}`,
        summary: `Summary ${i}`,
        authors: [`Author ${i}`],
        published: new Date(`2024-01-${10 + i}`),
        categories: ['cs.LG'],
        run_id: testRunId
      });
      
      manyEnriched.push({
        arxiv_id: `2024.0100${i}`,
        run_id: testRunId,
        primary_category: 'Foundation Models',
        secondary_categories: [],
        potential_impact: 6 - i // Decreasing impact: 5, 4, 3, 2, 1
      });
    }

    await db.insert(articlesRawTable).values(manyArticles);
    await db.insert(articlesEnrichedTable).values(manyEnriched);

    const result = await getTopicAggregations(testRunId);

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(5);
    expect(result[0].representative_papers).toHaveLength(3);

    // Should be the 3 highest impact papers
    expect(result[0].representative_papers[0].potential_impact).toBe(5);
    expect(result[0].representative_papers[1].potential_impact).toBe(4);
    expect(result[0].representative_papers[2].potential_impact).toBe(3);
  });
});

describe('getTopicCounts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty object for non-existent run_id', async () => {
    const result = await getTopicCounts('00000000-0000-0000-0000-000000000000');
    expect(result).toEqual({});
  });

  it('should return correct topic counts', async () => {
    // Insert test data
    await db.insert(articlesRawTable).values([rawArticle1, rawArticle2, rawArticle3]);
    await db.insert(articlesEnrichedTable).values([enrichedArticle1, enrichedArticle2, enrichedArticle3]);

    const result = await getTopicCounts(testRunId);

    expect(result).toEqual({
      'Foundation Models': 2,
      'Retrieval-Augmented Generation (RAG)': 1
    });
  });

  it('should filter by run_id correctly', async () => {
    // Insert data for two different runs
    await db.insert(articlesRawTable).values([rawArticle1, rawArticle4]);
    await db.insert(articlesEnrichedTable).values([enrichedArticle1, enrichedArticle4]);

    const result1 = await getTopicCounts(testRunId);
    const result2 = await getTopicCounts(testRunId2);

    expect(result1).toEqual({
      'Foundation Models': 1
    });

    expect(result2).toEqual({
      'Other': 1
    });
  });

  it('should handle single topic correctly', async () => {
    // Insert single article
    await db.insert(articlesRawTable).values([rawArticle1]);
    await db.insert(articlesEnrichedTable).values([enrichedArticle1]);

    const result = await getTopicCounts(testRunId);

    expect(result).toEqual({
      'Foundation Models': 1
    });
  });

  it('should return numbers as count values', async () => {
    // Insert test data
    await db.insert(articlesRawTable).values([rawArticle1, rawArticle2]);
    await db.insert(articlesEnrichedTable).values([enrichedArticle1, enrichedArticle2]);

    const result = await getTopicCounts(testRunId);

    Object.values(result).forEach(count => {
      expect(typeof count).toBe('number');
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});