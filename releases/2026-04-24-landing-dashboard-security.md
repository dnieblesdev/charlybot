# Release 2026-04-24 — landing-dashboard-security

## Packages
- dashboard: 0.1.2 → 0.1.3
- landing: 0.1.0 → 0.1.1

## Changes

### dashboard (0.1.3)
- Security headers in nginx.conf (CSP Report-Only, X-Frame-Options, etc.)
- Logout fix: backend session invalidation
- XSS fix: inline SVG templates replacing innerHTML

### landing (0.1.1)
- Navbar with dashboard login
- Scroll fade-in/fade-out animations (Angular 21 animate.enter)
- OAuth config fix (client_id + permissions)
- Server security headers + 404 handler
- @defer viewport loading
- CTA text update

## Internal Dependencies
- None
