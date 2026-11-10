import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'
import { TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js'
import { SCHEMA_SQL, runMigrations } from '@/lib/database/schema'
import { parseSemicolonCsv } from '@/lib/import/osteotools/csv'
import { readOsteoToolsArchive, OsteoToolsArchiveError } from '@/lib/import/osteotools/archive'
import {
  buildOsteoToolsPlan,
  buildConsultationTexts,
  formatName,
  formatPhone,
  isGenericReason,
  mapAntecedent,
  splitReason,
  DEFAULT_PAYMENT_MODES,
  type PaymentTarget,
} from '@/lib/import/osteotools/transform'
import { applyOsteoToolsPlan } from '@/lib/import/osteotools/apply'

// Export OsteoTools entièrement fictif, à la structure des vrais fichiers
// (séparateur « ; », BOM, champs multilignes entre guillemets).
const BOM = '﻿'
const csv = (header: string, ...rows: string[]) => BOM + [header, ...rows].join('\r\n') + '\r\n'

const FIXTURE: Record<string, string> = {
  'patients.csv': csv(
    'pat_id;creator_id;first_name;last_name;profession;gender;phone;email;address;birth_date;creation_date;blacklist;deceased;allow_access;unsubscribe;usr_id;col_id',
    'p1;u;léa;martin;professeure;1;+33612345678;Lea@Example.com;"3 rue des lilas, 33000 bordeaux, france";1990-04-12T12:00:00+02:00;2021-04-14T00:00:00+02:00;false;false;true;false;u;-1',
    'p2;u;jean-pierre;de la tour;retraité;0;;;;1950-01-02T12:00:00+01:00;2022-01-03T10:00:00+01:00;false;true;true;false;u;-1',
    'p3;u;camille;petit;;2;;;;2015-06-01T12:00:00+02:00;2023-01-01T00:00:00+01:00;false;false;true;false;u;-1',
    'p4;u;nathalie;durand;;1;;;;1975-03-03T12:00:00+01:00;2023-01-01T00:00:00+01:00;false;false;true;false;u;-1',
  ),
  'patient_details.csv': csv(
    'pat_id;nir;notes;habitus;reference;family_antecedents;situation;level;number_of_children',
    'p1;290049912345678;"migraines\nsous traitement";course à pied;autre;hta;0;1;2',
    'p2;;;;doctolib;ras;0;1;0',
  ),
  'phones.csv': csv('id;creator_id;order;number;iso;type;link_id', 'ph1;;1;+33612345678;fr;1;p1', 'ph2;;2;+33556000000;fr;2;p1'),
  'addresses.csv': csv('id;creator_id;number;street;zipcode;city;country;type;link_id', 'a1;;3;rue des lilas;33000;bordeaux;france;1;p1'),
  'antecedents.csv': csv(
    'id;creator_id;type;title;description;event_date;end_date;periodic;important;pat_id;usr_id',
    'h1;u;traumatique;chirurgical;"appendicite\nménisque";2021-05-10T00:00:00+02:00;2021-05-10T00:00:00+02:00;false;true;p1;u',
    'h2;u;traumatique;m?dical;asthme;2003-01-01T00:00:00+01:00;2003-01-01T00:00:00+01:00;false;false;p1;u',
    'h3;u;traumatique;obst?trique;1 enfant par voie basse;2021-05-10T00:00:00+02:00;2021-05-10T00:00:00+02:00;false;false;p1;u',
    'h4;u;traumatique;avp;coup du lapin;2024-03-05T00:00:00+01:00;2024-03-05T00:00:00+01:00;false;false;p1;u',
    'h5;u;traumatique;chirurgical;;2021-05-10T00:00:00+02:00;2021-05-10T00:00:00+02:00;false;false;p1;u',
  ),
  'pediatrics.csv': csv(
    'id;creator_id;weight;size;apgar1;with_apgar1;presentation;forceps;with_caesarean;caesarean;pat_id;usr_id',
    'k1;u;3,250;50,00;10;true;sommet;true;false;;p3;u',
    'k2;u;0,000;0,00;0;false;;false;false;;p4;u',
  ),
  'consultations.csv': csv(
    'id;creator_id;reason;act_date;start_schedule;end_schedule;pat_id;usr_id;ofi_id;inv_id;ret_id;rea_id;ses_id',
    'c1;u;"lombalgie droite\ndepuis 3 jours";2024-03-05T00:00:00+01:00;2024-03-05T00:00:00+01:00;2024-03-05T00:45:00+01:00;p1;u;o;i1;-1;-1;-1',
    'c2;u;cervicalgie;2024-04-02T14:30:00+02:00;2024-04-02T14:30:00+02:00;2024-04-02T15:15:00+02:00;p1;u;o;i2;-1;-1;-1',
    'c3;u;consultation du 17/07/2012;2012-07-17T00:00:00+02:00;2012-07-17T00:00:00+02:00;2012-07-17T00:45:00+02:00;p2;u;o;-1;-1;-1;-1',
  ),
  'examens.csv': csv(
    'con_id;creator_id;evolution;observation;diagnostic;tests;treatment',
    'c1;;mieux depuis la dernière fois;myope;;;psoas et diaphragme',
    'c3;;;;"coxalgie droite\ndifficulté à s\'asseoir";;',
  ),
  'measurements.csv': csv('con_id;creator_id;size;weight;act_date', 'c2;;168;61,50;2024-04-02T14:30:00+02:00'),
  'evas.csv': csv('con_id;creator_id;before;after', 'c2;;7;3'),
  'events.csv': csv(
    'id;creator_id;label;start_date;end_date;missed;unvalid;pat_id',
    'e1;u;consultation;2024-03-05T10:15:00+01:00;2024-03-05T11:00:00+01:00;false;false;p1',
  ),
  'invoices.csv': csv(
    'id;creator_id;label;type;sub_type;mode;mode_retrocession;bank;number;tva;ttc;retrocession;damping_rate;settlement_date;checked;banked;printed;sended;transmitted;usr_id;ofi_id;rec_id;con_id;pat_id',
    'i1;u;léa martin;0;0;1;0;;2400101;0,00;60,00;42,00;0,00;2024-03-05T00:00:00+01:00;true;false;false;false;false;u;o;-1;c1;p1',
    'i2;u;consultation à domicile;0;0;2;0;;2400102;0,00;0,00;0,00;0,00;2024-04-02T00:00:00+02:00;true;false;false;false;false;u;o;-1;c2;p1',
    'i3;u;consultation;0;0;0;0;;2400101;0,00;50,00;0,00;0,00;2023-11-20T00:00:00+01:00;true;false;false;false;false;u;o;-1;-1;p4',
  ),
  'attachments.csv': csv(
    'id;creator_id;mime;storage;name;description;data;type;act_date;pat_id;usr_id',
    'f1;u;3;3;compte rendu irm.;;;0;2024-04-01T10:00:00+02:00;p1;u',
    'f2;u;0;0;radio du bassin;bascule du bassin;;0;2024-03-01T10:00:00+01:00;p1;u',
  ),
}

async function buildZip(password?: string): Promise<Uint8Array> {
  const writer = new ZipWriter(new Uint8ArrayWriter(), password ? { password, encryptionStrength: 3 } : undefined)
  for (const [name, content] of Object.entries(FIXTURE)) await writer.add(`export123/${name}`, new TextReader(content))
  await writer.add('export123/attachments/f1.pdf', new Uint8ArrayReader(new TextEncoder().encode('%PDF-1.4 fictif')))
  return writer.close()
}

function freshDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA_SQL)
  runMigrations(db as unknown as Parameters<typeof runMigrations>[0])
  db.prepare("INSERT INTO practitioners (id, user_id, first_name, last_name, email) VALUES ('pr1', 'u1', 'Ana', 'Lopez', 'ana@example.com')").run()
  return db
}

