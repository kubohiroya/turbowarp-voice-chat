import {defineConfig} from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    minify: false,
    sourcemap: false,
    emptyOutDir: false,
    lib: {
      entry: 'src/composition.ts',
      formats: ['es'],
      fileName: () => 'composition.js'
    },
    // Consumers share one copy of each upstream package; the standalone extension bundle inlines them.
    rollupOptions: {
      external: [/^@kubohiroya\/turbowarp-(named-functions|openai-realtime-api|web-speech)(\/.*)?$/]
    }
  }
});
