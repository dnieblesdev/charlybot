import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DISCORD_OAUTH_URL } from '../shared/discord-oauth.config';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="hero-section">
      <!-- Mobile Sticky CTA -->
      <div class="hero-mobile-cta">
        <a [href]="discordOAuthUrl"
           class="btn-primary btn-block">
          Agregar al Servidor
        </a>
      </div>

      <div class="hero-content">
        <h1 class="heading-display">
          CharlyBot — El bot todo en uno que tu servidor de Discord necesita
        </h1>
        <p class="text-body hero-subtitle">
          Tu servidor crece, las cosas se complican. CharlyBot te da las herramientas para gestionar todo desde un solo lugar.
        </p>

        <!-- Desktop CTA -->
        <a [href]="discordOAuthUrl"
           class="btn-primary btn-primary-lg hero-desktop-cta">
          Agregar al Servidor
        </a>

        <!-- Bot Visual Mockup -->
        <div class="hero-mockup">
          <div class="hero-mockup-inner">
            <div class="hero-mockup-icon">
              <div class="hero-bot-icon">
                <span class="hero-bot-emoji">🤖</span>
              </div>
            </div>
            <span class="text-secondary hero-mockup-label">[ CharlyBot en acción — mockup ]</span>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    .hero-section {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 1rem;
      background: var(--color-bg-base);
      position: relative;
    }

    .hero-section::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(167, 139, 250, 0.06) 0%, transparent 50%);
      pointer-events: none;
    }

    .hero-mobile-cta {
      display: block;
    }

    @media (max-width: 767px) {
      .hero-mobile-cta {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 1rem;
        padding-bottom: calc(1rem + env(safe-area-inset-bottom));
        background: rgba(11, 9, 26, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-top: 1px solid var(--color-border);
        z-index: 50;
      }

      .hero-section {
        padding-bottom: 120px;
      }
    }

    @media (min-width: 768px) {
      .hero-mobile-cta {
        display: none;
      }
    }

    .hero-content {
      max-width: 56rem;
      margin: 0 auto;
      text-align: center;
      position: relative;
      z-index: 1;
    }

    .hero-subtitle {
      margin-top: 1.5rem;
      margin-bottom: 0;
    }

    @media (min-width: 768px) {
      .hero-subtitle {
        font-size: 1.25rem;
      }
    }

    .hero-desktop-cta {
      display: none;
    }

    @media (min-width: 768px) {
      .hero-desktop-cta {
        display: inline-block;
        margin-top: 2rem;
      }
    }

    .hero-mockup {
      margin-top: 3rem;
      width: 100%;
      max-width: 48rem;
      margin-left: auto;
      margin-right: auto;
      height: 16rem;
      background: var(--color-bg-surface);
      border-radius: 0.75rem;
      border: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .hero-mockup-inner {
      text-align: center;
    }

    .hero-mockup-icon {
      display: flex;
      justify-content: center;
      margin-bottom: 1rem;
    }

    .hero-bot-icon {
      width: 4rem;
      height: 4rem;
      border-radius: 9999px;
      background: rgba(88, 101, 242, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .hero-bot-emoji {
      font-size: 1.875rem;
    }

    .hero-mockup-label {
      font-size: 1.25rem;
    }
  `]
})
export class HeroSection {
  discordOAuthUrl = DISCORD_OAUTH_URL;
}