describe('lecture CSV OsteoTools', () => {
  it('gère BOM, point-virgule, guillemets et retours à la ligne', () => {
    const rows = parseSemicolonCsv('﻿a;b\r\n1;"x ; ""y""\nz"\r\n')
    expect(rows).toEqual([{ a: '1', b: 'x ; "y"\nz' }])
  })
})

describe('archive chiffrée', () => {
  it('se déchiffre avec le bon mot de passe', async () => {
    const archive = await readOsteoToolsArchive(await buildZip('s3cret'), 's3cret')
    expect(archive.tables.patients).toHaveLength(4)
    expect(archive.files.has('f1.pdf')).toBe(true)
  })

  it('signale un mot de passe manquant ou faux', async () => {
    const zip = await buildZip('s3cret')
    await expect(readOsteoToolsArchive(zip)).rejects.toMatchObject({ code: 'password_required' })
    await expect(readOsteoToolsArchive(zip, 'faux')).rejects.toBeInstanceOf(OsteoToolsArchiveError)
    await expect(readOsteoToolsArchive(zip, 'faux')).rejects.toMatchObject({ code: 'bad_password' })
  })
})

describe('mise en forme', () => {
  it('noms, téléphones, motifs', () => {
    expect(formatName('jean-pierre')).toBe('Jean-Pierre')
    expect(formatName('souliÉ')).toBe('Soulié')
    expect(formatName('de la tour')).toBe('De la Tour')
    expect(formatName('saint-médard-en-jalles')).toBe('Saint-Médard-en-Jalles')
    expect(formatPhone('+33612345678')).toBe('06 12 34 56 78')
    expect(formatPhone('+41221234567')).toBe('+41221234567')
    expect(isGenericReason('consultation du 17/07/2012')).toBe(true)
    expect(isGenericReason('bilan')).toBe(false)
    expect(splitReason('lombalgie\ndepuis 3 jours')).toEqual({ reason: 'Lombalgie', overflow: 'lombalgie\ndepuis 3 jours' })
  })

  it('range les antécédents selon leur vraie catégorie', () => {
    const base = { event_date: '2021-05-10T00:00:00+02:00', periodic: 'false', important: 'false' }
    expect(mapAntecedent({ ...base, type: 'traumatique', title: 'chirurgical', description: 'appendice' })).toMatchObject({ history_type: 'surgical', description: 'Appendice' })
    expect(mapAntecedent({ ...base, type: 'traumatique', title: 'obst?trique', description: 'voie basse' })).toMatchObject({ history_type: 'medical', description: 'Gynéco-obstétrique : Voie basse' })
    expect(mapAntecedent({ ...base, type: 'traumatique', title: 'chirurgical', description: '' })).toBeNull()
    expect(mapAntecedent({ ...base, type: 'médical', title: 'diabète', description: 'type 2' })).toMatchObject({ history_type: 'medical', description: 'Diabète : type 2' })
  })

  it('tire le motif du diagnostic quand le motif est « Consultation du … »', () => {
    const texts = buildConsultationTexts(
      { reason: 'consultation du 17/07/2012' },
      { diagnostic: 'coxalgie droite\ndifficulté à s\'asseoir', evolution: '' },
      {},
    )
    expect(texts.reason).toBe('Coxalgie droite')
    expect(texts.anamnesis).toContain('difficulté à s\'asseoir')
    expect(texts.examination).toBeNull()
  })
})

