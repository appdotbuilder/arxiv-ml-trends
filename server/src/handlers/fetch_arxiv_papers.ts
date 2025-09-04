import { type CreateArticleRawInput } from '../schema';
import { v4 as uuidv4 } from 'uuid';

interface ArxivEntry {
  id: string[];
  title: string[];
  summary: string[];
  author: Array<{ name: string[] }>;
  published: string[];
  category: Array<{ $: { term: string } }>;
}

interface ArxivResponse {
  feed: {
    entry?: ArxivEntry[];
  };
}

/**
 * Fetches arXiv papers from the arXiv API for specified categories and date range.
 * Parses the Atom feed response and extracts paper metadata.
 * Returns deduplicated paper data ready for database insertion.
 */
export async function fetchArxivPapers(
    categories: string[] = ['cs.LG', 'stat.ML'],
    maxResults: number = 100,
    daysBack: number = 7
): Promise<CreateArticleRawInput[]> {
    try {
        // Generate a unique run_id for this fetch operation
        const runId = uuidv4();

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - daysBack);

        // Format dates for arXiv API (YYYYMMDD format)
        const formatDate = (date: Date): string => {
            return date.toISOString().slice(0, 10).replace(/-/g, '');
        };

        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        // Construct search query for arXiv API
        const categoryQuery = categories.map(cat => `cat:${cat}`).join(' OR ');
        const dateQuery = `submittedDate:[${startDateStr} TO ${endDateStr}]`;
        const searchQuery = `(${categoryQuery}) AND ${dateQuery}`;

        // Build API URL
        const baseUrl = 'http://export.arxiv.org/api/query';
        const params = new URLSearchParams({
            search_query: searchQuery,
            start: '0',
            max_results: maxResults.toString(),
            sortBy: 'submittedDate',
            sortOrder: 'descending'
        });

        const apiUrl = `${baseUrl}?${params}`;

        // Fetch data from arXiv API
        console.log(`Fetching arXiv papers from: ${apiUrl}`);
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`ArXiv API request failed: ${response.status} ${response.statusText}`);
        }

        const xmlText = await response.text();

        // Parse XML response
        const parsedData = await parseArxivXml(xmlText);
        
        if (!parsedData.feed.entry || parsedData.feed.entry.length === 0) {
            console.log('No papers found for the specified criteria');
            return [];
        }

        // Transform and deduplicate papers
        const papers: CreateArticleRawInput[] = [];
        const seenArxivIds = new Set<string>();

        for (const entry of parsedData.feed.entry) {
            try {
                // Extract arXiv ID from the full URL
                const arxivId = extractArxivId(entry.id?.[0] || '');
                
                // Skip duplicates
                if (seenArxivIds.has(arxivId)) {
                    continue;
                }
                seenArxivIds.add(arxivId);

                // Extract authors
                const authors = entry.author?.map(author => author.name[0]) || [];

                // Extract categories
                const paperCategories = entry.category?.map(cat => cat.$.term) || [];

                // Parse published date
                const publishedDate = new Date(entry.published?.[0] || new Date());

                // Create paper object
                const paper: CreateArticleRawInput = {
                    arxiv_id: arxivId,
                    title: cleanText(entry.title?.[0] || ''),
                    summary: cleanText(entry.summary?.[0] || ''),
                    authors,
                    published: publishedDate,
                    categories: paperCategories,
                    run_id: runId
                };

                papers.push(paper);
            } catch (entryError) {
                console.error(`Error processing arXiv entry:`, entryError);
                // Continue processing other entries
                continue;
            }
        }

        console.log(`Successfully processed ${papers.length} unique papers`);
        return papers;

    } catch (error) {
        console.error('ArXiv papers fetch failed:', error);
        throw error;
    }
}

/**
 * Parses arXiv XML response using a simple XML parser
 */
async function parseArxivXml(xmlText: string): Promise<ArxivResponse> {
    // Simple XML parsing implementation for Node.js environment
    // This is a simplified parser focused on arXiv's specific XML structure
    const entries: ArxivEntry[] = [];
    
    // Extract entries using regex (simplified approach)
    const entryMatches = xmlText.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
    
    for (const entryMatch of entryMatches) {
        const entry: ArxivEntry = {
            id: extractXmlValues(entryMatch, 'id'),
            title: extractXmlValues(entryMatch, 'title'),
            summary: extractXmlValues(entryMatch, 'summary'),
            published: extractXmlValues(entryMatch, 'published'),
            author: extractAuthors(entryMatch),
            category: extractCategories(entryMatch)
        };
        entries.push(entry);
    }

    return {
        feed: {
            entry: entries.length > 0 ? entries : undefined
        }
    };
}

/**
 * Extracts XML values using regex
 */
function extractXmlValues(xml: string, tagName: string): string[] {
    const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>`, 'gs');
    const matches = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
        matches.push(match[1].trim());
    }
    return matches;
}

/**
 * Extracts author information from XML
 */
function extractAuthors(xml: string): Array<{ name: string[] }> {
    const authorMatches = xml.match(/<author>([\s\S]*?)<\/author>/g) || [];
    return authorMatches.map(authorXml => ({
        name: extractXmlValues(authorXml, 'name')
    }));
}

/**
 * Extracts category information from XML
 */
function extractCategories(xml: string): Array<{ $: { term: string } }> {
    const categoryMatches = xml.match(/<category\s+term="([^"]+)"/g) || [];
    return categoryMatches.map(match => {
        const termMatch = match.match(/term="([^"]+)"/);
        return {
            $: { term: termMatch ? termMatch[1] : '' }
        };
    });
}

/**
 * Extracts arXiv ID from the full arXiv URL
 */
function extractArxivId(url: string): string {
    if (!url) {
        throw new Error('URL is empty or undefined');
    }
    
    const match = url.match(/arxiv\.org\/abs\/(.+)$/);
    if (match) {
        let id = match[1];
        // Remove version number for deduplication (e.g., 2401.0001v1 -> 2401.0001)
        const versionMatch = id.match(/^(.+?)v\d+$/);
        if (versionMatch) {
            id = versionMatch[1];
        }
        return id;
    }
    // Fallback: if it's already just an ID
    if (/^\d+\.\d+v?\d*$/.test(url)) {
        let id = url;
        // Remove version number for deduplication
        const versionMatch = id.match(/^(.+?)v\d+$/);
        if (versionMatch) {
            id = versionMatch[1];
        }
        return id;
    }
    throw new Error(`Could not extract arXiv ID from: ${url}`);
}

/**
 * Cleans text by removing extra whitespace and newlines
 */
function cleanText(text: string): string {
    if (!text || typeof text !== 'string') {
        return '';
    }
    return text
        .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
        .replace(/\n/g, ' ')   // Replace newlines with spaces
        .trim();               // Remove leading/trailing whitespace
}