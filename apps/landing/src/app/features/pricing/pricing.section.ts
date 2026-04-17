import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

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
    <section class="py-24 px-4 bg-bg-surface" id="pricing">
      <div class="max-w-6xl mx-auto">
        <h2 class="text-3xl md:text-4xl font-bold text-center text-text-primary mb-4">
          Planes simples y transparentes
        </h2>
        <p class="text-text-secondary text-center max-w-2xl mx-auto mb-16">
          Elige el plan que mejor se adapte a tu servidor. Sin compromisos.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          @for (tier of tiers; track tier.name) {
            <div [class]="tier.highlighted
              ? 'bg-bg-base border-2 border-accent shadow-lg shadow-accent/20 relative'
              : 'bg-bg-base border border-border'"
                 class="rounded-2xl p-8 flex flex-col">
              @if (tier.badge) {
                <div class="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span class="bg-accent text-white text-xs font-semibold px-3 py-1 rounded-full">
                    {{ tier.badge }}
                  </span>
                </div>
              }

              <div class="text-center mb-6">
                <h3 class="text-xl font-bold text-text-primary mb-2">{{ tier.name }}</h3>
                <div class="text-4xl font-bold text-text-primary">{{ tier.price }}</div>
                @if (tier.price !== 'Gratis') {
                  <div class="text-text-secondary text-sm mt-1">por mes</div>
                }
                <p class="text-text-secondary text-sm mt-4">{{ tier.description }}</p>
              </div>

              <ul class="space-y-3 mb-8 flex-1">
                @for (feature of tier.features; track feature) {
                  <li class="flex items-start gap-2 text-text-secondary text-sm">
                    <span class="text-success mt-0.5">✓</span>
                    {{ feature }}
                  </li>
                }
              </ul>

              <a [href]="tier.ctaHref"
                 [class]="tier.highlighted
                   ? 'block w-full py-3 bg-accent hover:bg-accent-hover text-white text-center font-semibold rounded-lg transition-colors'
                   : 'block w-full py-3 bg-bg-elevated hover:bg-border text-text-primary text-center font-semibold rounded-lg transition-colors'"
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
      cta: 'Agregar a Discord',
      ctaHref: 'https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot&permissions=8',
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
}
