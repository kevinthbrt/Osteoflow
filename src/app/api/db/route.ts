/**
 * Generic database query API route.
 *
 * Accepts a query descriptor from client components and executes it
 * using the server-side SQLite query builder. This allows client components
 * (which run in the browser) to interact with the database without importing
 * Node.js modules directly.
 */

import { NextResponse } from 'next/server'
import { createLocalClient } from '@/lib/database/query-builder'
import { initServerCron } from '@/lib/server-cron'

// Start background cron jobs on first request
initServerCron()

export async function POST(request: Request) {
  try {
    const descriptor = await request.json()
    const client = createLocalClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chain: any = client.from(descriptor.table)

    // Apply operation
    switch (descriptor.operation) {
      case 'select':
        chain = chain.select(descriptor.columns || '*', descriptor.selectOptions)
        break
      case 'insert':
        chain = chain.insert(descriptor.data)
        if (descriptor.returnSelect) {
          chain = chain.select(descriptor.returnSelectColumns)
        }
        break
      case 'update':
        chain = chain.update(descriptor.data)
        if (descriptor.returnSelect) {
          chain = chain.select(descriptor.returnSelectColumns)
        }
        break
      case 'delete':
        chain = chain.delete()
        if (descriptor.returnSelect) {
          chain = chain.select(descriptor.returnSelectColumns)
        }
        break
    }

    // Apply conditions
    if (descriptor.conditions) {
      for (const cond of descriptor.conditions) {
        chain = chain[cond.type](cond.column, cond.value)
      }
    }

    // Apply ordering
    if (descriptor.orders) {
      for (const ord of descriptor.orders) {
        chain = chain.order(ord.column, { ascending: ord.ascending })
      }
    }

    // Apply limit / range
    if (descriptor.offsetCount != null && descriptor.limitCount != null) {
      chain = chain.range(descriptor.offsetCount, descriptor.offsetCount + descriptor.limitCount - 1)
    } else if (descriptor.limitCount != null) {
      chain = chain.limit(descriptor.limitCount)
    }

    // Apply single
    if (descriptor.singleResult) {
      chain = chain.single()
    }

    const result = await chain
    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database query failed'
    return NextResponse.json({ data: null, error: { message } }, { status: 500 })
  }
}
