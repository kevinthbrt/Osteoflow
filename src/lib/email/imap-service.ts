import type { ImapFlow as ImapFlowType } from 'imapflow'

// Runtime require hidden from Turbopack's static analysis.
// Same fix as better-sqlite3: prevents Turbopack from appending a hash
// to the module name in compiled output.
// eslint-disable-next-line no-eval
const { ImapFlow } = eval('require')('imapflow') as { ImapFlow: new (...args: ConstructorParameters<typeof ImapFlowType>) => ImapFlowType }

export interface ImapSettings {
  imap_host: string
  imap_port: number
  imap_secure: boolean
  imap_user: string
  imap_password: string
}

export interface EmailMessage {
  uid: number
  messageId: string
  from: {
    name?: string
    email: string
  }
  to: Array<{
    name?: string
    email: string
  }>
  subject: string
  date: Date
  textContent?: string
  htmlContent?: string
  inReplyTo?: string
  references?: string[]
}

export interface FetchEmailsResult {
  success: boolean
  emails: EmailMessage[]
  lastUid: number
  error?: string
}

/**
 * Create an IMAP client
 */
function createImapClient(settings: ImapSettings): ImapFlowType {
  return new ImapFlow({
    host: settings.imap_host,
    port: settings.imap_port,
    secure: settings.imap_secure,
    auth: {
      user: settings.imap_user,
      pass: settings.imap_password,
    },
    logger: false, // Disable logging in production
  })
}

/**
 * Parse email address from IMAP format
 */
function parseEmailAddress(addr: { name?: string; address?: string } | undefined): { name?: string; email: string } | null {
  if (!addr || !addr.address) return null
  return {
    name: addr.name || undefined,
    email: addr.address,
  }
}

/**
 * Extract text content from email parts
 */
function extractTextFromParts(parts: unknown): { text?: string; html?: string } {
  const result: { text?: string; html?: string } = {}

  function traverse(part: unknown): void {
    if (!part || typeof part !== 'object') return

    const p = part as {
      type?: string
      disposition?: string
      content?: unknown
      childNodes?: unknown[]
    }

    // Skip attachments
    if (p.disposition === 'attachment') return

    if (p.type === 'text/plain' && p.content) {
      result.text = String(p.content)
    } else if (p.type === 'text/html' && p.content) {
      result.html = String(p.content)
    }

    if (Array.isArray(p.childNodes)) {
      for (const child of p.childNodes) {
        traverse(child)
      }
    }
  }

  traverse(parts)
  return result
}

function decodeQuotedPrintable(input: string): string {
  const normalized = input.replace(/=\r?\n/g, '')
  const bytes: number[] = []

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i]
    if (char === '=' && i + 2 < normalized.length) {
      const hex = normalized.slice(i + 1, i + 3)
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(Number.parseInt(hex, 16))
        i += 2
        continue
      }
    }

    if (char) {
      const encoded = Buffer.from(char, 'utf8')
      bytes.push(...encoded)
    }
  }

  return Buffer.from(bytes).toString('utf8')
}

function normalizeEmailContent(content?: string): string | undefined {
  if (!content) return undefined
  const decoded = decodeQuotedPrintable(content)
  return decoded.replace(/=\s*$/g, '').trim()
}

/**
 * Fetch new emails since a given UID
 */
