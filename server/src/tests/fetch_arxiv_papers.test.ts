import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { fetchArxivPapers } from '../handlers/fetch_arxiv_papers';

// Mock XML response from arXiv API
const mockArxivXmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.0001v1</id>
    <published>2024-01-15T18:00:01Z</published>
    <title>Test Paper: Advanced Machine Learning Techniques</title>
    <summary>This is a test paper summary with multiple lines
    and some extra whitespace that should be cleaned up properly.</summary>
    <author>
      <name>John Doe</name>
    </author>
    <author>
      <name>Jane Smith</name>
    </author>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
    <category term="stat.ML" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2401.0002v2</id>
    <published>2024-01-14T12:30:00Z</published>
    <title>Another Test Paper: Deep Learning Applications</title>
    <summary>Another test paper summary for testing purposes.</summary>
    <author>
      <name>Alice Johnson</name>
    </author>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>`;

// Mock empty response
const mockEmptyArxivXmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ArXiv Query: search_query=cat:invalid&amp;id_list=&amp;start=0&amp;max_results=10</title>
  <id>http://arxiv.org/api/query?search_query=cat:invalid&amp;id_list=&amp;start=0&amp;max_results=10</id>
  <opensearch:totalResults>0</opensearch:totalResults>
  <opensearch:startIndex>0</opensearch:startIndex>
  <opensearch:itemsPerPage>10</opensearch:itemsPerPage>
</feed>`;

// Mock duplicate entry response
const mockDuplicateArxivXmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.0001v1</id>
    <published>2024-01-15T18:00:01Z</published>
    <title>First Version</title>
    <summary>First summary</summary>
    <author><name>Author One</name></author>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2401.0001v2</id>
    <published>2024-01-15T19:00:01Z</published>
    <title>Second Version</title>
    <summary>Updated summary</summary>
    <author><name>Author One</name></author>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>`;

describe('fetchArxivPapers', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should fetch and parse arXiv papers successfully', async () => {
    // Mock successful API response
    global.fetch = mock(() =>
      Promise.resolve(new Response(mockArxivXmlResponse, { status: 200 }))
    ) as any;

    const result = await fetchArxivPapers(['cs.LG'], 10, 7);

    // Should return parsed papers
    expect(result).toHaveLength(2);

    // Validate first paper
    const firstPaper = result[0];
    expect(firstPaper.arxiv_id).toBe('2401.0001');
    expect(firstPaper.title).toBe('Test Paper: Advanced Machine Learning Techniques');
    expect(firstPaper.summary).toBe('This is a test paper summary with multiple lines and some extra whitespace that should be cleaned up properly.');
    expect(firstPaper.authors).toEqual(['John Doe', 'Jane Smith']);
    expect(firstPaper.published).toBeInstanceOf(Date);
    expect(firstPaper.categories).toEqual(['cs.LG', 'stat.ML']);
    expect(firstPaper.run_id).toBeDefined();
    expect(typeof firstPaper.run_id).toBe('string');

    // Validate second paper
    const secondPaper = result[1];
    expect(secondPaper.arxiv_id).toBe('2401.0002');
    expect(secondPaper.title).toBe('Another Test Paper: Deep Learning Applications');
    expect(secondPaper.authors).toEqual(['Alice Johnson']);
    expect(secondPaper.categories).toEqual(['cs.LG', 'cs.AI']);

    // All papers should have the same run_id
    expect(firstPaper.run_id).toBe(secondPaper.run_id);
  });

  it('should handle empty response', async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response(mockEmptyArxivXmlResponse, { status: 200 }))
    ) as any;

    const result = await fetchArxivPapers(['invalid.category'], 10, 7);

    expect(result).toHaveLength(0);
  });

  it('should deduplicate papers with same arXiv ID', async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response(mockDuplicateArxivXmlResponse, { status: 200 }))
    ) as any;

    const result = await fetchArxivPapers(['cs.LG'], 10, 7);

    // Should only return one paper despite two entries with same base ID
    expect(result).toHaveLength(1);
    expect(result[0].arxiv_id).toBe('2401.0001'); // Version number removed for deduplication
    expect(result[0].title).toBe('First Version'); // Should keep the first one encountered
  });

  it('should handle API request failure', async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response('Not Found', { status: 404, statusText: 'Not Found' }))
    ) as any;

    await expect(fetchArxivPapers(['cs.LG'], 10, 7))
      .rejects.toThrow(/ArXiv API request failed: 404 Not Found/);
  });

  it('should handle network errors', async () => {
    global.fetch = mock(() =>
      Promise.reject(new Error('Network error'))
    ) as any;

    await expect(fetchArxivPapers(['cs.LG'], 10, 7))
      .rejects.toThrow(/Network error/);
  });

  it('should construct proper API URL with parameters', async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response(mockEmptyArxivXmlResponse, { status: 200 }))
    ) as any;
    global.fetch = mockFetch;

    await fetchArxivPapers(['cs.LG', 'stat.ML'], 50, 14);

    // Verify fetch was called with correct URL structure
    const calledUrl = (mockFetch.mock.calls[0][0] as string);
    expect(calledUrl).toMatch(/export\.arxiv\.org\/api\/query/);
    expect(calledUrl).toMatch(/search_query=/);
    expect(calledUrl).toMatch(/cs\.LG/);
    expect(calledUrl).toMatch(/stat\.ML/);
    expect(calledUrl).toMatch(/max_results=50/);
    expect(calledUrl).toMatch(/submittedDate/);
  });

  it('should use default parameters when not provided', async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response(mockEmptyArxivXmlResponse, { status: 200 }))
    ) as any;
    global.fetch = mockFetch;

    await fetchArxivPapers();

    const calledUrl = (mockFetch.mock.calls[0][0] as string);
    expect(calledUrl).toMatch(/cs\.LG/);
    expect(calledUrl).toMatch(/stat\.ML/);
    expect(calledUrl).toMatch(/max_results=100/);
  });

  it('should clean whitespace and newlines from text fields', async () => {
    const xmlWithMessyText = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.0003v1</id>
    <published>2024-01-15T18:00:01Z</published>
    <title>    Messy    Title   With   Spaces    </title>
    <summary>Summary with
    multiple lines
    and    extra    spaces</summary>
    <author><name>Test Author</name></author>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>`;

    global.fetch = mock(() =>
      Promise.resolve(new Response(xmlWithMessyText, { status: 200 }))
    ) as any;

    const result = await fetchArxivPapers(['cs.LG'], 10, 7);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Messy Title With Spaces');
    expect(result[0].summary).toBe('Summary with multiple lines and extra spaces');
  });

  it('should handle papers with no authors gracefully', async () => {
    const xmlWithNoAuthors = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.0004v1</id>
    <published>2024-01-15T18:00:01Z</published>
    <title>Paper Without Authors</title>
    <summary>Test summary</summary>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>`;

    global.fetch = mock(() =>
      Promise.resolve(new Response(xmlWithNoAuthors, { status: 200 }))
    ) as any;

    const result = await fetchArxivPapers(['cs.LG'], 10, 7);

    expect(result).toHaveLength(1);
    expect(result[0].authors).toEqual([]);
  });

  it('should parse published dates correctly', async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response(mockArxivXmlResponse, { status: 200 }))
    ) as any;

    const result = await fetchArxivPapers(['cs.LG'], 10, 7);

    expect(result[0].published).toBeInstanceOf(Date);
    expect(result[0].published.getFullYear()).toBe(2024);
    expect(result[0].published.getMonth()).toBe(0); // January is 0
    expect(result[0].published.getDate()).toBe(15);
  });
});