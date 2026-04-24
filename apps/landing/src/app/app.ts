import { Component } from '@angular/core';
import { HeroSection } from './features/hero/hero.section';
import { FeaturesSection } from './features/features/features.section';
import { PricingSection } from './features/pricing/pricing.section';
import { FooterSection } from './features/footer/footer.section';
import { NavbarSection } from './features/navbar/navbar.section';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeroSection, FeaturesSection, PricingSection, FooterSection, NavbarSection],
  template: `
    <app-navbar-section />

    <main class="bg-bg-base pt-16">
      <app-hero-section class="fade-in-up" />

      @defer (on viewport) {
        <app-features-section animate.enter="fade-in-up" />
      } @placeholder {
        <div class="min-h-[800px]"></div>
      }

      @defer (on viewport) {
        <app-pricing-section animate.enter="fade-in-up" />
      } @placeholder {
        <div class="min-h-[600px]"></div>
      }

      @defer (on viewport) {
        <app-footer-section animate.enter="fade-in-up" />
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
