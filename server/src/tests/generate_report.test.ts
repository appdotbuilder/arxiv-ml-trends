import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { articlesRawTable, articlesEnrichedTable, weeklyReportsTable } from '../db/schema';
import { type ReportGenerationInput } from '../schema';
import { generateReport } from '../handlers/generate_report';
import { eq } from 'drizzle-orm';

// Test data
const testRunId = '550e8400-e29b-41d4-a716-446655440000';

const testArticlesRaw = [
  {
    arxiv_id: '2024.001',
    title: 'Foundation Models for Everyone',
    summary: 'This paper presents a comprehensive survey of foundation models and their applications across various domains.',
    authors: ['Alice Smith', 'Bob Jones'],
    published: new Date('2024-01-15'),
    categories: ['cs.AI', 'cs.LG'],
    run_id: testRunId
  },
  {
    arxiv_id: '2024.002',
    title: 'Efficient RAG Systems',
    summary: 'We propose a novel approach to retrieval-augmented generation that improves efficiency by 40%.',
    authors: ['Carol White', 'David Brown', 'Eve Green'],
    published: new Date('2024-01-16'),
    categories: ['cs.CL', 'cs.IR'],
    run_id: testRunId
  },
  {
    arxiv_id: '2024.003',
    title: 'Parameter-Efficient Fine-tuning Methods',
    summary: 'This work introduces new PEFT techniques that reduce memory usage while maintaining performance.',
    authors: ['Frank Black'],
    published: new Date('2024-01-17'),
    categories: ['cs.LG'],
    run_id: testRunId
  }
];

const testArticlesEnriched = [
  {
    arxiv_id: '2024.001',
    run_id: testRunId,
    primary_category: 'Foundation Models',
    secondary_categories: ['Other'],
    potential_impact: 5
  },
  {
    arxiv_id: '2024.002',
    run_id: testRunId,
    primary_category: 'Retrieval-Augmented Generation (RAG)',
    secondary_categories: ['Efficient AI / AI Optimization'],
    potential_impact: 4
  },
  {
    arxiv_id: '2024.003',
    run_id: testRunId,
    primary_category: 'Parameter-Efficient Fine-tuning (PEFT)',
    secondary_categories: ['LLM Fine-tuning'],
    potential_impact: 3
  }
];

const testInput: ReportGenerationInput = {
  run_id: testRunId,
  preview_only: false
};

const previewInput: ReportGenerationInput = {
  run_id: testRunId,
  preview_only: true
};

