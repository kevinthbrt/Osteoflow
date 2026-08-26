/**
 * Vocabulaire fermé des faits cliniques.
 *
 * C'est la pièce centrale du dispositif : tout ce qui entre dans le moteur —
 * anamnèse dictée, réponse à une question, résultat d'un test, score d'un
 * questionnaire — doit se traduire en signaux de cette liste. Rien d'autre
 * n'est interprétable. C'est ce qui rend le raisonnement reproductible : deux
 * passages sur la même anamnèse produisent les mêmes signaux, donc les mêmes
 * hypothèses.
 *
 * Un signal vaut vrai, faux, ou reste inconnu — et « inconnu » n'est jamais
 * traité comme « faux » : c'est précisément ce qui reste à explorer.
 */

export type SignalGroup =
  | 'terrain'
  | 'general'
  | 'douleur'
  | 'topographie'
  | 'neurologique'
  | 'examen'
  | 'psychosocial'

export interface SignalDefinition {
  /**
   * Groupe de signaux qui s'excluent : une douleur médiane n'est pas
   * paravertébrale. Répondre « oui » à l'un met les autres à « non ».
   */
  exclusive?: string
  /** Libellé court, pour un bouton dans une question à choix. */
  choiceLabel?: string
  /**
   * Formulation quand le signal est faux. Une négation porte souvent une
   * information clinique à part entière : « soulagé par le traitement » n'est
   * pas la même chose que l'absence de « douleur persistante malgré le
   * traitement », et c'est la première formulation que le patient a dite.
   * Sans elle, on rend une double négation illisible.
   */
  negativeLabel?: string
  /**
   * Un signal « compte-rendu » est relevé pour le dossier, pas pour trancher :
   * le geste déclenchant ou l'arrêt de travail décrivent le tableau sans
   * départager deux hypothèses. Les distinguer évite de les compter comme des
   * oublis dans le raisonnement.
   */
  role?: 'raisonnement' | 'compte-rendu'
  /**
   * Signaux nécessairement vrais si celui-ci l'est. Une douleur qui descend
   * sous le genou descend dans la jambe : inutile de poser les deux questions.
   */
  implies?: string[]
  /** Formulation affirmative, telle qu'elle sera reprise dans le compte rendu. */
  label: string
  group: SignalGroup
  /**
   * Formulation interrogative. Un signal qui en possède une peut être proposé
   * comme question à poser quand il manque ; les autres ne se renseignent que
   * par un test ou un examen.
   */
  question?: string
}

