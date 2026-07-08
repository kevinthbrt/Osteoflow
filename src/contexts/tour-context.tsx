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
      description: `Votre page d'accueil : météo du jour, aperçu de vos patients à voir aujourd'hui, votre progression par rapport à votre objectif de chiffre d'affaires, un rappel de vos patients à relancer, et des contenus OsteoUpgrade (revue de littérature, formation à la une, vidéo pratique, flashcards) pour rester à jour entre deux patients.`,
      side: 'right' as const,
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
    element: '[data-tour="nav-day-plan"]',
    popover: {
      title: '📋 Ma journée',
      description: `Organisez l'ordre de vos rendez-vous du jour : ajoutez vos patients à la liste, réordonnez-les et cochez-les au fur et à mesure. Naviguez d'un jour à l'autre et ajoutez un nouveau patient à la volée sans quitter la page.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-patients"]',
    popover: {
      title: '👥 Patients et consultations',
      description: `Gérez votre patientèle : fiches détaillées (coordonnées, genre, date de naissance, médecin référent, antécédents, profession), notes personnelles et historique complet des consultations. Pour chaque séance : motif, compte-rendu libre, envoi d'email de conseils post-séance, prescription d'exercices en PDF, génération de courriers et facturation en un clic. Export PDF disponible.`,
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-messages"]',
    popover: {
      title: '💬 Messagerie et relances',
      description: `Communiquez avec vos patients par email sans quitter l'application. Toutes les conversations sont archivées par patient. Retrouvez ici vos patients inactifs à relancer, en manuel ou en programmant une relance automatique à une échéance choisie. Vous pouvez aussi envoyer une diffusion à plusieurs patients à la fois (ex. fermeture du cabinet pour les vacances).`,
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
      description: `Envoyez automatiquement un sondage à vos patients un nombre de jours après leur consultation que vous choisissez (réglable dans les paramètres). Mesurez leur satisfaction : note globale, score EVA, mobilité, recommandation. Les réponses se synchronisent et sont analysées ici.`,
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
      description: `Définissez votre objectif de chiffre d'affaires annuel : MyOsteoFlow calcule automatiquement vos objectifs journaliers, hebdomadaires et mensuels en tenant compte de vos semaines de congé et de votre tarif moyen. Sur le tableau de bord, un indicateur vous dit en temps réel si vous êtes en avance ou en retard par rapport à votre rythme cible.`,
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
      description: `Configurez votre cabinet : coordonnées et profil, facturation (types de séance, logo, tampon), contenu clinique, connexion email, sauvegarde et import de données, sécurité (PIN), journal d'activité, RGPD et mentions légales.`,
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
