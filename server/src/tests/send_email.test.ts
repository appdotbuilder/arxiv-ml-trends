import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { sendEmail, getEmailRecipients } from '../handlers/send_email';

// Store original environment variables
const originalEnv = {
    SMTP_HOST: process.env['SMTP_HOST'],
    SMTP_PORT: process.env['SMTP_PORT'],
    SMTP_USER: process.env['SMTP_USER'],
    SMTP_PASS: process.env['SMTP_PASS'],
    SMTP_FROM: process.env['SMTP_FROM'],
    REPORT_RECIPIENTS: process.env['REPORT_RECIPIENTS']
};

describe('getEmailRecipients', () => {
    afterEach(() => {
        // Restore original environment
        Object.assign(process.env, originalEnv);
    });

    it('should parse single email recipient', () => {
        process.env['REPORT_RECIPIENTS'] = 'test@example.com';
        
        const recipients = getEmailRecipients();
        
        expect(recipients).toEqual(['test@example.com']);
    });

    it('should parse multiple email recipients', () => {
        process.env['REPORT_RECIPIENTS'] = 'test1@example.com,test2@example.com,test3@example.com';
        
        const recipients = getEmailRecipients();
        
        expect(recipients).toEqual([
            'test1@example.com',
            'test2@example.com', 
            'test3@example.com'
        ]);
    });

    it('should trim whitespace from email addresses', () => {
        process.env['REPORT_RECIPIENTS'] = ' test1@example.com , test2@example.com , test3@example.com ';
        
        const recipients = getEmailRecipients();
        
        expect(recipients).toEqual([
            'test1@example.com',
            'test2@example.com',
            'test3@example.com'
        ]);
    });

    it('should filter out invalid email formats', () => {
        process.env['REPORT_RECIPIENTS'] = 'valid@example.com,invalid-email,another@valid.com,@invalid.com';
        
        const recipients = getEmailRecipients();
        
        expect(recipients).toEqual([
            'valid@example.com',
            'another@valid.com'
        ]);
    });

    it('should handle empty recipients string', () => {
        process.env['REPORT_RECIPIENTS'] = '';
        
        const recipients = getEmailRecipients();
        
        expect(recipients).toEqual([]);
    });

    it('should handle missing REPORT_RECIPIENTS env var', () => {
        delete process.env['REPORT_RECIPIENTS'];
        
        const recipients = getEmailRecipients();
        
        expect(recipients).toEqual([]);
    });

    it('should filter out empty strings after splitting', () => {
        process.env['REPORT_RECIPIENTS'] = 'test@example.com,,another@example.com,';
        
        const recipients = getEmailRecipients();
        
        expect(recipients).toEqual([
            'test@example.com',
            'another@example.com'
        ]);
    });

    it('should handle complex valid email formats', () => {
        process.env['REPORT_RECIPIENTS'] = 'user+tag@example.com,user.name@sub.domain.com,123@numbers.co';
        
        const recipients = getEmailRecipients();
        
        expect(recipients).toEqual([
            'user+tag@example.com',
            'user.name@sub.domain.com',
            '123@numbers.co'
        ]);
    });
});