const definitions = {
  // ── Terrain ───────────────────────────────────────────────────────────────
  'terrain.age_moins_60': { label: 'âge inférieur à 60 ans', negativeLabel: '60 ans ou plus', group: 'terrain' },
  'terrain.age_plus_65': { label: 'âge supérieur à 65 ans', negativeLabel: 'moins de 65 ans', group: 'terrain' },
  'terrain.age_plus_70': { label: 'âge supérieur à 70 ans', negativeLabel: 'moins de 70 ans', group: 'terrain' },
  'terrain.sexe_feminin': { label: 'sexe féminin', negativeLabel: 'sexe masculin', group: 'terrain' },
  'terrain.grossesse': {
    label: 'grossesse en cours',
    group: 'terrain',
    role: 'compte-rendu',
  },
  'terrain.age_50_facteurs_cancer': {
    label: 'plus de 50 ans avec facteurs de risque de cancer',
    group: 'terrain',
    question: 'Le patient a-t-il plus de 50 ans avec des facteurs de risque de cancer (tabac, expositions) ?',
  },
  'terrain.antecedent_cancer': {
    label: 'antécédent de cancer',
    group: 'terrain',
    question: 'Y a-t-il un antécédent de cancer ?',
  },
  'terrain.corticotherapie': {
    label: 'corticothérapie au long cours',
    group: 'terrain',
    question: 'Le patient prend-il des corticoïdes au long cours ?',
  },
  'terrain.osteoporose': {
    label: 'ostéoporose connue',
    group: 'terrain',
    question: 'Une ostéoporose est-elle connue ?',
  },
  'terrain.immunodepression': {
    label: 'immunodépression',
    group: 'terrain',
    question: 'Y a-t-il une immunodépression (VIH, corticoïdes, immunosuppresseurs) ?',
  },
  'terrain.drogues_iv': { label: 'usage de drogues intraveineuses', group: 'terrain' },
  'terrain.catheter_infection_recente': {
    label: 'cathéter vasculaire ou infection bactérienne récente',
    group: 'terrain',
  },
  'terrain.chirurgie_rachis_recente': {
    label: 'chirurgie cervicale ou rachidienne récente',
    group: 'terrain',
    question: 'Y a-t-il eu une chirurgie du rachis récente ?',
  },
  'terrain.profil_vasculaire_aaa': {
    label: 'profil vasculaire évocateur d\'anévrisme',
    group: 'terrain',
  },
  'terrain.facteurs_vasculaires_50': {
    label: 'plus de 50 ans avec facteurs de risque vasculaire',
    group: 'terrain',
  },

  // ── Signes généraux ───────────────────────────────────────────────────────
  'general.perte_poids': {
    label: 'perte de poids inexpliquée récente',
    group: 'general',
    question: 'Y a-t-il eu une perte de poids inexpliquée récemment ?',
  },
  'general.fievre': { label: 'fièvre', group: 'general', question: 'Y a-t-il de la fièvre ?' },
  'general.douleur_nocturne': {
    label: 'douleur nocturne',
    group: 'douleur',
    question: 'La douleur réveille-t-elle en seconde partie de nuit ?',
  },
  'general.douleur_repos_constante': {
    label: 'douleur constante au repos, sans position antalgique',
    group: 'douleur',
    question: 'La douleur est-elle constante, sans position qui la soulage ?',
  },
  'general.douleur_persistante_traitement': {
    label: 'douleur persistante malgré le traitement',
    negativeLabel: 'soulagé par le traitement antalgique',
    group: 'douleur',
    question: 'La douleur persiste-t-elle ou s\'aggrave-t-elle malgré le traitement depuis plus d\'un mois ?',
  },
  'general.soulage_repos': {
    label: 'soulagé par le repos',
    group: 'douleur',
    question: 'Le repos soulage-t-il la douleur ?',
    role: 'compte-rendu',
  },
  'general.sommeil_perturbe': {
    label: 'sommeil perturbé par la douleur',
    group: 'douleur',
    question: 'La douleur perturbe-t-elle le sommeil ?',
    role: 'compte-rendu',
  },
  'general.traumatisme_recent': {
    label: 'traumatisme récent',
    group: 'general',
    question: 'Y a-t-il eu un traumatisme récent, même mineur ?',
  },
  'general.deficit_neuro_post_traumatique': {
    label: 'déficit neurologique associé au traumatisme',
    group: 'neurologique',
  },
  'general.contusion_abrasion': {
    label: 'contusion ou abrasion cutanée en regard du rachis',
    group: 'general',
    question: 'Y a-t-il une ecchymose ou une éraflure en regard de la colonne ?',
  },
  'general.douleur_mediane_epineuse': {
    label: 'douleur très localisée sur les épineuses',
    group: 'examen',
  },

  // ── Facteurs aggravants et soulageants ────────────────────────────────────
  // Deux praticiens ne posent pas les mêmes questions : la liste vise ce qu'un
  // interrogatoire peut relever, pas ce que le moteur sait exploiter. Ceux qui
  // ne départagent rien sont marqués « compte-rendu ».
  'facteur.aggrave_flexion': {
    label: 'aggravation en flexion antérieure',
    group: 'douleur',
    question: 'Se pencher en avant aggrave-t-il la douleur ?',
    role: 'compte-rendu',
  },
  'facteur.aggrave_extension': {
    label: 'aggravation en extension',
    group: 'douleur',
    question: 'Se cambrer en arrière aggrave-t-il la douleur ?',
    role: 'compte-rendu',
  },
  'facteur.aggrave_rotation': {
    label: 'aggravation en rotation ou torsion',
    group: 'douleur',
    question: 'Les mouvements de rotation aggravent-ils la douleur ?',
    role: 'compte-rendu',
  },
  'facteur.aggrave_debout': {
    label: 'aggravation en station debout prolongée',
    group: 'douleur',
    question: 'Rester debout longtemps aggrave-t-il la douleur ?',
    role: 'compte-rendu',
  },
  'facteur.aggrave_charge': {
    label: 'aggravation au port de charge',
    group: 'douleur',
    question: 'Porter une charge aggrave-t-il la douleur ?',
    role: 'compte-rendu',
  },
  'facteur.aggrave_effort': {
    label: 'aggravation à l\'effort physique',
    group: 'douleur',
    question: 'L\'effort physique aggrave-t-il la douleur ?',
    role: 'compte-rendu',
  },
  'facteur.aggrave_stress': {
    label: 'aggravation par le stress',
    group: 'douleur',
    question: 'Le stress aggrave-t-il la douleur ?',
    role: 'compte-rendu',
  },
  'facteur.aggrave_couche': {
    label: 'aggravation en position couchée',
    group: 'douleur',
    question: 'La position couchée aggrave-t-elle la douleur ?',
    role: 'compte-rendu',
  },
  'facteur.soulage_mouvement': {
    label: 'soulagé par le mouvement',
    group: 'douleur',
    question: 'Bouger soulage-t-il la douleur ?',
    role: 'compte-rendu',
  },
  'facteur.soulage_chaleur': {
    label: 'soulagé par la chaleur',
    group: 'douleur',
    question: 'La chaleur soulage-t-elle ?',
    role: 'compte-rendu',
  },
  'facteur.soulage_froid': {
    label: 'soulagé par le froid',
    group: 'douleur',
    question: 'Le froid soulage-t-il ?',
    role: 'compte-rendu',
  },
  'facteur.soulage_couche': {
    label: 'soulagé en position couchée',
    group: 'douleur',
    question: 'La position couchée soulage-t-elle ?',
    role: 'compte-rendu',
  },

  // ── Rythme et évolution ───────────────────────────────────────────────────
  'rythme.matinal': {
    label: 'douleur prédominante le matin',
    group: 'douleur',
    question: 'La douleur est-elle plus forte le matin ?',
    role: 'compte-rendu',
  },
  'rythme.vesperal': {
    label: 'douleur prédominante en fin de journée',
    group: 'douleur',
    question: 'La douleur est-elle plus forte en fin de journée ?',
    role: 'compte-rendu',
  },
  'rythme.permanente': {
    label: 'douleur permanente',
    negativeLabel: 'douleur intermittente',
    group: 'douleur',
    question: 'La douleur est-elle permanente, ou va-t-elle et vient-elle ?',
    role: 'compte-rendu',
  },
  'evolution.aggravation': {
    label: 'aggravation progressive depuis le début',
    group: 'douleur',
    question: 'La douleur s\'aggrave-t-elle depuis le début ?',
    role: 'compte-rendu',
  },
  'evolution.amelioration': {
    label: 'amélioration spontanée en cours',
    group: 'douleur',
    question: 'La douleur s\'améliore-t-elle spontanément ?',
    role: 'compte-rendu',
  },

  // ── Antécédents et prise en charge ────────────────────────────────────────
  'antecedent.chirurgie_rachis': {
    label: 'antécédent de chirurgie rachidienne',
    group: 'terrain',
    question: 'Y a-t-il eu une chirurgie du rachis par le passé ?',
    role: 'compte-rendu',
  },
  'antecedent.imagerie_realisee': {
    label: 'imagerie déjà réalisée pour ce motif',
    group: 'general',
    question: 'Une imagerie a-t-elle déjà été faite pour ce problème ?',
    role: 'compte-rendu',
  },
  'antecedent.prise_en_charge_anterieure': {
    label: 'prise en charge antérieure pour ce motif (kiné, ostéopathie)',
    group: 'general',
    question: 'Y a-t-il eu une prise en charge antérieure pour ce motif ?',
    role: 'compte-rendu',
  },
  'traitement.ains': {
    label: 'anti-inflammatoires en cours',
    group: 'general',
    question: 'Le patient prend-il des anti-inflammatoires ?',
    role: 'compte-rendu',
  },
  'traitement.myorelaxant': {
    label: 'myorelaxant en cours',
    group: 'general',
    question: 'Le patient prend-il un myorelaxant ?',
    role: 'compte-rendu',
  },

  // ── Contexte professionnel et sportif ─────────────────────────────────────
  'contexte.charges_travail': {
    label: 'port de charges au travail',
    group: 'psychosocial',
    question: 'Le travail impose-t-il du port de charges ?',
    role: 'compte-rendu',
  },
  'contexte.postures_prolongees': {
    label: 'postures prolongées ou statiques au travail',
    group: 'psychosocial',
    question: 'Le travail impose-t-il des postures prolongées ?',
    role: 'compte-rendu',
  },
  'contexte.travail_ecran': {
    label: 'travail sur écran prolongé',
    group: 'psychosocial',
    question: 'Le travail se fait-il longuement sur écran ?',
    role: 'compte-rendu',
  },
  'contexte.conduite_prolongee': {
    label: 'conduite prolongée',
    group: 'psychosocial',
    question: 'Y a-t-il de longs trajets en voiture ?',
    role: 'compte-rendu',
  },
  'contexte.activite_sportive': {
    label: 'activité sportive régulière',
    group: 'psychosocial',
    question: 'Y a-t-il une activité sportive régulière ?',
    role: 'compte-rendu',
  },

  // ── Drapeaux jaunes, relevés à l'interrogatoire ───────────────────────────
  'psychosocial.peur_mouvement': {
    label: 'peur du mouvement exprimée',
    group: 'psychosocial',
    question: 'Le patient évite-t-il de bouger par peur d\'aggraver ?',
  },
  'psychosocial.croyance_lesion_grave': {
    label: 'conviction d\'une lésion grave',
    group: 'psychosocial',
    question: 'Le patient pense-t-il avoir quelque chose de grave ?',
  },
  'psychosocial.stress_anxiete': {
    label: 'stress ou anxiété exprimés',
    group: 'psychosocial',
    question: 'Le patient évoque-t-il du stress ou de l\'anxiété ?',
  },
  'psychosocial.insatisfaction_travail': {
    label: 'insatisfaction au travail',
    group: 'psychosocial',
    question: 'Le patient est-il satisfait de sa situation professionnelle ?',
  },

  // ── Rachis lombaire ───────────────────────────────────────────────────────
  'lombaire.duree_aigue': {
    label: 'épisode aigu de moins de 8 semaines',
    negativeLabel: 'évolution de plus de 8 semaines',
    group: 'douleur',
    question: 'La douleur évolue-t-elle depuis moins de 8 semaines ?',
  },
  'lombaire.queue_de_cheval': {
    label: 'signes de syndrome de la queue de cheval',
    group: 'neurologique',
    question: 'Y a-t-il des troubles urinaires, une anesthésie en selle ou une faiblesse des deux jambes ?',
  },
  'lombaire.irradiation_jambe': {
    label: 'irradiation dans la jambe',
    group: 'topographie',
    question: 'La douleur descend-elle dans la jambe ?',
  },
  'lombaire.irradiation_sous_genou': {
    label: 'irradiation sous le genou',
    group: 'topographie',
    question: 'La douleur descend-elle sous le genou ?',
    implies: ['lombaire.irradiation_jambe'],
  },
  'lombaire.jambe_plus_douloureuse': {
    label: 'douleur de jambe plus intense que la douleur lombaire',
    group: 'topographie',
    question: 'La douleur de la jambe est-elle plus forte que celle du dos ?',
  },
  'lombaire.unilateral': {
    label: 'atteinte unilatérale',
    group: 'topographie',
    question: 'La douleur touche-t-elle une seule jambe ?',
  },
  'lombaire.aggrave_assis': {
    label: 'aggravation en position assise',
    group: 'douleur',
    question: 'La position assise aggrave-t-elle la douleur ?',
  },
  'lombaire.aggrave_marche': {
    label: 'aggravation à la marche',
    group: 'douleur',
    question: 'La marche aggrave-t-elle la douleur ?',
  },
  'lombaire.signe_caddie': {
    label: 'soulagement en antéflexion (signe du caddie)',
    group: 'douleur',
    question: 'Le patient est-il soulagé penché en avant, sur un caddie par exemple ?',
  },
  'lombaire.debut_brutal': {
    label: 'début brutal',
    group: 'douleur',
    question: 'La douleur est-elle apparue brutalement ?',
  },
  'lombaire.aggrave_toux': {
    label: 'aggravation à la toux ou à l\'éternuement',
    group: 'douleur',
    question: 'La toux ou l\'éternuement réveillent-ils la douleur ?',
  },
  'lombaire.geste_declenchant': {
    label: 'geste déclenchant identifié (port de charge, faux mouvement)',
    group: 'general',
    question: 'La douleur a-t-elle démarré sur un geste précis, un port de charge ou un faux mouvement ?',
    role: 'compte-rendu',
  },
  'lombaire.episodes_anterieurs': {
    label: 'épisodes lombaires antérieurs',
    group: 'general',
    question: 'Y a-t-il déjà eu des épisodes du même type ?',
  },
  'lombaire.irradiation_anterieure_cuisse': {
    label: 'irradiation à la face antérieure de cuisse ou à l\'aine',
    group: 'topographie',
    question: 'La douleur descend-elle devant la cuisse ou vers l\'aine ?',
  },
  'lombaire.faiblesse_ressentie_jambe': {
    label: 'sensation de faiblesse dans la jambe',
    group: 'neurologique',
    question: 'Le patient ressent-il une faiblesse dans la jambe ?',
  },
  'lombaire.boiterie': {
    label: 'boiterie',
    group: 'general',
    question: 'Y a-t-il une boiterie ?',
    role: 'compte-rendu',
  },
  'lombaire.rythme_inflammatoire': {
    label: 'rythme inflammatoire',
    group: 'douleur',
    question: 'La raideur matinale dure-t-elle plus de 30 minutes ?',
  },
  'lombaire.criteres_asas_4plus': {
    label: 'au moins 4 critères ASAS de rachialgie inflammatoire',
    group: 'douleur',
  },
  'lombaire.manifestations_extra_articulaires': {
    label: 'manifestations extra-articulaires (uvéite, psoriasis, MICI)',
    group: 'general',
    question: 'Y a-t-il une uvéite, un psoriasis ou une maladie inflammatoire de l\'intestin ?',
  },
  'lombaire.sacroiliite_radiographique': {
    label: 'sacroiliite visible en radiographie',
    group: 'examen',
  },
  'lombaire.hla_b27': { label: 'HLA-B27 positif', group: 'examen' },
  'lombaire.tableau_clinique_spa': {
    label: 'tableau clinique de spondyloarthrite (critères ASAS cliniques)',
    group: 'general',
  },
  'lombaire.localisation_mediane': {
    label: 'douleur médiane, sur les épineuses',
    group: 'topographie',
    question: 'La douleur siège-t-elle sur la ligne médiane, sur les épineuses ?',
    choiceLabel: 'Médiane',
    exclusive: 'lombaire.localisation',
  },
  'lombaire.localisation_paravertebrale': {
    label: 'douleur paravertébrale',
    group: 'topographie',
    question: 'La douleur siège-t-elle à côté de la colonne, d\'un seul côté ?',
    choiceLabel: 'Paravertébrale',
    exclusive: 'lombaire.localisation',
  },
  'lombaire.localisation_fessiere': {
    label: 'douleur fessière ou sacro-iliaque',
    group: 'topographie',
    question: 'La douleur siège-t-elle dans la fesse ou sur la sacro-iliaque ?',
    choiceLabel: 'Fessière',
    exclusive: 'lombaire.localisation',
  },
  'lombaire.localisation_diffuse': {
    label: 'douleur paravertébrale bilatérale diffuse',
    group: 'topographie',
    question: 'La douleur est-elle diffuse et bilatérale de part et d\'autre de la colonne ?',
    choiceLabel: 'Diffuse',
    exclusive: 'lombaire.localisation',
  },
  'lombaire.centralisation': {
    label: 'phénomène de centralisation aux mouvements répétés',
    negativeLabel: 'absence de centralisation aux mouvements répétés',
    group: 'examen',
  },
  'lombaire.lasegue_positif': {
    label: 'Lasègue positif',
    negativeLabel: 'Lasègue négatif',
    group: 'examen',
  },
  'lombaire.lasegue_croise_positif': {
    label: 'Lasègue croisé positif',
    negativeLabel: 'Lasègue croisé négatif',
    group: 'examen',
  },
  'lombaire.deficit_moteur': {
    label: 'déficit moteur du membre inférieur',
    group: 'neurologique',
  },
  'lombaire.criteres_revel_3plus': {
    label: 'au moins 3 critères de Revel sur 7',
    group: 'examen',
  },

  // ── Rachis cervical ───────────────────────────────────────────────────────
  'cervical.duree_aigue': {
    label: 'épisode aigu de moins de 8 semaines',
    negativeLabel: 'évolution de plus de 8 semaines',
    group: 'douleur',
    question: 'La cervicalgie évolue-t-elle depuis moins de 8 semaines ?',
  },
  'cervical.symptomes_myelopathie': {
    label: 'symptômes évocateurs de myélopathie',
    group: 'neurologique',
    question: 'Y a-t-il une maladresse des mains, des troubles de l\'équilibre ou des décharges en flexion du cou ?',
  },
  'cervical.signes_mns_2plus': {
    label: 'au moins 2 signes de motoneurone supérieur',
    group: 'examen',
  },
  'cervical.douleur_focale_epineuse': {
    label: 'douleur très localisée sur une épineuse cervicale',
    group: 'examen',
  },
  'cervical.irradiation_bras': {
    label: 'irradiation dans le bras',
    group: 'topographie',
    question: 'La douleur descend-elle dans le bras ?',
  },
  'cervical.paresthesies_bras': {
    label: 'paresthésies du membre supérieur',
    group: 'neurologique',
    question: 'Y a-t-il des fourmillements dans le bras ou la main ?',
  },
  'cervical.bras_plus_douloureux': {
    label: 'douleur de bras plus intense que la douleur cervicale',
    group: 'topographie',
    question: 'La douleur du bras est-elle plus forte que celle du cou ?',
  },
  'cervical.cephalees': {
    label: 'céphalées associées',
    group: 'douleur',
    question: 'Y a-t-il des maux de tête associés ?',
  },
  'cervical.whiplash': {
    label: 'mécanisme de coup du lapin (whiplash)',
    group: 'general',
    question: 'La douleur fait-elle suite à un coup du lapin ?',
  },
  'cervical.wad_grade_3': {
    label: 'atteinte neurologique objectivée (WAD grade III)',
    group: 'neurologique',
    implies: ['cervical.whiplash'],
  },
  'cervical.vertiges': {
    label: 'vertiges ou instabilité',
    group: 'general',
    question: 'Y a-t-il des vertiges ou une sensation d\'instabilité ?',
  },
  'cervical.acouphenes': {
    label: 'acouphènes',
    group: 'general',
    question: 'Y a-t-il des acouphènes ?',
    role: 'compte-rendu',
  },
  'cervical.craquements': {
    label: 'craquements ou crépitations cervicales',
    group: 'general',
    question: 'Y a-t-il des craquements dans le cou ?',
    role: 'compte-rendu',
  },
  'cervical.irradiation_occiput': {
    label: 'irradiation vers l\'occiput',
    group: 'topographie',
    question: 'La douleur remonte-t-elle vers l\'arrière du crâne ?',
    role: 'compte-rendu',
  },
  'cervical.irradiation_omoplate': {
    label: 'irradiation vers l\'omoplate',
    group: 'topographie',
    question: 'La douleur descend-elle vers l\'omoplate ?',
    role: 'compte-rendu',
  },
  'cervical.limitation_ressentie': {
    label: 'limitation de mobilité ressentie',
    group: 'general',
    question: 'Le patient sent-il son cou plus raide ou limité ?',
    role: 'compte-rendu',
  },
  'cervical.rythme_inflammatoire': {
    label: 'rythme inflammatoire cervical',
    group: 'douleur',
    question: 'La raideur cervicale matinale dure-t-elle plus de 30 minutes ?',
  },
  'cervical.localisation_suboccipitale': {
    label: 'douleur sous-occipitale',
    group: 'topographie',
    question: 'La douleur siège-t-elle sous l\'occiput, à la jonction tête-cou ?',
    choiceLabel: 'Sous-occipitale',
    exclusive: 'cervical.localisation',
  },
  'cervical.localisation_paravertebrale': {
    label: 'douleur paravertébrale cervicale',
    group: 'topographie',
    question: 'La douleur siège-t-elle à côté de la colonne cervicale, d\'un seul côté ?',
    choiceLabel: 'Paravertébrale',
    exclusive: 'cervical.localisation',
  },
  'cervical.criteres_cephalee_1plus': {
    label: 'au moins 1 critère de céphalée cervicogénique',
    group: 'examen',
  },
  'cervical.criteres_cephalee_3plus': {
    label: 'au moins 3 critères de céphalée cervicogénique',
    group: 'examen',
    implies: ['cervical.criteres_cephalee_1plus'],
  },
  'cervical.criteres_facettaires_2plus': {
    label: 'au moins 2 critères facettaires cervicaux',
    group: 'examen',
  },
  'cervical.traumatisme_mineur_recent': {
    label: 'traumatisme cervical récent, même mineur (manipulation, sport, coup du lapin)',
    group: 'general',
    question: 'Y a-t-il eu un mouvement ou un choc cervical récent, même anodin ?',
  },
  'cervical.spurling_positif': {
    label: 'Spurling positif',
    negativeLabel: 'Spurling négatif',
    group: 'examen',
  },
  'cervical.distraction_positif': {
    label: 'test de distraction cervicale positif',
    negativeLabel: 'test de distraction cervicale négatif',
    group: 'examen',
  },
  'cervical.ulnt_positif': {
    label: 'test de tension neurale du membre supérieur positif',
    negativeLabel: 'test de tension neurale du membre supérieur négatif',
    group: 'examen',
  },
  'cervical.rotation_limitee_60': {
    label: 'rotation cervicale limitée à moins de 60° du côté atteint',
    negativeLabel: 'rotation cervicale conservée au-delà de 60°',
    group: 'examen',
  },
  'cervical.frt_positif': {
    label: 'flexion-rotation test positif',
    negativeLabel: 'flexion-rotation test négatif',
    group: 'examen',
  },
  'cervical.cephalee_brutale': {
    label: 'céphalée brutale inhabituelle et sévère',
    group: 'douleur',
    question: 'La céphalée est-elle apparue brutalement, en coup de tonnerre ?',
  },
  'cervical.signes_neuro_dissection': {
    label: 'troubles visuels, vertiges, diplopie, dysphagie ou dysarthrie',
    group: 'neurologique',
    question: 'Y a-t-il des troubles visuels, des vertiges, une difficulté à avaler ou à articuler ?',
  },
  'cervical.acouphene_pulsatile': {
    label: 'acouphène pulsatile unilatéral',
    group: 'general',
    question: 'Y a-t-il un acouphène pulsatile d\'un seul côté ?',
  },

  // ── Psychosocial ──────────────────────────────────────────────────────────
  'psychosocial.arret_travail': {
    label: 'arrêt de travail en cours',
    group: 'psychosocial',
    question: 'Y a-t-il un arrêt de travail en cours ?',
  },
  'psychosocial.drapeaux_jaunes_2plus': {
    label: 'au moins 2 drapeaux jaunes',
    group: 'psychosocial',
  },
  'psychosocial.risque_chronicisation': {
    label: 'facteurs de risque de chronicisation',
    group: 'psychosocial',
  },
} as const satisfies Record<string, SignalDefinition>

