import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

let appDataDir: string
const updates: Array<{ table: string; values: Record<string, unknown>; id: unknown }> = []

vi.mock('@/lib/database/connection', () => ({
  getAppDataDir: () => appDataDir,
}))

vi.mock('@/lib/database/query-builder', () => ({
  createLocalClient: () => ({
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: async (_column: string, id: unknown) => {
          updates.push({ table, values, id })
          return { data: null, error: null }
        },
      }),
    }),
  }),
}))

const { POST, DELETE } = await import('@/app/api/stamps/upload/route')

const PRACTITIONER_ID = '11111111-2222-3333-4444-555555555555'
// 1x1 transparent PNG
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const stampsDir = () => path.join(appDataDir, 'stamps')

function uploadRequest(body: Record<string, unknown>) {
  return new Request('http://127.0.0.1/api/stamps/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function upload(mimetype = 'image/png') {
  const response = await POST(
    uploadRequest({
      file: `data:${mimetype};base64,${PNG_BASE64}`,
      practitioner_id: PRACTITIONER_ID,
      mimetype,
    })
  )
  expect(response.status).toBe(200)
  return (await response.json()) as { stampUrl: string }
}

beforeEach(() => {
  updates.length = 0
  appDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osteoflow-stamps-'))
})

afterEach(() => {
  fs.rmSync(appDataDir, { recursive: true, force: true })
})

describe('stamp upload', () => {
  it('gives a replacement stamp a new URL so caches cannot serve the old image', async () => {
    const first = await upload()
    const second = await upload()

    expect(second.stampUrl).not.toBe(first.stampUrl)
    expect(updates.at(-1)).toMatchObject({
      table: 'practitioners',
      values: { stamp_url: second.stampUrl },
      id: PRACTITIONER_ID,
    })
  })

  it('deletes the superseded image instead of piling up files', async () => {
    await upload()
    const second = await upload()

    const files = fs.readdirSync(stampsDir())
    expect(files).toEqual([path.basename(second.stampUrl)])
  })

  it('replaces a legacy fixed-name stamp left by an older version', async () => {
    fs.mkdirSync(stampsDir(), { recursive: true })
    const legacy = path.join(stampsDir(), `${PRACTITIONER_ID}.png`)
    fs.writeFileSync(legacy, Buffer.from(PNG_BASE64, 'base64'))

    const { stampUrl } = await upload()

    expect(fs.existsSync(legacy)).toBe(false)
    expect(fs.readdirSync(stampsDir())).toEqual([path.basename(stampUrl)])
  })

  it('replaces a stamp saved under a different extension', async () => {
    const first = await upload('image/png')
    const second = await upload('image/jpeg')

    expect(fs.existsSync(path.join(stampsDir(), path.basename(first.stampUrl)))).toBe(false)
    expect(fs.readdirSync(stampsDir())).toEqual([path.basename(second.stampUrl)])
  })

  it('rejects a practitioner id that is not a UUID', async () => {
    const response = await POST(
      uploadRequest({ file: PNG_BASE64, practitioner_id: '../../etc', mimetype: 'image/png' })
    )
    expect(response.status).toBe(400)
  })
})

describe('stamp delete', () => {
  it('clears stamp_url and removes the file from disk', async () => {
    const { stampUrl } = await upload()

    const response = await DELETE(
      new Request(
        `http://127.0.0.1/api/stamps/upload?practitioner_id=${PRACTITIONER_ID}`,
        { method: 'DELETE' }
      )
    )

    expect(response.status).toBe(200)
    expect(fs.existsSync(path.join(stampsDir(), path.basename(stampUrl)))).toBe(false)
    expect(updates.at(-1)).toMatchObject({ values: { stamp_url: null }, id: PRACTITIONER_ID })
  })

  it('rejects a practitioner id that is not a UUID', async () => {
    const response = await DELETE(
      new Request('http://127.0.0.1/api/stamps/upload?practitioner_id=nope', { method: 'DELETE' })
    )
    expect(response.status).toBe(400)
  })
})
