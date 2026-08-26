/**
 * Bibliographie du moteur.
 *
 * Toute valeur chiffrée du raisonnement — rapport de vraisemblance, prévalence
 * — cite une clé de cette table. La contrainte est vérifiée par les tests : une
 * clé absente fait échouer la compilation, une valeur sans clé fait échouer le
 * test d'invariant. C'est ce qui sépare une base de connaissance d'un avis.
 *
 * Origine
 * -------
 * Le socle est le document de référence lombaire fourni par le praticien
 * (« Base lombaire — moteur d'anamnèse »), retenu comme source de vérité pour
 * la région lombaire. Chaque valeur qu'il porte a toutefois été remontée à sa
 * publication primaire avant d'être codée : le document sert de plan, pas de
 * caution. Le champ `verification` dit où en est ce contrôle.
 *
 *  - `primaire`  : valeur recoupée sur la publication d'origine.
 *  - `document`  : valeur reprise du document, source primaire non encore
 *                  consultée. Utilisable, mais à ne pas propager ailleurs.
 *  - `corrigee`  : le document attribuait la valeur à une autre publication ;
 *                  l'attribution a été rectifiée ici.
 */

export interface SourceEntry {
  /** Référence complète, telle qu'elle serait citée dans un compte rendu. */
  citation: string
  verification: 'primaire' | 'document' | 'corrigee'
  /** Cadre de recrutement de l'étude — décisif pour la transposabilité. */
  cadre?: 'soins primaires' | 'urgences' | 'soins secondaires' | 'mixte'
  /** Précision sur ce qui a été vérifié, ou sur ce qui a été corrigé. */
  note?: string
}

