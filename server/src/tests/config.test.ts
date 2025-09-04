import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { loadConfig, type AppConfig } from '../handlers/config';

// Store original environment to restore after tests
const originalEnv = { ...process.env };

describe('loadConfig', () => {
  beforeEach(() => {
    // Clear environment before each test
    for (const key in process.env) {
      if (key.startsWith('OPENROUTER_') || 
          key.startsWith('SMTP_') || 
          key.startsWith('REPORT_') || 
          key.startsWith('ARXIV_') || 
          key.startsWith('LANCEDB_') || 
          key.startsWith('WEEKLY_') || 
          key.startsWith('EMBEDDINGS_')) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    // Restore original environment after each test
    process.env = { ...originalEnv };
  });

  it('should load configuration with all required environment variables', () => {
    // Set all required environment variables
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';

    const config = loadConfig();

    expect(config.openrouter.apiKey).toEqual('test-api-key');
    expect(config.smtp.host).toEqual('smtp.example.com');
    expect(config.smtp.user).toEqual('user@example.com');
    expect(config.smtp.pass).toEqual('password123');
    expect(config.smtp.from).toEqual('noreply@example.com');
  });

  it('should use default values for optional configuration', () => {
    // Set only required variables
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';

    const config = loadConfig();

    expect(config.openrouter.model).toEqual('anthropic/claude-3.5-sonnet');
    expect(config.embeddings.model).toEqual('text-embedding-3-large');
    expect(config.smtp.port).toEqual(587);
    expect(config.reports.recipients).toEqual([]);
    expect(config.arxiv.maxResults).toEqual(100);
    expect(config.arxiv.categories).toEqual(['cs.LG', 'stat.ML']);
    expect(config.lancedb.uri).toEqual('file:./data/lancedb');
    expect(config.scheduler.weeklyCron).toEqual('0 8 * * MON');
  });

  it('should override defaults with custom environment values', () => {
    // Set required variables
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';

    // Set custom optional values
    process.env['OPENROUTER_MODEL'] = 'custom/model';
    process.env['EMBEDDINGS_MODEL'] = 'custom-embedding-model';
    process.env['SMTP_PORT'] = '465';
    process.env['REPORT_RECIPIENTS'] = 'user1@test.com,user2@test.com';
    process.env['ARXIV_MAX_RESULTS'] = '50';
    process.env['ARXIV_CATEGORIES'] = 'cs.AI,cs.CL,cs.CV';
    process.env['LANCEDB_URI'] = 's3://my-bucket/lancedb';
    process.env['WEEKLY_CRON'] = '0 9 * * FRI';

    const config = loadConfig();

    expect(config.openrouter.model).toEqual('custom/model');
    expect(config.embeddings.model).toEqual('custom-embedding-model');
    expect(config.smtp.port).toEqual(465);
    expect(config.reports.recipients).toEqual(['user1@test.com', 'user2@test.com']);
    expect(config.arxiv.maxResults).toEqual(50);
    expect(config.arxiv.categories).toEqual(['cs.AI', 'cs.CL', 'cs.CV']);
    expect(config.lancedb.uri).toEqual('s3://my-bucket/lancedb');
    expect(config.scheduler.weeklyCron).toEqual('0 9 * * FRI');
  });

  it('should throw error for missing required OPENROUTER_API_KEY', () => {
    // Set other required variables but not OPENROUTER_API_KEY
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';

    expect(() => loadConfig()).toThrow(/Missing required environment variables.*OPENROUTER_API_KEY/i);
  });

  it('should throw error for missing required SMTP variables', () => {
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    // Missing SMTP variables

    expect(() => loadConfig()).toThrow(/Missing required environment variables.*SMTP_HOST.*SMTP_USER.*SMTP_PASS.*SMTP_FROM/i);
  });

  it('should throw error for invalid SMTP port', () => {
    // Set all required variables
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';
    
    // Set invalid port
    process.env['SMTP_PORT'] = 'not-a-number';

    expect(() => loadConfig()).toThrow(/Invalid SMTP_PORT.*not-a-number/i);
  });

  it('should throw error for port out of range', () => {
    // Set all required variables
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';
    
    // Set port out of range
    process.env['SMTP_PORT'] = '99999';

    expect(() => loadConfig()).toThrow(/Invalid SMTP_PORT.*99999/i);
  });

  it('should throw error for invalid ARXIV_MAX_RESULTS', () => {
    // Set all required variables
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';
    
    // Set invalid max results
    process.env['ARXIV_MAX_RESULTS'] = '-5';

    expect(() => loadConfig()).toThrow(/Invalid ARXIV_MAX_RESULTS.*-5/i);
  });

  it('should throw error for invalid email addresses in recipients', () => {
    // Set all required variables
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';
    
    // Set invalid email addresses
    process.env['REPORT_RECIPIENTS'] = 'valid@test.com,invalid-email,another@invalid';

    expect(() => loadConfig()).toThrow(/Invalid email addresses.*invalid-email.*another@invalid/i);
  });

  it('should throw error for invalid cron expression', () => {
    // Set all required variables
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';
    
    // Set invalid cron expression
    process.env['WEEKLY_CRON'] = '0 8 * *'; // Missing weekday field

    expect(() => loadConfig()).toThrow(/Invalid WEEKLY_CRON format.*0 8 \* \*/i);
  });

  it('should handle empty recipients list gracefully', () => {
    // Set all required variables
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';
    
    // Set empty recipients
    process.env['REPORT_RECIPIENTS'] = '';

    const config = loadConfig();

    expect(config.reports.recipients).toEqual([]);
  });

  it('should handle recipients with whitespace correctly', () => {
    // Set all required variables
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';
    
    // Set recipients with extra whitespace
    process.env['REPORT_RECIPIENTS'] = '  user1@test.com  ,  user2@test.com  ,  ';

    const config = loadConfig();

    expect(config.reports.recipients).toEqual(['user1@test.com', 'user2@test.com']);
  });

  it('should handle categories with whitespace correctly', () => {
    // Set all required variables
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';
    
    // Set categories with extra whitespace
    process.env['ARXIV_CATEGORIES'] = '  cs.AI  ,  cs.CL  ,  ';

    const config = loadConfig();

    expect(config.arxiv.categories).toEqual(['cs.AI', 'cs.CL']);
  });

  it('should validate port boundary values', () => {
    // Set all required variables
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'password123';
    process.env['SMTP_FROM'] = 'noreply@example.com';
    
    // Test valid boundary values
    process.env['SMTP_PORT'] = '1';
    expect(() => loadConfig()).not.toThrow();
    
    process.env['SMTP_PORT'] = '65535';
    expect(() => loadConfig()).not.toThrow();
    
    // Test invalid boundary values
    process.env['SMTP_PORT'] = '0';
    expect(() => loadConfig()).toThrow(/Invalid SMTP_PORT/i);
    
    process.env['SMTP_PORT'] = '65536';
    expect(() => loadConfig()).toThrow(/Invalid SMTP_PORT/i);
  });
});