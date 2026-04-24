import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Known SSR routes whitelist.
 * Any request path NOT in this list will receive a 404 response before Angular SSR.
 * Update this constant when new SSR routes are added to the Landing app.
 */
const KNOWN_SSR_PATHS = ['/', '/health'];

/**
 * Suppress X-Powered-By header disclosure.
 * Must be set before any middleware to take effect.
 */
app.disable('x-powered-by');

/**
 * Security headers applied to all responses.
 * Mirrors nginx headers for consistency across Express dev server and production.
 * CSP is Report-Only: reports violations without blocking Angular runtime styles.
 * Switch to enforced Content-Security-Policy after validating policy via reports.
 */
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy-Report-Only': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'",
};

/**
 * Apply security headers to all responses.
 */
app.use((_req, res, next) => {
  for (const [header, value] of Object.entries(securityHeaders)) {
    res.setHeader(header, value);
  }
  next();
});

/**
 * Health check endpoint.
 */
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Serve static files from /browser.
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * 404 handler for unknown paths (not in KNOWN_SSR_PATHS and not a static asset).
 * Static file serving via express.static sets the response headers and ends the request
 * for matching files. If we reach this middleware, the path was not handled by static
 * and is not a known SSR route, so we return a 404.
 */
app.use((req, res, next) => {
  if (!KNOWN_SSR_PATHS.includes(req.path)) {
    res.status(404).send('<html><body><h1>404 — Page Not Found</h1></body></html>');
    return;
  }
  next();
});

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
