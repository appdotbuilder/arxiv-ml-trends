import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { weeklyReportsTable } from '../db/schema';
import { type CreateWeeklyReportInput } from '../schema';
import { createWeeklyReport } from '../handlers/create_weekly_report';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateWeeklyReportInput = {
  run_id: '550e8400-e29b-41d4-a716-446655440000',
  subject: 'Weekly AI Research Trends Report',
  body_markdown: '# Weekly Trends\n\nThis week we observed significant developments in **Foundation Models**.',
  body_html: '<h1>Weekly Trends</h1><p>This week we observed significant developments in <strong>Foundation Models</strong>.</p>',
  emailed: false
};

describe('createWeeklyReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a weekly report', async () => {
    const result = await createWeeklyReport(testInput);

    // Validate all fields are present and correct
    expect(result.run_id).toEqual(testInput.run_id);
    expect(result.subject).toEqual(testInput.subject);
    expect(result.body_markdown).toEqual(testInput.body_markdown);
    expect(result.body_html).toEqual(testInput.body_html);
    expect(result.emailed).toEqual(false);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save weekly report to database', async () => {
    const result = await createWeeklyReport(testInput);

    // Query the database to verify the report was saved
    const reports = await db.select()
      .from(weeklyReportsTable)
      .where(eq(weeklyReportsTable.id, result.id))
      .execute();

    expect(reports).toHaveLength(1);
    const savedReport = reports[0];
    expect(savedReport.run_id).toEqual(testInput.run_id);
    expect(savedReport.subject).toEqual(testInput.subject);
    expect(savedReport.body_markdown).toEqual(testInput.body_markdown);
    expect(savedReport.body_html).toEqual(testInput.body_html);
    expect(savedReport.emailed).toEqual(false);
    expect(savedReport.created_at).toBeInstanceOf(Date);
  });

  it('should handle emailed status correctly', async () => {
    const emailedInput: CreateWeeklyReportInput = {
      ...testInput,
      emailed: true
    };

    const result = await createWeeklyReport(emailedInput);

    expect(result.emailed).toEqual(true);

    // Verify in database
    const reports = await db.select()
      .from(weeklyReportsTable)
      .where(eq(weeklyReportsTable.id, result.id))
      .execute();

    expect(reports[0].emailed).toEqual(true);
  });

  it('should create multiple reports with different run_ids', async () => {
    const secondInput: CreateWeeklyReportInput = {
      ...testInput,
      run_id: '550e8400-e29b-41d4-a716-446655440001',
      subject: 'Second Weekly Report'
    };

    const firstReport = await createWeeklyReport(testInput);
    const secondReport = await createWeeklyReport(secondInput);

    expect(firstReport.id).not.toEqual(secondReport.id);
    expect(firstReport.run_id).not.toEqual(secondReport.run_id);
    expect(firstReport.subject).not.toEqual(secondReport.subject);

    // Verify both exist in database
    const allReports = await db.select()
      .from(weeklyReportsTable)
      .execute();

    expect(allReports).toHaveLength(2);
  });

  it('should handle long content correctly', async () => {
    const longMarkdown = '# ' + 'A'.repeat(1000) + '\n\n' + 'B'.repeat(2000);
    const longHtml = '<h1>' + 'A'.repeat(1000) + '</h1><p>' + 'B'.repeat(2000) + '</p>';
    
    const longContentInput: CreateWeeklyReportInput = {
      ...testInput,
      body_markdown: longMarkdown,
      body_html: longHtml
    };

    const result = await createWeeklyReport(longContentInput);

    expect(result.body_markdown).toEqual(longMarkdown);
    expect(result.body_html).toEqual(longHtml);

    // Verify in database
    const reports = await db.select()
      .from(weeklyReportsTable)
      .where(eq(weeklyReportsTable.id, result.id))
      .execute();

    expect(reports[0].body_markdown).toEqual(longMarkdown);
    expect(reports[0].body_html).toEqual(longHtml);
  });

  it('should allow duplicate run_ids', async () => {
    // Create first report with a run_id
    const firstReport = await createWeeklyReport(testInput);
    
    // Create second report with same run_id (should be allowed)
    const duplicateInput: CreateWeeklyReportInput = {
      ...testInput,
      subject: 'Updated Report for Same Run'
    };

    const secondReport = await createWeeklyReport(duplicateInput);

    expect(firstReport.id).not.toEqual(secondReport.id);
    expect(firstReport.run_id).toEqual(secondReport.run_id);
    expect(firstReport.subject).not.toEqual(secondReport.subject);

    // Verify both reports exist with same run_id
    const reportsWithSameRunId = await db.select()
      .from(weeklyReportsTable)
      .where(eq(weeklyReportsTable.run_id, testInput.run_id))
      .execute();

    expect(reportsWithSameRunId).toHaveLength(2);
  });
});