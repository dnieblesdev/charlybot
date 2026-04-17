import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-bg-base to-bg-surface px-4 py-16 relative">
      <!-- Mobile Sticky CTA -->
      <div class="fixed bottom-0 left-0 right-0 p-4 pb-[env(safe-area-inset-bottom)] bg-bg-base/95 backdrop-blur-sm border-t border-border md:hidden z-50">
        <a href="https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot&permissions=8"
           class="block w-full py-4 bg-discord text-white text-center font-semibold rounded-lg hover:opacity-90 transition-opacity">
          Agregar a Discord
        </a>
      </div>

      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-4xl md:text-6xl font-bold text-center text-text-primary leading-tight">
          CharlyBot — El bot todo en uno que tu servidor de Discord necesita
        </h1>
        <p class="mt-6 text-lg md:text-xl text-text-secondary text-center max-w-2xl mx-auto">
          Tu servidor crece, las cosas se complican. CharlyBot te da las herramientas para gestionar todo desde un solo lugar.
        </p>

        <!-- Desktop CTA -->
        <a href="https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot&permissions=8"
           class="hidden md:inline-block mt-8 px-8 py-4 bg-discord text-white text-lg font-semibold rounded-lg hover:opacity-90 transition-opacity">
          Agregar a Discord
        </a>

        <!-- Bot Visual Mockup -->
        <div class="mt-12 w-full max-w-3xl mx-auto h-64 bg-bg-surface rounded-xl border border-border flex items-center justify-center">
          <div class="text-center">
            <div class="flex justify-center mb-4">
              <div class="w-16 h-16 rounded-full bg-discord/20 flex items-center justify-center">
                <span class="text-3xl">🤖</span>
              </div>
            </div>
            <span class="text-text-secondary text-xl">[ CharlyBot en acción — mockup ]</span>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    section {
      scroll-behavior: smooth;
    }

    @media (max-width: 768px) {
      section {
        padding-bottom: 100px;
      }
    }
  `]
})
export class HeroSection {}
