import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    const { data: campaign } = await db
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (!campaign || campaign.practitioner_id !== practitioner.id) {
      return NextResponse.json({ error: 'Diffusion non trouvée' }, { status: 404 })
    }

    if (campaign.status === 'completed' || campaign.status === 'failed' || campaign.status === 'cancelled') {
      return NextResponse.json({ error: 'Cette diffusion est déjà terminée' }, { status: 400 })
    }

    await db
      .from('email_campaign_recipients')
      .update({ status: 'failed', error_message: 'Diffusion annulée' })
      .eq('campaign_id', id)
      .eq('status', 'pending')

    await db
      .from('email_campaigns')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cancelling campaign:', error)
    return NextResponse.json({ error: "Erreur lors de l'annulation" }, { status: 500 })
  }
}
