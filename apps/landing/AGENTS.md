# AGENTS.md — CharlyBot Landing (`apps/landing`)

Context for AI agents working on the landing page. Read this in full before making any changes.

## Scope Rule

- Landing-specific conventions → `apps/landing/` (this file)
- Cross-cutting rules, scripts, git → root `AGENTS.md`
- Bot-only conventions → `apps/bot/AGENTS.md`
- API-only conventions → `apps/api/AGENTS.md`

## CRITICAL RULES

### ALWAYS

| # | Rule | Why |
|---|------|-----|
| 1 | Guard browser-only code with `isPlatformBrowser(PLATFORM_ID)` | SSR renders on Node — no `window`, `document`, `navigator`, or CSS DOM injection |
| 2 | Use `@defer (on viewport)` for sections below the fold | Lazy-load improves initial bundle and SSR time-to-first-byte |
| 3 | Use pure CSS classes from `src/styles.css` (no Tailwind classes) | Tailwind was removed; all styling uses CSS custom properties |
| 4 | Keep components as standalone section files under `src/app/features/<name>/<name>.section.ts` | Every section follows the same `.section.ts` naming pattern |
| 5 | Update `KNOWN_SSR_PATHS` in `src/server.ts` when adding new SSR routes | 404 middleware rejects unknown paths before Angular SSR |
| 6 | Use `provideZonelessChangeDetection()` in `app.config.ts` | Landing runs zoneless; change detection is browser-only by default |
| 7 | Register new SSR routes in `src/app/app.routes.server.ts` with `RenderMode.Server` or `RenderMode.Prerender` | Angular SSR needs explicit render mode per route |

### NEVER

| # | Rule | Consequence |
|---|------|-------------|
| 1 | Import from `@charlybot/shared` | Landing has no shared-package dependency |
| 2 | Use Tailwind CSS utility classes | Tailwind is not installed — classes will be dead in CSS |
| 3 | Include `console.log` without `isPlatformBrowser` guard | Crashes SSR on Node where `console` has no DOM peers |

## TL;DR

- Stack: **Angular 21.2 standalone + zoneless + Express 5 SSR**.
- SSR entry: `src/server.ts` — `KNOWN_SSR_PATHS`, security headers, 404 middleware.
- Styling: pure CSS with custom properties (`.glass-card`, `.btn-primary`, etc.).
- Sections: `src/app/features/<name>/<name>.section.ts` — one file per section.
- No test infrastructure (zero `.spec.ts` files, no test runner configured).
- Icon library: `lucide-angular` (not raw SVG).

## Tech Stack

| | |
|---|---|
| Package Manager | Bun 1.3.9 |
| Framework | Angular 21.2.0 standalone components, zoneless |
| SSR | `@angular/ssr` 21.2.2 + Express 5.1.0 |
| Change Detection | Zoneless (`provideZonelessChangeDetection()`) |
| Hydration | Client hydration with event replay (`provideClientHydration(withEventReplay())`) |
| Icons | `lucide-angular` 1.0.0 |
| Styling | Pure CSS (`src/styles.css`) — custom properties, glass cards, animations |
| Build | Angular CLI (`@angular/build` 21.2.2) |
| Tests | **NONE** (no test runner configured; zero `.spec.ts` files) |

## What This Project Is

Landing page for CharlyBot. Public-facing marketing page rendered as a Single Page Application (SPA) with Angular SSR. Displays features, pricing tiers, documentation links, and a Discord OAuth CTA. The page is primarily static content with interactive sections (hero stats counter, scroll animations, card spotlight effects) that require browser-only code paths.

## Structure (Actual)

```
apps/landing/src/
  index.html                ← Entry HTML (lang="es", Inter font, Open Graph meta)
  main.ts                   ← Browser bootstrap (standalone)
  main.server.ts            ← SSR bootstrap (BootstrapContext API)
  server.ts                 ← Express SSR server (KNOWN_SSR_PATHS, security headers)
  styles.css                ← Pure CSS design tokens, glass cards, animations
  app/
    app.ts                  ← Root component (@defer sections, rain effect, spotlight)
    app.config.ts           ← Zoneless, client hydration, event replay
    app.config.server.ts    ← SSR config merged with appConfig
    app.routes.ts           ← Empty (single-page — no client routing)
    app.routes.server.ts    ← Prerender root (''), Server for unknowns ('**')
    features/
      navbar/navbar.section.ts
      hero/hero.section.ts
      features/features.section.ts
      docs/docs.section.ts
      pricing/pricing.section.ts
      footer/footer.section.ts
      shared/
        directives/scroll-animate.directive.ts
        discord-oauth.config.ts
```

