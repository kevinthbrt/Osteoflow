import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    return NextResponse.json({
      id: campaign.id,
      type: campaign.type,
      status: campaign.status,
      total: campaign.total_recipients,
      sent: campaign.sent_count,
      failed: campaign.failed_count,
      errorMessage: campaign.error_message,
      createdAt: campaign.created_at,
      completedAt: campaign.completed_at,
    })
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération de la diffusion' }, { status: 500 })
  }
}
