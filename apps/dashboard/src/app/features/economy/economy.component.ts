import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { StatCardComponent } from '../../shared/ui/stat-card.component';
import { createApiState } from '../../shared/http/api-state';

interface LeaderboardEntry {
  userId: string;
  username?: string;
  totalMoney: number;
  joinedServerAt: Date;
}

interface EconomyConfig {
  guildId: string;
  workCooldown: number;
  crimeCooldown: number;
  robCooldown: number;
  workMinAmount: number;
  workMaxAmount: number;
  crimeMultiplier: number;
  startingMoney: number;
  jailTimeWork: number;
  jailTimeRob: number;
  rouletteChannelId?: string;
}

@Component({
  selector: 'app-economy',
  standalone: true,
  imports: [FormsModule, LoaderComponent, AlertComponent, StatCardComponent],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-text-primary mb-6">Economy</h1>

      @if (leaderboardState.loading() || configState.loading()) {
        <app-loader />
      } @else if (leaderboardState.error() || configState.error()) {
        <app-alert type="error" [message]="leaderboardState.error() || configState.error() || ''" [retry]="loadData.bind(this)" />
      } @else {
        <!-- Leaderboard -->
        <div class="bg-bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 class="text-lg font-semibold text-text-primary mb-4">Economy Leaderboard</h2>

          @if (leaderboard()?.length === 0) {
            <p class="text-text-secondary">No leaderboard data available</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-border">
                    <th class="text-left py-3 px-4 text-text-secondary font-medium text-sm">#</th>
                    <th class="text-left py-3 px-4 text-text-secondary font-medium text-sm">User</th>
                    <th class="text-right py-3 px-4 text-text-secondary font-medium text-sm">Total Money</th>
                  </tr>
                </thead>
                <tbody>
                  @for (entry of leaderboard(); track entry.userId; let i = $index) {
                    <tr class="border-b border-border hover:bg-bg-base/50 transition-colors">
                      <td class="py-3 px-4 text-text-secondary">{{ i + 1 }}</td>
                      <td class="py-3 px-4 text-text-primary">{{ entry.username || entry.userId }}</td>
                      <td class="py-3 px-4 text-right text-accent">{{ entry.totalMoney }} 💰</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <!-- Config Form -->
        <div class="bg-bg-surface border border-border rounded-xl p-6">
          <h2 class="text-lg font-semibold text-text-primary mb-4">Economy Configuration</h2>

          @if (saveSuccess()) {
            <app-alert type="success" message="Configuration saved successfully!" />
          }

          <form (ngSubmit)="saveConfig()" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-text-secondary text-sm mb-1">Work Cooldown (ms)</label>
              <input
                type="number"
                [(ngModel)]="configForm.workCooldown"
                name="workCooldown"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Crime Cooldown (ms)</label>
              <input
                type="number"
                [(ngModel)]="configForm.crimeCooldown"
                name="crimeCooldown"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Rob Cooldown (ms)</label>
              <input
                type="number"
                [(ngModel)]="configForm.robCooldown"
                name="robCooldown"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Work Min Amount</label>
              <input
                type="number"
                [(ngModel)]="configForm.workMinAmount"
                name="workMinAmount"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Work Max Amount</label>
              <input
                type="number"
                [(ngModel)]="configForm.workMaxAmount"
                name="workMaxAmount"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Starting Money</label>
              <input
                type="number"
                [(ngModel)]="configForm.startingMoney"
                name="startingMoney"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Crime Multiplier</label>
              <input
                type="number"
                [(ngModel)]="configForm.crimeMultiplier"
                name="crimeMultiplier"
                step="0.1"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Roulette Channel ID</label>
              <input
                type="text"
                [(ngModel)]="configForm.rouletteChannelId"
                name="rouletteChannelId"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                placeholder="Optional"
              />
            </div>

            <div class="md:col-span-2">
              <button
                type="submit"
                [disabled]="saving()"
                class="bg-accent hover:bg-accent-hover text-text-primary px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {{ saving() ? 'Saving...' : 'Save Configuration' }}
              </button>
            </div>
          </form>
        </div>
      }
    </div>
  `,
})
export class EconomyComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  leaderboardState = createApiState<LeaderboardEntry[]>();
  configState = createApiState<EconomyConfig>();

  saving = signal(false);
  saveSuccess = signal(false);

  leaderboard = this.leaderboardState.data;
  configForm: Partial<EconomyConfig> = {};

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;

    this.leaderboardState.setLoading();
    this.http.get<LeaderboardEntry[]>(`/api/v1/economy/leaderboard/${guildId}`)
      .subscribe({
        next: (data) => this.leaderboardState.setData(data),
        error: (err) => this.leaderboardState.setError(err),
      });

    this.configState.setLoading();
    this.http.get<EconomyConfig>(`/api/v1/economy/config/${guildId}`)
      .subscribe({
        next: (data) => {
          this.configState.setData(data);
          this.configForm = { ...data };
        },
        error: (err) => this.configState.setError(err),
      });
  }

  saveConfig(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;
    this.saving.set(true);
    this.saveSuccess.set(false);

    this.http.patch<EconomyConfig>(`/api/v1/economy/config/${guildId}`, this.configForm)
      .subscribe({
        next: (data) => {
          this.configState.setData(data);
          this.configForm = { ...data };
          this.saving.set(false);
          this.saveSuccess.set(true);
          setTimeout(() => this.saveSuccess.set(false), 3000);
        },
        error: (err) => {
          this.saving.set(false);
          this.configState.setError(err);
        },
      });
  }
}
