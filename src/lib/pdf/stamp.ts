export async function getStampDataUrl(stampUrl?: string | null): Promise<string | null> {
  if (!stampUrl) return null

  try {
    const response = await fetch(stampUrl)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || 'image/png'
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch (error) {
    console.error('Error loading stamp image:', error)
    return null
  }
}