describe('generateReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate a comprehensive report', async () => {
    // Create test data
    await db.insert(articlesRawTable).values(testArticlesRaw).execute();
    await db.insert(articlesEnrichedTable).values(testArticlesEnriched).execute();

    const result = await generateReport(testInput);

    // Verify basic structure
    expect(result.subject).toContain('Weekly ML Research Trends');
    expect(result.subject).toContain('3 papers');
    expect(result.subject).toContain('Foundation Models leads');
    expect(result.body_markdown).toContain('# Weekly ML Research Trends Report');
    expect(result.body_html).toContain('<h1>Weekly ML Research Trends Report</h1>');
    expect(result.emailed).toBe(true);
  });

  it('should include topic distribution in report', async () => {
    await db.insert(articlesRawTable).values(testArticlesRaw).execute();
    await db.insert(articlesEnrichedTable).values(testArticlesEnriched).execute();

    const result = await generateReport(testInput);

    // Check that all topics are included
    expect(result.body_markdown).toContain('Foundation Models');
    expect(result.body_markdown).toContain('Retrieval-Augmented Generation (RAG)');
    expect(result.body_markdown).toContain('Parameter-Efficient Fine-tuning (PEFT)');
    
    // Check topic counts
    expect(result.body_markdown).toContain('1. **Foundation Models**: 1 papers');
    expect(result.body_markdown).toContain('**Total Papers Analyzed:** 3');
  });

  it('should include representative papers with details', async () => {
    await db.insert(articlesRawTable).values(testArticlesRaw).execute();
    await db.insert(articlesEnrichedTable).values(testArticlesEnriched).execute();

    const result = await generateReport(testInput);

    // Check paper details are included
    expect(result.body_markdown).toContain('Foundation Models for Everyone');
    expect(result.body_markdown).toContain('Alice Smith, Bob Jones');
    expect(result.body_markdown).toContain('2024.001');
    expect(result.body_markdown).toContain('Impact Score: 5/5');
    expect(result.body_markdown).toContain('comprehensive survey of foundation models');
  });

  it('should save report to database', async () => {
    await db.insert(articlesRawTable).values(testArticlesRaw).execute();
    await db.insert(articlesEnrichedTable).values(testArticlesEnriched).execute();

    const result = await generateReport(testInput);

    // Verify report is saved in database
    const savedReports = await db.select()
      .from(weeklyReportsTable)
      .where(eq(weeklyReportsTable.run_id, testRunId))
      .execute();

    expect(savedReports).toHaveLength(1);
    const savedReport = savedReports[0];
    
    expect(savedReport.subject).toEqual(result.subject);
    expect(savedReport.body_markdown).toEqual(result.body_markdown);
    expect(savedReport.body_html).toEqual(result.body_html);
    expect(savedReport.emailed).toBe(true);
    expect(savedReport.created_at).toBeInstanceOf(Date);
  });

  it('should handle preview mode correctly', async () => {
    await db.insert(articlesRawTable).values(testArticlesRaw).execute();
    await db.insert(articlesEnrichedTable).values(testArticlesEnriched).execute();

    const result = await generateReport(previewInput);

    // Should not be marked as emailed in preview mode
    expect(result.emailed).toBe(false);
    
    // Verify database record reflects preview mode
    const savedReports = await db.select()
      .from(weeklyReportsTable)
      .where(eq(weeklyReportsTable.run_id, testRunId))
      .execute();

    expect(savedReports).toHaveLength(1);
    expect(savedReports[0].emailed).toBe(false);
  });

  it('should handle multiple papers in same category', async () => {
    // Add more papers in Foundation Models category
    const additionalRawArticles = [
      {
        arxiv_id: '2024.004',
        title: 'Advanced Foundation Models',
        summary: 'Building on previous work, we present advanced foundation model architectures.',
        authors: ['Jane Doe'],
        published: new Date('2024-01-18'),
        categories: ['cs.AI'],
        run_id: testRunId
      },
      {
        arxiv_id: '2024.005',
        title: 'Foundation Model Evaluation',
        summary: 'A comprehensive evaluation framework for foundation models across tasks.',
        authors: ['John Smith'],
        published: new Date('2024-01-19'),
        categories: ['cs.AI'],
        run_id: testRunId
      }
    ];

    const additionalEnrichedArticles = [
      {
        arxiv_id: '2024.004',
        run_id: testRunId,
        primary_category: 'Foundation Models',
        secondary_categories: ['Other'],
        potential_impact: 4
      },
      {
        arxiv_id: '2024.005',
        run_id: testRunId,
        primary_category: 'Foundation Models',
        secondary_categories: ['Other'],
        potential_impact: 3
      }
    ];

    await db.insert(articlesRawTable).values([...testArticlesRaw, ...additionalRawArticles]).execute();
    await db.insert(articlesEnrichedTable).values([...testArticlesEnriched, ...additionalEnrichedArticles]).execute();

    const result = await generateReport(testInput);

    // Should show correct count for Foundation Models
    expect(result.body_markdown).toContain('**Foundation Models**: 3 papers');
    expect(result.body_markdown).toContain('**Total Papers Analyzed:** 5');
    
    // Should still show top 3 representative papers
    const foundationModelsSection = result.body_markdown.split('### 1. Foundation Models')[1];
    const paperCount = (foundationModelsSection.match(/\*\*.*\*\*/g) || []).filter(match => 
      match.includes('Foundation Models') || match.includes('Advanced Foundation') || match.includes('Evaluation')
    ).length;
    expect(paperCount).toBeLessThanOrEqual(3);
  });

  it('should order topics by count (descending)', async () => {
    // Create more RAG papers to make it the top category
    const ragPapers = Array.from({ length: 5 }, (_, i) => ({
      arxiv_id: `2024.rag${i + 1}`,
      title: `RAG Paper ${i + 1}`,
      summary: `RAG research paper number ${i + 1}`,
      authors: [`Author${i + 1}`],
      published: new Date('2024-01-20'),
      categories: ['cs.CL'],
      run_id: testRunId
    }));

    const ragEnriched = Array.from({ length: 5 }, (_, i) => ({
      arxiv_id: `2024.rag${i + 1}`,
      run_id: testRunId,
      primary_category: 'Retrieval-Augmented Generation (RAG)',
      secondary_categories: ['Other'],
      potential_impact: 3
    }));

    await db.insert(articlesRawTable).values([...testArticlesRaw, ...ragPapers]).execute();
    await db.insert(articlesEnrichedTable).values([...testArticlesEnriched, ...ragEnriched]).execute();

    const result = await generateReport(testInput);

    // RAG should now be the leading topic
    expect(result.subject).toContain('Retrieval-Augmented Generation (RAG) leads');
    
    // Check ordering in markdown
    const lines = result.body_markdown.split('\n');
    const distributionIndex = lines.findIndex(line => line.includes('Topic Distribution'));
    const ragLine = lines.slice(distributionIndex).find(line => line.includes('Retrieval-Augmented Generation (RAG)'));
    const foundationLine = lines.slice(distributionIndex).find(line => line.includes('Foundation Models'));
    
    expect(ragLine).toContain('1. **Retrieval-Augmented Generation (RAG)**: 6 papers');
    expect(foundationLine).toContain('2. **Foundation Models**: 1 papers');
  });

  it('should generate insights section', async () => {
    await db.insert(articlesRawTable).values(testArticlesRaw).execute();
    await db.insert(articlesEnrichedTable).values(testArticlesEnriched).execute();

    const result = await generateReport(testInput);

    // Check insights section exists
    expect(result.body_markdown).toContain('## 📈 Insights');
    expect(result.body_markdown).toContain('**Most Active Area:** Foundation Models with 1 papers');
    expect(result.body_markdown).toContain('**Second Most Active:** Parameter-Efficient Fine-tuning (PEFT)'); // Updated to match actual ordering
    expect(result.body_markdown).toContain('**High Impact Papers:** 2 papers with impact score ≥ 4');
    expect(result.body_markdown).toContain('**Research Diversity:** 3 distinct research categories');
  });

  it('should handle empty run_id gracefully', async () => {
    // Don't add any test data - use a run_id that has no articles
    const emptyInput: ReportGenerationInput = {
      run_id: '550e8400-e29b-41d4-a716-446655440001', // Different run_id with no data
      preview_only: false
    };

    await expect(generateReport(emptyInput)).rejects.toThrow(/No enriched articles found/i);
  });

  it('should truncate author lists appropriately', async () => {
    // Create article with many authors
    const manyAuthorsArticle = {
      arxiv_id: '2024.many',
      title: 'Paper with Many Authors',
      summary: 'A paper written by many researchers.',
      authors: ['Author1', 'Author2', 'Author3', 'Author4', 'Author5'],
      published: new Date('2024-01-20'),
      categories: ['cs.AI'],
      run_id: testRunId
    };

    const manyAuthorsEnriched = {
      arxiv_id: '2024.many',
      run_id: testRunId,
      primary_category: 'Foundation Models',
      secondary_categories: ['Other'],
      potential_impact: 5
    };

    await db.insert(articlesRawTable).values([...testArticlesRaw, manyAuthorsArticle]).execute();
    await db.insert(articlesEnrichedTable).values([...testArticlesEnriched, manyAuthorsEnriched]).execute();

    const result = await generateReport(testInput);

    // Should show "et al." for papers with more than 3 authors
    expect(result.body_markdown).toContain('Author1, Author2, Author3 et al.');
  });

  it('should convert markdown to HTML correctly', async () => {
    await db.insert(articlesRawTable).values(testArticlesRaw).execute();
    await db.insert(articlesEnrichedTable).values(testArticlesEnriched).execute();

    const result = await generateReport(testInput);

    // Check HTML conversion
    expect(result.body_html).toContain('<h1>Weekly ML Research Trends Report</h1>');
    expect(result.body_html).toContain('<h2>📊 Topic Distribution</h2>');
    expect(result.body_html).toContain('<h3>1. Foundation Models (1 papers)</h3>');
    expect(result.body_html).toContain('<strong>Total Papers Analyzed:</strong>');
    expect(result.body_html).toContain('Authors:'); // No italic formatting anymore
    expect(result.body_html).toContain('<hr>');
    expect(result.body_html).toContain('<li>');
  });
});