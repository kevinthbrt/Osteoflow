/**
 * Worker Thread for Whisper transcription.
 *
 * Runs in a separate Node.js thread so ONNX Runtime inference does not block
 * the Electron main process event loop (which would freeze the window).
 */

const { workerData, parentPort } = require('worker_threads')

;(async () => {
  try {
    const { pipeline, env } = require('@huggingface/transformers')
    env.cacheDir = workerData.cacheDir
    console.log('[Whisper Worker] Chargement du modèle…')
    const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base')
    console.log('[Whisper Worker] Modèle prêt.')

    // Signal readiness to the main process
    parentPort.postMessage({ type: 'ready' })

    parentPort.on('message', async ({ id, buffer }: { id: number; buffer: ArrayBuffer }) => {
      try {
        const float32 = new Float32Array(buffer)
        const result = await pipe(float32, { language: 'french', task: 'transcribe' })
        parentPort.postMessage({ id, text: (result?.text ?? '').trim() })
      } catch (err: any) {
        parentPort.postMessage({ id, error: err?.message ?? 'Erreur inconnue' })
      }
    })
  } catch (err: any) {
    console.error('[Whisper Worker] Erreur init:', err)
    parentPort.postMessage({ type: 'error', error: err?.message ?? 'Erreur init' })
  }
})()
