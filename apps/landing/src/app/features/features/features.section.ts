import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Music, Coins, Trophy, Shield, CheckCircle, LogOut, MessageCircle, Swords } from 'lucide-angular';

interface Feature {
  icon: any;
  name: string;
  description: string;
  tier: 'Free' | 'Premium';
}

@Component({
  selector: 'app-features-section',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <section class="section" id="features">
      <div class="container">
        <h2 class="heading-section">
          Todo lo que necesitas para tu servidor
        </h2>
        <p class="text-body">
          CharlyBot ofrece un conjunto completo de herramientas para hacer crecer y gestionar tu comunidad de Discord.
        </p>

        <div class="grid-3">
          @for (feature of features; track feature.name) {
            <div class="feature-card">
              <div class="feature-icon-row">
                <div class="feature-icon-wrapper">
                  <lucide-icon [img]="feature.icon" [size]="24" class="text-accent"></lucide-icon>
                </div>
                <div class="feature-content">
                  <div class="feature-header">
                    <h3 class="feature-name">{{ feature.name }}</h3>
                    <span [class]="feature.tier === 'Premium' ? 'feature-badge feature-badge--premium' : 'feature-badge feature-badge--free'">
                      {{ feature.tier }}
                    </span>
                  </div>
                  <p class="feature-description">{{ feature.description }}</p>
                </div>
              </div>
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

    .feature-icon-wrapper {
      padding: 0.75rem;
      background: var(--color-bg-elevated);
      border-radius: var(--radius-md);
      flex-shrink: 0;
    }

    .feature-icon-row {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }

    .feature-content {
      flex: 1;
    }

    .feature-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .feature-name {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--color-text-primary);
      margin: 0;
    }

    .feature-description {
      color: var(--color-text-secondary);
      font-size: 0.875rem;
      margin: 0;
    }
  `]
})
export class FeaturesSection {
  readonly Music = Music;
  readonly Coins = Coins;
  readonly Trophy = Trophy;
  readonly Shield = Shield;
  readonly CheckCircle = CheckCircle;
  readonly LogOut = LogOut;
  readonly MessageCircle = MessageCircle;
  readonly Swords = Swords;

  features: Feature[] = [
    {
      icon: Music,
      name: 'Música',
      description: 'Reproduce música de YouTube y Spotify. Perfecto para sesiones de escucha en comunidad.',
      tier: 'Free'
    },
    {
      icon: Coins,
      name: 'Economía',
      description: 'Sistema completo de dinero virtual con diarios, trabajos y tiendas.',
      tier: 'Free'
    },
    {
      icon: Trophy,
      name: 'XP y Niveles',
      description: 'Sistema de experiencia por participar. Roles automáticos según nivel.',
      tier: 'Free'
    },
    {
      icon: Shield,
      name: 'AutoRoles',
      description: 'Asigna roles automáticamente cuando los usuarios entren al servidor.',
      tier: 'Free'
    },
    {
      icon: CheckCircle,
      name: 'Verificación',
      description: 'Control de acceso con captcha y verificación por email o Discord.',
      tier: 'Free'
    },
    {
      icon: LogOut,
      name: 'Logs y Moderación',
      description: 'Registro automático de mensajes, ediciones, eliminaciones y acciones de moderación.',
      tier: 'Free'
    },
    {
      icon: MessageCircle,
      name: 'Bienvenida/Despedida',
      description: 'Mensajes personalizados de entrada y salida con imágenes y embeds.',
      tier: 'Free'
    },
    {
      icon: Swords,
      name: 'Sistema de Clases',
      description: 'Jerarquía RPG con clases, stats y habilidades especiales.',
      tier: 'Premium'
    }
  ];
}
