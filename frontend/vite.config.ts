import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Never drift to 5174: the compose port mapping would not follow.
    strictPort: true,
    // Bare IPs and localhost are always allowed; mDNS *.local names are not by default.
    allowedHosts: ['.local'],
  },
})
