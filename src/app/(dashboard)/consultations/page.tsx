import { redirect } from 'next/navigation'

export default function ConsultationsRedirect() {
  redirect('/patients?tab=consultations')
}
