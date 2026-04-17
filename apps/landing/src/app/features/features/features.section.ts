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
    <section class="py-24 px-4 bg-bg-base" id="features">
      <div class="max-w-6xl mx-auto">
        <h2 class="text-3xl md:text-4xl font-bold text-center text-text-primary mb-4">
          Todo lo que necesitas para tu servidor
        </h2>
        <p class="text-text-secondary text-center max-w-2xl mx-auto mb-16">
          CharlyBot ofrece un conjunto completo de herramientas para hacer crecer y gestionar tu comunidad de Discord.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (feature of features; track feature.name) {
            <div class="bg-bg-surface border border-border rounded-xl p-6 hover:border-accent transition-colors">
              <div class="flex items-start gap-4">
                <div class="p-3 bg-bg-elevated rounded-lg">
                  <lucide-icon [img]="feature.icon" [size]="24" class="text-accent"></lucide-icon>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <h3 class="text-lg font-semibold text-text-primary">{{ feature.name }}</h3>
                    <span [class]="feature.tier === 'Premium' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'"
                          class="text-xs px-2 py-0.5 rounded font-medium">
                      {{ feature.tier }}
                    </span>
                  </div>
                  <p class="text-text-secondary text-sm">{{ feature.description }}</p>
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