export const SIGNALS: Record<string, SignalDefinition> = definitions

/** Identifiant de signal — typé sur le vocabulaire, pas sur `string`. */
export type SignalId = keyof typeof definitions

/** Relevé courant. Une clé absente ou `undefined` signifie « pas encore exploré ». */
export type SignalSet = Partial<Record<SignalId, boolean>>

export const GROUP_LABELS: Record<SignalGroup, string> = {
  terrain: 'Terrain',
  general: 'État général',
  douleur: 'Douleur',
  topographie: 'Topographie',
  neurologique: 'Neurologique',
  examen: 'Examen',
  psychosocial: 'Psychosocial',
}

/** Ordre d'affichage du relevé : du contexte vers l'examen. */
const GROUP_ORDER: SignalGroup[] = [
  'topographie',
  'douleur',
  'neurologique',
  'general',
  'terrain',
  'examen',
  'psychosocial',
]

export interface SignalSummary {
  /** Ce qui a été relevé, groupé par nature. */
  present: { group: SignalGroup; label: string; items: { id: SignalId; label: string }[] }[]
  /** Ce qui a été explicitement écarté — utile et souvent oublié d'un compte rendu. */
  absent: { id: SignalId; label: string }[]
}

/**
 * Formulation d'un signal écarté.
 *
 * Afficher le libellé affirmatif sous un intertitre « Écarté » fait lire
 * l'inverse de ce que le patient a dit : « douleur persistante malgré le
 * traitement » rangé dans les absents se comprend de travers, alors que le
 * patient a simplement dit que les antalgiques le soulagent. On énonce donc la
 * négation, avec la formulation propre du signal quand elle existe.
 */
