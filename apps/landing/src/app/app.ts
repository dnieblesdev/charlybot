import { Component, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HeroSection } from './features/hero/hero.section';
import { FeaturesSection } from './features/features/features.section';
import { DocsSection } from './features/docs/docs.section';
import { PricingSection } from './features/pricing/pricing.section';
import { FooterSection } from './features/footer/footer.section';
import { NavbarSection } from './features/navbar/navbar.section';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeroSection, FeaturesSection, DocsSection, PricingSection, FooterSection, NavbarSection],
  template: `
    <app-navbar-section />

    <main class="page-main">
      <app-hero-section class="fade-in-up" />

      @defer (on viewport) {
        <app-features-section animate.enter="fade-in-up" />
      } @placeholder {
        <div class="placeholder-features"></div>
      }

      @defer (on viewport) {
        <app-docs-section />
      } @placeholder {
        <div class="placeholder-docs"></div>
      }

      @defer (on viewport) {
        <app-pricing-section animate.enter="fade-in-up" />
      } @placeholder {
        <div class="placeholder-pricing"></div>
      }

      @defer (on viewport) {
        <app-footer-section animate.enter="fade-in-up" />
      } @placeholder {
        <div class="placeholder-footer"></div>
      }
    </main>
  `,
  styles: [`
    :host {
      display: block;
    }

    main {
      scroll-behavior: smooth;
    }

    .placeholder-features {
      min-height: 800px;
    }

    .placeholder-docs {
      min-height: 900px;
    }

    .placeholder-pricing {
      min-height: 600px;
    }

    .placeholder-footer {
      height: 256px;
    }
  `]
})
export class App implements AfterViewInit {
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    // Inject CSS that Angular build optimizer strips (no DOM match during SSR)
    const style = document.createElement('style');
    style.textContent = `
      .rain-drop {
        position: fixed; top: 0; width: 3px; height: 16px;
        background: linear-gradient(to bottom, rgba(139, 92, 246, 0.7), transparent);
        border-radius: 999px; opacity: 0.25;
        animation: rain linear infinite;
        pointer-events: none; z-index: 9999;
      }
      @keyframes rain {
        0% { transform: translateY(-10vh); }
        100% { transform: translateY(110vh); }
      }
      .card-spotlight { position: relative; overflow: hidden; }
      .card-spotlight::before {
        content: ""; position: absolute;
        top: var(--y, 50%); left: var(--x, 50%);
        width: 220px; height: 220px;
        background: radial-gradient(circle, rgba(139, 92, 246, 0.25), transparent 60%);
        transform: translate(-50%, -50%); opacity: 0; transition: 0.3s;
        pointer-events: none;
      }
      .card-spotlight:hover::before { opacity: 1; }
    `;
    document.head.appendChild(style);

    // Rain effect — purple drops
    for (let i = 0; i < 45; i++) {
      const d = document.createElement('div');
      d.className = 'rain-drop';
      d.style.left = Math.random() * 100 + 'vw';
      d.style.animationDuration = (2 + Math.random() * 3) + 's';
      document.body.appendChild(d);
    }

    // Spotlight effect for cards
    document.addEventListener('mousemove', (e: MouseEvent) => {
      document.querySelectorAll('.card-spotlight').forEach((card) => {
        const r = card.getBoundingClientRect();
        (card as HTMLElement).style.setProperty('--x', (e.clientX - r.left) + 'px');
        (card as HTMLElement).style.setProperty('--y', (e.clientY - r.top) + 'px');
      });
    });
  }
}
