import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/worker.ts', 'src/db/migrate.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Bundle the workspace contracts package; externalize real npm deps.
  noExternal: ['@lumen/shared'],
  skipNodeModulesBundle: true,
});
