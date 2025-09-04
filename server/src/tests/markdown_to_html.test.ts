import { describe, expect, it } from 'bun:test';
import { markdownToHtml } from '../handlers/markdown_to_html';

describe('markdownToHtml', () => {
  it('should convert basic markdown elements', async () => {
    const markdown = `# Main Title

This is a **bold** text and *italic* text.

## Subtitle

A paragraph with a [link](https://example.com).

- List item 1
- List item 2

1. Ordered item 1
2. Ordered item 2`;

    const html = await markdownToHtml(markdown);

    // Check that headings are converted with inline styles
    expect(html).toContain('<h1 style="font-size: 24px; font-weight: bold; margin: 20px 0 16px 0; color: #333;">Main Title</h1>');
    expect(html).toContain('<h2 style="font-size: 20px; font-weight: bold; margin: 16px 0 12px 0; color: #333;">Subtitle</h2>');
    
    // Check paragraphs have styling
    expect(html).toContain('<p style="margin: 12px 0; line-height: 1.6; color: #333;">');
    
    // Check bold and italic
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    
    // Check links have proper styling
    expect(html).toContain('<a href="https://example.com" style="color: #0066cc; text-decoration: underline;">link</a>');
    
    // Check lists have styling
    expect(html).toContain('<ul style="margin: 12px 0; padding-left: 24px; color: #333;">');
    expect(html).toContain('<ol style="margin: 12px 0; padding-left: 24px; color: #333;">');
    expect(html).toContain('<li style="margin: 4px 0; line-height: 1.6;">');
  });

  it('should convert arXiv IDs to proper URLs', async () => {
    const markdown = 'Check out this paper: [Title](2024.12345) and arXiv:2024.12346v1.';

    const html = await markdownToHtml(markdown);

    // Check that arXiv ID in link is converted to full URL
    expect(html).toContain('<a href="https://arxiv.org/abs/2024.12345"');
    
    // Check that arXiv reference in text is converted to link
    expect(html).toContain('<a href="https://arxiv.org/abs/2024.12346v1" style="color: #0066cc; text-decoration: underline;">arXiv:2024.12346v1</a>');
  });

  it('should handle code blocks and inline code', async () => {
    const markdown = `Here is some \`inline code\`.

\`\`\`python
def hello():
    print("Hello, World!")
\`\`\``;

    const html = await markdownToHtml(markdown);

    // Check inline code styling
    expect(html).toContain('<code style="background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 90%; color: #e74c3c;">inline code</code>');
    
    // Check code block styling
    expect(html).toContain('<pre style="background-color: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; margin: 12px 0;">');
    expect(html).toContain('<code style="font-family: monospace; font-size: 13px; color: #333;">');
    expect(html).toContain('def hello():');
  });

  it('should handle blockquotes', async () => {
    const markdown = '> This is a quote\n> with multiple lines';

    const html = await markdownToHtml(markdown);

    expect(html).toContain('<blockquote style="border-left: 4px solid #ddd; margin: 12px 0; padding: 8px 16px; color: #666; font-style: italic;">');
  });

  it('should handle line breaks correctly', async () => {
    const markdown = 'Line 1\nLine 2\n\nParagraph break';

    const html = await markdownToHtml(markdown);

    // Should convert single line breaks to <br> due to breaks: true option
    expect(html).toContain('Line 1<br>Line 2');
    
    // Should still recognize paragraph breaks
    expect(html).toMatch(/<\/p>\s*<p/);
  });

  it('should convert various arXiv ID formats', async () => {
    const markdown = 'Papers: 2024.12345, arXiv:2024.12346v2, 1234.5678v1, and arXiv:0123.4567';

    const html = await markdownToHtml(markdown);

    // All should be converted to proper links
    expect(html).toContain('href="https://arxiv.org/abs/2024.12345"');
    expect(html).toContain('href="https://arxiv.org/abs/2024.12346v2"');
    expect(html).toContain('href="https://arxiv.org/abs/1234.5678v1"');
    expect(html).toContain('href="https://arxiv.org/abs/0123.4567"');
    
    // Original text should be preserved in the link text
    expect(html).toContain('>2024.12345</a>');
    expect(html).toContain('>arXiv:2024.12346v2</a>');
    expect(html).toContain('>1234.5678v1</a>');
    expect(html).toContain('>arXiv:0123.4567</a>');
  });

  it('should not convert invalid arXiv-like patterns', async () => {
    const markdown = 'Invalid patterns: 24.12345, 2024.12, version1.2.3, test.12345';

    const html = await markdownToHtml(markdown);

    // These should NOT be converted to arXiv links
    expect(html).not.toContain('href="https://arxiv.org/abs/24.12345"');
    expect(html).not.toContain('href="https://arxiv.org/abs/2024.12"');
    expect(html).not.toContain('href="https://arxiv.org/abs/version1.2.3"');
    expect(html).not.toContain('href="https://arxiv.org/abs/test.12345"');
  });

  it('should handle regular URLs correctly', async () => {
    const markdown = '[Google](https://google.com) and https://example.com';

    const html = await markdownToHtml(markdown);

    // Regular URLs should not be modified
    expect(html).toContain('<a href="https://google.com"');
    expect(html).toContain('https://example.com');
  });

  it('should handle empty and whitespace-only input', async () => {
    const emptyResult = await markdownToHtml('');
    const whitespaceResult = await markdownToHtml('   \n  \t  ');

    expect(emptyResult).toBe('');
    expect(whitespaceResult.trim()).toBe('');
  });

  it('should sanitize potentially harmful content', async () => {
    const markdown = `# Title

<script>alert('xss')</script>

[Link](javascript:alert('xss'))

<img src="x" onerror="alert('xss')">`;

    const html = await markdownToHtml(markdown);

    // Should not contain any script tags or javascript: URLs
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('javascript:alert');
    expect(html).not.toContain('onerror=');
    
    // But should still contain the safe content
    expect(html).toContain('<h1');
    expect(html).toContain('Title');
  });

  it('should escape HTML in code blocks', async () => {
    const markdown = '```\n<script>alert("test")</script>\n```';

    const html = await markdownToHtml(markdown);

    // HTML should be escaped in code blocks
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;test&quot;');
    expect(html).not.toContain('<script>alert("test")</script>');
  });

  it('should handle complex research report markdown', async () => {
    const markdown = `# Weekly AI Research Trends

## Foundation Models

Recent advances in foundation models include:

- **LLaMA 2.5** (arXiv:2024.12345): Improved efficiency
- **GPT-4.5** (arXiv:2024.12346v2): Better reasoning capabilities

### Key Papers

1. [Scaling Laws](2024.11111) - Important findings
2. [Attention Mechanisms](2024.11112v1) - Novel approach

> "The future of AI lies in efficient architectures" - Research Team

Code example:
\`\`\`python
def train_model():
    return "success"
\`\`\`

For more details, see https://openai.com and arXiv:2024.99999.`;

    const html = await markdownToHtml(markdown);

    // Should contain all the expected elements with proper styling
    expect(html).toContain('<h1 style="');
    expect(html).toContain('<h2 style="');
    expect(html).toContain('<h3 style="');
    expect(html).toContain('<ul style="');
    expect(html).toContain('<ol style="');
    expect(html).toContain('<blockquote style="');
    expect(html).toContain('<pre style="');
    
    // Should have converted all arXiv references
    expect(html).toContain('href="https://arxiv.org/abs/2024.12345"');
    expect(html).toContain('href="https://arxiv.org/abs/2024.12346v2"');
    expect(html).toContain('href="https://arxiv.org/abs/2024.11111"');
    expect(html).toContain('href="https://arxiv.org/abs/2024.11112v1"');
    expect(html).toContain('href="https://arxiv.org/abs/2024.99999"');
    
    // Should preserve regular URLs
    expect(html).toContain('href="https://openai.com"');
    
    // Should have proper list styling with bold text
    expect(html).toContain('<strong>LLaMA 2.5</strong>');
    expect(html).toContain('<strong>GPT-4.5</strong>');
  });

  it('should handle special characters and prevent XSS', async () => {
    const markdown = 'Text with <>&"\' characters and [dangerous link](javascript:void(0))';

    const html = await markdownToHtml(markdown);

    // Should contain escaped characters where appropriate
    expect(html).toContain('&lt;&gt;&amp;');
    
    // Should neutralize javascript: links
    expect(html).not.toContain('javascript:void');
    expect(html).toContain('href="#"');
  });
});