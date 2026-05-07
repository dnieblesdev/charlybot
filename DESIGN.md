---
version: alpha
name: CharlyBot
description: Dark-themed design system for a Discord bot platform. Glassmorphism surfaces, purple accent, Inter typography. Landing implements tokens via pure CSS custom properties; Dashboard (in progress) will apply them via Tailwind CSS 4 @theme.
colors:
  primary: "#8b5cf6"
  primary-hover: "#7c3aed"
  premium: "#a78bfa"
  surface: "#060914"
  surface-elevated: "#FFFFFF0A"
  on-surface: "#e5e7eb"
  on-surface-secondary: "#9CA3AF"
  outline: "#FFFFFF14"
  error: "#EF4444"
  success: "#10B981"
  warning: "#F59E0B"
  discord: "#5865F2"
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.02em
  heading:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.3
  heading-sub:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.4
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.75
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.05em
  code:
    fontFamily: Fira Code, Cascadia Code, JetBrains Mono, monospace
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px
spacing:
  section-y: 96px
  section-y-alt: 96px
  container-max: 1152px
  gutter: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#0b1020"
    rounded: "{rounded.sm}"
    typography: "{typography.body-md}"
  button-secondary:
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    typography: "{typography.body-sm}"
  button-ghost:
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    typography: "{typography.body-md}"
  glass-card:
    backgroundColor: "#FFFFFF0A"
    borderColor: "{colors.outline}"
    rounded: "{rounded.lg}"
  feature-card:
    backgroundColor: "#FFFFFF0A"
    borderColor: "{colors.outline}"
    rounded: "{rounded.md}"
  command-block:
    backgroundColor: "#FFFFFF0A"
    borderColor: "{colors.outline}"
    rounded: "{rounded.md}"
  input-native:
    backgroundColor: "#FFFFFF0A"
    borderColor: "{colors.outline}"
    rounded: "{rounded.sm}"
    typography: "{typography.body-md}"
---

# Design System

## Overview

CharlyBot is a Discord bot platform — its visual identity needs to feel **powerful but inviting**, like a tool that serious server admins trust but casual users enjoy. The landing page is the public face; the dashboard is the admin cockpit.

**Brand personality**: Confident, modern, slightly playful. Dark backgrounds with glassmorphism surfaces create depth without heaviness. Purple is the hero color — it signals creativity and premium quality without the aggression of red or the coldness of blue.

**Target**: Discord server administrators and community managers who want one bot that does everything. The design should communicate "all-in-one power" without looking cluttered.

**Emotional response**: "This looks professional. I can trust my server to this."

## Colors

The palette is rooted in a deep near-black surface with a single vibrant purple accent. Glassmorphism layers provide depth through transparency rather than additional solid colors.

- **Primary** (`#8b5cf6`): CTAs, links, active states, accent elements, brand dot. The single most important color — use sparingly.
- **Primary hover** (`#7c3aed`): Button hover states, interactive feedback.
- **Premium** (`#a78bfa`): Premium-tier highlights, gradient endpoints, pro badges. A softer, more luxurious purple.
- **Surface** (`#060914`): Page background. Deep blue-black that anchors the dark theme.
- **Surface elevated** (white at 4%): Card backgrounds, elevated containers. The glassmorphism base layer.
- **On-surface** (`#e5e7eb`): Primary text. High contrast against the dark surface.
- **On-surface secondary** (`#9CA3AF`): Captions, descriptions, metadata. Muted but readable.
- **Outline** (white at 8%): Borders, dividers. Subtle definition without visual weight.
- **Error** (`#EF4444`): Destructive actions, validation errors.
- **Success** (`#10B981`): Confirmations, Free tier badges, checkmarks.
- **Warning** (`#F59E0B`): Premium tier badges, caution states.
- **Discord** (`#5865F2`): Discord brand references only — never use as a primary action color.

### Glass Effect Composition

Glass surfaces are NOT a single color token. They are a composition:
- Background: white at 4% opacity (`rgba(255, 255, 255, 0.04)`)
- Border: white at 8% opacity (`rgba(255, 255, 255, 0.08)`)
- Shadow: primary at 15% opacity (`rgba(139, 92, 246, 0.15)`)
- Backdrop filter: `blur(12px)`
- Always include `-webkit-backdrop-filter: blur(12px)` for Safari