export function negativeLabel(id: SignalId): string {
  const definition = definitions[id] as SignalDefinition | undefined
  if (!definition) return id
  if (definition.negativeLabel) return definition.negativeLabel
  // Élision devant voyelle ou h muet : « pas d'irradiation », « pas de fièvre ».
  const elide = /^[aeiouyàâäéèêëîïôöûüh]/i.test(definition.label)
  return `pas ${elide ? "d'" : 'de '}${definition.label}`
}

/**
 * Met le relevé en forme pour l'affichage. Le présent et l'écarté sont séparés
 * et chacun est énoncé dans sa propre formulation : un signe recherché et
 * absent est une information clinique à part entière, pas un trou.
 */
export function summariseSignals(signals: SignalSet): SignalSummary {
  const present = new Map<SignalGroup, { id: SignalId; label: string }[]>()
  const absent: { id: SignalId; label: string }[] = []

  for (const [id, value] of Object.entries(signals) as [SignalId, boolean | undefined][]) {
    const definition = definitions[id] as SignalDefinition | undefined
    if (value === undefined || !definition) continue
    if (value) {
      const bucket = present.get(definition.group) ?? []
      bucket.push({ id, label: definition.label })
      present.set(definition.group, bucket)
    } else {
      absent.push({ id, label: negativeLabel(id) })
    }
  }

  return {
    present: GROUP_ORDER.filter((group) => present.has(group)).map((group) => ({
      group,
      label: GROUP_LABELS[group],
      items: present.get(group)!,
    })),
    absent,
  }
}

