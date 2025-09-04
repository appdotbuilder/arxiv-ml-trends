import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { healthCheck } from '../handlers/health_check';

describe('healthCheck', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return ok status when database is healthy', async () => {
    const result = await healthCheck();

    expect(result.status).toEqual('ok');
    expect(typeof result.status).toBe('string');
  });

  it('should verify database connectivity', async () => {
    // This test ensures the handler actually connects to the database
    // If database is not available, the handler should throw
    const result = await healthCheck();

    expect(result).toBeDefined();
    expect(result.status).toEqual('ok');
  });

  it('should complete within reasonable time', async () => {
    const startTime = Date.now();
    
    await healthCheck();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Health check should complete within 1 second
    expect(duration).toBeLessThan(1000);
  });

  it('should handle multiple concurrent health checks', async () => {
    // Test that multiple health checks can run simultaneously
    const promises = Array.from({ length: 5 }, () => healthCheck());
    
    const results = await Promise.all(promises);
    
    results.forEach(result => {
      expect(result.status).toEqual('ok');
    });
  });
});