import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Docker Desktop no Windows não propaga eventos nativos de mudança de
    // arquivo (inotify) através do bind mount pro container — sem isso, o
    // Vite serve versões antigas dos arquivos até o container reiniciar,
    // mesmo com o arquivo já salvo no disco (bug real encontrado 2026-08-21:
    // várias edições ficaram invisíveis no navegador até reiniciar o `web`).
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})
