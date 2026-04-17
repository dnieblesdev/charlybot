import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { StatCardComponent } from '../../shared/ui/stat-card.component';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { createApiState } from '../../shared/http/api-state';
import { getErrorMessage } from '../../shared/http/api-errors';

interface LeaderboardEntry {
  userId: string;
  username?: string;
  totalMoney?: number;
  money?: number;
  xp?: number;
  level?: number;
  nivel?: number;
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [StatCardComponent, LoaderComponent, AlertComponent],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-text-primary mb-6">Overview</h1>

      @if (economyState.loading() || xpState.loading()) {
        <app-loader />
      } @else if (economyState.error() || xpState.error()) {
        <app-alert type="error" [message]="economyState.error() || xpState.error() || ''" [retry]="retry.bind(this)" />
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <app-stat-card label="Economy Top" [value]="topEarner()" />
          <app-stat-card label="XP Top" [value]="topXPUser()" />
          <app-stat-card label="Total on Leaderboard" [value]="totalUsers()" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-bg-surface border border-border rounded-xl p-6">
            <h2 class="text-lg font-semibold text-text-primary mb-4">Economy Top 5</h2>
            @if (economyLeaderboard()?.length === 0) {
              <p class="text-text-secondary">No data available</p>
            } @else {
              @for (entry of economyLeaderboard(); track entry.userId) {
                <div class="flex justify-between py-2 border-b border-border last:border-0">
                  <span class="text-text-primary">{{ entry.username || entry.userId }}</span>
                  <span class="text-accent">{{ entry.totalMoney || entry.money || 0 }} 💰</span>
                </div>
              }
            }
          </div>

          <div class="bg-bg-surface border border-border rounded-xl p-6">
            <h2 class="text-lg font-semibold text-text-primary mb-4">XP Top 5</h2>
            @if (xpLeaderboard()?.length === 0) {
              <p class="text-text-secondary">No data available</p>
            } @else {
              @for (entry of xpLeaderboard(); track entry.userId) {
                <div class="flex justify-between py-2 border-b border-border last:border-0">
                  <span class="text-text-primary">{{ entry.username || entry.userId }}</span>
                  <span class="text-accent">Lv.{{ entry.level || entry.nivel || 0 }} ({{ entry.xp || 0 }} XP)</span>
                </div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class OverviewComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  economyState = createApiState<LeaderboardEntry[]>();
  xpState = createApiState<LeaderboardEntry[]>();

  economyLeaderboard = this.economyState.data;
  xpLeaderboard = this.xpState.data;

  topEarner = computed(() => {
    const lb = this.economyLeaderboard();
    if (!lb || lb.length === 0) return '-';
    const top = lb[0];
    return top.username || top.userId;
  });

  topXPUser = computed(() => {
    const lb = this.xpLeaderboard();
    if (!lb || lb.length === 0) return '-';
    const top = lb[0];
    return top.username || top.userId;
  });

  totalUsers = computed(() => {
    const lb = this.economyLeaderboard();
    return lb ? lb.length.toString() : '0';
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;

    this.economyState.setLoading();
    this.http.get<LeaderboardEntry[]>(`/api/v1/economy/leaderboard/${guildId}?limit=100`)
      .subscribe({
        next: (data) => this.economyState.setData(data),
        error: (err) => this.economyState.setError(err),
      });

    this.xpState.setLoading();
    this.http.get<LeaderboardEntry[]>(`/api/v1/xp/leaderboard/${guildId}?limit=100`)
      .subscribe({
        next: (data) => this.xpState.setData(data),
        error: (err) => this.xpState.setError(err),
      });
  }

  retry(): void {
    this.loadData();
  }
}
