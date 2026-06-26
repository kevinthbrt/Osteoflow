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

// ── Conversation 1: Sophie DUPONT – exercices post-consultation ──────────────
const conv1 = randomUUID()
insertConv.run(conv1, practId, sophie.id,
  'Exercices recommandes et reprise du yoga',
  '2026-06-26T09:14:00.000Z', 1)

const msgs1 = [
  {
    dir: 'outgoing', status: 'delivered',
    at: '2026-06-22T16:30:00.000Z',
    from: 'jb.martin@osteoflow.fr', to: 'sophie.dupont@gmail.com',
    subject: 'Suite a votre consultation du 22 juin',
    body: `Bonjour Sophie,

Suite a notre consultation de cet apres-midi, je vous transmets les exercices d'etirement que nous avons evoque.

Exercices quotidiens (matin) :
- Etirement cervical lateral : 3 x 30 secondes de chaque cote
- Rotation douce de la nuque : 5 repetitions lentes
- Retraction du menton (chin tuck) : 10 repetitions

Faites-les en douceur, sans forcer. Si vous ressentez des douleurs, arretez et contactez-moi.

Pour le yoga, je vous conseille d'attendre encore une semaine avant de reprendre les cours collectifs.

Bonne guerison,
Jean-Baptiste MARTIN, Osteopathe`
  },
  {
    dir: 'incoming', status: 'delivered',
    at: '2026-06-23T10:05:00.000Z',
    from: 'sophie.dupont@gmail.com', to: 'jb.martin@osteoflow.fr',
    subject: 'Re: Suite a votre consultation du 22 juin',
    body: `Bonjour Docteur Martin,

Merci beaucoup pour ce suivi ! J'ai fait les exercices ce matin et je me sens deja un peu mieux.

Une question : est-ce que je peux reprendre le yoga doux (yin yoga) des la semaine prochaine, ou faut-il attendre plus longtemps ?

Merci d'avance,
Sophie`
  },
  {
    dir: 'outgoing', status: 'delivered',
    at: '2026-06-23T11:30:00.000Z',
    from: 'jb.martin@osteoflow.fr', to: 'sophie.dupont@gmail.com',
    subject: 'Re: Suite a votre consultation du 22 juin',
    body: `Bonjour Sophie,

Tres bonne nouvelle pour les exercices !

Pour le yin yoga, oui c'est tout a fait adapte des la semaine prochaine. Ce type de yoga doux avec des postures longues et passives est ideal pour votre recuperation. Evitez simplement les postures qui compriment fortement la nuque (comme la posture du poisson ou l'epaule inversee).

Si vous avez le moindre doute sur une posture, n'hesitez pas a m'envoyer un message.

Bonne pratique,
Jean-Baptiste MARTIN`
  },
  {
    dir: 'incoming', status: 'delivered',
    at: '2026-06-25T19:42:00.000Z',
    from: 'sophie.dupont@gmail.com', to: 'jb.martin@osteoflow.fr',
    subject: 'Re: Suite a votre consultation du 22 juin',
    body: `Bonsoir,

J'ai repris le yin yoga hier soir, et c'etait parfait. Mon professeur a adapte quelques postures. Je me sens vraiment mieux !

Merci encore pour tout.
Sophie`
  },
  {
    dir: 'incoming', status: 'delivered',
    at: '2026-06-26T09:14:00.000Z',
    from: 'sophie.dupont@gmail.com', to: 'jb.martin@osteoflow.fr',
    subject: 'Re: Suite a votre consultation du 22 juin',
    body: `Bonjour,

Je voulais aussi vous signaler que j'ai de legeres tensions ce matin dans l'epaule gauche apres la seance. Est-ce normal ? Dois-je m'inquieter ?

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

Controle dans 3 semaines si pas d'amelioration.

Jean-Baptiste MARTIN, Osteopathe`
  },
  {
    dir: 'incoming', status: 'delivered',
    at: '2026-06-22T20:15:00.000Z',
    from: 'thomas.bernard@outlook.fr', to: 'jb.martin@osteoflow.fr',
    subject: 'Re: Protocole de reprise sportive',
    body: `Bonsoir,

Merci pour le protocole, c'est tres clair.

J'ai fait 3 seances de natation dos crawle cette semaine et c'est pas mal. Par contre j'ai une douleur persistante le matin au lever, vers L4-L5. Ca devrait s'ameliorer ?

Thomas`
  },
  {
    dir: 'outgoing', status: 'delivered',
    at: '2026-06-24T15:20:00.000Z',
    from: 'jb.martin@osteoflow.fr', to: 'thomas.bernard@outlook.fr',
    subject: 'Re: Protocole de reprise sportive',
    body: `Bonjour Thomas,

La douleur matinale en L4-L5 est frequente dans les premieres semaines de reprise, surtout apres une nuit en position statique.

Conseils :
1. Avant de vous lever : faites des rotations du bassin allonge (30 secondes)
2. Matelas trop mou ou trop dur ? A verifier
3. Appliquez chaleur humide 10 min avant le lever si douleur persistante

Si cette douleur matinale persiste plus de 2 semaines ou s'intensifie, revenez me voir. Sinon, continuez le protocole.

Bon courage,
Jean-Baptiste MARTIN`
  },
]

