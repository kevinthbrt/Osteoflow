import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { createLocalClient } = await import('@/lib/database/query-builder')
    const client = createLocalClient()

    const { data: practitioner } = await client.from('app_config').select('value').eq('key', 'current_practitioner_id').single()
    if (!practitioner) {
      return NextResponse.json({ data: null, error: { message: 'Not authenticated' } }, { status: 401 })
    }

    const { data, error } = await client
      .from('consultation_templates')
      .select('*')
      .eq('practitioner_id', practitioner.value)
      .order('use_count', { ascending: false })

    if (error) {
      return NextResponse.json({ data: null, error }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch templates'
    return NextResponse.json({ data: null, error: { message } }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { createLocalClient } = await import('@/lib/database/query-builder')
    const client = createLocalClient()

    const { data: practitioner } = await client.from('app_config').select('value').eq('key', 'current_practitioner_id').single()
    if (!practitioner) {
      return NextResponse.json({ data: null, error: { message: 'Not authenticated' } }, { status: 401 })
    }

    const body = await request.json()

    const { data, error } = await client
      .from('consultation_templates')
      .insert({
        practitioner_id: practitioner.value,
        name: body.name,
        reason: body.reason || null,
        anamnesis: body.anamnesis || null,
        examination: body.examination || null,
        advice: body.advice || null,
        category: body.category || null,
      })
      .select('*')

    if (error) {
      return NextResponse.json({ data: null, error }, { status: 500 })
    }

    return NextResponse.json({ data: data?.[0] || null })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create template'
    return NextResponse.json({ data: null, error: { message } }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { createLocalClient } = await import('@/lib/database/query-builder')
    const client = createLocalClient()

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ data: null, error: { message: 'Missing template id' } }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) updateData.name = body.name
    if (body.reason !== undefined) updateData.reason = body.reason || null
    if (body.anamnesis !== undefined) updateData.anamnesis = body.anamnesis || null
    if (body.examination !== undefined) updateData.examination = body.examination || null
    if (body.advice !== undefined) updateData.advice = body.advice || null
    if (body.category !== undefined) updateData.category = body.category || null
    if (body.use_count !== undefined) updateData.use_count = body.use_count

    const { data, error } = await client
      .from('consultation_templates')
      .update(updateData)
      .eq('id', body.id)
      .select('*')

    if (error) {
      return NextResponse.json({ data: null, error }, { status: 500 })
    }

    return NextResponse.json({ data: data?.[0] || null })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update template'
    return NextResponse.json({ data: null, error: { message } }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { createLocalClient } = await import('@/lib/database/query-builder')
    const client = createLocalClient()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ data: null, error: { message: 'Missing template id' } }, { status: 400 })
    }

    const { error } = await client
      .from('consultation_templates')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ data: null, error }, { status: 500 })
    }

    return NextResponse.json({ data: { success: true } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete template'
    return NextResponse.json({ data: null, error: { message } }, { status: 500 })
  }
}
