import { db } from '../db';
import { articlesRawTable, articlesEnrichedTable, weeklyReportsTable } from '../db/schema';
import { type ReportGenerationInput, type ReportResult, type TopicCount } from '../schema';
import { eq, sql, desc } from 'drizzle-orm';

/**
 * Generates a weekly trend report using LLM based on ingestion results.
 * Analyzes topic counts and representative papers to create insights.
 */
export async function generateReport(input: ReportGenerationInput): Promise<ReportResult> {
  try {
    // 1. Fetch topic counts and representative papers for the run_id
    const topicCounts = await getTopicCountsWithRepresentativePapers(input.run_id);
    
    if (topicCounts.length === 0) {
      throw new Error(`No enriched articles found for run_id: ${input.run_id}`);
    }

    // 2. Generate report content
    const { subject, bodyMarkdown } = generateReportContent(topicCounts);
    
    // 3. Convert markdown to HTML (simple conversion for now)
    const bodyHtml = convertMarkdownToHtml(bodyMarkdown);
    
    // 4. Determine if email should be sent (not in preview mode)
    const shouldEmail = !input.preview_only;
    
    // 5. Store report in weekly_reports table
    const reportData = {
      run_id: input.run_id,
      subject,
      body_markdown: bodyMarkdown,
      body_html: bodyHtml,
      emailed: shouldEmail
    };

    await db.insert(weeklyReportsTable)
      .values(reportData)
      .execute();

    return {
      subject,
      body_markdown: bodyMarkdown,
      body_html: bodyHtml,
      emailed: shouldEmail
    };
  } catch (error) {
    console.error('Report generation failed:', error);
    throw error;
  }
}

/**
 * Fetches topic counts with representative papers for a given run_id
 */
async function getTopicCountsWithRepresentativePapers(runId: string): Promise<TopicCount[]> {
  // Get topic counts using SQL aggregation
  const topicCountsResult = await db
    .select({
      primary_category: articlesEnrichedTable.primary_category,
      count: sql<number>`cast(count(*) as int)`.as('count')
    })
    .from(articlesEnrichedTable)
    .where(eq(articlesEnrichedTable.run_id, runId))
    .groupBy(articlesEnrichedTable.primary_category)
    .orderBy(desc(sql`count(*)`))
    .execute();

  // For each category, get representative papers (top 3 by impact)
  const topicCounts: TopicCount[] = [];
  
  for (const topicCount of topicCountsResult) {
    const representativePapers = await db
      .select({
        arxiv_id: articlesRawTable.arxiv_id,
        title: articlesRawTable.title,
        summary: articlesRawTable.summary,
        authors: articlesRawTable.authors,
        published: articlesRawTable.published,
        potential_impact: articlesEnrichedTable.potential_impact
      })
      .from(articlesEnrichedTable)
      .innerJoin(articlesRawTable, eq(articlesEnrichedTable.arxiv_id, articlesRawTable.arxiv_id))
      .where(eq(articlesEnrichedTable.primary_category, topicCount.primary_category))
      .orderBy(desc(articlesEnrichedTable.potential_impact))
      .limit(3)
      .execute();

    topicCounts.push({
      primary_category: topicCount.primary_category as any,
      count: topicCount.count,
      representative_papers: representativePapers.map(paper => ({
        arxiv_id: paper.arxiv_id,
        title: paper.title,
        summary: paper.summary,
        authors: paper.authors as string[],
        published: paper.published,
        potential_impact: paper.potential_impact
      }))
    });
  }

  return topicCounts;
}

/**
 * Generates report content based on topic counts and papers
 */