describe('plan d\'import', () => {
  it('reprend patients, antécédents, séances, factures et documents', async () => {
    const archive = await readOsteoToolsArchive(await buildZip())
    const plan = buildOsteoToolsPlan(archive.tables, archive.files)
    const [lea, jp, camille, nathalie] = plan.patients

    expect(lea).toMatchObject({ first_name: 'Léa', last_name: 'Martin', gender: 'F', birth_date: '1990-04-12', phone: '06 12 34 56 78', email: 'lea@example.com', sport_activity: 'Course à pied' })
    expect(lea.notes).toContain('Adresse : 3 rue des lilas, 33000 Bordeaux')
    expect(lea.notes).toContain('Autre téléphone : 05 56 00 00 00')
    expect(lea.notes).toContain('N° de sécurité sociale : 290049912345678')
    expect(lea.history.map((h) => h.history_type).sort()).toEqual(['family', 'medical', 'medical', 'surgical', 'traumatic'])
    expect(lea.history.find((h) => h.history_type === 'surgical')).toMatchObject({ is_vigilance: true, note: 'Année : 2021 (OsteoTools)' })
    expect(lea.history.find((h) => h.description === 'Asthme')?.note).toBe('Année : 2003 (OsteoTools)')
    expect(lea.history.find((h) => h.description.startsWith('Avp'))?.note).toBe('Noté en séance le 05/03/2024 (OsteoTools)')

    // Heure reprise de l'agenda pour la séance saisie « à minuit »
    expect(lea.consultations[0]).toMatchObject({ date_time: '2024-03-05T10:15', reason: 'Lombalgie droite' })
    expect(lea.consultations[0].anamnesis).toContain('**Évolution :** mieux depuis la dernière fois')
    expect(lea.consultations[0].examination).toContain('**Traitement :** psoas et diaphragme')
    expect(lea.consultations[0].invoice).toMatchObject({ amount: 60, paymentMode: '1', sourceNumber: '2400101' })
    expect(lea.consultations[0].invoice?.notes).toContain('Rétrocession : 42,00 €')
    expect(lea.consultations[1].examination).toContain('**Mesures :** taille 168 cm, poids 61,5 kg')
    expect(lea.consultations[1].examination).toContain('**EVA :** avant 7, après 3')
    expect(lea.consultations[1].attachments).toEqual([{ sourceId: 'f1', fileName: 'f1.pdf', originalName: 'compte rendu irm.pdf', mimeType: 'application/pdf' }])
    expect(lea.notes).toContain('Radio du bassin (01/03/2024) : bascule du bassin')

    expect(jp).toMatchObject({ first_name: 'Jean-Pierre', last_name: 'De la Tour', gender: 'M', archived: true, phone: '' })
    expect(jp.notes).toContain('Adressé par : doctolib')
    expect(jp.history).toEqual([]) // « ras » n'est pas un antécédent
    expect(jp.consultations[0]).toMatchObject({ date_time: '2012-07-17T09:00', reason: 'Coxalgie droite' })

    expect(camille.gender).toBe('F') // code 2 : déduit du prénom
    expect(camille.history[0].description).toBe('Naissance : poids 3,25 kg, taille 50 cm, Apgar 10 à 1 min, présentation : sommet, forceps')
    expect(nathalie.history).toEqual([]) // fiche pédiatrique vide ignorée

    // Facture sans séance : séance support créée pour la porter
    expect(nathalie.consultations).toHaveLength(1)
    expect(nathalie.consultations[0]).toMatchObject({ invoiceOnly: true, date_time: '2023-11-20T09:00' })

    expect(plan.paymentModes.find((m) => m.code === '2')?.suggested).toBe('free')
  })
})

