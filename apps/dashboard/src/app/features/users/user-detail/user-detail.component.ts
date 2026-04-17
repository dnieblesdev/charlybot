import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { LoaderComponent } from '../../../shared/ui/loader.component';
import { AlertComponent } from '../../../shared/ui/alert.component';
import { StatCardComponent } from '../../../shared/ui/stat-card.component';
import { createApiState } from '../../../shared/http/api-state';

interface UserXP {
  userId: string;
  username?: string;
  guildId: string;
  xp: number;
  nivel: number;
  lastMessageAt: Date;
}

interface UserEconomy {
  userId: string;
  username: string;
  guildId: string;
  pocket: number;
  inJail: boolean;
  jailReleaseAt?: Date;
  lastWork?: Date;
  lastCrime?: Date;
  lastRob?: Date;
  totalEarned: number;
  totalLost: number;
}

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [LoaderComponent, AlertComponent, StatCardComponent],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-text-primary mb-6">User Details</h1>

      @if (xpState.loading() || economyState.loading()) {
        <app-loader />
      } @else if (xpState.error() || economyState.error()) {
        <app-alert type="error" [message]="xpState.error() || economyState.error() || ''" [retry]="loadData.bind(this)" />
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <app-stat-card label="Level" [value]="'Lv.' + (xp()?.nivel || 0)" />
          <app-stat-card label="Total XP" [value]="(xp()?.xp || 0).toString()" />
          <app-stat-card label="Pocket" [value]="(economy()?.pocket || 0) + ' 💰'" />
          <app-stat-card label="Total Earned" [value]="(economy()?.totalEarned || 0) + ' 💰'" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- XP Info -->
          <div class="bg-bg-surface border border-border rounded-xl p-6">
            <h2 class="text-lg font-semibold text-text-primary mb-4">XP Information</h2>
            <div class="space-y-3">
              <div class="flex justify-between">
                <span class="text-text-secondary">Username</span>
                <span class="text-text-primary">{{ xp()?.username || xp()?.userId || '-' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-text-secondary">Level</span>
                <span class="text-text-primary">{{ xp()?.nivel || 0 }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-text-secondary">Total XP</span>
                <span class="text-text-primary">{{ xp()?.xp || 0 }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-text-secondary">Last Message</span>
                <span class="text-text-primary">{{ formatDate(xp()?.lastMessageAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Economy Info -->
          <div class="bg-bg-surface border border-border rounded-xl p-6">
            <h2 class="text-lg font-semibold text-text-primary mb-4">Economy Information</h2>
            <div class="space-y-3">
              <div class="flex justify-between">
                <span class="text-text-secondary">Username</span>
                <span class="text-text-primary">{{ economy()?.username || '-' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-text-secondary">Pocket</span>
                <span class="text-accent">{{ economy()?.pocket || 0 }} 💰</span>
              </div>
              <div class="flex justify-between">
                <span class="text-text-secondary">In Jail</span>
                <span class="text-text-primary">{{ economy()?.inJail ? 'Yes' : 'No' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-text-secondary">Total Earned</span>
                <span class="text-green-400">{{ economy()?.totalEarned || 0 }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-text-secondary">Total Lost</span>
                <span class="text-red-400">{{ economy()?.totalLost || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class UserDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  xpState = createApiState<UserXP>();
  economyState = createApiState<UserEconomy>();

  xp = this.xpState.data;
  economy = this.economyState.data;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;
    const userId = this.route.snapshot.paramMap.get('userId')!;

    this.xpState.setLoading();
    this.http.get<UserXP>(`/api/v1/xp/${guildId}/${userId}`)
      .subscribe({
        next: (data) => this.xpState.setData(data),
        error: (err) => this.xpState.setError(err),
      });

    this.economyState.setLoading();
    this.http.get<UserEconomy>(`/api/v1/economy/user/${guildId}/${userId}`)
      .subscribe({
        next: (data) => this.economyState.setData(data),
        error: (err) => this.economyState.setError(err),
      });
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }
}
