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
        <span class="navbar-brand">CharlyBot</span>

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
  `]
})
export class NavbarSection {}
