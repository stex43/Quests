import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Defaults to 5173, which is what the Docker dev stack's container-internal
    // port must stay fixed at (docker-compose.yml maps "${FRONTEND_PORT:-5173}:5173"
    // and its healthcheck curls 127.0.0.1:5173 inside the container) -- the Docker
    // flow never sets this var, so it always gets that default. Only a bare `npm run
    // dev` on the host (outside Docker) needs a different value, to avoid colliding
    // with the separately-deployed prod stack's host-published port 5173 -- set
    // VITE_DEV_PORT in frontend/.env for that case (see frontend/.env.example).
    port: Number(process.env.VITE_DEV_PORT) || 5173,
    // Never silently drift to another port if this one's busy: the compose port
    // mapping (or whatever the user configured VITE_DEV_PORT to) would not follow.
    strictPort: true,
    // Bare IPs and localhost are always allowed; mDNS *.local names are not by default.
    allowedHosts: ['.local'],
  },
})