## Architecture Rules

### Sections

Every landing section is a standalone Angular component in `src/app/features/<name>/<name>.section.ts`. The root `app.ts` imports and uses them directly:

```ts
import { HeroSection } from './features/hero/hero.section';
import { FeaturesSection } from './features/features/features.section';
// etc.
```

### `@defer` on Viewport

Sections below the fold use `@defer (on viewport)` so Angular defers loading until the user scrolls near them:

```ts
@defer (on viewport) {
  <app-features-section animate.enter="fade-in-up" />
} @placeholder {
  <div class="placeholder-features"></div>
}
```

Use placeholder divs with `min-height` set in `app.ts` styles to avoid layout shift.

### Zoneless

Landing runs without Zone.js (`provideZonelessChangeDetection()`). All change detection is explicit via signals or `ChangeDetectorRef`. This also means:
- `isPlatformBrowser(PLATFORM_ID)` is the primary guard for browser-only code.
- `typeof window === 'undefined'` is also valid in simpler contexts (e.g., `hero.section.ts` line 230).

### SSR Guards

Before accessing any browser-only API, guard with `isPlatformBrowser`:

```ts
import { isPlatformBrowser } from '@angular/common';

constructor(@Inject(PLATFORM_ID) platformId: Object) {
  this.isBrowser = isPlatformBrowser(platformId);
}

ngAfterViewInit(): void {
  if (!this.isBrowser) return;
  // safe: window, document, requestAnimationFrame, IntersectionObserver
}
```

The `ScrollAnimateDirective` also uses this pattern (line 17: `if (!isPlatformBrowser(this.platformId)) return`).

## SSR / `server.ts` Conventions

Express 5 SSR server (`src/server.ts`):

### `KNOWN_SSR_PATHS`

Whitelist of routes that receive Angular SSR. Any path NOT in this list gets a 404 before Angular handles it:

```ts
const KNOWN_SSR_PATHS = ['/', '/health'];
```

When adding a new SSR route, update `KNOWN_SSR_PATHS` AND `app.routes.server.ts`.

### Security Headers

Security headers are applied to all responses (do not modify):

```ts
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy-Report-Only': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'",
};
```

`X-Powered-By` is suppressed via `app.disable('x-powered-by')`.

### 404 Middleware

Unknown paths (not in `KNOWN_SSR_PATHS` and not a static asset) receive a 404 response:

```ts
app.use((req, res, next) => {
  if (!KNOWN_SSR_PATHS.includes(req.path)) {
    res.status(404).send('<html><body><h1>404 — Page Not Found</h1></body></html>');
    return;
  }
  next();
});
```

### Angular Render

All other requests are passed to Angular SSR:

```ts
app.use((req, res, next) => {
  angularApp.handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});
```

## CSS / UI Rules

> **Canonical design tokens are defined in the root `DESIGN.md`.**
> The CSS custom properties in `src/styles.css` are the Landing-specific implementation of those tokens. When adding new visual elements, consult `DESIGN.md` first, then use the existing semantic CSS classes. Do not invent new classes if an existing one covers the same intent.

### Design Tokens (`:root`)

All design tokens are CSS custom properties in `:root`:

```css
:root {
  --color-bg-base: #060914;
  --color-bg-surface: rgba(255, 255, 255, 0.04);
  --color-accent: #8b5cf6;
  --color-accent-premium: #a78bfa;
  --font-family-base: 'Inter', system-ui, -apple-system, sans-serif;
  --radius-sm: 0.5rem;
  --radius-lg: 1rem;
  --transition-base: 0.2s ease;
}
```

### Layout Classes

| Class | Purpose |
|-------|---------|
| `.container` | Max-width centered container (`72rem`) |
| `.section` | Section padding (`6rem 1rem`) |
| `.section-alt` | Alternating section with surface background |
| `.page-main` | Main content offset for fixed navbar (`padding-top: 4rem`) |

### Glass Cards