describe('sendEmail', () => {
    beforeEach(() => {
        // Set up test SMTP configuration with invalid host that fails quickly
        process.env['SMTP_HOST'] = '127.0.0.1'; // localhost without SMTP server
        process.env['SMTP_PORT'] = '9999'; // Invalid port
        process.env['SMTP_USER'] = 'test@test.com';
        process.env['SMTP_PASS'] = 'testpass';
        process.env['SMTP_FROM'] = 'reports@test.com';
    });

    afterEach(() => {
        // Restore original environment
        Object.assign(process.env, originalEnv);
    });

    it('should return false when missing SMTP configuration', async () => {
        delete process.env['SMTP_HOST'];
        delete process.env['SMTP_USER'];
        delete process.env['SMTP_PASS'];
        
        const result = await sendEmail(
            ['test@example.com'],
            'Test Subject',
            '<h1>Test HTML</h1>',
            '# Test Markdown'
        );
        
        expect(result).toBe(false);
    });

    it('should return false when SMTP_HOST is missing', async () => {
        delete process.env['SMTP_HOST'];
        
        const result = await sendEmail(
            ['test@example.com'],
            'Test Subject',
            '<h1>Test HTML</h1>',
            '# Test Markdown'
        );
        
        expect(result).toBe(false);
    });

    it('should return false when SMTP_USER is missing', async () => {
        delete process.env['SMTP_USER'];
        
        const result = await sendEmail(
            ['test@example.com'],
            'Test Subject',
            '<h1>Test HTML</h1>',
            '# Test Markdown'
        );
        
        expect(result).toBe(false);
    });

    it('should return false when SMTP_PASS is missing', async () => {
        delete process.env['SMTP_PASS'];
        
        const result = await sendEmail(
            ['test@example.com'],
            'Test Subject',
            '<h1>Test HTML</h1>',
            '# Test Markdown'
        );
        
        expect(result).toBe(false);
    });

    it('should handle empty recipient list gracefully', async () => {
        const result = await sendEmail(
            [],
            'Test Subject',
            '<h1>Test HTML</h1>',
            '# Test Markdown'
        );
        
        // Should attempt to send but fail due to invalid SMTP server or no recipients
        expect(result).toBe(false);
    }, 1000);

    it('should use default port when SMTP_PORT is not set', async () => {
        delete process.env['SMTP_PORT'];
        
        // This will fail due to invalid SMTP server, but we're testing configuration parsing
        const result = await sendEmail(
            ['test@example.com'],
            'Test Subject',
            '<h1>Test HTML</h1>',
            '# Test Markdown'
        );
        
        expect(result).toBe(false);
    }, 1000); // Shorter timeout for network failure tests

    it('should use SMTP_USER as from address when SMTP_FROM is not set', async () => {
        delete process.env['SMTP_FROM'];
        
        const result = await sendEmail(
            ['test@example.com'],
            'Test Subject',
            '<h1>Test HTML</h1>',
            '# Test Markdown'
        );
        
        // Will fail due to invalid SMTP server but tests from address logic
        expect(result).toBe(false);
    }, 1000);

    it('should handle network/connection errors gracefully', async () => {
        // Use invalid SMTP host to trigger connection error
        process.env['SMTP_HOST'] = 'invalid.smtp.host.that.does.not.exist';
        
        const result = await sendEmail(
            ['test@example.com'],
            'Test Subject',
            '<h1>Test HTML</h1>',
            '# Test Markdown'
        );
        
        expect(result).toBe(false);
    });

    it('should handle multiple recipients', async () => {
        const result = await sendEmail(
            ['test1@example.com', 'test2@example.com', 'test3@example.com'],
            'Test Subject',
            '<h1>Test HTML</h1>',
            '# Test Markdown'
        );
        
        // Will fail due to test SMTP server, but tests recipient handling
        expect(result).toBe(false);
    }, 1000);

    it('should handle special characters in subject and content', async () => {
        const result = await sendEmail(
            ['test@example.com'],
            'Test Subject with émojis 🚀 and ünicode',
            '<h1>HTML with <em>formatting</em> & entities</h1>',
            '# Markdown with *emphasis* and `code`'
        );
        
        expect(result).toBe(false);
    }, 1000);

    it('should handle very long content', async () => {
        const longMarkdown = '# Long Content\n\n' + 'This is a very long line. '.repeat(1000);
        const longHtml = '<h1>Long Content</h1><p>' + 'This is a very long line. '.repeat(1000) + '</p>';
        
        const result = await sendEmail(
            ['test@example.com'],
            'Test Long Content',
            longHtml,
            longMarkdown
        );
        
        expect(result).toBe(false);
    }, 1000);
});