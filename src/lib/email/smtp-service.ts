import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

export interface EmailSettings {
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_user: string
  smtp_password: string
  from_name?: string
  from_email: string
}

export interface SendEmailOptions {
  to: string
  subject: string
  text?: string
  html?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
  replyTo?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Create a nodemailer transporter from email settings
 */
export function createTransporter(settings: EmailSettings): Transporter<SMTPTransport.SentMessageInfo> {
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: settings.smtp_secure, // true for 465, false for other ports
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_password,
    },
    // Timeout settings
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 30000,
  })
}

/**
 * Send an email using the practitioner's SMTP settings
 */
export async function sendEmail(
  settings: EmailSettings,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const transporter = createTransporter(settings)

  try {
    const fromAddress = settings.from_name
      ? `"${settings.from_name}" <${settings.from_email}>`
      : settings.from_email

    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo || settings.from_email,
      attachments: options.attachments,
    })

    return {
      success: true,
      messageId: info.messageId,
    }
  } catch (error) {
    console.error('SMTP send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    transporter.close()
  }
}

/**
 * Test SMTP connection
 */
export async function testSmtpConnection(settings: EmailSettings): Promise<{
  success: boolean
  error?: string
}> {
  const transporter = createTransporter(settings)

  try {
    await transporter.verify()
    return { success: true }
  } catch (error) {
    console.error('SMTP connection test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  } finally {
    transporter.close()
  }
}

/**
 * Convert plain text to HTML (preserving line breaks)
 */
export function textToHtml(text: string): string {
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const paragraphs = escapedText.split(/\n\n+/)
  return paragraphs
    .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/**
 * Create HTML email with professional styling
 */
export function createHtmlEmail(
  content: string,
  practitioner?: {
    first_name?: string
    last_name?: string
    practice_name?: string
    address?: string
    city?: string
    postal_code?: string
    phone?: string
    email?: string
  },
  options?: {
    includeFooter?: boolean
  }
): string {
  const htmlContent = textToHtml(content)
  const includeFooter = options?.includeFooter ?? true

  let footer = ''
  if (practitioner && includeFooter) {
    const name = [practitioner.first_name, practitioner.last_name].filter(Boolean).join(' ')
    const addressParts = [
      practitioner.address,
      [practitioner.postal_code, practitioner.city].filter(Boolean).join(' '),
    ].filter(Boolean)

    footer = `
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
        <p style="margin: 0 0 4px 0; font-weight: 500; color: #374151;">${name}</p>
        ${practitioner.practice_name ? `<p style="margin: 0 0 4px 0;">${practitioner.practice_name}</p>` : ''}
        ${addressParts.length > 0 ? `<p style="margin: 0 0 4px 0;">${addressParts.join('<br>')}</p>` : ''}
        ${practitioner.phone ? `<p style="margin: 0 0 4px 0;">Tél: ${practitioner.phone}</p>` : ''}
      </div>
    `
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px;">
          <div style="background-color: white; padding: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            ${htmlContent}
            ${footer}
          </div>
          <p style="text-align: center; margin-top: 16px; color: #9ca3af; font-size: 12px;">
            Envoyé via Osteoflow
          </p>
        </div>
      </body>
    </html>
  `
}