describe('écriture en base', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'osteotools-'))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const apply = async (db: Database.Database, dryRun = false) => {
    const archive = await readOsteoToolsArchive(await buildZip())
    const plan = buildOsteoToolsPlan(archive.tables, archive.files)
    return applyOsteoToolsPlan(db, plan, {
      practitionerId: 'pr1',
      paymentTargets: DEFAULT_PAYMENT_MODES as Record<string, PaymentTarget>,
      files: archive.files,
      attachmentsDir: dir,
      dryRun,
    })
  }

  it('importe tout, puis ne duplique rien à la relance', async () => {
    const db = freshDb()
    const first = await apply(db)
    expect(first).toMatchObject({ patientsCreated: 4, consultationsCreated: 4, invoicesCreated: 3, paymentsCreated: 2, attachmentsCreated: 1 })

    const invoices = db.prepare('SELECT invoice_number, amount, cabinet_id FROM invoices ORDER BY invoice_number').all()
    expect(invoices).toEqual([
      { invoice_number: 'OT-2400101', amount: 60, cabinet_id: 'pr1' },
      { invoice_number: 'OT-2400101-2', amount: 50, cabinet_id: 'pr1' }, // numéro en double dans OsteoTools
      { invoice_number: 'OT-2400102', amount: 0, cabinet_id: 'pr1' },
    ])
    expect(db.prepare('SELECT method, amount FROM payments ORDER BY amount').all()).toEqual([
      { method: 'check', amount: 50 },
      { method: 'card', amount: 60 },
    ])
    expect(db.prepare("SELECT archived_at IS NOT NULL a FROM patients WHERE last_name = 'De la Tour'").get()).toEqual({ a: 1 })
    expect(fs.readdirSync(dir)).toHaveLength(1)

    const second = await apply(db)
    expect(second).toMatchObject({ patientsCreated: 0, patientsAlreadyImported: 4, consultationsCreated: 0, invoicesCreated: 0, historyEntriesCreated: 0, attachmentsCreated: 0 })
    expect(db.prepare('SELECT count(*) n FROM patients').get()).toEqual({ n: 4 })
  })

  it('complète un ancien import CSV raté au lieu de créer des doublons', async () => {
    const db = freshDb()
    db.prepare(
      "INSERT INTO patients (id, practitioner_id, gender, first_name, last_name, birth_date, phone) VALUES ('old', 'pr1', 'M', 'lea', 'MARTIN', '', '0000000000')"
    ).run()
    db.prepare("INSERT INTO consultations (id, patient_id, date_time, reason) VALUES ('oldc', 'old', '2024-03-05T09:00', 'Consultation')").run()
    db.prepare(
      "INSERT INTO consultations (id, patient_id, date_time, reason, anamnesis) VALUES ('mine', 'old', '2026-10-01T10:00', 'Dorsalgie', 'Saisie dans MyOsteoflow')"
    ).run()

    const preview = await apply(db, true)
    expect(preview).toMatchObject({ patientsMerged: 1, consultationsMerged: 1 })
    expect(db.prepare('SELECT count(*) n FROM patients').get()).toEqual({ n: 1 }) // simulation : rien d'écrit
    expect(fs.readdirSync(dir)).toHaveLength(0)

    await apply(db)
    expect(db.prepare("SELECT gender, birth_date, phone FROM patients WHERE id = 'old'").get()).toEqual({ gender: 'F', birth_date: '1990-04-12', phone: '06 12 34 56 78' })
    expect(db.prepare("SELECT date_time, reason FROM consultations WHERE id = 'oldc'").get()).toEqual({ date_time: '2024-03-05T10:15', reason: 'Lombalgie droite' })
    expect(db.prepare("SELECT anamnesis FROM consultations WHERE id = 'mine'").get()).toEqual({ anamnesis: 'Saisie dans MyOsteoflow' })
    expect(db.prepare("SELECT count(*) n FROM patients WHERE last_name LIKE 'martin'").get()).toEqual({ n: 1 })
  })
})
