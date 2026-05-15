# AGENTS.md — CharlyBot Dashboard (`apps/dashboard`)

Context for AI agents working on the dashboard. Read this in full before making any changes.

## Scope Rule

- Dashboard-specific conventions → `apps/dashboard/` (this file)
- Cross-cutting rules, scripts, git → root `AGENTS.md`
- Bot-only conventions → `apps/bot/AGENTS.md`
- API-only conventions → `apps/api/AGENTS.md`
- Landing-page conventions → `apps/landing/AGENTS.md`

## CRITICAL RULES

### ALWAYS

| # | Rule | Why |
|---|------|-----|
| 1 | Use `provideZonelessChangeDetection()` in `app.config.ts` | Dashboard runs without Zone.js — all change detection is signal-driven |
| 2 | Use `standalone: true` on all components | No NgModule declarations — every component is fully standalone |
| 3 | Apply Tailwind utility classes from `src/styles.css` design tokens | Dashboard uses Tailwind CSS 4 with `@theme` custom properties (`--color-bg-base`, `--color-accent`, etc.) |
| 4 | Use lucide-angular icons | Icon library is `lucide-angular` 1.0.0 — import icons from the package, never raw SVG |
| 5 | Protect all guild routes with `authGuard` + `guildAdminGuard` in `app.routes.ts` | Auth guards enforce login + guild admin role on every lazy-loaded feature |
| 6 | Use `createApiState()` signal pattern for all HTTP operations | `shared/http/api-state.ts` provides a consistent `loading`/`error`/`data` signal interface |
| 7 | Run dashboard tests with `ng test` | Jest 30 is the test runner — configured via `jest.config.ts`, not vitest |
| 8 | Use template-driven forms with `FormsModule` | All dashboard forms use `[(ngModel)]` and `(ngSubmit)` — no ReactiveFormsModule |

### NEVER

| # | Rule | Consequence |
|---|------|-------------|
| 1 | Import from `@charlybot/shared` | Dashboard has no dependency on the shared package |
| 2 | Use `zone.js` or Zone.js APIs | Zoneless app — Zone APIs are unavailable; use signals for change detection |
| 3 | Use Angular CDK or Angular Material | No `@angular/cdk` or `@angular/material` in dependencies — UI is Tailwind-only |
| 4 | Declare `@NgModule` | All components use `standalone: true` — NgModule declarations will fail to compile |
| 5 | Use `console.log` without guard | AGENTS.md convention (consistent across all sibling files) |

## TL;DR

- Stack: **Angular 21.2 standalone + zoneless + Tailwind CSS 4** — pure SPA, no SSR.
- Dev server: `ng serve` — **NOT `pnpm dev`** (pnpm is package manager only).
- Tests: **Jest 30** via `ng test` — vitest is NOT configured; `pnpm test` does NOT run dashboard tests.
- Icons: `lucide-angular` 1.0.0.
- Forms: template-driven via `FormsModule` — `[(ngModel)]`, `(ngSubmit)`.
- API state: `createApiState()` signals in `shared/http/api-state.ts`.

## Tech Stack

| | |
|---|---|
| Package Manager | pnpm 10 |
| Framework | Angular 21.2.0 standalone components, zoneless |
| Change Detection | Zoneless (`provideZonelessChangeDetection()`) |
| Styling | Tailwind CSS 4 + PostCSS (`@tailwindcss/postcss`) |
| Dark Theme | `@theme` custom properties in `src/styles.css` |
| Icons | `lucide-angular` 1.0.0 |
| Forms | `@angular/forms` — template-driven (`FormsModule`, not `ReactiveFormsModule`) |
| HTTP | `@angular/common/http` + `provideHttpClient(withInterceptors([authInterceptor]))` |
| Build | Angular CLI (`@angular/build` 21.2.2) |
| Tests | Jest 30.3.0 (`@angular-builders/jest`, `jest-preset-angular` 16.1.4, `ts-jest` 29.4.9) |

## What This Project Is

Discord bot management dashboard. SPA for guild administrators to configure bot features (economy, moderation, autoroles, music, etc.) via the CharlyBot REST API. Users authenticate through Discord OAuth; the API uses HttpOnly cookies for session management.

## Structure (Actual)

