import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { articlesRawTable } from '../db/schema';
import { type CreateArticleRawInput } from '../schema';
import { createArticleRaw, createArticlesRawBulk } from '../handlers/create_article_raw';
import { eq } from 'drizzle-orm';

// Test input data
const testInput: CreateArticleRawInput = {
  arxiv_id: '2024.12345v1',
  title: 'Test Article: Advanced Machine Learning Techniques',
  summary: 'This paper presents novel approaches to machine learning that improve accuracy and efficiency.',
  authors: ['John Doe', 'Jane Smith', 'Bob Johnson'],
  published: new Date('2024-01-15T10:30:00Z'),
  categories: ['cs.LG', 'cs.AI', 'stat.ML'],
  run_id: '123e4567-e89b-12d3-a456-426614174000'
};

const testInput2: CreateArticleRawInput = {
  arxiv_id: '2024.67890v1',
  title: 'Another Test Article: Deep Learning Advances',
  summary: 'Exploring new architectures for deep neural networks with improved performance.',
  authors: ['Alice Cooper', 'Charlie Brown'],
  published: new Date('2024-01-16T14:20:00Z'),
  categories: ['cs.LG', 'cs.CV'],
  run_id: '456e7890-e12b-34d5-a678-901234567890'
};

describe('createArticleRaw', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a new article', async () => {
    const result = await createArticleRaw(testInput);

    // Verify all fields are correctly set
    expect(result.arxiv_id).toEqual(testInput.arxiv_id);
    expect(result.title).toEqual(testInput.title);
    expect(result.summary).toEqual(testInput.summary);
    expect(result.authors).toEqual(testInput.authors);
    expect(result.published).toBeInstanceOf(Date);
    expect(result.published.getTime()).toEqual(testInput.published.getTime());
    expect(result.categories).toEqual(testInput.categories);
    expect(result.run_id).toEqual(testInput.run_id);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save article to database', async () => {
    const result = await createArticleRaw(testInput);

    // Query the database to verify the article was saved
    const articles = await db.select()
      .from(articlesRawTable)
      .where(eq(articlesRawTable.arxiv_id, testInput.arxiv_id))
      .execute();

    expect(articles).toHaveLength(1);
    expect(articles[0].arxiv_id).toEqual(testInput.arxiv_id);
    expect(articles[0].title).toEqual(testInput.title);
    expect(articles[0].summary).toEqual(testInput.summary);
    expect(articles[0].authors).toEqual(testInput.authors);
    expect(articles[0].categories).toEqual(testInput.categories);
    expect(articles[0].run_id).toEqual(testInput.run_id);
    expect(articles[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle duplicate arxiv_id gracefully', async () => {
    // Create the article first time
    const firstResult = await createArticleRaw(testInput);
    expect(firstResult.arxiv_id).toEqual(testInput.arxiv_id);

    // Try to create the same article again with different data
    const duplicateInput: CreateArticleRawInput = {
      ...testInput,
      title: 'Different Title',
      summary: 'Different summary',
      run_id: '999e9999-e99b-99d9-a999-999999999999'
    };

    const secondResult = await createArticleRaw(duplicateInput);

    // Should return the existing article, not create a new one
    expect(secondResult.arxiv_id).toEqual(testInput.arxiv_id);
    expect(secondResult.title).toEqual(testInput.title); // Original title, not the duplicate's
    expect(secondResult.summary).toEqual(testInput.summary); // Original summary
    expect(secondResult.run_id).toEqual(testInput.run_id); // Original run_id

    // Verify only one record exists in database
    const articles = await db.select()
      .from(articlesRawTable)
      .where(eq(articlesRawTable.arxiv_id, testInput.arxiv_id))
      .execute();

    expect(articles).toHaveLength(1);
  });

  it('should handle JSON array fields correctly', async () => {
    const complexInput: CreateArticleRawInput = {
      arxiv_id: '2024.complex1',
      title: 'Complex Article with Multiple Authors and Categories',
      summary: 'A comprehensive study with extensive metadata.',
      authors: ['Author One', 'Author Two', 'Author Three', 'Author Four'],
      published: new Date('2024-02-01T09:15:00Z'),
      categories: ['cs.LG', 'cs.AI', 'cs.CV', 'stat.ML', 'math.OC'],
      run_id: '111e1111-e11b-11d1-a111-111111111111'
    };

    const result = await createArticleRaw(complexInput);

    expect(result.authors).toHaveLength(4);
    expect(result.authors).toEqual(['Author One', 'Author Two', 'Author Three', 'Author Four']);
    expect(result.categories).toHaveLength(5);
    expect(result.categories).toEqual(['cs.LG', 'cs.AI', 'cs.CV', 'stat.ML', 'math.OC']);

    // Verify in database
    const articles = await db.select()
      .from(articlesRawTable)
      .where(eq(articlesRawTable.arxiv_id, complexInput.arxiv_id))
      .execute();

    expect(articles[0].authors).toEqual(complexInput.authors);
    expect(articles[0].categories).toEqual(complexInput.categories);
  });
});

