import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths, not root-absolute ("/assets/...") -- this app
  // gets served behind an arbitrary path prefix in deployment (e.g.
  // /cell/flyyt/ on a Nova instance, see ../backend/main.py's BASE_PATH),
  // and one build has to work under any prefix without baking a specific
  // one in at build time. Root-absolute paths resolve against the origin
  // and 404 under a prefix; relative paths resolve against the HTML
  // document's own URL, which already includes whatever prefix it was
  // actually served under.
  base: './',
})
