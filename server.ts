import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const distPath = path.resolve(__dirname, 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');

  // Allow all custom domains and CORS headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-admin-session, x-tenant-id, x-user-role, x-member-id, x-file-name, x-image-filename, x-mime-type, x-image-mimetype, x-storage-category, x-storage-path, x-record-id, x-activity-id, x-uploaded-by, x-uploaded-by-uid'
    );
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });

  // Mount backend API middleware compiled during build (dist/apiPlugin.mjs)
  const compiledPluginPath = path.join(distPath, 'apiPlugin.mjs');
  if (fs.existsSync(compiledPluginPath)) {
    try {
      const pluginModule = await import(compiledPluginPath);
      const pluginFactory = pluginModule.apiPlugin || pluginModule.associationApiPlugin;
      if (typeof pluginFactory === 'function') {
        const plugin = pluginFactory();
        if (plugin && typeof plugin.configureServer === 'function') {
          plugin.configureServer({
            middlewares: {
              use: (fn: any) => {
                app.use(fn);
              },
            },
          });
        }
      }
    } catch (err) {
      console.error('[Server] Failed to load compiled API plugin:', err);
    }
  }

  // Serve static production assets from dist
  if (fs.existsSync(distPath)) {
    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
  }

  // SPA fallback for all non-API routes on any custom domain
  app.use((req, res, next) => {
    if (req.url.startsWith('/api/')) {
      next();
      return;
    }
    if (fs.existsSync(indexHtmlPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).sendFile(indexHtmlPath);
    } else {
      res.status(404).send('Application build not found. Please run npm run build.');
    }
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
