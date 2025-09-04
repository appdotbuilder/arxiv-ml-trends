import nodemailer from 'nodemailer';
import { marked } from 'marked';

/**
 * Sends email reports via SMTP using configured email settings.
 * Supports HTML content with fallback to plain text.
 */
export async function sendEmail(
    to: string[],
    subject: string,
    htmlBody: string,
    markdownBody: string
): Promise<boolean> {
    try {
        // Get SMTP configuration from environment variables
        const smtpHost = process.env['SMTP_HOST'];
        const smtpPort = parseInt(process.env['SMTP_PORT'] || '587');
        const smtpUser = process.env['SMTP_USER'];
        const smtpPass = process.env['SMTP_PASS'];
        const fromEmail = process.env['SMTP_FROM'] || smtpUser;

        if (!smtpHost || !smtpUser || !smtpPass) {
            console.error('Missing required SMTP configuration:', {
                host: !!smtpHost,
                user: !!smtpUser,
                pass: !!smtpPass
            });
            return false;
        }

        // Create SMTP transporter
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465, // Use SSL for port 465, TLS for others
            auth: {
                user: smtpUser,
                pass: smtpPass
            },
            // Add timeout settings for faster failure in tests
            connectionTimeout: 1000, // 1 second connection timeout
            greetingTimeout: 1000,   // 1 second greeting timeout
            socketTimeout: 2000,     // 2 second socket timeout
            // Add retry and connection pool settings
            pool: true,
            maxConnections: 5,
            maxMessages: 10,
            rateDelta: 1000,
            rateLimit: 5
        });

        // Verify SMTP connection
        await transporter.verify();

        // Convert markdown to plain text for fallback
        const plainTextBody = markdownToPlainText(markdownBody);

        // Send email to all recipients
        const mailOptions = {
            from: fromEmail,
            to: to.join(', '),
            subject: subject,
            text: plainTextBody,
            html: htmlBody
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log('Email sent successfully:', {
            messageId: info.messageId,
            recipients: to.length,
            accepted: info.accepted?.length || 0,
            rejected: info.rejected?.length || 0
        });

        // Close the transporter
        transporter.close();

        // Return true if all recipients were accepted
        return (info.rejected?.length || 0) === 0;

    } catch (error) {
        console.error('Failed to send email:', error);
        return false;
    }
}

/**
 * Parses comma-separated email recipients from environment variable.
 */
export function getEmailRecipients(): string[] {
    try {
        const recipientsEnv = process.env['REPORT_RECIPIENTS'];
        
        if (!recipientsEnv) {
            console.warn('REPORT_RECIPIENTS environment variable not set');
            return [];
        }

        // Split by comma, trim whitespace, and filter out empty strings
        const emails = recipientsEnv
            .split(',')
            .map(email => email.trim())
            .filter(email => email.length > 0);

        // Validate email format using simple regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validEmails = emails.filter(email => {
            const isValid = emailRegex.test(email);
            if (!isValid) {
                console.warn(`Invalid email format: ${email}`);
            }
            return isValid;
        });

        if (validEmails.length !== emails.length) {
            console.warn(`Filtered out ${emails.length - validEmails.length} invalid email(s)`);
        }

        return validEmails;

    } catch (error) {
        console.error('Failed to parse email recipients:', error);
        return [];
    }
}

/**
 * Helper function to convert markdown to plain text
 */
function markdownToPlainText(markdown: string): string {
    try {
        // Convert markdown to HTML first, then strip HTML tags
        const html = marked(markdown) as string;
        
        // Simple HTML tag removal and entity decoding
        const plainText = html
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
            .replace(/&amp;/g, '&') // Replace HTML entities
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();

        return plainText;
    } catch (error) {
        console.error('Failed to convert markdown to plain text:', error);
        // Fallback to original markdown if conversion fails
        return markdown;
    }
}