```
apps/dashboard/src/
  index.html
  main.ts                    ← Browser bootstrap (standalone)
  styles.css                 ← Tailwind CSS 4: @import "tailwindcss" + @theme tokens
  setup-jest.ts              ← Jest setup file
  app/
    app.ts                   ← Root component (imports DashboardLayout)
    app.config.ts            ← Zoneless, HttpClient with authInterceptor
    app.routes.ts            ← 10 lazy-loaded features + authGuard + guildAdminGuard
    core/
      guards/
        auth.guard.ts         ← CanActivateFn: fetchProfile() → redirect on 401
        guild-admin.guard.ts  ← CanActivateFn: guild admin role check
      interceptors/
        auth.interceptor.ts   ← HttpInterceptorFn: 401 → window.location.href = '/api/v1/auth/login'
      services/
        auth.service.ts       ← Signal-based AuthService: user, guilds, fetchProfile()
        auth.service.spec.ts
    layout/
      dashboard-layout/      ← Main layout wrapper (sidebar + outlet)
        dashboard-layout.component.ts
      sidebar/
        sidebar.component.ts
    shared/
      http/
        api-state.ts          ← createApiState<T>() — signal-based loading/error/data pattern
        api-errors.ts         ← getErrorMessage() helper
      types/
        auth.types.ts         ← AuthUser, FilteredGuild interfaces
        pagination.types.ts   ← PaginatedResponse<T>
      ui/
        loader.component.ts
        alert.component.ts
    features/
      auth/
        callback/
          callback.component.ts
          callback.component.spec.ts
      autoroles/autoroles.component.ts
      classes/classes.component.ts
      config/config.component.ts
      economy/economy.component.ts
      guilds/
        guild-selector/guild-selector.component.ts
      moderation/moderation.component.ts
      music/music.component.ts
      overview/overview.component.ts
      users/
        users.component.ts
        user-detail/user-detail.component.ts
```

## Auth / HTTP Conventions

### HttpOnly Cookies

The API handles auth via HttpOnly cookies — no manual token header injection needed. Cookies are sent automatically with every request via `credentials: include`. The dashboard never stores tokens in `localStorage` manually.

### `auth.interceptor.ts`

Every HTTP request passes through `authInterceptor` (`core/interceptors/auth.interceptor.ts`). On a `401` response (and only if the URL is not an auth route), it redirects to the Discord login page:

```ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        window.location.href = '/api/v1/auth/login';
      }
      return throwError(() => error);
    })
  );
};
```

### `auth.guard.ts`

Route guard that calls `authService.fetchProfile()` to validate the session with the server before allowing access. On failure, redirects to login:

```ts
export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  try {
    await authService.fetchProfile();
    return true;
  } catch {
    window.location.href = '/api/v1/auth/login';
    return false;
  }
};
```

### `createApiState()` Signal Pattern

All HTTP operations use `createApiState<T>()` from `shared/http/api-state.ts`. It returns a structured signal set:

```ts
const state = createApiState<GuildConfig>();
// state.data    — signal<T | null>
// state.loading — signal<boolean>
// state.error   — signal<string | null>
// state.state   — computed(() => ({ data, loading, error }))

state.setLoading();
state.setData(data);
state.setError(err);
state.reset();
```

Components inject this state and bind directly to signal reads in templates (`state.loading()`, `state.error()`).

## Forms Conventions

Dashboard uses **template-driven forms** via `FormsModule` (from `@angular/forms`). NOT `ReactiveFormsModule`.

```ts
imports: [FormsModule, LoaderComponent, AlertComponent]

template: `
  <form (ngSubmit)="saveConfig()">
    <input [(ngModel)]="formData.welcomeChannelId" name="welcomeChannelId" />
  </form>
`
```

- `[(ngModel)]` for two-way binding
- `(ngSubmit)` for form submission
- `name` attribute required on every `ngModel` input
- No Angular CDK form components (dashboard does not use Angular CDK)

## Tailwind CSS 4 Conventions

Dashboard uses Tailwind CSS 4 with the `@tailwindcss/postcss` PostCSS plugin.

### Configuration

`.postcssrc.json`:
```json
{ "plugins": { "@tailwindcss/postcss": {} } }
```

