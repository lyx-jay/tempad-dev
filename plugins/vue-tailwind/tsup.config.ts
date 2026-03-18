import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  splitting: false,
  clean: true,
  sourcemap: false,
  format: ['esm'],
  noExternal: [/.*/],
  treeshake: true,
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' })
})
