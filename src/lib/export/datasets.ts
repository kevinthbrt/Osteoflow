/**
 * Catalogue des données exportables en CSV.
 *
 * Un seul catalogue sert à la fois :
 * - à l'écran Paramètres > Export, qui affiche une case à cocher par jeu de
 *   données et par colonne ;
 * - à la route serveur, qui construit la requête SQL.
 *
 * Ce catalogue est donc AUSSI la liste blanche de l'export : la route
 * n'accepte que des clés présentes ici et n'interpole jamais une chaîne reçue
 * du client dans le SQL.
 *
 * Module pur (pas d'import Node) : il est importé par un composant client.
 */

import { EXPENSE_CATEGORY_LABELS, EXPENSE_RECURRENCE_LABELS } from '@/lib/finance/categories'
import { ASSET_CATEGORY_LABELS } from '@/lib/finance/depreciation'

/** Décide du formatage appliqué à la valeur brute renvoyée par SQLite. */
export type ExportValueKind = 'text' | 'date' | 'datetime' | 'number' | 'amount' | 'boolean'

export interface ExportField {
  key: string
  label: string
  /** Expression SQL, aliasée sur `key` par le constructeur de requête. */
  sql: string
  kind: ExportValueKind
  /**
   * Donnée de santé (art. 9 RGPD). Décochée par défaut et signalée dans
   * l'interface : un export de suivi d'activité n'a pas à embarquer les
   * antécédents des patients dans un fichier qui finira sur une clé USB.
   */
  health?: boolean
  /** Cochée d'office quand le praticien sélectionne le jeu de données. */
  preselected?: boolean
}

/** Périmètre de partage entre cabinets appliqué au jeu de données. */
export type ExportScope = 'patients' | 'consultations' | 'compta'

export interface ExportDataset {
  key: string
  label: string
  description: string
  /** Clause FROM complète (jointures comprises), sans WHERE. */
  from: string
  /**
   * Expression SQL normalisée en « YYYY-MM-DD », utilisée par le filtre de
   * période. `null` si le jeu de données n'a pas de date pertinente.
   */
  dateColumn: string | null
  /** Intitulé de la date filtrée, affiché dans l'interface. */
  dateLabel?: string
  scope: ExportScope
  /** Prédicat de cloisonnement cabinet ; `{ph}` reçoit les placeholders. */
  cabinetFilter: string
  /** Prédicat excluant les éléments archivés, si la table en a. */
  archivedFilter?: string
  orderBy: string
  fields: ExportField[]
}

/**
 * Construit un CASE SQL depuis une table de libellés.
 * Les clés viennent du code (jamais du client) ; l'apostrophe est malgré tout
 * échappée pour rester correct si un libellé en contient une.
 */
function sqlCase(column: string, labels: Record<string, string>): string {
  const branches = Object.entries(labels)
    .map(([key, label]) => `WHEN '${escapeSqlLiteral(key)}' THEN '${escapeSqlLiteral(label)}'`)
    .join(' ')
  return `CASE ${column} ${branches} ELSE ${column} END`
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Carte bancaire',
  cash: 'Espèces',
  check: 'Chèque',
  transfer: 'Virement',
  other: 'Autre',
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  paid: 'Payée',
  cancelled: 'Annulée',
}

const PATIENT_NAME_FIELDS: ExportField[] = [
  { key: 'patient_last_name', label: 'Nom du patient', sql: 'patients.last_name', kind: 'text', preselected: true },
  { key: 'patient_first_name', label: 'Prénom du patient', sql: 'patients.first_name', kind: 'text', preselected: true },
]

