import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/worker.ts', 'src/migrate.ts'],
  format: ['esm'],
  target: 'node22',
  sourcemap: true,
  clean: true,
  noExternal: ['@quickchat/contracts'],
})