## Typography

Inter is the single typeface for all text. It is a variable font designed for screens — highly readable at small sizes, distinctive at display sizes. Fira Code (with Cascadia and JetBrains Mono fallbacks) is used exclusively for code blocks, command names, and parameter tables.

- **Display**: Inter 800, 48px, -0.02em tracking. Hero headline only. One per page.
- **Heading**: Inter 700, 30px. Section titles.
- **Heading sub**: Inter 700, 24px. Subsection titles, footer CTA.
- **Body lg**: Inter 400, 18px, 1.75 leading. Section descriptions, hero subtitle.
- **Body md**: Inter 400, 16px, 1.6 leading. Default body, button text.
- **Body sm**: Inter 400, 14px. Nav links, feature descriptions, footer links.
- **Label sm**: Inter 500, 12px, 0.05em tracking. Badges, table headers, uppercase labels.
- **Code**: Fira Code 400, 13px. Command names, code blocks, parameter names. Never use for body text.

### Typography Rules
- Never use more than two font weights on a single screen (800 + 400, or 700 + 400).
- Code font is for code ONLY — do not use it for headings, labels, or UI chrome.
- All body text must meet WCAG AA contrast (4.5:1) against the surface background.

## Layout

The landing is a single-page, scroll-based layout with a fixed navbar. The dashboard (in progress) uses a sidebar + content-area SPA layout.

### Landing Layout

- **Container**: `max-width: 72rem (1152px)`, centered, `padding: 0 1rem` gutters.
- **Sections**: `padding: 6rem 1rem` vertical rhythm. Alternating sections use a subtle surface background.
- **Navbar**: Fixed top, `z-index: 50`, glass background with bottom border.
- **Grid**: 1 column mobile → 2 columns tablet (768px) → 3 columns desktop (1024px).
- **Page offset**: `padding-top: 4rem` on main content to clear the fixed navbar.
- **Mobile breakpoints**: 480px (stats grid), 768px (hero 2-col, grid 2-col), 1024px (grid 3-col).

### Dashboard Layout (in progress)

- Sidebar + content area. Details TBD once dashboard UI stabilizes.

## Elevation & Depth

Depth is conveyed through **glassmorphism layers**, not traditional box shadows. The approach:

1. **Base surface** (`#060914`): Deep background.
2. **Surface elevated** (white at 4%): Cards, panels — sits one level above base.
3. **Surface elevated hover** (white at 6%): Interactive hover feedback.
4. **Glass cards**: Background + border + subtle colored shadow + backdrop blur. The blur creates the illusion of depth by showing what's "behind" the card.

Cards do NOT use `box-shadow` for elevation. The frosted glass effect (blur + semi-transparent background) is the depth mechanism.

### Hover States

- Cards lift: `translateY(-4px)` + border changes to primary color.
- Buttons scale: `scale(1.02)` + glow shadow.
- No elevation change on hover — movement and color shifts communicate interactivity.

## Shapes

All interactive elements use rounded corners. The scale is intentionally tight — no sharp corners anywhere.

- **`sm` (8px)**: Buttons, inputs, badges, sidebar items, command badges. The workhorse radius.
- **`md` (12px)**: Feature cards, command blocks, docs cards. Mid-sized containers.
- **`lg` (16px)**: Glass cards. Primary card surface.
- **`xl` (24px)**: Pricing cards. Largest containers, premium feel.
- **`full` (9999px)**: Pills, badges positioned absolute, icon wrappers.

Rule: never mix sharp and rounded corners in the same view.

## Components — Landing

Every component is implemented as a **pure CSS semantic class** in `apps/landing/src/styles.css`. Consumer agents applying this design system MUST use these existing classes rather than inventing new ones. If a needed component does not exist, extend the system with a new class following the BEM-like naming convention.

### Buttons

Five button variants share common traits: inline-block, centered text, font-weight 500-600, transition on transform/box-shadow.

| Class | Appearance | Usage |
|-------|-----------|-------|
| `.btn-primary` | Gradient fill (primary → premium), dark text | Primary CTA. One per screen max. |
| `.btn-secondary` | Transparent bg, outline border | Navbar login, secondary actions |
| `.btn-ghost` | Transparent bg, outline border, fills on hover | Alternative secondary |
| `.btn-premium` | Premium gradient fill, full width | Premium tier CTA in pricing cards |
| `.btn-pro` | Solid premium bg, full width | Pro tier CTA in pricing cards |

