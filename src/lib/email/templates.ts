// Default email templates
export const defaultEmailTemplates = {
  invoice: {
    subject: 'Votre facture {{invoice_number}} - {{practice_name}}',
    body: `Bonjour {{patient_first_name}},

Veuillez trouver ci-joint votre facture n°{{invoice_number}} d'un montant de {{invoice_amount}} pour votre consultation du {{invoice_date}}.

Merci de votre confiance.

Cordialement,
{{practitioner_name}}
{{practitioner_specialty}}`,
  },
  follow_up_7d: {
    subject: 'Comment allez-vous ? - {{practice_name}}',
    body: `Bonjour {{patient_first_name}},

Votre séance du {{consultation_date}} remonte à quelques jours maintenant. Comment vous sentez-vous ?

Si vous avez des questions ou la moindre préoccupation, n'hésitez surtout pas à me contacter. Je reste à votre entière disposition.

Je vous souhaite une excellente continuation.`,
  },
}

// Replace template variables
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }
  return result
}

// Convert plain text to simple HTML
export function textToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() === '' ? '<br>' : `<p>${line}</p>`))
    .join('')
}

export function createInvoiceHtmlEmail({
  bodyText,
  practitionerName,
  practiceName,
  primaryColor = '#2563eb',
  googleReviewUrl,
}: {
  bodyText: string
  practitionerName: string
  practiceName?: string | null
  primaryColor?: string
  googleReviewUrl?: string | null
}): string {
  const bodyHtml = textToHtml(bodyText)
  const reviewSection = googleReviewUrl
    ? `
      <div style="margin-top: 24px; padding: 16px; border-radius: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: #0f172a;">Votre avis compte énormément</p>
        <p style="margin: 0 0 16px 0; color: #475569;">
          Quelques secondes suffisent pour partager votre expérience et aider d'autres patients.
        </p>
        <a href="${googleReviewUrl}" style="display: inline-block; padding: 10px 18px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: 600;">
          Laisser un avis Google
        </a>
      </div>
    `
    : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${practiceName || practitionerName}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
        <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
          <div style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            <div style="padding: 24px 32px; background: linear-gradient(135deg, ${primaryColor} 0%, #0f172a 100%); color: #ffffff;">
              <p style="margin: 0; font-size: 14px; opacity: 0.8;">Osteoflow</p>
              <h1 style="margin: 8px 0 0; font-size: 22px;">Votre facture est disponible</h1>
              <p style="margin: 8px 0 0; font-size: 15px; opacity: 0.9;">
                ${practiceName || practitionerName}
              </p>
            </div>
            <div style="padding: 32px;">
              ${bodyHtml}
              ${reviewSection}
            </div>
          </div>
          <p style="text-align: center; margin-top: 16px; color: #94a3b8; font-size: 12px;">
            Envoyé via Osteoflow
          </p>
        </div>
      </body>
    </html>
  `
}

/**
 * Create a beautiful HTML email for J+7 follow-up.
 * IMPORTANT: No consultation reason/motif for patient privacy.
 */
export function createFollowUpHtmlEmail({
  bodyText,
  practitionerName,
  practiceName,
  primaryColor = '#2563eb',
  googleReviewUrl,
}: {
  bodyText: string
  practitionerName: string
  practiceName?: string | null
  primaryColor?: string
  googleReviewUrl?: string | null
}): string {
  const bodyHtml = textToHtml(bodyText)
  const reviewSection = googleReviewUrl
    ? `
      <div style="margin-top: 24px; padding: 20px; border-radius: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #0f172a;">Votre avis compte beaucoup</p>
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b;">
          Si vous avez apprécié votre prise en charge, un avis Google serait très précieux.
        </p>
        <a href="${googleReviewUrl}" style="display: inline-block; padding: 10px 24px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 14px;">
          Laisser un avis
        </a>
      </div>
    `
    : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Suivi - ${practiceName || practitionerName}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
        <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
          <div style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            <!-- Header -->
            <div style="padding: 28px 32px; background: linear-gradient(135deg, ${primaryColor} 0%, #0f172a 100%); color: #ffffff; text-align: center;">
              <div style="width: 56px; height: 56px; margin: 0 auto 16px; background-color: rgba(255,255,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 28px; line-height: 56px;">&#128075;</span>
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Comment allez-vous ?</h1>
              <p style="margin: 8px 0 0; font-size: 15px; opacity: 0.85;">
                ${practiceName || practitionerName}
              </p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
              <div style="font-size: 15px; line-height: 1.7; color: #334155;">
                ${bodyHtml}
              </div>

              <!-- Info box -->
              <div style="margin-top: 24px; padding: 16px 20px; border-radius: 12px; background-color: #eff6ff; border-left: 4px solid ${primaryColor};">
                <p style="margin: 0; font-size: 14px; color: #1e40af; font-weight: 500;">
                  En cas de besoin, n'hésitez pas à reprendre rendez-vous. Je reste disponible pour vous accompagner.
                </p>
              </div>

              ${reviewSection}
            </div>

            <!-- Footer -->
            <div style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 14px; color: #64748b; font-weight: 600;">
                ${practitionerName}
              </p>
              ${practiceName ? `<p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">${practiceName}</p>` : ''}
            </div>
          </div>
          <p style="text-align: center; margin-top: 16px; color: #94a3b8; font-size: 12px;">
            Envoyé via Osteoflow
          </p>
        </div>
      </body>
    </html>
  `
}