export const SOURCES = {
  // ── Socle ─────────────────────────────────────────────────────────────────
  'doc.lombaire': {
    citation:
      'Base lombaire — moteur d\'anamnèse (document de référence interne, 2026)',
    verification: 'document',
    note: 'Spécification de référence de la région lombaire. Sert de plan ; chaque valeur est recoupée séparément.',
  },

  // ── Revues générales et recommandations ───────────────────────────────────
  'cashin.2026': {
    citation:
      'Cashin AG, Chou R, Weimer MB, McAuley JH. Low Back Pain: A Review. JAMA. 2026 Jun 15. doi:10.1001/jama.2026.9631',
    verification: 'primaire',
    cadre: 'mixte',
    note: 'Revue narrative, 108 publications (2005–2026), recommandations OMS/ACP/NICE. Retient aigu <6 semaines, subaigu 6–12, chronique >12.',
  },
  'chiarotto.2022': {
    citation: 'Chiarotto A, Koes BW. Nonspecific Low Back Pain. N Engl J Med. 2022;386(18):1732-1740',
    verification: 'document',
    cadre: 'mixte',
  },
  'knezevic.2021': {
    citation: 'Knezevic NN, Candido KD, Vlaeyen JWS, Van Zundert J, Cohen SP. Low back pain. Lancet. 2021;398(10294):78-92',
    verification: 'document',
    cadre: 'mixte',
  },
  'maher.2017': {
    citation: 'Maher C, Underwood M, Buchbinder R. Non-specific low back pain. Lancet. 2017;389(10070):736-747',
    verification: 'document',
    cadre: 'mixte',
    note: 'Environ 2 % des lombalgies en soins primaires sont d\'origine viscérale.',
  },
  'qaseem.2017': {
    citation:
      'Qaseem A, Wilt TJ, McLean RM, Forciea MA. Noninvasive Treatments for Acute, Subacute, and Chronic Low Back Pain. Ann Intern Med. 2017;166(7):514-530',
    verification: 'document',
  },
  'earwood.2025': {
    citation: 'Earwood JS, et al. Low Back Pain: Evaluation and Management. Am Fam Physician. 2025',
    verification: 'document',
    cadre: 'soins primaires',
  },

  // ── Drapeaux rouges ───────────────────────────────────────────────────────
  'han.cochrane.2023': {
    citation:
      'Han CS, Hancock MJ, Sharma S, et al. Red flags to screen for vertebral fracture in people presenting with low back pain. Cochrane Database Syst Rev. 2023;8:CD014461',
    verification: 'corrigee',
    cadre: 'mixte',
    note:
      'Le document attribue cette revue à « Williams et al. » — c\'est la version 2013. Premier auteur de la version 2023 : Han CS. Valeurs recoupées : contusion/abrasion LR+ 31,09 (IC 18,25–52,96) en soins tertiaires ; corticothérapie LR+ 3,97–48,50 ; traumatisme significatif en soins primaires LR+ 3,42–12,85 (le document indiquait une borne basse de 1,93).',
  },
  'downie.2013': {
    citation:
      'Downie A, Williams CM, Henschke N, et al. Red flags to screen for malignancy and fracture in patients with low back pain. BMJ. 2013;347:f7095',
    verification: 'primaire',
    cadre: 'mixte',
  },
  'notarangelo.2025': {
    citation:
      'Notarangelo A, et al. Red flags for spinal malignancy in low back pain. J Clin Med. 2025',
    verification: 'document',
    cadre: 'mixte',
  },
  'vadod.2022': {
    citation:
      'VA/DoD Clinical Practice Guideline for the Diagnosis and Treatment of Low Back Pain. Department of Veterans Affairs / Department of Defense, 2022',
    verification: 'document',
    cadre: 'mixte',
  },
  'reginato.2025': {
    citation: 'Reginato A, et al. Prevalence of serious pathology in low back pain. Pain Med. 2025',
    verification: 'document',
    cadre: 'soins primaires',
    note: 'Prévalences de départ : pathologie grave ~2,9 %, fracture 2,4 %, syndrome de la queue de cheval 0,3 %.',
  },

  // ── Radiculopathie et hernie ──────────────────────────────────────────────
  'vanderwindt.2010': {
    citation:
      'van der Windt DA, Simons E, Riphagen II, et al. Physical examination for lumbar radiculopathy due to disc herniation. Cochrane Database Syst Rev. 2010;2:CD007431',
    verification: 'primaire',
    cadre: 'soins secondaires',
    note: 'Lasègue Sn 0,92 · Sp 0,28 ; Lasègue croisé Sn 0,28 · Sp 0,90.',
  },
  'genevay.2017': {
    citation:
      'Genevay S, Courvoisier DS, Konstantinou K, et al. Clinical classification criteria for radicular pain caused by lumbar disc herniation: the RAPIDH criteria. Spine J. 2017;17(10):1464-1471',
    verification: 'corrigee',
    cadre: 'soins secondaires',
    note:
      'Le document attribue le modèle RAPIDH à « Chiodo & Jorgensen, Muscle & Nerve, 2025 » — cette référence existe mais porte sur les mimes périphériques. Le modèle à poids entiers (douleur monoradiculaire 6, Lasègue <60° ou femoral stretch 4, réflexe unilatéral 4, déficit moteur 3, douleur de jambe unilatérale 3 ; seuil ≥11) est de Genevay et al. 2017, Se 0,71 · Sp 0,90.',
  },
  'bateman.2025': {
    citation:
      'Bateman EA, Jorgensen AY, Chiodo A. Lumbosacral radiculopathy: diagnosis and differential. Muscle Nerve. 2025',
    verification: 'document',
    cadre: 'soins secondaires',
    note: 'Odds ratios d\'anamnèse : douleur dermatomale 4,1 ; Valsalva 3,2 ; faiblesse subjective 2,2 ; perte sensitive subjective 2,1.',
  },
  'jorgensen.2025': {
    citation:
      'Jorgensen AY, Chiodo A. Musculoskeletal mimics of lumbosacral radiculopathy. Muscle Nerve. 2025',
    verification: 'document',
    cadre: 'soins secondaires',
    note: 'Coexistence fréquente mime / radiculopathie (18–35 % de syndrome douloureux du grand trochanter chez les lombalgiques) : ne jamais coder l\'un comme excluant l\'autre.',
  },
  'khorami.2021': {
    citation:
      'Khorami AK, Oliveira CB, Maher CG, et al. Recommendations for diagnosis and treatment of lumbosacral radicular pain: a systematic review of clinical practice guidelines. J Clin Med. 2021;10(11):2482',
    verification: 'document',
  },

  // ── Sténose lombaire ──────────────────────────────────────────────────────
  'suri.2010': {
    citation:
      'Suri P, Rainville J, Kalichman L, Katz JN. Does this older adult with lower extremity pain have the clinical syndrome of lumbar spinal stenosis? JAMA. 2010;304(23):2628-2636',
    verification: 'primaire',
    cadre: 'soins secondaires',
    note:
      'Rational Clinical Examination, 4 études, 741 patients. Recoupé : démarche à base élargie LR+ 13 (IC 1,9–95), Romberg LR+ 4,2 (IC 1,4–13), absence de claudication neurogène = meilleur élément d\'exclusion.',
  },

  // ── Douleur discogénique ──────────────────────────────────────────────────
  'deneuville.2025': {
    citation:
      'Deneuville JP, et al. Concurrent validity of the directional preference phenomenon compared to controlled lumbar discography. Musculoskelet Sci Pract. 2025',
    verification: 'primaire',
    cadre: 'soins secondaires',
    note: 'Préférence directionnelle LR+ 7,65 · LR− 0,56. Recoupé.',
  },
  'tonosu.2016': {
    citation:
      'Tonosu J, Inanami H, Oka H, et al. Diagnosing discogenic low back pain associated with degenerative disc disease using a medical interview. PLoS One. 2016;11(11):e0166031',
    verification: 'primaire',
    cadre: 'soins secondaires',
    note: 'Seuil ≥31/47 : Se 100 %, Sp 71,4 %. Questionnaire purement verbal, exploitable à l\'écoute.',
  },

  // ── Sacro-iliaque ─────────────────────────────────────────────────────────
  'han.eclinm.2023': {
    citation:
      'Han CS, et al. Diagnostic accuracy of history and physical examination for sacroiliac joint pain. eClinicalMedicine. 2023',
    verification: 'primaire',
    cadre: 'soins secondaires',
    note: 'Absence de douleur lombaire médiane LR+ 2,41 (IC 1,89–3,07) ; cluster de provocation ≥3 LR+ 2,44 (IC 1,50–3,98). Référence : bloc intra-articulaire.',
  },
  'laslett.2005': {
    citation:
      'Laslett M, Aprill CN, McDonald B, Young SB. Diagnosis of sacroiliac joint pain: validity of individual provocation tests and composites of tests. Man Ther. 2005;10(3):207-218',
    verification: 'document',
    cadre: 'soins secondaires',
  },

  // ── Spondylolisthésis et instabilité ──────────────────────────────────────
  'ahn.2015': {
    citation:
      'Ahn K, Jhun HJ. New physical examination tests for lumbar spondylolisthesis and instability: low midline sill sign and interspinous gap change during lumbar flexion-extension motion. BMC Musculoskelet Disord. 2015;16:97',
    verification: 'document',
    cadre: 'soins secondaires',
    note: 'Low midline sill sign Se 0,81 · Sp 0,89 ; interspinous gap change Se 0,82 · Sp 0,61.',
  },
  'moller.2000': {
    citation: 'Möller H, Sundin A, Hedlund R. Symptoms, signs, and functional disability in adult spondylolisthesis. Spine. 2000;25(6):683-689',
    verification: 'document',
    cadre: 'soins secondaires',
  },

  // ── Facettaire ────────────────────────────────────────────────────────────
  'revel.1998': {
    citation:
      'Revel M, Poiraudeau S, Auleley GR, et al. Capacity of the clinical picture to characterize low back pain relieved by facet joint anesthesia. Spine. 1998;23(18):1972-1976',
    verification: 'document',
    cadre: 'soins secondaires',
  },

  // ── Pédiatrique et sportif ────────────────────────────────────────────────
  'macdonald.2017': {
    citation: 'MacDonald J, Stuart E, Rodenberg R. Musculoskeletal Low Back Pain in School-aged Children. JAMA Pediatr. 2017;171(3):280-287',
    verification: 'document',
    cadre: 'soins secondaires',
  },
  'aoyagi.2021': {
    citation:
      'Aoyagi K, et al. Classification and regression tree analysis to distinguish acute spondylolysis from nonspecific low back pain in young athletes. Spine. 2021',
    verification: 'document',
    cadre: 'soins secondaires',
    note: 'Se 0,64 · Sp 0,92.',
  },
  'achar.2020': {
    citation: 'Achar S, Yamanaka J. Back Pain in Children and Adolescents. Am Fam Physician. 2020;102(1):19-28',
    verification: 'document',
    cadre: 'soins primaires',
  },

  // ── Méthodologie ──────────────────────────────────────────────────────────
  'grimes.2005': {
    citation: 'Grimes DA, Schulz KF. Refining clinical diagnosis with likelihood ratios. Lancet. 2005;365(9469):1500-1505',
    verification: 'document',
    note: 'Fondement du chaînage bayésien par les cotes, et des paliers d\'informativité du rapport de vraisemblance.',
  },
  'petersen.2017': {
    citation:
      'Petersen T, Laslett M, Juhl C. Clinical classification in low back pain: best-evidence diagnostic rules based on systematic reviews. BMC Musculoskelet Disord. 2017;18(1):188',
    verification: 'document',
    note: 'Corrélation des signes lombaires : privilégier le rapport du cluster validé au produit des rapports individuels.',
  },
  'weatherall.2018': {
    citation: 'Weatherall M. Likelihood ratios and clinical decision making. Postgrad Med J. 2018',
    verification: 'document',
    note: 'Ne retenir un signe que si LR+ ≥2 ou LR− ≤0,5, avec un intervalle de confiance excluant 1,0.',
  },

  // ── Syndrome de la queue de cheval ────────────────────────────────────────
  'kuris.2021': {
    citation: 'Kuris EO, McDonald CL, Palumbo MA, Daniels AH. Evaluation and Management of Cauda Equina Syndrome. Am J Med. 2021;134(12):1483-1489',
    verification: 'document',
    cadre: 'soins secondaires',
    note: 'Rétention urinaire nouvelle et anesthésie en selle : items verbaux critiques. Tout item critique → IRM en urgence, sans attendre d\'accumulation.',
  },
  'angus.2021': {
    citation: 'Angus M, et al. Cauda equina syndrome: clinical findings and diagnostic accuracy. 2021',
    verification: 'document',
    cadre: 'soins secondaires',
    note: 'Perte des réflexes des membres inférieurs : LR 3,4 en analyse multivariée.',
  },
  'wood.2024': {
    citation: 'Wood C, et al. Predictors of cauda equina syndrome on emergency MRI. 2024',
    verification: 'document',
    cadre: 'urgences',
    note: 'Aréflexie achilléenne bilatérale OR 4,3 ; douleur bilatérale des jambes OR 2,2–2,6.',
  },
  'hennessy.2025': {
    citation: 'Hennessy MJ, et al. Cauda equina syndrome: recommendations for early recognition. 2025',
    verification: 'document',
    cadre: 'soins secondaires',
  },

  // ── Région cervicale ──────────────────────────────────────────────────────
  'wainner.2003': {
    citation:
      'Wainner RS, Fritz JM, Irrgang JJ, et al. Reliability and diagnostic accuracy of the clinical examination and patient self-report measures for cervical radiculopathy. Spine. 2003;28(1):52-62',
    verification: 'document',
    cadre: 'soins secondaires',
    note: 'Spurling Sp 0,93 ; test de distraction Sp 0,90 ; ULNT Sn 0,97.',
  },
  'hall.2004': {
    citation:
      'Hall T, Robinson K. The flexion-rotation test and active cervical mobility: a comparative measurement study in cervicogenic headache. Man Ther. 2004;9(4):197-202',
    verification: 'document',
    cadre: 'soins secondaires',
    note: 'Test de flexion-rotation : Sn 0,91 · Sp 0,90 pour une restriction C1-C2.',
  },
} as const satisfies Record<string, SourceEntry>

export type SourceKey = keyof typeof SOURCES

export function sourceCitation(key: SourceKey): string {
  return SOURCES[key].citation
}

/** Sources dont la publication primaire reste à consulter. */
export function sourcesNonVerifiees(): SourceKey[] {
  return (Object.keys(SOURCES) as SourceKey[]).filter(
    (key) => SOURCES[key].verification === 'document',
  )
}
