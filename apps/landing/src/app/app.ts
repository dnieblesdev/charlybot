import { Component } from '@angular/core';
import { HeroSection } from './features/hero/hero.section';
import { FeaturesSection } from './features/features/features.section';
import { PricingSection } from './features/pricing/pricing.section';
import { FooterSection } from './features/footer/footer.section';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeroSection, FeaturesSection, PricingSection, FooterSection],
  template: `
    <main class="bg-bg-base">
      <app-hero-section />

      @defer (on viewport) {
        <app-features-section />
      } @placeholder {
        <div class="min-h-screen"></div>
      }

      @defer (on viewport) {
        <app-pricing-section />
      } @placeholder {
        <div class="min-h-screen"></div>
      }

      @defer (on viewport) {
        <app-footer-section />
      } @placeholder {
        <div class="h-64"></div>
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
  `]
})
export class App {}
