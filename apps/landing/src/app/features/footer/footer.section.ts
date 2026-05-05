import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DISCORD_OAUTH_URL } from '../shared/discord-oauth.config';

@Component({
  selector: 'app-footer-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="footer">
      <div class="container">
        <!-- CTA Section -->
        <div class="footer-cta">
          <h2 class="heading-subsection">
            ¿Listo para mejorar tu servidor?
          </h2>
          <p class="footer-subtitle">
            Únete a miles de servidores que ya usan CharlyBot.
          </p>
          <a [href]="discordOAuthUrl"
             class="btn-primary btn-primary-lg">
            Agregar al Servidor
          </a>
        </div>

        <!-- Links -->
        <div class="footer-links">
          <a href="https://discord.gg" target="_blank" rel="noopener noreferrer"
             class="footer-link">
            Discord de soporte
          </a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
             class="footer-link">
            GitHub
          </a>
          <a href="#"
             class="footer-link">
            Términos
          </a>
          <a href="#"
             class="footer-link">
            Privacidad
          </a>
        </div>

        <!-- Copyright -->
        <div class="footer-copyright">
          © 2026 CharlyBot — Todos los derechos reservados.
        </div>
      </div>
    </footer>
  `,
  styles: [`
    :host {
      display: block;
    }

    .footer {
      padding: 4rem 1rem;
      background: var(--color-bg-base);
      border-top: 1px solid var(--color-border);
    }

    .footer-subtitle {
      color: var(--color-text-secondary);
      margin-bottom: 1.5rem;
    }

    .footer-cta {
      text-align: center;
      margin-bottom: 3rem;
    }

    .footer-links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    @media (min-width: 768px) {
      .footer-links {
        gap: 3rem;
      }
    }

    .footer-link {
      color: var(--color-text-secondary);
      text-decoration: none;
      transition: color var(--transition-base);
    }

    .footer-link:hover {
      color: var(--color-text-primary);
    }

    .footer-copyright {
      text-align: center;
      font-size: 0.875rem;
      color: var(--color-text-secondary);
    }
  `]
})
export class FooterSection {
  discordOAuthUrl = DISCORD_OAUTH_URL;
}
