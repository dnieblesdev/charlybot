import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DISCORD_OAUTH_URL } from '../shared/discord-oauth.config';

interface PricingTier {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted: boolean;
  badge?: string;
}

@Component({
  selector: 'app-pricing-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="section-alt" id="pricing">
      <div class="container">
        <h2 class="heading-section">
          Planes simples y transparentes
        </h2>
        <p class="text-body">
          Elige el plan que mejor se adapte a tu servidor. Sin compromisos.
        </p>

        <div class="grid-3">
          @for (tier of tiers; track tier.name) {
            <div [class]="getCardClass(tier)">
              @if (tier.badge) {
                <div class="pricing-badge-wrapper">
                  <span [class]="getBadgeClass(tier)">
                    {{ tier.badge }}
                  </span>
                </div>
              }

              <div class="pricing-card-header">
                <h3 [class]="getTierNameClass(tier)"
                    class="pricing-tier-name">{{ tier.name }}</h3>
                <div [class]="getPriceClass(tier)"
                     class="pricing-price">{{ tier.price }}</div>
                @if (tier.price !== 'Gratis') {
                  <div class="pricing-period">por mes</div>
                }
                <p class="text-secondary text-small pricing-description">{{ tier.description }}</p>
              </div>

              <ul class="pricing-feature-list">
                @for (feature of tier.features; track feature) {
                  <li class="pricing-feature-item">
                    <span class="pricing-check">✓</span>
                    {{ feature }}
                  </li>
                }
              </ul>

              <a [href]="tier.ctaHref"
                 [class]="getButtonClass(tier)"
                 [attr.target]="tier.ctaHref.startsWith('http') ? '_blank' : null"
                 [rel]="tier.ctaHref.startsWith('http') ? 'noopener noreferrer' : null">
                {{ tier.cta }}
              </a>
            </div>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    .pricing-badge-wrapper {
      position: absolute;
      top: -0.75rem;
      left: 50%;
      transform: translateX(-50%);
    }

    .pricing-period {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      margin-top: 0.25rem;
    }

    .pricing-card-header {
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .pricing-feature-item {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      color: var(--color-text-secondary);
      font-size: 0.875rem;
    }

    .pricing-check {
      color: var(--color-success);
      margin-top: 0.125rem;
      flex-shrink: 0;
    }

    .pricing-description {
      margin-top: 1rem;
    }
  `]
})
export class PricingSection {
  tiers: PricingTier[] = [
    {
      name: 'Free',
      price: 'Gratis',
      description: 'Para servidores pequeños que quieren empezar.',
      features: [
        'Música (YouTube, Spotify)',
        'Sistema de economía básica',
        'XP y niveles',
        '5 AutoRoles',
        'Logs básicos',
        'Bienvenida/Despedida',
        'Soporte por Discord'
      ],
      cta: 'Agregar al Servidor',
      ctaHref: DISCORD_OAUTH_URL,
      highlighted: false
    },
    {
      name: 'Premium',
      price: '$5',
      description: 'Para servidores que quieren más poder.',
      features: [
        'Todo lo de Free',
        'Música sin límite de tiempo',
        'Sistema de economía completo',
        'AutoRoles ilimitados',
        'Verificación avanzada',
        'Logs completos',
        'Sistema de Clases RPG',
        'Prioridad en soporte'
      ],
      cta: 'Próximamente',
      ctaHref: '#',
      highlighted: true,
      badge: 'Popular'
    },
    {
      name: 'Pro',
      price: '$10',
      description: 'Sin límites para servidores grandes.',
      features: [
        'Todo lo de Premium',
        'Comandos personalizados',
        'API access',
        'Web dashboard completo',
        'Múltiples servidores',
        'Soporte prioritario 24/7',
        'Características exclusivas mensuales'
      ],
      cta: 'Próximamente',
      ctaHref: '#',
      highlighted: false
    }
  ];

  getCardClass(tier: PricingTier): string {
    if (tier.name === 'Premium') {
      return 'glass-card pricing-card pricing-card--premium';
    }
    if (tier.name === 'Free') {
      return 'glass-card pricing-card pricing-card--free';
    }
    return 'glass-card pricing-card pricing-card--pro';
  }

  getBadgeClass(tier: PricingTier): string {
    if (tier.name === 'Premium') {
      return 'pricing-badge pricing-badge--premium';
    }
    return 'pricing-badge pricing-badge--free';
  }

  getTierNameClass(tier: PricingTier): string {
    if (tier.name === 'Premium') {
      return 'pricing-tier-name pricing-tier-name--premium';
    }
    if (tier.name === 'Free') {
      return 'pricing-tier-name pricing-tier-name--free';
    }
    return 'pricing-tier-name pricing-tier-name--pro';
  }

  getPriceClass(tier: PricingTier): string {
    if (tier.name === 'Premium') {
      return 'pricing-price pricing-price--premium';
    }
    if (tier.name === 'Free') {
      return 'pricing-price pricing-price--free';
    }
    return 'pricing-price pricing-price--pro';
  }

  getButtonClass(tier: PricingTier): string {
    if (tier.name === 'Premium') {
      return 'btn-premium';
    }
    if (tier.name === 'Free') {
      return 'btn-primary btn-block';
    }
    return 'btn-pro';
  }
}
