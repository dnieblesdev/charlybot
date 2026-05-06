import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

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
        <a href="/dashboard/"
           class="btn-secondary">
          Iniciar sesión
        </a>
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
  `]
})
export class NavbarSection {}