/**
 * Questions à choix. Un groupe de signaux qui s'excluent se pose en une fois,
 * avec un bouton par réponse : quatre questions oui/non successives pour un
 * seul siège de douleur, dont une seule visible à la fois, ne se répondent pas.
 */
export const EXCLUSIVE_GROUPS: Record<string, string> = {
  'lombaire.localisation': 'Où siège la douleur ?',
  'cervical.localisation': 'Où siège la douleur cervicale ?',
}

/** Membres d'un groupe exclusif, dans l'ordre de déclaration. */
export function exclusiveMembers(group: string): { id: SignalId; label: string }[] {
  return (Object.entries(definitions) as [SignalId, SignalDefinition][])
    .filter(([, definition]) => definition.exclusive === group)
    .map(([id, definition]) => ({ id, label: definition.choiceLabel ?? definition.label }))
}

/** Groupe exclusif auquel appartient un signal, le cas échéant. */
export function exclusiveGroupOf(id: SignalId): string | undefined {
  return (definitions[id] as SignalDefinition | undefined)?.exclusive
}

/**
 * Ce que le dossier patient dit déjà, sans avoir à le demander.
 *
 * Poser au praticien une question dont la réponse est dans la fiche est la
 * façon la plus sûre de faire perdre confiance à un copilote.
 */
