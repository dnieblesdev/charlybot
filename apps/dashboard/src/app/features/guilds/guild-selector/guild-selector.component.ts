import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FilteredGuild } from '../../../shared/types/auth.types';

@Component({
  selector: 'app-guild-selector',
  standalone: true,
  template: `
    <div class="min-h-screen bg-bg-base p-8">
      <h1 class="text-3xl font-bold text-text-primary mb-8">Select a Server</h1>

      @if (guilds().length === 0) {
        <div class="text-text-secondary">You don't have any servers with admin access.</div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (guild of guilds(); track guild.id) {
            <button
              (click)="selectGuild(guild)"
              class="bg-bg-surface rounded-lg p-4 hover:bg-opacity-80 transition-colors border border-border flex items-center gap-4 cursor-pointer"
            >
              @if (guild.icon) {
                <img
                  [src]="getGuildIconUrl(guild)"
                  [alt]="guild.name"
                  class="w-16 h-16 rounded-full"
                />
              } @else {
                <div class="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-2xl font-bold text-text-primary">
                  {{ guild.name.charAt(0).toUpperCase() }}
                </div>
              }
              <span class="text-xl font-semibold text-text-primary">{{ guild.name }}</span>
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class GuildSelectorComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  guilds = this.authService.guilds;

  selectGuild(guild: FilteredGuild): void {
    this.router.navigate(['/', guild.id, 'overview']);
  }

  getGuildIconUrl(guild: FilteredGuild): string {
    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
  }
}
