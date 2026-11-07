import {
  Users,
  BarChart3,
  Settings,
  MessageCircle,
  LayoutDashboard,
  TrendingUp,
  Target,
  ClipboardList,
  FileText,
  GraduationCap,
  ListChecks,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react'

/**
 * Source unique de la navigation : menu latéral, titre de l'en-tête et
 * palette de commandes lisent tous cette liste. Ajouter une page ici suffit
 * pour qu'elle ait un titre et soit trouvable avec Ctrl + K.
 */
export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  /** Sous-titre affiché dans l'en-tête */
  description: string
  /** Mots-clés supplémentaires pour la palette de commandes */
  keywords?: string
  /** Version qui a introduit l'entrée : affiche la pastille « Nouveau » */
  newIn?: string
  /** Autres préfixes d'URL rattachés à cette entrée */
  matches?: string[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navigationGroups: NavGroup[] = [
  {
    label: 'Cabinet',
    items: [
      { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, description: 'Vue d’ensemble de votre activité', keywords: 'accueil' },
      { name: 'Ma journée', href: '/day-plan', icon: ListChecks, description: 'Vos patients du jour', keywords: 'planning agenda rendez-vous' },
      { name: 'Patients', href: '/patients', icon: Users, description: 'Patients et consultations', keywords: 'dossiers', matches: ['/consultations'] },
    ],
  },
  {
    label: 'Suivi',
    items: [
      { name: 'Messagerie', href: '/messages', icon: MessageCircle, description: 'Messages et relances', keywords: 'emails relances', matches: ['/scheduled-emails'] },
      { name: 'Suivi patients', href: '/surveys', icon: ClipboardList, description: 'Questionnaires et suivis', keywords: 'sondages questionnaires' },
      { name: 'Courriers', href: '/communication', icon: FileText, description: 'Courriers et documents', keywords: 'communication lettres documents' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { name: 'Comptabilité', href: '/accounting', icon: BarChart3, description: 'Recettes, factures et rapports', keywords: 'factures recettes', newIn: '1.16.0', matches: ['/invoices'] },
      { name: 'Objectifs', href: '/objectives', icon: Target, description: 'Suivi de vos objectifs' },
      { name: 'Statistiques', href: '/statistics', icon: TrendingUp, description: 'Analyses et tendances' },
    ],
  },
  {
    label: 'Formation',
    items: [
      { name: 'E-Learning', href: '/elearning', icon: GraduationCap, description: 'Formations OsteoUpgrade', keywords: 'formation cours', matches: ['/formation'] },
      { name: 'Tutoriels', href: '/tutorials', icon: PlayCircle, description: 'Toutes les fonctions de MyOsteoflow en vidéo', keywords: 'aide tutoriel vidéo comment faire guide', newIn: '1.22.0' },
    ],
  },
]

export const settingsNavItem: NavItem = {
  name: 'Paramètres',
  href: '/settings',
  icon: Settings,
  description: 'Configuration du cabinet',
  keywords: 'réglages configuration',
}

/** Pages sans entrée de menu mais qui méritent un titre propre */
const extraPages: Array<Pick<NavItem, 'name' | 'href' | 'description'>> = [
  { name: 'Changelog', href: '/changelog', description: 'Historique des mises à jour' },
  { name: 'Import', href: '/import', description: 'Importer des données' },
]

export const allNavItems: NavItem[] = [
  ...navigationGroups.flatMap((group) => group.items),
  settingsNavItem,
]

export function isNavItemActive(item: Pick<NavItem, 'href' | 'matches'>, pathname: string): boolean {
  return [item.href, ...(item.matches ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function getPageInfo(pathname: string): { title: string; description: string } {
  // Les factures et consultations ont leur propre titre, plus précis que
  // celui de l'entrée de menu qui les regroupe.
  if (pathname.startsWith('/invoices')) return { title: 'Factures', description: 'Factures et paiements' }
  if (pathname.startsWith('/consultations')) return { title: 'Consultations', description: 'Historique des consultations' }
  if (pathname.startsWith('/scheduled-emails')) return { title: 'Emails programmés', description: 'Envois planifiés' }
  const item = [...allNavItems, ...extraPages].find((entry) => isNavItemActive(entry, pathname))
  return item
    ? { title: item.name, description: item.description }
    : { title: 'MyOsteoFlow', description: 'Gestion de cabinet' }
}
