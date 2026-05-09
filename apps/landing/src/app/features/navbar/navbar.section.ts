import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-navbar-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="navbar">
      <div class="navbar-inner">
        <!-- Brand -->
        <span class="navbar-brand">
          <span class="navbar-brand-dot"></span>
          CharlyBot
        </span>

        <!-- Nav links -->
        <div class="navbar-links">
          <a href="#features" class="navbar-link">Funciones</a>
          <a href="#comandos" class="navbar-link">Comandos</a>
          <a href="#pricing" class="navbar-link">Planes</a>
        </div>

        <!-- CTA -->
        @if (authService.isLoading()) {
          <!-- silent loading state — no spinner to avoid layout shift -->
        } @else if (authService.isAuthenticated()) {
          <div class="user-menu" [class.open]="dropdownOpen()">
            <button
              type="button"
              class="user-menu-trigger"
              (click)="toggleDropdown()"
              [attr.aria-expanded]="dropdownOpen()"
              aria-haspopup="true">
              @if (authService.avatarUrl()) {
                <img
                  [src]="authService.avatarUrl()!"
                  [alt]="authService.currentUser()?.username"
                  class="user-avatar" />
              } @else {
                <span class="user-avatar-fallback">
                  {{ authService.currentUser()?.username?.charAt(0) ?? '?' }}
                </span>
              }
              <span class="user-name">{{ authService.currentUser()?.username }}</span>
              <svg class="user-menu-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            @if (dropdownOpen()) {
              <div class="user-dropdown glass-card">
                <a href="/dashboard/" class="user-dropdown-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  Dashboard
                </a>
                <button
                  type="button"
                  class="user-dropdown-item user-dropdown-item--danger"
                  (click)="logout()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            }
          </div>
        } @else {
          <a href="/dashboard/" class="btn-secondary">Iniciar sesión</a>
        }
      </div>
    </nav>
  `,
  styles: [`
    :host {
      display: block;
    }

    .navbar-brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .navbar-brand-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background: var(--color-accent);
    }

    /* User menu */
    .user-menu {
      position: relative;
    }

    .user-menu-trigger {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem 0.375rem 0.375rem;
      border: 1px solid var(--color-glass-border);
      border-radius: var(--radius-sm);
      background: var(--color-glass-bg);
      color: var(--color-text-primary);
      font-family: var(--font-family-base);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: border-color var(--transition-base), background var(--transition-base);
    }

    .user-menu-trigger:hover {
      border-color: var(--color-accent-free);
      background: var(--color-bg-elevated);
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 9999px;
      border: 1px solid var(--color-glass-border);
      object-fit: cover;
    }

    .user-avatar-fallback {
      width: 32px;
      height: 32px;
      border-radius: 9999px;
      background: var(--color-accent);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .user-name {
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .user-menu-chevron {
      color: var(--color-text-secondary);
      transition: transform var(--transition-base);
    }

    .user-menu.open .user-menu-chevron {
      transform: rotate(180deg);
    }

    /* Dropdown */
    .user-dropdown {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      min-width: 180px;
      padding: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      z-index: 100;
    }

    .user-dropdown-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius-sm);
      color: var(--color-text-primary);
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      background: transparent;
      border: none;
      width: 100%;
      font-family: var(--font-family-base);
      transition: background var(--transition-base);
    }

    .user-dropdown-item:hover {
      background: var(--color-bg-elevated);
    }

    .user-dropdown-item--danger {
      color: var(--color-error);
    }

    .user-dropdown-item--danger:hover {
      background: rgba(239, 68, 68, 0.1);
    }
  `]
})
export class NavbarSection {
  protected readonly authService = inject(AuthService);
  readonly dropdownOpen = signal(false);

  toggleDropdown(): void {
    this.dropdownOpen.update(v => !v);
  }

  async logout(): Promise<void> {
    this.dropdownOpen.set(false);
    await this.authService.logout();
  }
}
