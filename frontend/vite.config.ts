import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PostCSS/Tailwind load from postcss.config.cjs (explicit CJS theme path).
// Do not inline PostCSS here — monorepo cwd made theme discovery flaky.
export default defineConfig({
  plugins: [react()],
})
