import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

const db = new Database('/root/.config/Osteoflow/osteoflow.db')
db.pragma('foreign_keys = OFF')

// Get practitioner id
const practId = db.prepare("SELECT value FROM app_config WHERE key = 'current_user_id'").get().value

// Get patient ids
const patients = db.prepare('SELECT id, first_name, last_name FROM patients LIMIT 5').all()
const sophie = patients.find(p => p.last_name === 'DUPONT')
const thomas = patients.find(p => p.last_name === 'BERNARD')
const marie = patients.find(p => p.last_name === 'LECLERC')

// Clear existing demo conversations
db.prepare('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE practitioner_id = ?)').run(practId)
db.prepare('DELETE FROM conversations WHERE practitioner_id = ?').run(practId)

const insertConv = db.prepare(`
  INSERT INTO conversations (id, practitioner_id, patient_id, subject, last_message_at, unread_count, is_archived)
  VALUES (?, ?, ?, ?, ?, ?, 0)
`)

const insertMsg = db.prepare(`
  INSERT INTO messages (id, conversation_id, content, direction, channel, status, sent_at, from_email, to_email, email_subject, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

// ── Conversation 1: Sophie DUPONT – contact rhumatologue ─────────────────────
const conv1 = randomUUID()
insertConv.run(conv1, practId, sophie.id,
  'Orientation vers un rhumatologue',
  '2026-06-26T10:22:00.000Z', 1)

const msgs1 = [
  {
    dir: 'incoming', status: 'delivered',
    at: '2026-06-25T14:38:00.000Z',
    from: 'sophie.dupont@gmail.com', to: 'jb.martin@osteoflow.fr',
    subject: 'Question - rhumatologue',
    body: `Bonjour Monsieur Martin,

Suite a notre consultation de la semaine derniere, vous m'aviez parle de la possibilite de consulter un rhumatologue pour mes douleurs articulaires persistantes aux mains.

Pourriez-vous me recommander un specialiste dans le secteur de Lyon 3 ou Lyon 6 ? De preference secteur 1 ou avec honoraires raisonnables.

Merci d'avance,
Sophie Dupont`
  },
  {
    dir: 'outgoing', status: 'delivered',
    at: '2026-06-25T17:10:00.000Z',
    from: 'jb.martin@osteoflow.fr', to: 'sophie.dupont@gmail.com',
    subject: 'Re: Question - rhumatologue',
    body: `Bonjour Sophie,

Bien sur, voici deux rhumatologues que je recommande regulierement :

Dr Claire MOREAU - Rhumatologue
Cabinet medical, 14 rue de la Republique, Lyon 2
Tel : 04 72 XX XX XX
Secteur 1, prend de nouveaux patients
Delai habituel : 6 a 8 semaines

Dr Antoine PERRIN - Rhumatologue
Clinique du Parc, 155 bd Stalingrad, Lyon 5
Tel : 04 78 XX XX XX
Secteur 2 avec depassements moderes (25 euros)
Delai : 4 a 6 semaines, souvent des creneaux annules disponibles

Je vous conseille de mentionner lors de la prise de rendez-vous que vous etes suivie en osteopathie pour des douleurs articulaires des mains avec suspicion d'atteinte inflammatoire, cela peut accelerer le delai.

N'hesitez pas si vous avez d'autres questions.

Cordialement,
Jean-Baptiste MARTIN, Osteopathe D.O.`
  },
  {
    dir: 'incoming', status: 'delivered',
    at: '2026-06-26T09:05:00.000Z',
    from: 'sophie.dupont@gmail.com', to: 'jb.martin@osteoflow.fr',
    subject: 'Re: Question - rhumatologue',
    body: `Bonjour Monsieur Martin,

Merci beaucoup pour ces informations ! J'ai appele le cabinet du Dr Moreau ce matin, ils m'ont propose un rendez-vous le 4 aout.

J'ai bien mentionne le suivi en osteopathie comme vous me l'avez conseille.

Encore merci,
Sophie`
  },
  {
    dir: 'incoming', status: 'delivered',
    at: '2026-06-26T10:22:00.000Z',
    from: 'sophie.dupont@gmail.com', to: 'jb.martin@osteoflow.fr',
    subject: 'Re: Question - rhumatologue',
    body: `Bonjour,

Une derniere question : est-ce que je dois faire une prise de sang avant le rendez-vous avec le rhumatologue, ou c'est elle qui la prescrira lors de la consultation ?

Merci,
Sophie`
  },
]

for (const m of msgs1) {
  insertMsg.run(randomUUID(), conv1, m.body, m.dir, 'email', m.status, m.at, m.from, m.to, m.subject, m.at)
}

// ── Conversation 2: Thomas BERNARD – reprise sportive apres lombalgie ─────────
const conv2 = randomUUID()
insertConv.run(conv2, practId, thomas.id,
  'Reprise sportive apres lombalgie',
  '2026-06-24T15:20:00.000Z', 0)

const msgs2 = [
  {
    dir: 'outgoing', status: 'delivered',
    at: '2026-06-20T14:00:00.000Z',
    from: 'jb.martin@osteoflow.fr', to: 'thomas.bernard@outlook.fr',
    subject: 'Protocole de reprise sportive',
    body: `Bonjour Thomas,

Comme convenu lors de votre consultation, voici le protocole de reprise progressive pour votre lombalgie.

Semaine 1-2 : Marche 30 min/jour, natation (crawl interdit, dos crawle ok)
Semaine 3 : Velo elliptique intensite faible, abdos hypopressifs
Semaine 4+ : Reprise progressive de la course a pied sur terrain plat

Evitez absolument : les sauts, la musculation du dos en charge, le squash pendant encore 6 semaines.

N'hesitez pas a me contacter si les douleurs s'intensifient.

Cordialement,
Jean-Baptiste MARTIN, Osteopathe D.O.`
  },
  {
    dir: 'incoming', status: 'delivered',
    at: '2026-06-22T20:15:00.000Z',
    from: 'thomas.bernard@outlook.fr', to: 'jb.martin@osteoflow.fr',
    subject: 'Re: Protocole de reprise sportive',
    body: `Bonsoir Monsieur Martin,

Merci pour le protocole, c'est tres clair.

J'ai fait 3 seances de natation dos crawle cette semaine et ca se passe bien. Par contre j'ai une douleur persistante le matin au lever, vers le bas du dos. Ca devrait s'ameliorer ?

Thomas`
  },
  {
    dir: 'outgoing', status: 'delivered',
    at: '2026-06-24T15:20:00.000Z',
    from: 'jb.martin@osteoflow.fr', to: 'thomas.bernard@outlook.fr',
    subject: 'Re: Protocole de reprise sportive',
    body: `Bonjour Thomas,

La raideur matinale dans le bas du dos est tres courante en debut de reprise, c'est tout a fait normal a ce stade.

Quelques conseils avant le lever : faites des rotations douces du bassin allonge pendant 30 secondes, puis ramenez les genoux sur la poitrine. Attendez 1 a 2 minutes avant de vous mettre debout.

Si cette douleur s'intensifie ou s'accompagne de fourmillements dans les jambes, contactez-moi. Sinon, continuez le protocole, cela devrait s'estomper d'ici 10 jours.

Bon courage,
Jean-Baptiste MARTIN`
  },
]

for (const m of msgs2) {
  insertMsg.run(randomUUID(), conv2, m.body, m.dir, 'email', m.status, m.at, m.from, m.to, m.subject, m.at)
}

// ── Conversation 3: Marie LECLERC – contact kinesitherapeute ──────────────────
const conv3 = randomUUID()
insertConv.run(conv3, practId, marie.id,
  'Kinesitherapeute recommande pour reeducation',
  '2026-06-21T16:45:00.000Z', 0)

const msgs3 = [
  {
    dir: 'incoming', status: 'delivered',
    at: '2026-06-20T18:30:00.000Z',
    from: 'marie.leclerc@laposte.net', to: 'jb.martin@osteoflow.fr',
    subject: 'Kinesitherapeute pour reeducation epaule',
    body: `Bonjour Monsieur Martin,

Lors de notre seance d'hier vous m'avez conseille de faire de la kinesitherapie en complement pour mon epaule droite. Avez-vous un kinesitherapeute a me recommander, de preference sur Villeurbanne ?

Merci,
Marie Leclerc`
  },
  {
    dir: 'outgoing', status: 'delivered',
    at: '2026-06-21T16:45:00.000Z',
    from: 'jb.martin@osteoflow.fr', to: 'marie.leclerc@laposte.net',
    subject: 'Re: Kinesitherapeute pour reeducation epaule',
    body: `Bonjour Marie,

Oui, je travaille regulierement avec deux kinesitherapeutes sur Villeurbanne avec qui j'ai de tres bons retours pour les pathologies de l'epaule :

Mme Sarah PETIT - Kinesitherapeute
12 avenue Roger Salengro, Villeurbanne
Tel : 04 78 XX XX XX
Specialisee en reeducation de l'epaule et du membre superieur

M. Lucas RENARD - Kinesitherapeute
Cabinet pluridisciplinaire, 8 rue Jules Guesde, Villeurbanne
Tel : 04 72 XX XX XX
Approche globale, travaille souvent en coordination avec les osteopathes

Je leur transmettrai un petit mot de ma part pour le contexte clinique si vous le souhaitez.

Cordialement,
Jean-Baptiste MARTIN, Osteopathe D.O.`
  },
]

for (const m of msgs3) {
  insertMsg.run(randomUUID(), conv3, m.body, m.dir, 'email', m.status, m.at, m.from, m.to, m.subject, m.at)
}

console.log('Messages seeded successfully')
console.log('  Conv 1 (Sophie DUPONT - rhumatologue):', conv1)
console.log('  Conv 2 (Thomas BERNARD - sport):', conv2)
console.log('  Conv 3 (Marie LECLERC - kine):', conv3)
db.close()