```css
.glass-card {           /* frosted glass effect */
  background: var(--color-glass-bg);
  border: 1px solid var(--color-glass-border);
  box-shadow: 0 8px 32px var(--color-glass-shadow);
  backdrop-filter: blur(12px);
  border-radius: var(--radius-lg);
}

.glass-card-hover {     /* hover lift effect */
  transition: transform var(--transition-hover), box-shadow var(--transition-hover);
}
.glass-card-hover:hover {
  transform: translateY(-4px);
  border-color: var(--color-accent);
}
```

### Button Classes

| Class | Appearance |
|-------|------------|
| `.btn-primary` | Gradient purple fill, dark text |
| `.btn-secondary` | Ghost with border, accent on hover |
| `.btn-ghost` | Transparent with border, fills on hover |
| `.btn-gradient` | Same as `.btn-primary` |
| `.btn-premium` | Premium gradient fill |
| `.btn-pro` | Solid premium purple |
| `.btn-primary-lg` | Larger padding (1rem 2rem) |
| `.btn-block` | Full width |

### BEM-like Modifiers

Pricing and feature cards use BEM-style modifiers:

```css
.pricing-card--free   { border: 1px solid var(--color-accent-free); }
.pricing-card--premium{ border: 2px solid var(--color-accent-premium); }
.pricing-card--pro    { border: 1px solid var(--color-accent-premium); }
.feature-badge--free  { background: rgba(16, 185, 129, 0.2); color: var(--color-success); }
.feature-badge--premium { /* ... */ }
.pricing-tier-name--free   { color: var(--color-accent-free); }
.pricing-tier-name--premium { color: var(--color-accent-premium); }
.pricing-price--free   { color: var(--color-text-primary); }
.pricing-price--premium { color: var(--color-accent-premium); }
```

### Animations

| Class | Effect |
|-------|--------|
| `.fade-in-up` | Opacity 0→1, translateY 24px→0 (600ms ease-out) |
| `.fade-out-down` | Opacity 1→0, translateY 0→24px (400ms ease-in) |
| `.rain-drop` | Fixed purple drops falling from top (CSS keyframes) |
| `.card-spotlight` | Radial gradient follows mouse on hover |

### Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Mobile-first Breakpoints

```css
/* Base: mobile first */
.grid-3 { grid-template-columns: 1fr; }

@media (min-width: 768px) {
  .grid-3 { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
}
```

## Environment Variables (minimal)

The SSR server reads `PORT` (defaults to 4000):

```bash
PORT=4000   # optional, defaults to 4000
```

No other environment variables are required for the landing page. Discord OAuth uses the hardcoded `DISCORD_CLIENT_ID` from `src/app/features/shared/discord-oauth.config.ts`.

## Scripts

```bash
bun run start         # ng serve (dev server)
bun run build        # ng build (production browser + server bundles)
bun run watch        # ng build --watch --configuration development
bun run serve:ssr:landing  # node dist/landing/server/server.mjs (production SSR)
```

## Tests

**No test infrastructure exists.**

- `tsconfig.spec.json` references vitest types but no test runner is configured
- Zero `.spec.ts` files in the project
- No `vitest.config.ts`, no `karma.conf.js`
- Do not run `bun test` — there is nothing to run

## Auto-Invoke Skills

| Action | Skill |
|--------|-------|
| Create Angular components, sections, or standalone components | `angular-core` |
| Structure Angular project layout, file naming | `angular-architecture` |
| Optimize with `@defer`, lazy loading, SSR performance | `angular-performance` |
| Style with pure CSS, glass cards, animations, BEM modifiers | `frontend-design` |
| Write TypeScript code, interfaces, signals | `typescript` |
| Optimize SEO, Open Graph meta, structured data | `seo` |
| Audit accessibility, WCAG 2.2 compliance | `accessibility` |

## QA Checklist

- [ ] `isPlatformBrowser(PLATFORM_ID)` guard used for all browser-only code (`window`, `document`, `requestAnimationFrame`, CSS DOM injection)
- [ ] Pure CSS classes only — no Tailwind utility classes
- [ ] No imports from `@charlybot/shared`
- [ ] `KNOWN_SSR_PATHS` updated when adding new SSR routes
- [ ] `@defer (on viewport)` used for non-initial sections (features, docs, pricing, footer)
- [ ] Lucide icons imported from `lucide-angular` (not raw SVG)
- [ ] `prefers-reduced-motion` respected (animations use the CSS media query in `styles.css`)
- [ ] New sections follow `features/<name>/<name>.section.ts` naming pattern
