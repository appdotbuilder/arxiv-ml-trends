import { db } from '../db';
import { weeklyReportsTable } from '../db/schema';
import { type CreateWeeklyReportInput, type WeeklyReport } from '../schema';

/**
 * Creates a new weekly report entry in the database.
 * Stores both markdown and HTML versions of the report.
 */
export async function createWeeklyReport(input: CreateWeeklyReportInput): Promise<WeeklyReport> {
  try {
    // Insert weekly report record
    const result = await db.insert(weeklyReportsTable)
      .values({
        run_id: input.run_id,
        subject: input.subject,
        body_markdown: input.body_markdown,
        body_html: input.body_html,
        emailed: input.emailed
      })
      .returning()
      .execute();

    const weeklyReport = result[0];
    return {
      id: weeklyReport.id,
      run_id: weeklyReport.run_id,
      subject: weeklyReport.subject,
      body_markdown: weeklyReport.body_markdown,
      body_html: weeklyReport.body_html,
      emailed: weeklyReport.emailed,
      created_at: weeklyReport.created_at
    };
  } catch (error) {
    console.error('Weekly report creation failed:', error);
    throw error;
  }
}