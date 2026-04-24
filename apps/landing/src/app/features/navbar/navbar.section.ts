import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="fixed top-0 left-0 right-0 z-50 bg-bg-base/90 backdrop-blur-md border-b border-border">
      <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <!-- Brand -->
        <span class="text-xl font-bold text-accent">CharlyBot</span>

        <!-- CTA -->
        <a href="/dashboard/"
           class="bg-discord hover:bg-discord/80 text-white px-4 py-2 rounded-lg font-medium transition-colors">
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