### `src/styles.css`

```css
@import "tailwindcss";

@theme {
  /* Dark theme colors */
  --color-bg-base: #0F172A;
  --color-bg-surface: #1E293B;
  --color-accent: #6366F1;
  --color-accent-hover: #818CF8;
  --color-text-primary: #F8FAFC;
  --color-text-secondary: #94A3B8;
  --color-border: #334155;
}
```

### Usage

Apply utility classes using design token values:

```html
<div class="bg-bg-base text-text-primary border-border">
  <input class="bg-bg-surface border border-border focus:border-accent" />
  <button class="bg-accent hover:bg-accent-hover text-text-primary" />
</div>
```

## Environment Variables (minimal)

The only environment variable needed is the API base URL — set by the proxy during development:

```bash
# No manual environment variables required
# API calls are proxied through the Angular dev server (proxy.conf.json)
# In production, the API is at the same origin or behind a reverse proxy
```

## Scripts

```bash
ng serve        # Dev server (port 4200)
ng build       # Production build (output to dist/)
ng test        # Run Jest 30 test suite
```

## Tests

**Jest 30** is the test runner. Vitest is NOT configured.

### Spec files (exactly 3)

| File | Description |
|------|-------------|
| `src/app/core/services/auth.service.spec.ts` | AuthService unit tests |
| `src/app/core/interceptors/auth.interceptor.spec.ts` | Auth interceptor unit tests |
| `src/app/features/auth/callback/callback.component.spec.ts` | OAuth callback component tests |

### Running tests

```bash
ng test        # Runs Jest in watch mode via @angular-builders/jest
```

- `tsconfig.spec.json` references Jest types — no vitest types
- `jest.config.ts` uses `ts-jest` preset with `jest-environment-jsdom`
- Do **NOT** run `pnpm test` — it does not run dashboard tests (different runner from bot/api)

## Auto-Invoke Skills

| Action | Skill |
|--------|-------|
| Create Angular components, signals, `inject()`, standalone | `angular-core` |
| Structure Angular project layout, file naming, module organization | `angular-architecture` |
| Work with forms, `FormsModule`, template-driven validation | `angular-forms` |
| Style with Tailwind CSS 4, `@theme` tokens, dark theme utilities | `tailwind-4` |
| Optimize with `@defer`, lazy loading, zoneless performance | `angular-performance` |
| Write TypeScript code, interfaces, generics, signal types | `typescript` |
| Audit accessibility, WCAG 2.2, keyboard navigation | `accessibility` |
| Design UI components, dark theme, lucide icons | `frontend-design` |

## QA Checklist

- [ ] `provideZonelessChangeDetection()` present in `app.config.ts` — no Zone.js imports anywhere
- [ ] All components use `standalone: true` — no `@NgModule` declarations
- [ ] `authInterceptor` redirects to `/api/v1/auth/login` on 401 responses — not manual redirect logic
- [ ] Auth routes protected with `authGuard` + `guildAdminGuard` (lazy-loaded features under `/:guildId`)
- [ ] `createApiState()` pattern used for all HTTP operations — no manual signal boilerplate
- [ ] Template-driven forms use `FormsModule` + `[(ngModel)]` — no `ReactiveFormsModule`
- [ ] No imports from `@charlybot/shared`
- [ ] No Angular CDK or Angular Material — Tailwind CSS 4 only for styling
- [ ] Icons from `lucide-angular` — no raw SVG inline
- [ ] Tests run via `ng test` (Jest 30) — not `pnpm test`
- [ ] `app.routes.ts` uses `loadComponent` for all 10 features (lazy loading)

## Explicit Declarations

### No Angular CDK / Angular Material

Angular CDK and Angular Material are **NOT installed** in the dashboard. All UI is built with Tailwind CSS 4 utility classes and custom components in `shared/ui/`.

### No SSR

The dashboard is a **pure SPA** with no server-side rendering. There is no `@angular/ssr`, no `app.routes.server.ts`, and no Express server. The Angular CLI serves the browser bundle directly.

### English-Only Convention

All content in this file and all agent-facing documentation is in **English only**. Section titles, descriptions, rules, and tables must use English text. Technical identifiers (file names, function names, npm package names) are exempt.