Modifiers:
- `.btn-primary-lg`: Larger padding (1rem 2rem), 18px font. Desktop hero CTA.
- `.btn-block`: Full width. Mobile hero CTA.

### Glass Card

`.glass-card` — The signature surface. Applies frosted glass effect: 4% white background, 8% white border, 12px blur backdrop-filter, purple-tinted shadow, `lg` border-radius.

`.glass-card-hover` — Adds lift effect on hover: `translateY(-4px)`, border changes to primary, shadow intensifies.

### Feature Card

`.feature-card` — Surface-elevated background, outline border, `md` border-radius, 1.5rem padding. Border changes to primary on hover. Used in the Features section grid.

Child elements:
- `.feature-icon-row`: Flex row with icon wrapper + content
- `.feature-icon-wrapper`: Elevated background, `md` radius, 0.75rem padding, contains lucide icon
- `.feature-header`: Flex row with feature name + tier badge
- `.feature-name`: 18px, 600 weight, on-surface color
- `.feature-description`: 14px, on-surface-secondary color

### Pricing Card

`.pricing-card` — Flex column, `xl` border-radius, 2rem padding. Three variants via BEM modifiers:
- `.pricing-card--free`: Primary border, 1px
- `.pricing-card--premium`: Premium border, 2px, relative positioning for badge
- `.pricing-card--pro`: Premium border, 1px

Child elements:
- `.pricing-badge`: Absolute positioned pill (`full` radius) at top center. Variants: `--free`, `--premium`.
- `.pricing-tier-name`: 18px, 600 weight. Variants: `--free` (primary), `--premium` (premium), `--pro` (premium).
- `.pricing-price`: 36px, 800 weight. Variants: `--free` (on-surface), `--premium` (premium), `--pro` (on-surface).
- `.pricing-period`: 14px, on-surface-secondary.
- `.pricing-feature-list`: Flex column, 0.75rem gap, flex-grow.
- `.pricing-feature-item`: Flex row, checkmark + text. Checkmark is success color.

### Navbar

`.navbar` — Fixed top, full width, `z-index: 50`. Glass background (`rgba(11, 9, 26, 0.9)` with 12px blur), bottom border.

- `.navbar-inner`: Container-width, flex row, space-between, 1rem padding.
- `.navbar-brand`: Primary color, 20px, 700 weight. Includes a `.navbar-brand-dot` (8px circle, primary bg).
- `.navbar-links`: Flex row, 1.5rem gap. Stacks vertically on mobile.
- `.navbar-link`: 14px, 500 weight, on-surface-secondary. Primary on hover.

### Badges

- `.badge-free`: Success background at 20%, success text, `sm` radius, 12px, 500 weight.
- `.badge-premium`: Warning background at 20%, warning text.
- `.badge-popular`: Solid premium background, white text. Used for "Popular" tag on pricing.
- `.feature-badge`: Base badge, 12px, 500 weight. Variants: `--free`, `--premium`.

### Command Blocks (Docs Section)

- `.command-block`: Surface-elevated background, outline border, `md` radius, 1.25rem padding.
- `.command-badge`: Primary at 15% background, primary text, `sm` radius, Fira Code font, 13px.
- `.admin-tag`: Blue accent background at 18%, inline-flex with icon.
- `.command-copy-btn`: Elevated background, outline border, `sm` radius, 12px. Hover: border primary.
- `.params-table`: Full-width table, collapsed borders, uppercase headers, Fira Code for param names.
- `.command-block__output pre`: Dark background (`rgba(0,0,0,0.3)`), outline border, `sm` radius, Fira Code.

### Docs Sidebar

- `.docs-sidebar`: Flex column, 220px width, sticky at 5rem from top. Hidden on mobile.
- `.docs-sidebar-item`: Flex row, transparent bg, `sm` radius, 14px, 500 weight. Hover: surface bg. Active: primary at 15% background, primary text.
- `.docs-sidebar-item--active`: Active state modifier.

### Docs Cards