export const EXPORT_DATASETS: ExportDataset[] = [
  {
    key: 'patients',
    label: 'Patients',
    description: 'La fiche de chaque patient : identité, coordonnées, antécédents.',
    from: 'patients LEFT JOIN patients AS referrer ON referrer.id = patients.referred_by_patient_id',
    dateColumn: 'substr(patients.created_at, 1, 10)',
    dateLabel: 'date de création du dossier',
    scope: 'patients',
    cabinetFilter: 'patients.practitioner_id IN ({ph})',
    archivedFilter: 'patients.archived_at IS NULL',
    orderBy: 'patients.last_name COLLATE NOCASE, patients.first_name COLLATE NOCASE',
    fields: [
      { key: 'last_name', label: 'Nom', sql: 'patients.last_name', kind: 'text', preselected: true },
      { key: 'first_name', label: 'Prénom', sql: 'patients.first_name', kind: 'text', preselected: true },
      { key: 'gender', label: 'Sexe', sql: "CASE patients.gender WHEN 'M' THEN 'M' WHEN 'F' THEN 'F' ELSE '' END", kind: 'text', preselected: true },
      { key: 'birth_date', label: 'Date de naissance', sql: 'patients.birth_date', kind: 'date', preselected: true },
      { key: 'age', label: 'Âge', sql: "CAST((julianday('now') - julianday(patients.birth_date)) / 365.25 AS INTEGER)", kind: 'number' },
      { key: 'phone', label: 'Téléphone', sql: 'patients.phone', kind: 'text', preselected: true },
      { key: 'email', label: 'E-mail', sql: 'patients.email', kind: 'text', preselected: true },
      { key: 'profession', label: 'Profession', sql: 'patients.profession', kind: 'text' },
      { key: 'sport_activity', label: 'Activité sportive', sql: 'patients.sport_activity', kind: 'text' },
      { key: 'primary_physician', label: 'Médecin traitant', sql: 'patients.primary_physician', kind: 'text' },
      {
        key: 'referred_by',
        label: 'Adressé par',
        sql: "COALESCE(NULLIF(TRIM(COALESCE(referrer.last_name, '') || ' ' || COALESCE(referrer.first_name, '')), ''), patients.referred_by_source)",
        kind: 'text',
      },
      { key: 'consultation_count', label: 'Nombre de consultations', sql: '(SELECT COUNT(*) FROM consultations c WHERE c.patient_id = patients.id AND c.archived_at IS NULL)', kind: 'number' },
      { key: 'first_consultation', label: 'Première consultation', sql: '(SELECT MIN(c.date_time) FROM consultations c WHERE c.patient_id = patients.id AND c.archived_at IS NULL)', kind: 'date' },
      { key: 'last_consultation', label: 'Dernière consultation', sql: '(SELECT MAX(c.date_time) FROM consultations c WHERE c.patient_id = patients.id AND c.archived_at IS NULL)', kind: 'date' },
      { key: 'trauma_history', label: 'Antécédents traumatiques', sql: 'patients.trauma_history', kind: 'text', health: true },
      { key: 'medical_history', label: 'Antécédents médicaux', sql: 'patients.medical_history', kind: 'text', health: true },
      { key: 'surgical_history', label: 'Antécédents chirurgicaux', sql: 'patients.surgical_history', kind: 'text', health: true },
      { key: 'family_history', label: 'Antécédents familiaux', sql: 'patients.family_history', kind: 'text', health: true },
      { key: 'notes', label: 'Notes', sql: 'patients.notes', kind: 'text', health: true },
      { key: 'created_at', label: 'Dossier créé le', sql: 'patients.created_at', kind: 'datetime' },
      { key: 'archived_at', label: 'Archivé le', sql: 'patients.archived_at', kind: 'datetime' },
    ],
  },
  {
    key: 'consultations',
    label: 'Consultations',
    description: 'Une ligne par séance, avec le patient concerné et le compte rendu.',
    from: `consultations
      JOIN patients ON patients.id = consultations.patient_id
      LEFT JOIN session_types ON session_types.id = consultations.session_type_id`,
    dateColumn: 'substr(consultations.date_time, 1, 10)',
    dateLabel: 'date de la consultation',
    scope: 'consultations',
    cabinetFilter: 'consultations.cabinet_id IN ({ph})',
    archivedFilter: 'consultations.archived_at IS NULL',
    orderBy: 'consultations.date_time DESC',
    fields: [
      { key: 'date_time', label: 'Date et heure', sql: 'consultations.date_time', kind: 'datetime', preselected: true },
      ...PATIENT_NAME_FIELDS,
      { key: 'patient_birth_date', label: 'Date de naissance du patient', sql: 'patients.birth_date', kind: 'date' },
      { key: 'session_type', label: 'Type de séance', sql: 'session_types.name', kind: 'text', preselected: true },
      { key: 'reason', label: 'Motif de consultation', sql: 'consultations.reason', kind: 'text', health: true, preselected: true },
      { key: 'anamnesis', label: 'Anamnèse', sql: 'consultations.anamnesis', kind: 'text', health: true },
      { key: 'clinical_hypotheses', label: 'Hypothèses cliniques', sql: 'consultations.clinical_hypotheses', kind: 'text', health: true },
      { key: 'examination', label: 'Examen clinique', sql: 'consultations.examination', kind: 'text', health: true },
      { key: 'advice', label: 'Conseils', sql: 'consultations.advice', kind: 'text', health: true },
      { key: 'follow_up_7d', label: 'Suivi J+7 activé', sql: 'consultations.follow_up_7d', kind: 'boolean' },
      { key: 'invoice_number', label: 'Numéro de facture', sql: '(SELECT i.invoice_number FROM invoices i WHERE i.consultation_id = consultations.id)', kind: 'text' },
      { key: 'amount', label: 'Montant facturé', sql: '(SELECT i.amount FROM invoices i WHERE i.consultation_id = consultations.id)', kind: 'amount' },
      { key: 'created_at', label: 'Saisie le', sql: 'consultations.created_at', kind: 'datetime' },
    ],
  },
  {
    key: 'invoices',
    label: 'Factures',
    description: 'Les factures émises, leur statut et le reste à encaisser.',
    from: `invoices
      JOIN consultations ON consultations.id = invoices.consultation_id
      JOIN patients ON patients.id = consultations.patient_id`,
    dateColumn: 'substr(COALESCE(invoices.issued_at, invoices.created_at), 1, 10)',
    dateLabel: "date d'émission",
    scope: 'compta',
    cabinetFilter: 'invoices.cabinet_id IN ({ph})',
    orderBy: 'COALESCE(invoices.issued_at, invoices.created_at) DESC',
    fields: [
      { key: 'invoice_number', label: 'Numéro', sql: 'invoices.invoice_number', kind: 'text', preselected: true },
      { key: 'issued_at', label: "Date d'émission", sql: 'COALESCE(invoices.issued_at, invoices.created_at)', kind: 'date', preselected: true },
      { key: 'amount', label: 'Montant', sql: 'invoices.amount', kind: 'amount', preselected: true },
      { key: 'status', label: 'Statut', sql: sqlCase('invoices.status', INVOICE_STATUS_LABELS), kind: 'text', preselected: true },
      { key: 'paid_at', label: 'Payée le', sql: 'invoices.paid_at', kind: 'date', preselected: true },
      { key: 'paid_amount', label: 'Montant encaissé', sql: '(SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = invoices.id)', kind: 'amount' },
      { key: 'balance', label: 'Reste à encaisser', sql: 'invoices.amount - (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = invoices.id)', kind: 'amount' },
      { key: 'consultation_date', label: 'Date de consultation', sql: 'consultations.date_time', kind: 'datetime' },
      ...PATIENT_NAME_FIELDS,
      { key: 'notes', label: 'Notes', sql: 'invoices.notes', kind: 'text' },
    ],
  },
  {
    key: 'payments',
    label: 'Paiements',
    description: 'Les encaissements, y compris les règlements fractionnés.',
    from: `payments
      JOIN invoices ON invoices.id = payments.invoice_id
      JOIN consultations ON consultations.id = invoices.consultation_id
      JOIN patients ON patients.id = consultations.patient_id`,
    dateColumn: 'substr(payments.payment_date, 1, 10)',
    dateLabel: 'date du paiement',
    scope: 'compta',
    cabinetFilter: 'invoices.cabinet_id IN ({ph})',
    orderBy: 'payments.payment_date DESC',
    fields: [
      { key: 'payment_date', label: 'Date', sql: 'payments.payment_date', kind: 'date', preselected: true },
      { key: 'amount', label: 'Montant', sql: 'payments.amount', kind: 'amount', preselected: true },
      { key: 'method', label: 'Moyen de paiement', sql: sqlCase('payments.method', PAYMENT_METHOD_LABELS), kind: 'text', preselected: true },
      { key: 'invoice_number', label: 'Numéro de facture', sql: 'invoices.invoice_number', kind: 'text', preselected: true },
      { key: 'check_number', label: 'Numéro de chèque', sql: 'payments.check_number', kind: 'text' },
      ...PATIENT_NAME_FIELDS.map((field) => ({ ...field, preselected: false })),
      { key: 'notes', label: 'Notes', sql: 'payments.notes', kind: 'text' as const },
    ],
  },
  {
    key: 'expenses',
    label: 'Charges',
    description: 'Les dépenses professionnelles saisies dans Comptabilité.',
    from: 'expenses',
    dateColumn: 'substr(expenses.expense_date, 1, 10)',
    dateLabel: 'date de la dépense',
    scope: 'compta',
    cabinetFilter: 'expenses.cabinet_id IN ({ph})',
    orderBy: 'expenses.expense_date DESC',
    fields: [
      { key: 'expense_date', label: 'Date', sql: 'expenses.expense_date', kind: 'date', preselected: true },
      { key: 'label', label: 'Libellé', sql: 'expenses.label', kind: 'text', preselected: true },
      { key: 'category', label: 'Catégorie', sql: sqlCase('expenses.category', EXPENSE_CATEGORY_LABELS), kind: 'text', preselected: true },
      { key: 'amount_ht', label: 'Montant HT', sql: 'expenses.amount_ht', kind: 'amount', preselected: true },
      { key: 'vat_amount', label: 'TVA', sql: 'expenses.vat_amount', kind: 'amount' },
      { key: 'amount_ttc', label: 'Montant TTC', sql: 'expenses.amount_ttc', kind: 'amount', preselected: true },
      { key: 'deductible_share', label: 'Quote-part professionnelle (%)', sql: 'expenses.deductible_share', kind: 'number' },
      { key: 'deductible_amount', label: 'Montant déductible', sql: 'expenses.amount_ht * expenses.deductible_share / 100.0', kind: 'amount' },
      { key: 'recurrence', label: 'Périodicité', sql: sqlCase('expenses.recurrence', EXPENSE_RECURRENCE_LABELS), kind: 'text' },
      { key: 'payment_method', label: 'Moyen de paiement', sql: 'expenses.payment_method', kind: 'text' },
      { key: 'notes', label: 'Notes', sql: 'expenses.notes', kind: 'text' },
    ],
  },
  {
    key: 'fixed_assets',
    label: 'Immobilisations',
    description: "Les biens amortis, avec leur durée d'amortissement.",
    from: 'fixed_assets',
    dateColumn: 'substr(fixed_assets.service_date, 1, 10)',
    dateLabel: 'date de mise en service',
    scope: 'compta',
    cabinetFilter: 'fixed_assets.cabinet_id IN ({ph})',
    orderBy: 'fixed_assets.service_date DESC',
    fields: [
      { key: 'label', label: 'Libellé', sql: 'fixed_assets.label', kind: 'text', preselected: true },
      { key: 'category', label: 'Catégorie', sql: sqlCase('fixed_assets.category', ASSET_CATEGORY_LABELS), kind: 'text', preselected: true },
      { key: 'service_date', label: 'Mise en service', sql: 'fixed_assets.service_date', kind: 'date', preselected: true },
      { key: 'amount_ht', label: 'Montant HT', sql: 'fixed_assets.amount_ht', kind: 'amount', preselected: true },
      { key: 'vat_amount', label: 'TVA', sql: 'fixed_assets.vat_amount', kind: 'amount' },
      { key: 'duration_years', label: "Durée d'amortissement (années)", sql: 'fixed_assets.duration_years', kind: 'number', preselected: true },
      { key: 'annual_depreciation', label: 'Amortissement annuel', sql: 'fixed_assets.amount_ht / NULLIF(fixed_assets.duration_years, 0)', kind: 'amount' },
      { key: 'notes', label: 'Notes', sql: 'fixed_assets.notes', kind: 'text' },
    ],
  },
]

export function getExportDataset(key: string): ExportDataset | undefined {
  return EXPORT_DATASETS.find((dataset) => dataset.key === key)
}

/** Colonnes cochées d'office à la sélection d'un jeu de données. */
export function preselectedFieldKeys(dataset: ExportDataset): string[] {
  return dataset.fields.filter((field) => field.preselected).map((field) => field.key)
}
