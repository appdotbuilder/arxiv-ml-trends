/**
 * Generates embeddings for paper summaries using the configured embeddings model.
 * Returns embedding vectors for semantic search and similarity matching.
 */
export async function generateEmbeddings(
    text: string
): Promise<number[]> {
    try {
        // Validate input
        if (typeof text !== 'string') {
            throw new Error('Text input is required and must be a string');
        }

        if (text.trim().length === 0) {
            throw new Error('Text input cannot be empty');
        }

        // Truncate text if too long (typical embedding models have token limits)
        const maxLength = 8000; // Approximate character limit for embedding models
        const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

        // For now, generate a deterministic mock embedding based on text content
        // In production, this would call OpenAI's embeddings API or similar service
        const embedding = await generateMockEmbedding(truncatedText);

        // Validate embedding output
        if (!Array.isArray(embedding) || embedding.length === 0) {
            throw new Error('Failed to generate valid embedding vector');
        }

        // Ensure all values are numbers
        if (!embedding.every(val => typeof val === 'number' && !isNaN(val))) {
            throw new Error('Embedding vector contains invalid values');
        }

        return embedding;
    } catch (error) {
        console.error('Embedding generation failed:', error);
        throw error;
    }
}

/**
 * Generates a mock embedding vector for testing purposes.
 * Creates a deterministic 1536-dimensional vector based on text content.
 * In production, this would be replaced with actual API calls.
 */
async function generateMockEmbedding(text: string): Promise<number[]> {
    const dimensions = 1536; // OpenAI text-embedding-3-small dimension size
    const embedding = new Array(dimensions);
    
    // Create a simple hash from the text for deterministic results
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Generate pseudo-random values based on the hash
    for (let i = 0; i < dimensions; i++) {
        // Use a simple pseudo-random generator seeded with hash + index
        const seed = hash + i;
        const pseudoRandom = Math.sin(seed) * 10000;
        embedding[i] = pseudoRandom - Math.floor(pseudoRandom);
    }

    // Normalize the vector to unit length
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    for (let i = 0; i < dimensions; i++) {
        embedding[i] = embedding[i] / magnitude;
    }

    return embedding;
}

/**
 * Upserts paper data and embeddings to LanceDB collection.
 * Uses arxiv_id as primary key for deduplication.
 */
export async function upsertToLanceDB(
    arxivId: string,
    title: string,
    summary: string,
    authors: string[],
    published: Date,
    categories: string[],
    primaryCategory: string,
    potentialImpact: number,
    runId: string,
    embedding: number[]
): Promise<void> {
    try {
        // Validate required inputs
        if (!arxivId || typeof arxivId !== 'string') {
            throw new Error('ArXiv ID is required and must be a string');
        }

        if (!title || typeof title !== 'string') {
            throw new Error('Title is required and must be a string');
        }

        if (!summary || typeof summary !== 'string') {
            throw new Error('Summary is required and must be a string');
        }

        if (!Array.isArray(authors) || authors.length === 0) {
            throw new Error('Authors array is required and must not be empty');
        }

        if (!published || !(published instanceof Date)) {
            throw new Error('Published date is required and must be a Date object');
        }

        if (!Array.isArray(categories) || categories.length === 0) {
            throw new Error('Categories array is required and must not be empty');
        }

        if (!primaryCategory || typeof primaryCategory !== 'string') {
            throw new Error('Primary category is required and must be a string');
        }

        if (typeof potentialImpact !== 'number' || potentialImpact < 1 || potentialImpact > 5) {
            throw new Error('Potential impact must be a number between 1 and 5');
        }

        if (!runId || typeof runId !== 'string') {
            throw new Error('Run ID is required and must be a string');
        }

        if (!Array.isArray(embedding) || embedding.length === 0) {
            throw new Error('Embedding vector is required and must not be empty');
        }

        // Validate embedding vector
        if (!embedding.every(val => typeof val === 'number' && !isNaN(val))) {
            throw new Error('Embedding vector contains invalid values');
        }

        // Mock LanceDB upsert operation
        // In production, this would connect to LanceDB and upsert the document
        await mockLanceDBUpsert({
            arxiv_id: arxivId,
            title,
            summary,
            authors,
            published,
            categories,
            primary_category: primaryCategory,
            potential_impact: potentialImpact,
            run_id: runId,
            embedding
        });

    } catch (error) {
        console.error('LanceDB upsert failed:', error);
        throw error;
    }
}

/**
 * Mock LanceDB upsert for testing purposes.
 * In production, this would be replaced with actual LanceDB operations.
 */
async function mockLanceDBUpsert(document: {
    arxiv_id: string;
    title: string;
    summary: string;
    authors: string[];
    published: Date;
    categories: string[];
    primary_category: string;
    potential_impact: number;
    run_id: string;
    embedding: number[];
}): Promise<void> {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // In production, this would:
    // 1. Connect to LanceDB collection
    // 2. Create document with metadata and embedding
    // 3. Upsert using arxiv_id as primary key
    // 4. Handle connection errors and retries
    
    console.log(`Mock LanceDB upsert for document ${document.arxiv_id}`);
}