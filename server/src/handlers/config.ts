/**
 * Configuration management for environment variables.
 * Provides type-safe access to application settings.
 */

export interface AppConfig {
  openrouter: {
    apiKey: string;
    model: string;
  };
  embeddings: {
    model: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
  reports: {
    recipients: string[];
  };
  arxiv: {
    maxResults: number;
    categories: string[];
  };
  lancedb: {
    uri: string;
  };
  scheduler: {
    weeklyCron: string;
  };
}

/**
 * Loads and validates configuration from environment variables.
 * Throws error if required configuration is missing.
 */
export function loadConfig(): AppConfig {
  try {
    // Required environment variables
    const requiredVars = [
      'OPENROUTER_API_KEY',
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASS',
      'SMTP_FROM'
    ];

    // Check for missing required variables
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Parse and validate SMTP port
    const smtpPortStr = process.env['SMTP_PORT'] || '587';
    const smtpPort = parseInt(smtpPortStr, 10);
    if (isNaN(smtpPort) || smtpPort <= 0 || smtpPort > 65535) {
      throw new Error(`Invalid SMTP_PORT: ${smtpPortStr}. Must be a valid port number (1-65535)`);
    }

    // Parse and validate ArXiv max results
    const arxivMaxResultsStr = process.env['ARXIV_MAX_RESULTS'] || '100';
    const arxivMaxResults = parseInt(arxivMaxResultsStr, 10);
    if (isNaN(arxivMaxResults) || arxivMaxResults <= 0) {
      throw new Error(`Invalid ARXIV_MAX_RESULTS: ${arxivMaxResultsStr}. Must be a positive integer`);
    }

    // Parse recipients list
    const recipientsStr = process.env['REPORT_RECIPIENTS'] || '';
    const recipients = recipientsStr 
      ? recipientsStr.split(',').map(email => email.trim()).filter(email => email.length > 0)
      : [];

    // Validate email format for recipients
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      throw new Error(`Invalid email addresses in REPORT_RECIPIENTS: ${invalidEmails.join(', ')}`);
    }

    // Parse ArXiv categories
    const categoriesStr = process.env['ARXIV_CATEGORIES'] || 'cs.LG,stat.ML';
    const categories = categoriesStr.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);

    // Validate cron expression format (basic validation)
    const cronExpression = process.env['WEEKLY_CRON'] || '0 8 * * MON';
    const cronParts = cronExpression.split(' ');
    if (cronParts.length !== 5) {
      throw new Error(`Invalid WEEKLY_CRON format: ${cronExpression}. Must be in format "minute hour day month weekday"`);
    }

    return {
      openrouter: {
        apiKey: process.env['OPENROUTER_API_KEY']!,
        model: process.env['OPENROUTER_MODEL'] || 'anthropic/claude-3.5-sonnet'
      },
      embeddings: {
        model: process.env['EMBEDDINGS_MODEL'] || 'text-embedding-3-large'
      },
      smtp: {
        host: process.env['SMTP_HOST']!,
        port: smtpPort,
        user: process.env['SMTP_USER']!,
        pass: process.env['SMTP_PASS']!,
        from: process.env['SMTP_FROM']!
      },
      reports: {
        recipients
      },
      arxiv: {
        maxResults: arxivMaxResults,
        categories
      },
      lancedb: {
        uri: process.env['LANCEDB_URI'] || 'file:./data/lancedb'
      },
      scheduler: {
        weeklyCron: cronExpression
      }
    };
  } catch (error) {
    console.error('Configuration validation failed:', error);
    throw error;
  }
}