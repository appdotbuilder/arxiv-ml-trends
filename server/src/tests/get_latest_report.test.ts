import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { weeklyReportsTable } from '../db/schema';
import { type CreateWeeklyReportInput } from '../schema';
import { getLatestReport } from '../handlers/get_latest_report';

// Test data for weekly reports
const testReport1: CreateWeeklyReportInput = {
  run_id: '12345678-1234-1234-1234-123456789012',
  subject: 'AI Trends Weekly - Week 1',
  body_markdown: '# Week 1 Trends\nFoundation models are trending...',
  body_html: '<h1>Week 1 Trends</h1><p>Foundation models are trending...</p>',
  emailed: true
};

const testReport2: CreateWeeklyReportInput = {
  run_id: '87654321-4321-4321-4321-210987654321',
  subject: 'AI Trends Weekly - Week 2',
  body_markdown: '# Week 2 Trends\nRAG techniques are emerging...',
  body_html: '<h1>Week 2 Trends</h1><p>RAG techniques are emerging...</p>',
  emailed: false
};

const testReport3: CreateWeeklyReportInput = {
  run_id: '11111111-2222-3333-4444-555555555555',
  subject: 'AI Trends Weekly - Week 3',
  body_markdown: '# Week 3 Trends\nMultimodality is the future...',
  body_html: '<h1>Week 3 Trends</h1><p>Multimodality is the future...</p>',
  emailed: true
};

describe('getLatestReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when no reports exist', async () => {
    const result = await getLatestReport();
    expect(result).toBeNull();
  });

  it('should return the only report when one exists', async () => {
    // Create a single report
    await db.insert(weeklyReportsTable)
      .values(testReport1)
      .execute();

    const result = await getLatestReport();

    expect(result).not.toBeNull();
    expect(result!.subject).toEqual('AI Trends Weekly - Week 1');
    expect(result!.body_html).toEqual('<h1>Week 1 Trends</h1><p>Foundation models are trending...</p>');
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return the most recent report when multiple exist', async () => {
    // Create first report (older)
    await db.insert(weeklyReportsTable)
      .values(testReport1)
      .execute();

    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create second report (newer)
    await db.insert(weeklyReportsTable)
      .values(testReport2)
      .execute();

    const result = await getLatestReport();

    expect(result).not.toBeNull();
    expect(result!.subject).toEqual('AI Trends Weekly - Week 2');
    expect(result!.body_html).toEqual('<h1>Week 2 Trends</h1><p>RAG techniques are emerging...</p>');
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return the latest report among multiple reports', async () => {
    // Create reports in sequence to ensure different timestamps
    await db.insert(weeklyReportsTable)
      .values(testReport1)
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(weeklyReportsTable)
      .values(testReport2)
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(weeklyReportsTable)
      .values(testReport3)
      .execute();

    const result = await getLatestReport();

    expect(result).not.toBeNull();
    expect(result!.subject).toEqual('AI Trends Weekly - Week 3');
    expect(result!.body_html).toEqual('<h1>Week 3 Trends</h1><p>Multimodality is the future...</p>');
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should only return required fields', async () => {
    // Create a report
    await db.insert(weeklyReportsTable)
      .values(testReport1)
      .execute();

    const result = await getLatestReport();

    expect(result).not.toBeNull();
    
    // Check that only expected fields are present
    const resultKeys = Object.keys(result!);
    expect(resultKeys).toHaveLength(3);
    expect(resultKeys).toContain('subject');
    expect(resultKeys).toContain('body_html');
    expect(resultKeys).toContain('created_at');
    
    // Check that other fields like body_markdown, emailed, etc. are not present
    expect(result).not.toHaveProperty('body_markdown');
    expect(result).not.toHaveProperty('emailed');
    expect(result).not.toHaveProperty('run_id');
    expect(result).not.toHaveProperty('id');
  });

  it('should handle reports with different email statuses', async () => {
    // Create an emailed report
    await db.insert(weeklyReportsTable)
      .values({ ...testReport1, emailed: true })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a non-emailed report (should be the latest)
    await db.insert(weeklyReportsTable)
      .values({ ...testReport2, emailed: false })
      .execute();

    const result = await getLatestReport();

    expect(result).not.toBeNull();
    expect(result!.subject).toEqual('AI Trends Weekly - Week 2');
    
    // Verify that email status doesn't affect which report is returned (only recency matters)
    expect(result).not.toHaveProperty('emailed');
  });
});