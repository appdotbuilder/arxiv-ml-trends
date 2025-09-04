import { db } from '../db';
import { weeklyReportsTable } from '../db/schema';
import { type LatestReportResponse } from '../schema';
import { desc } from 'drizzle-orm';

/**
 * Retrieves the subject and HTML body of the most recent weekly report.
 * Used by the frontend dashboard to display the latest trends.
 */
export async function getLatestReport(): Promise<LatestReportResponse | null> {
  try {
    // Query the most recent weekly report ordered by created_at DESC
    const results = await db.select({
      subject: weeklyReportsTable.subject,
      body_html: weeklyReportsTable.body_html,
      created_at: weeklyReportsTable.created_at
    })
    .from(weeklyReportsTable)
    .orderBy(desc(weeklyReportsTable.created_at))
    .limit(1)
    .execute();

    // Return null if no reports exist
    if (results.length === 0) {
      return null;
    }

    // Return the latest report data
    return results[0];
  } catch (error) {
    console.error('Failed to retrieve latest report:', error);
    throw error;
  }
}