export function signalsFromRecord(
  age: number,
  gender?: string | null,
  pregnancyDueDate?: string | null,
): SignalSet {
  const signals: SignalSet = {
    'terrain.age_moins_60': age < 60,
    'terrain.age_plus_65': age > 65,
    'terrain.age_plus_70': age > 70,
  }
  // Le sexe féminin fait partie de la combinaison validée pour la fracture
  // vertébrale (Downie 2013) ; il est dans la fiche patient.
  if (gender === 'F' || gender === 'M') signals['terrain.sexe_feminin'] = gender === 'F'
  // La grossesse change la prise en charge : elle est dans la fiche, on la lit.
  if (pregnancyDueDate) {
    const terme = new Date(pregnancyDueDate).getTime()
    if (!Number.isNaN(terme)) signals['terrain.grossesse'] = terme > Date.now()
  }
  return signals
}

/** Un signal sert-il au raisonnement, ou seulement au compte rendu ? */
export function isReasoningSignal(id: SignalId): boolean {
  return (definitions[id] as SignalDefinition | undefined)?.role !== 'compte-rendu'
}

export function signalLabel(id: SignalId): string {
  return definitions[id]?.label ?? id
}

export function signalQuestion(id: SignalId): string | undefined {
  return (definitions[id] as SignalDefinition | undefined)?.question
}

