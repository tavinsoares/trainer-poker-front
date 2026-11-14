import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  test: {
    // Só lógica de domínio e validação de dados (módulos TypeScript puros).
    // Sem testes de componente nem E2E na v1.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
