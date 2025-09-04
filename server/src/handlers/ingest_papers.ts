import { db } from '../db';
import { articlesRawTable, articlesEnrichedTable } from '../db/schema';
import { type IngestionRunResult, type CreateArticleRawInput, type CreateArticleEnrichedInput, type PrimaryCategory } from '../schema';
import { eq } from 'drizzle-orm';

// Mock arXiv API response structure
interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  authors: { name: string }[];
  published: string;
  categories: string[];
}

// Mock LLM classification response
interface LLMClassificationResponse {
  primary_category: PrimaryCategory;
  secondary_categories: PrimaryCategory[];
  potential_impact: number;
}

/**
 * Mock function to simulate fetching arXiv papers from API
 * In real implementation, this would call the actual arXiv API
 */
async function fetchArxivPapers(): Promise<ArxivEntry[]> {
  // Mock data representing typical arXiv papers
  const mockPapers: ArxivEntry[] = [
    {
      id: '2024.01001',
      title: 'Efficient Fine-tuning of Large Language Models with LoRA',
      summary: 'This paper presents a novel approach to parameter-efficient fine-tuning using Low-Rank Adaptation (LoRA) techniques.',
      authors: [{ name: 'John Smith' }, { name: 'Jane Doe' }],
      published: '2024-01-15T10:00:00Z',
      categories: ['cs.LG', 'cs.AI']
    },
    {
      id: '2024.01002',
      title: 'Advances in Retrieval-Augmented Generation for Question Answering',
      summary: 'We explore new methods for improving RAG systems through better retrieval mechanisms and context integration.',
      authors: [{ name: 'Alice Johnson' }, { name: 'Bob Wilson' }],
      published: '2024-01-16T14:30:00Z',
      categories: ['cs.CL', 'cs.IR']
    },
    {
      id: '2024.01003',
      title: 'Multimodal Foundation Models: Vision and Language Integration',
      summary: 'This work investigates the integration of visual and textual modalities in foundation models.',
      authors: [{ name: 'Carol Brown' }],
      published: '2024-01-17T09:15:00Z',
      categories: ['cs.CV', 'cs.LG']
    }
  ];

  return mockPapers;
}

/**
 * Mock function to simulate LLM classification
 * In real implementation, this would call an actual LLM API
 */
async function classifyPaper(paper: ArxivEntry): Promise<LLMClassificationResponse> {
  // Mock classification logic based on title/summary keywords
  const title = paper.title.toLowerCase();
  const summary = paper.summary.toLowerCase();

  if (title.includes('lora') || title.includes('fine-tuning')) {
    return {
      primary_category: 'Parameter-Efficient Fine-tuning (PEFT)',
      secondary_categories: ['LLM Fine-tuning'],
      potential_impact: 4
    };
  } else if (title.includes('rag') || title.includes('retrieval')) {
    return {
      primary_category: 'Retrieval-Augmented Generation (RAG)',
      secondary_categories: ['Natural Language Processing (Specific Techniques)'],
      potential_impact: 3
    };
  } else if (title.includes('multimodal') || title.includes('vision')) {
    return {
      primary_category: 'Multimodality',
      secondary_categories: ['Foundation Models'],
      potential_impact: 5
    };
  } else {
    return {
      primary_category: 'Other',
      secondary_categories: [],
      potential_impact: 2
    };
  }
}

/**
 * Triggers the complete paper ingestion pipeline:
 * 1. Fetches latest arXiv papers from cs.LG and stat.ML categories for the last 7 days
 * 2. Parses Atom feed and extracts key information
 * 3. Deduplicates papers based on arxiv_id
 * 4. Stores raw paper data in articles_raw table
 * 5. Calls LLM for classification of each paper
 * 6. Stores classification results in articles_enriched table
 * 7. Generates embeddings and upserts to LanceDB collection
 * 8. Returns aggregated results with topic counts
 */
export async function ingestPapers(): Promise<IngestionRunResult> {
  try {
    // Generate a unique run_id for this ingestion
    const runId = crypto.randomUUID();

    // Step 1: Fetch papers from arXiv API
    const papers = await fetchArxivPapers();

    // Step 2: Deduplicate papers and filter new ones
    const existingPapers = await db.select({ arxiv_id: articlesRawTable.arxiv_id })
      .from(articlesRawTable)
      .execute();
    
    const existingIds = new Set(existingPapers.map(p => p.arxiv_id));
    const newPapers = papers.filter(paper => !existingIds.has(paper.id));

    let totalNew = 0;
    const topicCounts: Record<string, number> = {};

    // Process each new paper
    for (const paper of newPapers) {
      // Step 3: Store raw paper data
      const rawInput: CreateArticleRawInput = {
        arxiv_id: paper.id,
        title: paper.title,
        summary: paper.summary,
        authors: paper.authors.map(author => author.name),
        published: new Date(paper.published),
        categories: paper.categories,
        run_id: runId
      };

      await db.insert(articlesRawTable)
        .values(rawInput)
        .execute();

      // Step 4: Classify paper with LLM
      const classification = await classifyPaper(paper);

      // Step 5: Store enriched data
      const enrichedInput: CreateArticleEnrichedInput = {
        arxiv_id: paper.id,
        run_id: runId,
        primary_category: classification.primary_category,
        secondary_categories: classification.secondary_categories,
        potential_impact: classification.potential_impact
      };

      await db.insert(articlesEnrichedTable)
        .values(enrichedInput)
        .execute();

      // Update counters
      totalNew++;
      const primaryCat = classification.primary_category;
      topicCounts[primaryCat] = (topicCounts[primaryCat] || 0) + 1;

      // Step 6: Generate embeddings (mock implementation)
      // In real implementation: await generateAndStoreEmbeddings(paper);
    }

    return {
      run_id: runId,
      total_new: totalNew,
      topic_counts: topicCounts
    };

  } catch (error) {
    console.error('Paper ingestion failed:', error);
    throw error;
  }
}