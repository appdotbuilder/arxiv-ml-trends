import { describe, expect, it } from 'bun:test';
import { generateEmbeddings, upsertToLanceDB } from '../handlers/generate_embeddings';

describe('generateEmbeddings', () => {
  it('should generate embedding vector for valid text input', async () => {
    const text = 'This is a test paper about machine learning and neural networks.';
    
    const result = await generateEmbeddings(text);
    
    // Verify basic properties
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1536); // OpenAI embedding dimension
    
    // Verify all values are valid numbers
    result.forEach(val => {
      expect(typeof val).toBe('number');
      expect(isNaN(val)).toBe(false);
      expect(isFinite(val)).toBe(true);
    });
    
    // Verify vector is normalized (magnitude should be close to 1)
    const magnitude = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0));
    expect(magnitude).toBeCloseTo(1.0, 10);
  });

  it('should generate deterministic embeddings for same text', async () => {
    const text = 'Consistent text for deterministic testing';
    
    const result1 = await generateEmbeddings(text);
    const result2 = await generateEmbeddings(text);
    
    expect(result1).toEqual(result2);
  });

  it('should generate different embeddings for different text', async () => {
    const text1 = 'First text about computer vision';
    const text2 = 'Second text about natural language processing';
    
    const result1 = await generateEmbeddings(text1);
    const result2 = await generateEmbeddings(text2);
    
    // Vectors should be different
    expect(result1).not.toEqual(result2);
    
    // But should have same dimensions
    expect(result1.length).toBe(result2.length);
  });

  it('should handle long text by truncation', async () => {
    // Generate very long text (over 8000 characters)
    const longText = 'A'.repeat(10000);
    
    const result = await generateEmbeddings(longText);
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1536);
    
    // Should still generate valid normalized vector
    const magnitude = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0));
    expect(magnitude).toBeCloseTo(1.0, 10);
  });

  it('should reject empty string input', async () => {
    await expect(generateEmbeddings('')).rejects.toThrow(/empty/i);
  });

  it('should reject whitespace-only input', async () => {
    await expect(generateEmbeddings('   \n\t  ')).rejects.toThrow(/empty/i);
  });

  it('should reject null input', async () => {
    await expect(generateEmbeddings(null as any)).rejects.toThrow(/required.*string/i);
  });

  it('should reject undefined input', async () => {
    await expect(generateEmbeddings(undefined as any)).rejects.toThrow(/required.*string/i);
  });

  it('should reject non-string input', async () => {
    await expect(generateEmbeddings(123 as any)).rejects.toThrow(/string/i);
    await expect(generateEmbeddings({} as any)).rejects.toThrow(/string/i);
    await expect(generateEmbeddings([] as any)).rejects.toThrow(/string/i);
  });
});

