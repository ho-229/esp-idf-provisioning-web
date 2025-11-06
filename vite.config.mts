import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ESPProvisioningWeb',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.es.js' : 'index.cjs.js')
    },
    outDir: 'dist',
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