function generateReportContent(topicCounts: TopicCount[]): { subject: string; bodyMarkdown: string } {
  const totalPapers = topicCounts.reduce((sum, topic) => sum + topic.count, 0);
  const topCategory = topicCounts[0]?.primary_category || 'AI Research';
  
  // Generate subject line
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const subject = `Weekly ML Research Trends - ${currentDate} (${totalPapers} papers, ${topCategory} leads)`;

  // Generate markdown body
  let bodyMarkdown = `# Weekly ML Research Trends Report\n\n`;
  bodyMarkdown += `**Generated:** ${currentDate}\n`;
  bodyMarkdown += `**Total Papers Analyzed:** ${totalPapers}\n`;
  bodyMarkdown += `**Leading Topic:** ${topCategory}\n\n`;

  bodyMarkdown += `## 📊 Topic Distribution\n\n`;
  
  topicCounts.forEach((topic, index) => {
    const percentage = ((topic.count / totalPapers) * 100).toFixed(1);
    bodyMarkdown += `${index + 1}. **${topic.primary_category}**: ${topic.count} papers (${percentage}%)\n`;
  });

  bodyMarkdown += `\n## 🔬 Trending Research Areas\n\n`;

  topicCounts.slice(0, 5).forEach((topic, index) => {
    bodyMarkdown += `### ${index + 1}. ${topic.primary_category} (${topic.count} papers)\n\n`;
    
    if (topic.representative_papers.length > 0) {
      bodyMarkdown += `**Key Papers:**\n\n`;
      
      topic.representative_papers.forEach((paper, paperIndex) => {
        const authorsText = paper.authors.slice(0, 3).join(', ') + 
          (paper.authors.length > 3 ? ' et al.' : '');
        
        bodyMarkdown += `${paperIndex + 1}. **${paper.title}**\n`;
        bodyMarkdown += `   - Authors: ${authorsText}\n`;
        bodyMarkdown += `   - ArXiv ID: ${paper.arxiv_id}\n`;
        bodyMarkdown += `   - Impact Score: ${paper.potential_impact}/5\n`;
        bodyMarkdown += `   - Summary: ${paper.summary.slice(0, 200)}...\n\n`;
      });
    }
  });

  bodyMarkdown += `## 📈 Insights\n\n`;
  bodyMarkdown += `- **Most Active Area:** ${topCategory} with ${topicCounts[0]?.count || 0} papers\n`;
  
  if (topicCounts.length > 1) {
    bodyMarkdown += `- **Second Most Active:** ${topicCounts[1].primary_category} with ${topicCounts[1].count} papers\n`;
  }
  
  const highImpactPapers = topicCounts
    .flatMap(topic => topic.representative_papers)
    .filter(paper => paper.potential_impact >= 4).length;
    
  bodyMarkdown += `- **High Impact Papers:** ${highImpactPapers} papers with impact score ≥ 4\n`;
  bodyMarkdown += `- **Research Diversity:** ${topicCounts.length} distinct research categories\n\n`;

  bodyMarkdown += `---\n\n`;
  bodyMarkdown += `*This report was automatically generated from ArXiv papers and LLM classifications.*\n`;

  return { subject, bodyMarkdown };
}

/**
 * Simple markdown to HTML conversion
 */
function convertMarkdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold text
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic text
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Process lists before paragraphs
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isNumberedListItem = /^\d+\. /.test(line);
    const isBulletListItem = /^- /.test(line);
    const isListItem = isNumberedListItem || isBulletListItem;
    
    if (isListItem && !inList) {
      // Start of list
      const listType = isNumberedListItem ? 'ol' : 'ul';
      processedLines.push(`<${listType}>`);
      inList = true;
    } else if (!isListItem && inList) {
      // End of list
      processedLines.push('</ol>');
      processedLines.push('</ul>');
      inList = false;
    }
    
    if (isListItem) {
      const content = line.replace(/^\d+\. |^- /, '');
      processedLines.push(`<li>${content}</li>`);
    } else {
      processedLines.push(line);
    }
  }
  
  // Close any open list
  if (inList) {
    processedLines.push('</ol>');
    processedLines.push('</ul>');
  }
  
  html = processedLines.join('\n');
  
  // Line breaks and paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  
  // Wrap in paragraph tags
  html = '<p>' + html + '</p>';
  
  // Fix empty paragraphs and list formatting
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p><br><\/p>/g, '');
  html = html.replace(/<p>(<[ou]l>)/g, '$1');
  html = html.replace(/(<\/[ou]l>)<\/p>/g, '$1');
  html = html.replace(/<p>(<li>.*?<\/li>)<\/p>/g, '$1');
  
  // Horizontal rule
  html = html.replace(/---/g, '<hr>');
  
  return html;
}