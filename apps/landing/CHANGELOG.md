# landing

## 1.0.0

### Major Changes

- Migrate from Bun/npm to pnpm + Node.js 22

  - Production Dockerfile: node:22-slim, corepack + pnpm install
  - COPY paths corrected for pnpm monorepo workspace structure
  - Angular CLI installed globally via pnpm
  - README and AGENTS.md updated

## 0.2.0

### Minor Changes

- Visual refresh: switch accent color from cyan to purple (#8b5cf6)
- Add animated rain effect with 45 purple drops
- Add card spotlight effect following mouse position
- Add brand dot indicator in navbar
- Add .btn-gradient and .btn-ghost button styles
- Improve hero background gradient contrast

## 0.1.1

### Patch Changes

- Add navbar component with "Iniciar sesión" linking to dashboard
- Add fade-in animations using Angular 21 animate.enter
- Add scroll-triggered fade-in/fade-out animations (ScrollAnimateDirective)
- Fix OAuth: replace YOUR_CLIENT_ID with real client ID, remove Administrator permission
- Add security headers to server.ts (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP Report-Only)
- Add 404 handler for unknown routes in SSR
- Improve @defer loading: features/pricing use on viewport for scroll-triggered animation
- Change CTA text from "Agregar a Discord" to "Agregar al Servidor"
- Fix X-Powered-By header disclosure

# landing

## 0.1.0

### Minor Changes

- d8581af: Initial release — Angular 21 SSR landing page
  - Angular 21 standalone app with SSR/prerendering
  - Tailwind CSS 4 via PostCSS
  - Hero section with Discord CTA
  - Features section with feature cards (Free/Premium badges)
  - Pricing section with 3 tiers (Free, Premium, Pro)
  - Footer section
  - Lazy loading with @defer (on viewport)
  - Dark theme with custom CSS variables
  - Docker multi-stage Node.js build for SSR
