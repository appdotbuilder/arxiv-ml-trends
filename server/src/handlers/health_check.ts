import { db } from '../db';
import { sql } from 'drizzle-orm';
import { type HealthCheck } from '../schema';

/**
 * Returns health status of the service for monitoring and load balancer checks.
 * Verifies database connectivity and essential service components.
 */
export async function healthCheck(): Promise<HealthCheck> {
  try {
    // Test database connectivity with a simple query
    await db.execute(sql`SELECT 1 as health_check`);

    // Verify essential environment variables exist (in production)
    // In test environment, database connection is managed differently
    if (process.env.NODE_ENV !== 'test') {
      const requiredEnvVars = ['DATABASE_URL'];
      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          throw new Error(`Missing required environment variable: ${envVar}`);
        }
      }
    }

    return {
      status: "ok"
    };
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
}