- `.docs-card`: Surface-elevated background, outline border, `md` radius, 1.25rem padding.
- `.docs-card__icon`: 24px emoji, block display.
- `.docs-card__title`: 15px, 600 weight, on-surface.
- `.docs-card__desc`: 13px, on-surface-secondary.

### Footer

- `.footer`: Base background, top border, 4rem vertical padding.
- `.footer-cta`: Centered CTA block with heading, subtitle, and primary button.
- `.footer-links`: Flex row, centered, 1.5rem gap (3rem on desktop).
- `.footer-link`: On-surface-secondary, transitions to on-surface on hover.
- `.footer-copyright`: Centered, 14px, on-surface-secondary.

### Animations & Effects

- `.fade-in-up`: Entrance animation — opacity 0→1, translateY 24px→0, 600ms ease-out.
- `.fade-out-down`: Exit animation — opacity 1→0, translateY 0→24px, 400ms ease-in.
- `.card-spotlight`: Radial gradient overlay that follows mouse position. Requires `position: relative; overflow: hidden` on the card. Uses CSS custom properties `--x` and `--y` set via JavaScript.
- `.rain-drop`: Fixed position purple gradient drops, 3px wide, 16px tall, CSS keyframe animation. Browser-only (injected via Angular's `ngAfterViewInit` with `isPlatformBrowser` guard).

All animations respect `prefers-reduced-motion: reduce` — durations collapse to 0.01ms when the user has requested reduced motion.

### Iconography

- Icon library: `lucide-angular` v1.0.0. Never use raw SVG inline.
- Icon size: 24px default, 20px in sidebar, 12px in admin tags.
- Icon color: Inherits from parent text color. The `.text-accent` utility class applies primary color.
- Icon wrapper: Circle background at 15% primary opacity for module icons in docs.

## Components — Dashboard

**Status: In progress.** The dashboard design system is being developed in `apps/dashboard/`. Once the component patterns stabilize, they will be documented here following the same structure.

Current known constraints:
- Styling: Tailwind CSS 4 with `@theme` custom properties.
- The `@theme` tokens MUST be synchronized with the YAML tokens above.
- Component compositions use Tailwind utility classes (e.g., `bg-accent hover:bg-accent-hover text-text-primary px-8 py-3 rounded-sm`), not semantic CSS classes.
- Reference: `apps/dashboard/AGENTS.md` for implementation rules.

### Dashboard Token Mapping (preliminary)

| DESIGN.md token | Dashboard `@theme` token | Tailwind utility |
|-----------------|--------------------------|------------------|
| `colors.primary` | `--color-accent` | `bg-accent`, `text-accent` |
| `colors.surface` | `--color-bg-base` | `bg-bg-base` |
| `colors.on-surface` | `--color-text-primary` | `text-text-primary` |
| `colors.on-surface-secondary` | `--color-text-secondary` | `text-text-secondary` |
| `colors.outline` | `--color-border` | `border-border` |
| `colors.surface-elevated` | `--color-bg-surface` | `bg-bg-surface` |

## Do's and Don'ts

### Do

- Do use the primary color sparingly — only for the single most important action per screen.
- Do use glassmorphism (`backdrop-filter: blur()`) instead of heavy box shadows for depth.
- Do maintain WCAG AA contrast ratios (4.5:1 for body text, 3:1 for large text).
- Do respect `prefers-reduced-motion: reduce` — all animations must collapse when requested.
- Do guard all browser-only code with `isPlatformBrowser(PLATFORM_ID)` — the landing runs SSR.
- Do use `@defer (on viewport)` for sections below the fold.
- Do keep section files as `features/<name>/<name>.section.ts` — one standalone component per section.
- Do use the existing semantic CSS classes (`.glass-card`, `.btn-primary`, etc.) rather than creating new ones.

### Don't

- Don't mix rounded and sharp corners in the same view — pick a radius from the scale and stay consistent.
- Don't use more than two font weights on a single screen.
- Don't use the code font (Fira Code) for anything except code blocks, command names, and parameter values.
- Don't add new colors to the palette without documenting them here first.
- Don't use Tailwind CSS classes in the landing — it uses pure CSS.
- Don't use pure CSS semantic classes in the dashboard — it uses Tailwind utilities.
- Don't import from `@charlybot/shared` in either landing or dashboard — they have no shared package dependency.
- Don't use `console.log` in SSR contexts without `isPlatformBrowser` guard.
