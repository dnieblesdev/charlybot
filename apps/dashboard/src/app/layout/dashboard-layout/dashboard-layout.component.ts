import { Component, inject } from '@angular/core';
import { RouterOutlet, ActivatedRoute, RouterLink } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, RouterLink],
  template: `
    <div class="flex h-screen bg-bg-base">
      <app-sidebar />
      
      <!-- Main Content -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Topbar -->
        <header class="h-16 bg-bg-surface border-b border-border flex items-center justify-between px-6">
          <div class="flex items-center gap-3">
            <a routerLink="/" class="text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="Switch Server">
              ← Servers
            </a>
            <div class="text-lg font-semibold text-text-primary">
              {{ currentGuildName() }}
            </div>
          </div>
          
          <div class="flex items-center gap-4">
            @if (user()) {
              <div class="flex items-center gap-3">
                @if (user()!.avatar) {
                  <img
                    [src]="getAvatarUrl()"
                    [alt]="user()!.username"
                    class="w-8 h-8 rounded-full"
                  />
                } @else {
                  <div class="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-bold text-text-primary">
                    {{ user()!.username.charAt(0).toUpperCase() }}
                  </div>
                }
                <span class="text-text-primary">{{ user()!.username }}</span>
              </div>
            }
          </div>
        </header>
        
        <!-- Page Content -->
        <main class="flex-1 overflow-auto p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class DashboardLayoutComponent {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  user = this.authService.user;

  currentGuildName(): string {
    const guildId = this.route.snapshot.paramMap.get('guildId');
    if (!guildId) return 'Dashboard';
    
    const guild = this.authService.guilds().find((g) => g.id === guildId);
    return guild?.name ?? 'Dashboard';
  }

  getAvatarUrl(): string {
    const user = this.user();
    if (!user?.avatar) return '';
    return `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png`;
  }
}
