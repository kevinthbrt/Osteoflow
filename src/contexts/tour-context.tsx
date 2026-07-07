'use client'

import { createContext, useCallback, useContext, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface TourContextValue {
  startTour: () => void
}

const TourContext = createContext<TourContextValue>({ startTour: () => {} })

export function useTour() {
  return useContext(TourContext)
}

const STEPS = [
  {
    element: '[data-tour="sidebar-logo"]',
    popover: {
      title: 'MyOsteoFlow',
      description: `Bienvenue dans votre logiciel de gestion de cabinet ostéopathique. La navigation principale se trouve dans cette barre latérale, toujours visible.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-dashboard"]',
    popover: {
      title: '📊 Tableau de bord',
      description: `Votre vue d'ensemble du jour : patients actifs, consultations du jour, chiffre d'affaires du mois, messages non lus, anniversaires de la semaine et dernières consultations. La carte de complétude du profil vous guide pas à pas pour bien démarrer.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="dashboard-stats"]',
    popover: {
      title: 'Indicateurs clés',
      description: `Ces quatre cartes vous donnent en un coup d'oeil l'état de votre cabinet en temps réel.`,
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="dashboard-new-consult"]',
    popover: {
      title: '➕ Nouvelle consultation',
      description: `Cliquez ici pour créer une consultation directement depuis le tableau de bord. Sélectionnez le patient, renseignez le motif et c'est parti.`,
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="dashboard-completion"]',
    popover: {
      title: '✅ Complétude du profil',
      description: `Cette carte disparaît une fois votre profil à 100 %. Elle vous guide pas à pas pour configurer votre cabinet, vos types de séance, votre email d'envoi et vos objectifs de CA. Cliquez sur 'Compléter' pour accéder directement à la section concernée.`,
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="nav-patients"]',
    popover: {
      title: '👥 Patients',
      description: `Gérez votre patientèle : fiches détaillées (coordonnées, genre, date de naissance, médecin référent, antécédents, profession), notes personnelles, historique des consultations et des factures. L'onglet consultation permet l'édition inline du règlement. Export PDF disponible.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-consultations"]',
    popover: {
      title: '🗓 Consultations',
      description: `L'historique complet de toutes vos séances. Pour chaque consultation : motif, compte-rendu libre, aide au diagnostic (arbres décisionnels lombalgie et cervicalgie basés sur les recommandations AAFP 2025), envoi d'email de conseils post-séance, prescription d'exercices en PDF, génération de courriers et facturation en un clic.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-messages"]',
    popover: {
      title: '💬 Messagerie et relances',
      description: `Communiquez avec vos patients par email ou SMS sans quitter l'application. Toutes les conversations sont archivées par patient. Les messages non lus apparaissent dans le badge de notification. Vous y retrouvez aussi les patients inactifs à relancer.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-communication"]',
    popover: {
      title: '📄 Communication',
      description: `Générez des courriers médicaux en un clic grâce à l'IA : courrier d'adressage vers un confrère, attestation de consultation. Le texte est pré-rempli avec les données de la consultation et entièrement modifiable avant impression / export PDF.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-surveys"]',
    popover: {
      title: '⭐ Sondages de satisfaction',
      description: `Envoyez automatiquement un sondage à vos patients 7 jours après leur consultation. Mesurez leur satisfaction : note globale, score EVA, mobilité, recommandation. Les réponses se synchronisent et sont analysées ici.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-statistics"]',
    popover: {
      title: '📈 Statistiques',
      description: `Analysez votre activité sur n'importe quelle période : répartition de votre patientèle (H/F, tranches d'âge), motifs de consultation les plus fréquents avec détection par mots-clés (un motif "Lombalgie + Cervicalgie" est comptabilisé dans les deux catégories), et évolution de votre chiffre d'affaires. Export disponible.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-accounting"]',
    popover: {
      title: '💰 Comptabilité',
      description: `Suivez vos recettes par période, corrigez manuellement le CA non facturé, générez des rapports comptables et envoyez-les directement à votre expert-comptable par email en un clic.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-objectives"]',
    popover: {
      title: '🎯 Objectifs',
      description: `Définissez votre objectif de chiffre d'affaires annuel. MyOsteoFlow calcule automatiquement vos objectifs journaliers, hebdomadaires et mensuels en tenant compte de vos semaines de congé et de votre tarif moyen. Les corrections manuelles se propagent automatiquement aux statistiques et à la comptabilité.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-scheduled-emails"]',
    popover: {
      title: '📧 Emails programmés',
      description: `Planifiez des emails de suivi à envoyer automatiquement à une date précise. Idéal pour les bilans post-traitement, les relances ou les rappels de bilan.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-elearning"]',
    popover: {
      title: '🎓 E-Learning',
      description: `Accédez aux formations OsteoUpgrade directement intégrées au logiciel. Développez vos compétences cliniques et de gestion sans changer d'application.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-settings"]',
    popover: {
      title: '⚙️ Paramètres',
      description: `Configurez votre cabinet : profil (avec champs spécifiques à votre profession — les étiopathes disposent des champs RPE et RNE au lieu du RPPS), logo et tampon pour les factures, types de séance pour la facturation, configuration email avec préréglages SMTP, sécurité (PIN + verrouillage automatique) et sauvegarde de vos données.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="header-search"]',
    popover: {
      title: '🔍 Recherche rapide',
      description: `Tapez le nom, prénom, téléphone ou email d'un patient pour y accéder instantanément depuis n'importe quelle page. Minimum 2 caractères.`,
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="support-widget"]',
    popover: {
      title: '🛟 Support',
      description: `Ce bouton flottant est votre ligne directe avec l'équipe MyOsteoFlow. Il est déplaçable sur l'écran. Cliquez pour ouvrir un ticket, joindre une capture d'écran et suivre l'état de votre demande (Reçu → En cours → Corrigé).`,
      side: 'top' as const,
    },
  },
  {
    element: '[data-tour="header-help"]',
    popover: {
      title: '❓ Revoir la visite guidée',
      description: `Ce bouton vous permet de relancer cette visite guidée à tout moment.`,
      side: 'bottom' as const,
    },
  },
]

async function launchDriver(onDone: () => void) {
  const { driver } = await import('@/lib/driver-tour.mjs')

  // Filter out steps whose element doesn't exist on the current page
  const activeSteps = STEPS.filter((s) => {
    if (!s.element) return true
    return !!document.querySelector(s.element)
  })

  if (activeSteps.length === 0) return

  const driverObj = driver({
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: 'Suivant →',
    prevBtnText: '← Précédent',
    doneBtnText: 'Terminer',
    allowClose: true,
    overlayColor: 'rgba(0, 0, 0, 0.65)',
    popoverClass: 'osteoflow-tour-popover',
    steps: [
      {
        popover: {
          title: '👋 Bienvenue dans MyOsteoFlow',
          description: `Votre logiciel de gestion de cabinet ostéopathique. Faisons ensemble un tour rapide des fonctionnalités principales. Naviguez avec les boutons ou appuyez sur Échap pour quitter.`,
        },
      },
      ...activeSteps,
      {
        popover: {
          title: '🎉 Vous êtes prêt !',
          description: `Vous connaissez maintenant les fonctionnalités de MyOsteoFlow. En cas de besoin, cliquez sur le bouton ? en haut à droite pour revoir cette visite à tout moment. Bonne pratique !`,
        },
      },
    ],
    onDestroyed: onDone,
  })

  driverObj.drive()
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const startTour = useCallback(async () => {
    if (pathname !== '/dashboard') {
      router.push('/dashboard')
      await new Promise((resolve) => setTimeout(resolve, 800))
    }
    await launchDriver(() => {
      fetch('/api/tour/status', { method: 'POST' }).catch(() => {})
      window.dispatchEvent(new Event('tour-completed'))
    })
  }, [pathname, router])

  // Check first launch — only once on mount.
  // Wait for CGU acceptance if not yet done, so the tour never overlaps the legal modal.
  useEffect(() => {
    const tryStartTour = () => {
      fetch('/api/tour/status')
        .then((r) => r.json())
        .then((d) => { if (!d.seen) setTimeout(() => startTour(), 1500) })
        .catch(() => {})
    }

    fetch('/api/legal/status')
      .then((r) => r.json())
      .then((d) => {
        if (d.accepted) {
          tryStartTour()
        } else {
          window.addEventListener('cgu-accepted', tryStartTour, { once: true })
        }
      })
      .catch(() => {})

    return () => window.removeEventListener('cgu-accepted', tryStartTour)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
    </TourContext.Provider>
  )
}
