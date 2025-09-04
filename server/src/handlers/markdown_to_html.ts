import { marked } from 'marked';

/**
 * Converts Markdown content to HTML using the marked library.
 * Handles arXiv links and ensures proper formatting for email.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  try {
    // Configure marked for email-friendly HTML
    marked.setOptions({
      breaks: true, // Convert single line breaks to <br>
      gfm: true, // GitHub Flavored Markdown
    });

    // Custom renderer for email-safe styling
    const renderer = new marked.Renderer();
    
    // Override link rendering to handle arXiv links specifically
    renderer.link = ({ href, title, tokens }) => {
      // Convert arXiv IDs to proper URLs if they're not already URLs
      if (href && !href.startsWith('http') && href.match(/^\d{4}\.\d{4,5}(v\d+)?$/)) {
        href = `https://arxiv.org/abs/${href}`;
      }
      
      const titleAttr = title ? ` title="${title}"` : '';
      const text = renderer.parser.parseInline(tokens);
      return `<a href="${href}"${titleAttr} style="color: #0066cc; text-decoration: underline;">${text}</a>`;
    };

    // Override heading rendering with inline styles for email
    renderer.heading = ({ tokens, depth }) => {
      const styles = {
        1: 'font-size: 24px; font-weight: bold; margin: 20px 0 16px 0; color: #333;',
        2: 'font-size: 20px; font-weight: bold; margin: 16px 0 12px 0; color: #333;',
        3: 'font-size: 16px; font-weight: bold; margin: 12px 0 8px 0; color: #333;',
        4: 'font-size: 14px; font-weight: bold; margin: 8px 0 4px 0; color: #333;',
        5: 'font-size: 12px; font-weight: bold; margin: 4px 0 2px 0; color: #333;',
        6: 'font-size: 11px; font-weight: bold; margin: 4px 0 2px 0; color: #333;'
      };
      
      const style = styles[depth as keyof typeof styles] || styles[6];
      const text = renderer.parser.parseInline(tokens);
      return `<h${depth} style="${style}">${text}</h${depth}>`;
    };

    // Override paragraph rendering with email-safe styling
    renderer.paragraph = ({ tokens }) => {
      const text = renderer.parser.parseInline(tokens);
      return `<p style="margin: 12px 0; line-height: 1.6; color: #333;">${text}</p>`;
    };

    // Override list rendering with email-safe styling
    renderer.list = (token) => {
      const tag = token.ordered ? 'ol' : 'ul';
      const style = 'margin: 12px 0; padding-left: 24px; color: #333;';
      let body = '';
      for (const item of token.items) {
        body += renderer.listitem(item);
      }
      return `<${tag} style="${style}">${body}</${tag}>`;
    };

    renderer.listitem = (token) => {
      let text = '';
      for (const subToken of token.tokens) {
        text += renderer.parser.parse([subToken]);
      }
      return `<li style="margin: 4px 0; line-height: 1.6;">${text}</li>`;
    };

    // Override code rendering
    renderer.code = ({ text, lang }) => {
      return `<pre style="background-color: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; margin: 12px 0;"><code style="font-family: monospace; font-size: 13px; color: #333;">${escapeHtml(text)}</code></pre>`;
    };

    renderer.codespan = ({ text }) => {
      return `<code style="background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 90%; color: #e74c3c;">${escapeHtml(text)}</code>`;
    };

    // Override blockquote rendering
    renderer.blockquote = ({ tokens }) => {
      const text = renderer.parser.parse(tokens);
      return `<blockquote style="border-left: 4px solid #ddd; margin: 12px 0; padding: 8px 16px; color: #666; font-style: italic;">${text}</blockquote>`;
    };

    // Convert markdown to HTML
    let html = await marked(markdown, { renderer });

    // Post-process arXiv references in the text
    // Look for patterns like "arXiv:2024.12345" or just "2024.12345" and convert to links
    html = html.replace(/(?:arXiv:)?(\d{4}\.\d{4,5}(?:v\d+)?)/g, (match: string, arxivId: string) => {
      // Don't replace if it's already inside a link
      return `<a href="https://arxiv.org/abs/${arxivId}" style="color: #0066cc; text-decoration: underline;">${match}</a>`;
    });

    // Basic HTML sanitization - remove script tags and dangerous attributes
    html = sanitizeHtml(html);

    return html;
  } catch (error) {
    console.error('Markdown to HTML conversion failed:', error);
    throw error;
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Basic HTML sanitization for email safety
 */
function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // Remove dangerous event handlers
  html = html.replace(/\s*on\w+\s*=\s*"[^"]*"/gi, '');
  html = html.replace(/\s*on\w+\s*=\s*'[^']*'/gi, '');
  
  // Remove javascript: links
  html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  
  // Remove data: and vbscript: links
  html = html.replace(/href\s*=\s*["'](?:data|vbscript):[^"']*["']/gi, 'href="#"');
  
  return html;
}