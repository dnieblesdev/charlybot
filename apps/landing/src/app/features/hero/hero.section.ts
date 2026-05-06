import { Component, AfterViewInit, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DISCORD_OAUTH_URL } from '../shared/discord-oauth.config';

interface HeroStat {
  value: string;
  label: string;
  target: number;
  prefix: string;
  suffix: string;
  hasKFormat: boolean;
}

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
        <!-- Left Column: Info -->
        <div class="hero-left">
          <h1 class="heading-display">
            CharlyBot: El bot todo en uno para tu servidor
          </h1>
          <p class="text-body hero-subtitle">
            Moderación, música, economía y más — todo en un solo bot. Sin complicaciones, tu comunidad crece mejor.
          </p>
          <a [href]="discordOAuthUrl"
             class="btn-primary btn-primary-lg hero-desktop-cta">
            Agregar al Servidor
          </a>
        </div>

        <!-- Right Column: Stats -->
        <div class="hero-right">
          <div class="hero-stats">
            @for (stat of stats; track stat.label; let i = $index) {
              <div class="hero-stat glass-card" #statCard>
                <span class="hero-stat__number"
                      [attr.data-target]="stat.target"
                      [attr.data-prefix]="stat.prefix"
                      [attr.data-suffix]="stat.suffix">
                  {{ stat.prefix }}{{ stat.value }}{{ stat.suffix }}
                </span>
                <span class="hero-stat__label">{{ stat.label }}</span>
              </div>
            }
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
      padding: 6rem 1rem 4rem;
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
      max-width: var(--max-width-container);
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr;
      gap: 3rem;
      align-items: center;
      position: relative;
      z-index: 1;
    }

    @media (min-width: 768px) {
      .hero-content {
        grid-template-columns: 1fr 1fr;
      }
    }

    .hero-left {
      text-align: left;
    }

    @media (max-width: 767px) {
      .hero-left {
        text-align: center;
      }
    }

    .hero-right {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .hero-subtitle {
      margin-top: 1.5rem;
      margin-bottom: 0;
      text-align: left;
      margin-left: 0;
      margin-right: 0;
      max-width: none;
    }

    @media (max-width: 767px) {
      .hero-subtitle {
        text-align: center;
        margin-left: auto;
        margin-right: auto;
      }
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

    .hero-stats {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
      width: 100%;
    }

    @media (min-width: 480px) {
      .hero-stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 768px) {
      .hero-stats {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .hero-stat {
      text-align: center;
      padding: 1.5rem;
    }

    .hero-stat__number {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--color-accent);
      display: block;
    }

    .hero-stat__label {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      margin-top: 0.25rem;
    }
  `]
})
export class HeroSection implements AfterViewInit {
  @ViewChildren('statCard') statCards!: QueryList<ElementRef<HTMLDivElement>>;

  discordOAuthUrl = DISCORD_OAUTH_URL;

  stats: HeroStat[] = [
    { value: '500', label: 'servidores activos', target: 500, prefix: '+', suffix: '', hasKFormat: false },
    { value: '50k', label: 'usuarios', target: 50000, prefix: '+', suffix: '', hasKFormat: true },
    { value: '99.9', label: 'uptime', target: 999, prefix: '', suffix: '%', hasKFormat: false }
  ];

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.statCards.forEach((cardRef, index) => {
      const el = cardRef.nativeElement;
      const numberEl = el.querySelector('.hero-stat__number') as HTMLElement;
      if (!numberEl) return;

      const target = parseFloat(numberEl.getAttribute('data-target') || '0');
      const prefix = numberEl.getAttribute('data-prefix') || '';
      const suffix = numberEl.getAttribute('data-suffix') || '';
      const stat = this.stats[index];
      const hasKFormat = stat ? stat.hasKFormat : false;

      if (prefersReducedMotion) {
        numberEl.textContent = prefix + this.formatNumber(target, suffix, hasKFormat) + suffix;
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.animateCounter(numberEl, target, prefix, suffix, hasKFormat);
              observer.disconnect();
            }
          });
        },
        { threshold: 0.5 }
      );

      observer.observe(el);
    });
  }

  private animateCounter(el: HTMLElement, target: number, prefix: string, suffix: string, hasKFormat: boolean): void {
    const duration = 2000;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      el.textContent = prefix + this.formatNumber(current, suffix, hasKFormat) + suffix;

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }

  private formatNumber(value: number, suffix: string, hasKFormat: boolean): string {
    if (hasKFormat) {
      return value >= 1000 ? Math.round(value / 1000) + 'k' : value.toString();
    }
    if (suffix === '%') {
      return (value / 10).toFixed(1);
    }
    return value >= 1000 ? Math.round(value / 1000) + 'k' : value.toString();
  }
}
