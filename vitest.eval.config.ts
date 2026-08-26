import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Configuration séparée pour l'évaluation de l'extraction : elle appelle l'API
 * et coûte de l'argent, elle n'a donc rien à faire dans la suite de tests
 * lancée à chaque modification.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/eval/**/*.eval.ts'],
    testTimeout: 240_000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