describe('upsertToLanceDB', () => {
  const validTestData = {
    arxivId: '2024.01234v1',
    title: 'Test Paper on Machine Learning',
    summary: 'This is a test paper summary about advanced machine learning techniques.',
    authors: ['John Doe', 'Jane Smith'],
    published: new Date('2024-01-15'),
    categories: ['cs.LG', 'cs.AI'],
    primaryCategory: 'Foundation Models',
    potentialImpact: 4,
    runId: '123e4567-e89b-12d3-a456-426614174000',
    embedding: new Array(1536).fill(0.001) // Mock normalized embedding
  };

  it('should successfully upsert valid document', async () => {
    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      validTestData.summary,
      validTestData.authors,
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      validTestData.embedding
    )).resolves.toBeUndefined();
  });

  it('should reject missing arxiv_id', async () => {
    await expect(upsertToLanceDB(
      '',
      validTestData.title,
      validTestData.summary,
      validTestData.authors,
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      validTestData.embedding
    )).rejects.toThrow(/arxiv id.*required/i);
  });

  it('should reject invalid arxiv_id type', async () => {
    await expect(upsertToLanceDB(
      null as any,
      validTestData.title,
      validTestData.summary,
      validTestData.authors,
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      validTestData.embedding
    )).rejects.toThrow(/arxiv id.*string/i);
  });

  it('should reject missing title', async () => {
    await expect(upsertToLanceDB(
      validTestData.arxivId,
      '',
      validTestData.summary,
      validTestData.authors,
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      validTestData.embedding
    )).rejects.toThrow(/title.*required/i);
  });

  it('should reject missing summary', async () => {
    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      '',
      validTestData.authors,
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      validTestData.embedding
    )).rejects.toThrow(/summary.*required/i);
  });

  it('should reject empty authors array', async () => {
    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      validTestData.summary,
      [],
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      validTestData.embedding
    )).rejects.toThrow(/authors.*not be empty/i);
  });

  it('should reject non-array authors', async () => {
    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      validTestData.summary,
      'John Doe' as any,
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      validTestData.embedding
    )).rejects.toThrow(/authors.*array/i);
  });

  it('should reject invalid published date', async () => {
    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      validTestData.summary,
      validTestData.authors,
      'invalid-date' as any,
      validTestData.categories,
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      validTestData.embedding
    )).rejects.toThrow(/published.*date/i);
  });

  it('should reject empty categories array', async () => {
    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      validTestData.summary,
      validTestData.authors,
      validTestData.published,
      [],
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      validTestData.embedding
    )).rejects.toThrow(/categories.*not be empty/i);
  });

  it('should reject invalid potential impact values', async () => {
    // Test values outside 1-5 range
    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      validTestData.summary,
      validTestData.authors,
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      0, // Too low
      validTestData.runId,
      validTestData.embedding
    )).rejects.toThrow(/potential impact.*between 1 and 5/i);

    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      validTestData.summary,
      validTestData.authors,
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      6, // Too high
      validTestData.runId,
      validTestData.embedding
    )).rejects.toThrow(/potential impact.*between 1 and 5/i);

    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      validTestData.summary,
      validTestData.authors,
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      'invalid' as any, // Wrong type
      validTestData.runId,
      validTestData.embedding
    )).rejects.toThrow(/potential impact.*number/i);
  });

  it('should reject empty embedding vector', async () => {
    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      validTestData.summary,
      validTestData.authors,
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      []
    )).rejects.toThrow(/embedding.*not be empty/i);
  });

  it('should reject invalid embedding values', async () => {
    const invalidEmbedding = [1.0, NaN, 0.5, Infinity, -1.2];
    
    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      validTestData.summary,
      validTestData.authors,
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      invalidEmbedding
    )).rejects.toThrow(/embedding.*invalid values/i);
  });

  it('should handle multiple valid categories', async () => {
    const multipleCategories = ['cs.LG', 'cs.AI', 'stat.ML', 'cs.CV'];
    
    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      validTestData.summary,
      validTestData.authors,
      validTestData.published,
      multipleCategories,
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      validTestData.embedding
    )).resolves.toBeUndefined();
  });

  it('should handle multiple valid authors', async () => {
    const multipleAuthors = ['Alice Johnson', 'Bob Wilson', 'Carol Davis', 'David Brown'];
    
    await expect(upsertToLanceDB(
      validTestData.arxivId,
      validTestData.title,
      validTestData.summary,
      multipleAuthors,
      validTestData.published,
      validTestData.categories,
      validTestData.primaryCategory,
      validTestData.potentialImpact,
      validTestData.runId,
      validTestData.embedding
    )).resolves.toBeUndefined();
  });
});

describe('integration test - embeddings with LanceDB', () => {
  it('should generate embeddings and upsert to LanceDB', async () => {
    const paperSummary = 'This paper presents a novel approach to transformer architecture optimization using gradient-based methods.';
    const testData = {
      arxivId: '2024.05678v2',
      title: 'Optimizing Transformer Architectures',
      authors: ['Research Smith', 'AI Jones'],
      published: new Date('2024-02-20'),
      categories: ['cs.LG', 'cs.CL'],
      primaryCategory: 'Foundation Models',
      potentialImpact: 3,
      runId: '456e7890-e12c-34d5-b678-901234567890'
    };

    // Generate embeddings for the paper summary
    const embedding = await generateEmbeddings(paperSummary);
    
    expect(embedding.length).toBe(1536);
    expect(embedding.every(val => typeof val === 'number' && !isNaN(val))).toBe(true);

    // Upsert to LanceDB with generated embeddings
    await expect(upsertToLanceDB(
      testData.arxivId,
      testData.title,
      paperSummary,
      testData.authors,
      testData.published,
      testData.categories,
      testData.primaryCategory,
      testData.potentialImpact,
      testData.runId,
      embedding
    )).resolves.toBeUndefined();
  });
});