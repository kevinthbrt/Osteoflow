// Default email templates
export interface ExerciseProgramEmailData {
  patientFirstName: string
  prescriptionTitle: string
  exerciseNames: Array<{ name: string; region: string }>
  practitionerName: string
  practiceName?: string | null
  specialty?: string | null
  primaryColor?: string
}

export function createExerciseProgramHtmlEmail({
  patientFirstName,
  prescriptionTitle,
  exerciseNames,
  practitionerName,
  practiceName,
  specialty,
  primaryColor = '#0F766E',
}: ExerciseProgramEmailData): string {
  const exerciseList = exerciseNames
    .map(
      (e) =>
        `<li style="margin-bottom: 8px; color: #334155;">
          <strong>${e.name}</strong>
          <span style="color: #64748b; font-size: 13px;"> — ${e.region}</span>
        </li>`
    )
    .join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Programme d'exercices - ${practiceName || practitionerName}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
        <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
          <div style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">

            <!-- Header -->
            <div style="padding: 28px 32px; background: linear-gradient(135deg, ${primaryColor} 0%, #0f172a 100%); color: #ffffff; text-align: center;">
              <div style="width: 56px; height: 56px; margin: 0 auto 16px; background-color: rgba(255,255,255,0.15); border-radius: 50%; line-height: 56px; font-size: 28px;">
                &#127947;
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Votre programme d'exercices</h1>
              <p style="margin: 8px 0 0; font-size: 15px; opacity: 0.85;">
                ${practiceName || practitionerName}
              </p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.7;">
                Bonjour ${patientFirstName},
              </p>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.7;">
                Veuillez trouver ci-joint votre programme d'exercices personnalisé : <strong>${prescriptionTitle}</strong>.
              </p>

              <!-- Exercise list -->
              <div style="background-color: #f0fdfa; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 0.05em;">
                  Programme — ${exerciseNames.length} exercice${exerciseNames.length > 1 ? 's' : ''}
                </p>
                <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; line-height: 1.6;">
                  ${exerciseList}
                </ul>
              </div>

              <!-- Info box -->
              <div style="padding: 16px 20px; border-radius: 12px; background-color: #f8fafc; border-left: 4px solid ${primaryColor}; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
                  Le PDF détaillant chaque exercice (description, paramètres) est joint à cet email. N'hésitez pas à me contacter si vous avez des questions.
                </p>
              </div>

              <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.7;">
                Prenez soin de vous.
              </p>
            </div>

            <!-- Footer -->
            <div style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 14px; color: #64748b; font-weight: 600;">${practitionerName}</p>
              ${specialty ? `<p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">${specialty}</p>` : ''}
              ${practiceName ? `<p style="margin: 2px 0 0; font-size: 13px; color: #94a3b8;">${practiceName}</p>` : ''}
            </div>
          </div>
          <p style="text-align: center; margin-top: 16px; color: #94a3b8; font-size: 12px;">
            Envoyé via MyOsteoFlow
          </p>
        </div>
      </body>
    </html>
  `
}

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

Votre séance du {{consultation_date}} remonte à {{days}} jours maintenant.

Afin de me dire comment vous vous sentez aujourd'hui, vous pouvez remplir ce court questionnaire qui ne vous prendra que quelques secondes.

Si vous avez des questions ou la moindre préoccupation, n'hésitez surtout pas à me contacter. Je reste à votre entière disposition.

Je vous souhaite une excellente continuation.`,
  },
  post_session_advice: {
    subject: 'Conseils post-séance - {{practice_name}}',
    body: `Bonjour {{patient_first_name}},

Merci pour votre visite. Voici quelques conseils pour optimiser les bienfaits de votre séance :

Bougez régulièrement et privilégiez la marche.
Hydratez-vous bien dans les prochains jours.
Reprenez vos activités physiques de manière progressive.
Il est possible de ressentir quelques courbatures ou une légère fatigue dans les 24 à 48h. C'est tout à fait normal.

N'hésitez pas à me contacter si vous avez la moindre question.

Prenez soin de vous.`,
  },
  patient_relaunch: {
    subject: 'Prenez soin de vous - {{practice_name}}',
    body: `Bonjour {{patient_first_name}},

Cela fait quelque temps que nous n'avons pas eu l'occasion de nous voir au cabinet, et je souhaitais simplement prendre de vos nouvelles.

J'espère que vous allez bien. Si vous ressentez actuellement une gêne, des douleurs, une perte de mobilité ou simplement le besoin de faire le point, je reste bien entendu disponible pour vous accompagner.

Il n'est pas nécessaire de consulter systématiquement lorsque tout va bien. Ce message est simplement une invitation, en toute bienveillance, à ne pas laisser une gêne persistante s'installer et à prendre soin de vous lorsque vous en ressentez le besoin.

Vous pouvez consulter les créneaux disponibles et prendre rendez-vous en ligne.

Au plaisir de vous revoir,

Bien cordialement,`,
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
              <p style="margin: 0; font-size: 14px; opacity: 0.8;">MyOsteoFlow</p>
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
            Envoyé via MyOsteoFlow
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
  specialty,
  primaryColor = '#2563eb',
  googleReviewUrl,
  surveyUrl,
}: {
  bodyText: string
  practitionerName: string
  practiceName?: string | null
  specialty?: string | null
  primaryColor?: string
  googleReviewUrl?: string | null
  surveyUrl?: string | null
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

              ${surveyUrl ? `
              <!-- Survey CTA - right under "Comment vous sentez-vous" -->
              <div style="margin-top: 20px; text-align: center;">
                <a href="${surveyUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 15px;">
                  Répondre au questionnaire
                </a>
                <p style="margin: 12px 0 0 0; font-size: 13px; color: #94a3b8;">
                  Cela ne prend que 30 secondes
                </p>
              </div>
              ` : ''}

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
              ${specialty ? `<p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">${specialty}</p>` : ''}
              ${practiceName ? `<p style="margin: 2px 0 0; font-size: 13px; color: #94a3b8;">${practiceName}</p>` : ''}
            </div>
          </div>
          <p style="text-align: center; margin-top: 16px; color: #94a3b8; font-size: 12px;">
            Envoyé via MyOsteoFlow
          </p>
        </div>
      </body>
    </html>
  `
}

/**
 * Create a beautiful HTML email for post-session advice.
 * Includes standard osteopathy aftercare tips in French.
 */
export function createPostSessionAdviceHtmlEmail({
  bodyText,
  practitionerName,
  practiceName,
  specialty,
  primaryColor = '#2563eb',
  googleReviewUrl,
}: {
  bodyText: string
  practitionerName: string
  practiceName?: string | null
  specialty?: string | null
  primaryColor?: string
  googleReviewUrl?: string | null
}): string {
  const bodyHtml = textToHtml(bodyText)
  const reviewSection = googleReviewUrl
    ? `
      <div style="margin-top: 28px; padding: 20px; border-radius: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; text-align: center;">
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
        <title>Conseils post-séance - ${practiceName || practitionerName}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
        <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
          <div style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            <!-- Header -->
            <div style="padding: 28px 32px; background: linear-gradient(135deg, ${primaryColor} 0%, #0f172a 100%); color: #ffffff; text-align: center;">
              <div style="width: 56px; height: 56px; margin: 0 auto 16px; background-color: rgba(255,255,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 28px; line-height: 56px;">&#9889;</span>
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Conseils après votre séance d'ostéopathie</h1>
              <p style="margin: 8px 0 0; font-size: 15px; opacity: 0.85;">
                ${practiceName || practitionerName}
              </p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
              <div style="font-size: 15px; line-height: 1.7; color: #334155;">
                ${bodyHtml}
              </div>

              <!-- Advice cards -->
              <div style="margin-top: 28px;">
                <div style="padding: 16px 20px; border-radius: 12px; background-color: #f0fdf4; border-left: 4px solid #22c55e; margin-bottom: 12px;">
                  <p style="margin: 0; font-size: 14px; color: #166534;">
                    <strong>Bougez régulièrement :</strong> évitez de rester immobile trop longtemps, privilégiez la marche et les mouvements doux.
                  </p>
                </div>
                <div style="padding: 16px 20px; border-radius: 12px; background-color: #eff6ff; border-left: 4px solid #3b82f6; margin-bottom: 12px;">
                  <p style="margin: 0; font-size: 14px; color: #1e40af;">
                    <strong>Hydratez-vous :</strong> buvez suffisamment d'eau dans les jours qui suivent votre séance.
                  </p>
                </div>
                <div style="padding: 16px 20px; border-radius: 12px; background-color: #fefce8; border-left: 4px solid #eab308; margin-bottom: 12px;">
                  <p style="margin: 0; font-size: 14px; color: #854d0e;">
                    <strong>Reprise progressive :</strong> reprenez vos activités physiques de manière progressive.
                  </p>
                </div>
                <div style="padding: 16px 20px; border-radius: 12px; background-color: #faf5ff; border-left: 4px solid #a855f7; margin-bottom: 12px;">
                  <p style="margin: 0; font-size: 14px; color: #6b21a8;">
                    <strong>Réactions normales :</strong> il est possible de ressentir quelques courbatures ou une légère fatigue dans les 24 à 48 heures suivant la séance. C'est tout à fait normal.
                  </p>
                </div>
                <div style="padding: 16px 20px; border-radius: 12px; background-color: #fff1f2; border-left: 4px solid #f43f5e; margin-bottom: 0;">
                  <p style="margin: 0; font-size: 14px; color: #9f1239;">
                    <strong>Écoutez votre corps :</strong> en cas de douleur persistante ou inhabituelle, n'hésitez pas à me contacter.
                  </p>
                </div>
              </div>

              ${reviewSection}
            </div>

            <!-- Footer -->
            <div style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 14px; color: #64748b; font-weight: 600;">
                ${practitionerName}
              </p>
              ${specialty ? `<p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">${specialty}</p>` : ''}
              ${practiceName ? `<p style="margin: 2px 0 0; font-size: 13px; color: #94a3b8;">${practiceName}</p>` : ''}
            </div>
          </div>
          <p style="text-align: center; margin-top: 16px; color: #94a3b8; font-size: 12px;">
            Envoyé via MyOsteoFlow
          </p>
        </div>
      </body>
    </html>
  `
}

/**
 * Create a beautiful HTML email inviting a patient who hasn't been seen in a
 * while to come back. Includes a "Prendre rendez-vous" CTA — linking to the
 * practitioner's booking page when configured, otherwise falling back to a
 * direct contact link (email or phone) so the button is always actionable.
 */
export function createPatientRelaunchHtmlEmail({
  bodyText,
  practitionerName,
  practiceName,
  specialty,
  primaryColor = '#2563eb',
  bookingUrl,
  contactEmail,
  contactPhone,
}: {
  bodyText: string
  practitionerName: string
  practiceName?: string | null
  specialty?: string | null
  primaryColor?: string
  bookingUrl?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
}): string {
  const bodyHtml = textToHtml(bodyText)

  const ctaUrl = bookingUrl || (contactEmail ? `mailto:${contactEmail}` : contactPhone ? `tel:${contactPhone}` : null)
  const ctaLabel = bookingUrl ? 'Prendre rendez-vous en ligne' : 'Me contacter'

  const ctaSection = ctaUrl
    ? `
      <div style="margin-top: 24px; text-align: center;">
        <a href="${ctaUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 15px;">
          ${ctaLabel}
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
            <!-- Header -->
            <div style="padding: 28px 32px; background: linear-gradient(135deg, ${primaryColor} 0%, #0f172a 100%); color: #ffffff; text-align: center;">
              <div style="width: 56px; height: 56px; margin: 0 auto 16px; background-color: rgba(255,255,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 28px; line-height: 56px;">&#128155;</span>
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Prenez soin de vous</h1>
              <p style="margin: 8px 0 0; font-size: 15px; opacity: 0.85;">
                ${practiceName || practitionerName}
              </p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
              <div style="font-size: 15px; line-height: 1.7; color: #334155;">
                ${bodyHtml}
              </div>

              ${ctaSection}
            </div>

            <!-- Footer -->
            <div style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 14px; color: #64748b; font-weight: 600;">
                ${practitionerName}
              </p>
              ${specialty ? `<p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">${specialty}</p>` : ''}
              ${practiceName ? `<p style="margin: 2px 0 0; font-size: 13px; color: #94a3b8;">${practiceName}</p>` : ''}
            </div>
          </div>
          <p style="text-align: center; margin-top: 16px; color: #94a3b8; font-size: 12px;">
            Envoyé via MyOsteoFlow
          </p>
        </div>
      </body>
    </html>
  `
}
