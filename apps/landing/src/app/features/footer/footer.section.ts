import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="py-16 px-4 bg-bg-base border-t border-border">
      <div class="max-w-6xl mx-auto">
        <!-- CTA Section -->
        <div class="text-center mb-12">
          <h2 class="text-2xl md:text-3xl font-bold text-text-primary mb-4">
            ¿Listo para mejorar tu servidor?
          </h2>
          <p class="text-text-secondary mb-6">
            Únete a miles de servidores que ya usan CharlyBot.
          </p>
          <a href="https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot&permissions=8"
             class="inline-block px-8 py-4 bg-discord text-white text-lg font-semibold rounded-lg hover:opacity-90 transition-opacity">
            Agregar a Discord
          </a>
        </div>

        <!-- Links -->
        <div class="flex flex-wrap justify-center gap-6 md:gap-12 mb-12">
          <a href="https://discord.gg" target="_blank" rel="noopener noreferrer"
             class="text-text-secondary hover:text-text-primary transition-colors">
            Discord de soporte
          </a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
             class="text-text-secondary hover:text-text-primary transition-colors">
            GitHub
          </a>
          <a href="#"
             class="text-text-secondary hover:text-text-primary transition-colors">
            Términos
          </a>
          <a href="#"
             class="text-text-secondary hover:text-text-primary transition-colors">
            Privacidad
          </a>
        </div>

        <!-- Copyright -->
        <div class="text-center text-text-secondary text-sm">
          © 2026 CharlyBot — Todos los derechos reservados.
        </div>
      </div>
    </footer>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class FooterSection {}