describe('createArticlesRawBulk', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create multiple articles in bulk', async () => {
    const inputs = [testInput, testInput2];
    const results = await createArticlesRawBulk(inputs);

    expect(results).toHaveLength(2);
    
    // Check first article
    const first = results.find(r => r.arxiv_id === testInput.arxiv_id);
    expect(first).toBeDefined();
    expect(first!.title).toEqual(testInput.title);
    expect(first!.authors).toEqual(testInput.authors);

    // Check second article
    const second = results.find(r => r.arxiv_id === testInput2.arxiv_id);
    expect(second).toBeDefined();
    expect(second!.title).toEqual(testInput2.title);
    expect(second!.authors).toEqual(testInput2.authors);
  });

  it('should handle empty input array', async () => {
    const results = await createArticlesRawBulk([]);
    expect(results).toHaveLength(0);
  });

  it('should handle bulk insert with some duplicates', async () => {
    // First, create one article
    await createArticleRaw(testInput);

    // Now try to bulk insert including the existing article and a new one
    const inputs = [testInput, testInput2];
    const results = await createArticlesRawBulk(inputs);

    expect(results).toHaveLength(2);

    // Verify both articles exist in database
    const allArticles = await db.select()
      .from(articlesRawTable)
      .execute();

    expect(allArticles).toHaveLength(2);
    
    const arxivIds = allArticles.map(a => a.arxiv_id);
    expect(arxivIds).toContain(testInput.arxiv_id);
    expect(arxivIds).toContain(testInput2.arxiv_id);
  });

  it('should handle bulk insert with all duplicates', async () => {
    // First, create both articles individually
    await createArticleRaw(testInput);
    await createArticleRaw(testInput2);

    // Try to bulk insert the same articles again
    const inputs = [testInput, testInput2];
    const results = await createArticlesRawBulk(inputs);

    expect(results).toHaveLength(2);

    // Verify still only 2 articles in database
    const allArticles = await db.select()
      .from(articlesRawTable)
      .execute();

    expect(allArticles).toHaveLength(2);
  });

  it('should preserve article data integrity during bulk operations', async () => {
    const bulkInputs: CreateArticleRawInput[] = [
      {
        arxiv_id: '2024.bulk1',
        title: 'Bulk Article 1',
        summary: 'First bulk article summary',
        authors: ['Bulk Author 1'],
        published: new Date('2024-03-01T10:00:00Z'),
        categories: ['cs.LG'],
        run_id: '222e2222-e22b-22d2-a222-222222222222'
      },
      {
        arxiv_id: '2024.bulk2',
        title: 'Bulk Article 2',
        summary: 'Second bulk article summary',
        authors: ['Bulk Author 2', 'Co-Author 2'],
        published: new Date('2024-03-02T11:00:00Z'),
        categories: ['cs.AI', 'cs.CV'],
        run_id: '333e3333-e33b-33d3-a333-333333333333'
      }
    ];

    const results = await createArticlesRawBulk(bulkInputs);

    // Verify each article maintains its integrity
    for (const input of bulkInputs) {
      const result = results.find(r => r.arxiv_id === input.arxiv_id);
      expect(result).toBeDefined();
      expect(result!.title).toEqual(input.title);
      expect(result!.summary).toEqual(input.summary);
      expect(result!.authors).toEqual(input.authors);
      expect(result!.categories).toEqual(input.categories);
      expect(result!.run_id).toEqual(input.run_id);
      expect(result!.created_at).toBeInstanceOf(Date);
    }
  });
});