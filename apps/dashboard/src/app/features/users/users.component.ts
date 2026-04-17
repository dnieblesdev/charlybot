import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { createApiState } from '../../shared/http/api-state';

interface UserXPEntry {
  userId: string;
  username?: string;
  guildId: string;
  xp: number;
  nivel: number;
  lastMessageAt: Date;
}

interface LevelRole {
  guildId: string;
  roleId: string;
  level: number;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [LoaderComponent, AlertComponent, RouterLink],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-text-primary mb-6">Users & XP</h1>

      @if (leaderboardState.loading() || levelRolesState.loading()) {
        <app-loader />
      } @else if (leaderboardState.error() || levelRolesState.error()) {
        <app-alert type="error" [message]="leaderboardState.error() || levelRolesState.error() || ''" [retry]="loadData.bind(this)" />
      } @else {
        <!-- XP Leaderboard -->
        <div class="bg-bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 class="text-lg font-semibold text-text-primary mb-4">XP Leaderboard</h2>

          @if (leaderboard()?.length === 0) {
            <p class="text-text-secondary">No XP data available</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-border">
                    <th class="text-left py-3 px-4 text-text-secondary font-medium text-sm">#</th>
                    <th class="text-left py-3 px-4 text-text-secondary font-medium text-sm">User</th>
                    <th class="text-right py-3 px-4 text-text-secondary font-medium text-sm">Level</th>
                    <th class="text-right py-3 px-4 text-text-secondary font-medium text-sm">XP</th>
                    <th class="text-right py-3 px-4 text-text-secondary font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (entry of leaderboard(); track entry.userId; let i = $index) {
                    <tr class="border-b border-border hover:bg-bg-base/50 transition-colors">
                      <td class="py-3 px-4 text-text-secondary">{{ i + 1 }}</td>
                      <td class="py-3 px-4 text-text-primary">{{ entry.username || entry.userId }}</td>
                      <td class="py-3 px-4 text-right text-accent">Lv.{{ entry.nivel }}</td>
                      <td class="py-3 px-4 text-right text-text-secondary">{{ entry.xp }} XP</td>
                      <td class="py-3 px-4 text-right">
                        <a
                          [routerLink]="['./', entry.userId]"
                          class="text-accent hover:text-accent-hover underline"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <!-- Level Roles -->
        <div class="bg-bg-surface border border-border rounded-xl p-6">
          <h2 class="text-lg font-semibold text-text-primary mb-4">Level Roles</h2>

          @if (levelRoles()?.length === 0) {
            <p class="text-text-secondary">No level roles configured</p>
          } @else {
            <div class="space-y-2">
              @for (role of levelRoles(); track role.roleId) {
                <div class="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <span class="text-text-primary">Level {{ role.level }}</span>
                  <span class="text-accent text-sm">Role ID: {{ role.roleId }}</span>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class UsersComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  leaderboardState = createApiState<UserXPEntry[]>();
  levelRolesState = createApiState<LevelRole[]>();

  leaderboard = this.leaderboardState.data;
  levelRoles = this.levelRolesState.data;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;

    this.leaderboardState.setLoading();
    this.http.get<UserXPEntry[]>(`/api/v1/xp/leaderboard/${guildId}`)
      .subscribe({
        next: (data) => this.leaderboardState.setData(data),
        error: (err) => this.leaderboardState.setError(err),
      });

    this.levelRolesState.setLoading();
    this.http.get<LevelRole[]>(`/api/v1/xp/level-roles/${guildId}`)
      .subscribe({
        next: (data) => this.levelRolesState.setData(data),
        error: (err) => this.levelRolesState.setError(err),
      });
  }
}