/**
 * Enregistre une réponse et propage ce qu'elle implique. Répondre « oui, ça
 * descend sous le genou » répond du même coup à « est-ce que ça descend dans la
 * jambe » — sans quoi le copilote reposerait aussitôt une question déjà réglée.
 *
 * L'implication ne joue que dans le sens affirmatif : « non, pas sous le
 * genou » ne dit rien de l'irradiation dans la cuisse.
 */
export function applySignal(
  signals: SignalSet,
  id: SignalId,
  value: boolean,
): SignalSet {
  const next: SignalSet = { ...signals, [id]: value }
  if (!value) return next

  // Exclusivité : désigner un siège de douleur écarte les autres.
  const group = (definitions[id] as SignalDefinition | undefined)?.exclusive
  if (group) {
    for (const [candidate, definition] of Object.entries(definitions)) {
      if (candidate !== id && (definition as SignalDefinition).exclusive === group) {
        next[candidate as SignalId] = false
      }
    }
  }

  const queue = [...((definitions[id] as SignalDefinition | undefined)?.implies ?? [])]
  const seen = new Set<string>([id])
  while (queue.length > 0) {
    const implied = queue.shift()!
    if (seen.has(implied) || !(implied in definitions)) continue
    seen.add(implied)
    next[implied as SignalId] = true
    queue.push(...((definitions[implied as SignalId] as SignalDefinition).implies ?? []))
  }
  return next
}
