import path from 'node:path';
import { serveStatic } from 'hono/bun';
import { app } from './index';

const port = Number(process.env.RATATOSKR_PORT ?? '17653');

// Tauri passes the dist dir via RATATOSKR_DIST_DIR; fall back to cwd/dist for local testing.
const distDir = process.env.RATATOSKR_DIST_DIR ?? path.resolve(process.cwd(), 'dist');

// Serve static assets from dist/; falls through to next handler if file not found.
app.use('*', serveStatic({ root: distDir }));

// SPA fallback: any unmatched route serves index.html so client-side routing works.
app.get('*', serveStatic({ path: 'index.html', root: distDir }));

Bun.serve({ port, fetch: app.fetch });
console.log(`ratatoskr-server listening on http://localhost:${port}`);

// When spawned as a Tauri sidecar, exit if the parent process dies. macOS has no
// PR_SET_PDEATHSIG equivalent, so the sidecar polls for the parent instead.
const parentPid = Number(process.env.RATATOSKR_PARENT_PID ?? '0');
if (parentPid > 0) {
  setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      process.exit(0);
    }
  }, 1000);
}
