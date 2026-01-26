// Default email templates
export const defaultEmailTemplates = {
  invoice: {
    subject: 'Votre facture {{invoice_number}} - {{practice_name}}',
    body: `Bonjour {{patient_first_name}},

Veuillez trouver ci-joint votre facture n°{{invoice_number}} d'un montant de {{invoice_amount}} pour votre consultation du {{invoice_date}}.

Merci de votre confiance.

Cordialement,
{{practitioner_name}}
{{practice_name}}`,
  },
  follow_up_7d: {
    subject: 'Comment allez-vous ? - {{practice_name}}',
    body: `Bonjour {{patient_first_name}},

Vous avez consulté le {{consultation_date}} pour {{consultation_reason}}.

Comment vous sentez-vous depuis votre séance ? N'hésitez pas à me contacter si vous avez des questions ou si les symptômes persistent.

En vous souhaitant une bonne journée,

{{practitioner_name}}
{{practice_name}}`,
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