for (const m of msgs2) {
  insertMsg.run(randomUUID(), conv2, m.body, m.dir, 'email', m.status, m.at, m.from, m.to, m.subject, m.at)
}

// ── Conversation 3: Marie LECLERC – compte-rendu medecin du sport ─────────────
const conv3 = randomUUID()
insertConv.run(conv3, practId, marie.id,
  'Compte-rendu transmis au Dr Fontaine',
  '2026-06-18T11:00:00.000Z', 0)

const msgs3 = [
  {
    dir: 'outgoing', status: 'delivered',
    at: '2026-06-18T11:00:00.000Z',
    from: 'jb.martin@osteoflow.fr', to: 'marie.leclerc@laposte.net',
    subject: 'Compte-rendu osteopathique - Marie LECLERC',
    body: `Bonjour Marie,

Comme convenu, je vous transmets le compte-rendu de votre consultation du 18 juin que vous pourrez remettre au Dr Fontaine.

--- COMPTE-RENDU OSTEOPATHIQUE ---
Patient : Marie LECLERC, 34 ans
Date : 18 juin 2026
Praticien : Jean-Baptiste MARTIN, DO

Motif : Tendinopathie rotulienne droite recidivante (3e episode en 18 mois)

Bilan osteopathique :
- Restriction de mobilite tibio-fibulaire distale droite
- Tension du fascia IT band droit avec retentissement genoux
- Dysfonction sacro-iliaque droite en flexion
- Blocage T11-T12

Traitement realise : Techniques myofasciales sur IT band, correction articulaire tibio-fibulaire, normalisation sacro-iliaque, technique structurelle T11-T12.

Recommandations : Renforcement VMO en cours avec kine. Eviter montee/descente repetitive d'escaliers pendant 3 semaines.

Cordialement,
Jean-Baptiste MARTIN, Osteopathe D.O.`
  },
  {
    dir: 'incoming', status: 'delivered',
    at: '2026-06-18T14:30:00.000Z',
    from: 'marie.leclerc@laposte.net', to: 'jb.martin@osteoflow.fr',
    subject: 'Re: Compte-rendu osteopathique - Marie LECLERC',
    body: `Bonjour,

Merci beaucoup pour ce compte-rendu tres detaille ! J'ai deja pris rendez-vous avec le Dr Fontaine pour la semaine prochaine.

Je voulais aussi vous dire que j'ai deja beaucoup moins de douleurs depuis ce matin. C'est impressionnant.

Merci encore,
Marie`
  },
]

for (const m of msgs3) {
  insertMsg.run(randomUUID(), conv3, m.body, m.dir, 'email', m.status, m.at, m.from, m.to, m.subject, m.at)
}

console.log('Messages seeded successfully')
console.log('  Conv 1 (Sophie DUPONT):', conv1)
console.log('  Conv 2 (Thomas BERNARD):', conv2)
console.log('  Conv 3 (Marie LECLERC):', conv3)
db.close()