export async function fetchNewEmails(
  settings: ImapSettings,
  sinceUid: number = 0
): Promise<FetchEmailsResult> {
  const client = createImapClient(settings)
  const emails: EmailMessage[] = []
  let lastUid = sinceUid

  try {
    await client.connect()

    // Select INBOX
    const mailbox = await client.mailboxOpen('INBOX')
    if (!mailbox.exists || mailbox.exists === 0) {
      return { success: true, emails: [], lastUid: sinceUid }
    }

    // Build search query for messages newer than sinceUid
    const searchQuery = sinceUid > 0 ? { uid: `${sinceUid + 1}:*` } : { seen: false }

    // Fetch messages
    for await (const message of client.fetch(searchQuery, {
      uid: true,
      envelope: true,
      source: true,
      bodyStructure: true,
    })) {
      if (!message.envelope) continue

      // Skip if we've already processed this UID
      if (message.uid <= sinceUid) continue

      const envelope = message.envelope
      const from = parseEmailAddress(envelope.from?.[0])

      if (!from) continue

      const email: EmailMessage = {
        uid: message.uid,
        messageId: envelope.messageId || `uid-${message.uid}`,
        from,
        to: (envelope.to || [])
          .map(addr => parseEmailAddress(addr))
          .filter((addr): addr is { name?: string; email: string } => addr !== null),
        subject: envelope.subject || '(sans objet)',
        date: envelope.date || new Date(),
        inReplyTo: envelope.inReplyTo || undefined,
        references: (envelope as { references?: string[] }).references || undefined,
      }

      // Try to extract body content
      if (message.source) {
        try {
          // Parse the raw email source to extract text
          const source = message.source.toString()

          // Simple extraction - look for plain text between boundaries
          const textMatch = source.match(/Content-Type: text\/plain[^]*?\r\n\r\n([^]*?)(?:\r\n--|\r\n\r\n$)/i)
          if (textMatch) {
            email.textContent = normalizeEmailContent(textMatch[1])
          }

          const htmlMatch = source.match(/Content-Type: text\/html[^]*?\r\n\r\n([^]*?)(?:\r\n--|\r\n\r\n$)/i)
          if (htmlMatch) {
            email.htmlContent = normalizeEmailContent(htmlMatch[1])
          }

          // If no multipart, try simple body
          if (!email.textContent && !email.htmlContent) {
            const bodyStart = source.indexOf('\r\n\r\n')
            if (bodyStart > -1) {
              const body = source.substring(bodyStart + 4).trim()
              const normalized = normalizeEmailContent(body)
              // Detect if the body is HTML and categorize accordingly
              if (normalized && /^\s*<(!DOCTYPE|html|head|body)/i.test(normalized)) {
                email.htmlContent = normalized
              } else {
                email.textContent = normalized
              }
            }
          }
        } catch {
          // Ignore parsing errors
        }
      }

      emails.push(email)
      lastUid = Math.max(lastUid, message.uid)
    }

    return { success: true, emails, lastUid }
  } catch (error) {
    console.error('IMAP fetch error:', error)
    return {
      success: false,
      emails: [],
      lastUid: sinceUid,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    try {
      await client.logout()
    } catch {
      // Ignore logout errors
    }
  }
}

/**
 * Test IMAP connection
 */
export async function testImapConnection(settings: ImapSettings): Promise<{
  success: boolean
  error?: string
}> {
  const client = createImapClient(settings)

  try {
    await client.connect()
    await client.mailboxOpen('INBOX')
    return { success: true }
  } catch (error) {
    console.error('IMAP connection test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  } finally {
    try {
      await client.logout()
    } catch {
      // Ignore logout errors
    }
  }
}

/**
 * Strip HTML tags and decode entities for plain text display
 */
export function htmlToPlainText(html: string): string {
  return html
    // Remove scripts and styles
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Replace block elements with newlines
    .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
    // Remove other tags
    .replace(/<[^>]+>/g, '')
    // Decode common named entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Decode numeric HTML entities (&#233; -> é, &#160; -> non-breaking space, etc.)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Extract the reply content from an email (remove quoted replies)
 */
export function extractReplyContent(text: string): string {
  // Common reply indicators in French and English
  const replyIndicators = [
    /^>.*$/gm, // Quoted lines starting with >
    /^Le .+ a écrit\s*:.*$/gmi, // French: "Le ... a écrit :"
    /^On .+ wrote:.*$/gmi, // English: "On ... wrote:"
    /^-{3,}.*Original Message.*-{3,}$/gmi,
    /^_{3,}$/gm,
    /^De\s*:.+$/gmi, // French: "De: ..."
    /^From:.+$/gmi, // English: "From: ..."
    /^Envoyé\s*:.+$/gmi, // French: "Envoyé: ..."
    /^Sent:.+$/gmi, // English: "Sent: ..."
  ]

  let content = text

  // Find the first reply indicator and cut there
  for (const pattern of replyIndicators) {
    const match = content.match(pattern)
    if (match && match.index !== undefined) {
      content = content.substring(0, match.index).trim()
    }
  }

  return content || text
}
