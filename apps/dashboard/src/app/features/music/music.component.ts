import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { createApiState } from '../../shared/http/api-state';

interface MusicQueueItem {
  id: string;
  title: string;
  url: string;
  duration: number;
  thumbnail?: string;
  position: number;
  requesterId: string;
  requesterName: string;
}

interface MusicQueue {
  id: string;
  guildId: string;
  currentSongId?: string;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  loopMode: string;
  lastSeek: number;
  items?: MusicQueueItem[];
}

interface MusicConfig {
  guildId: string;
  defaultVolume: number;
  autoCleanup: boolean;
  maxQueueSize: number;
}

@Component({
  selector: 'app-music',
  standalone: true,
  imports: [FormsModule, LoaderComponent, AlertComponent],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-text-primary mb-6">Music</h1>

      @if (queueState.loading() || configState.loading()) {
        <app-loader />
      } @else if (queueState.error() || configState.error()) {
        <app-alert type="error" [message]="queueState.error() || configState.error() || ''" [retry]="loadData.bind(this)" />
      } @else {
        <!-- Queue -->
        <div class="bg-bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 class="text-lg font-semibold text-text-primary mb-4">Current Queue</h2>

          @if (!queue() || !queue()!.items || queue()!.items!.length === 0) {
            <p class="text-text-secondary">Queue is empty</p>
          } @else {
            <div class="space-y-2">
              @for (item of queue()!.items; track item.id) {
                <div class="flex justify-between items-center py-3 px-4 bg-bg-base rounded-lg">
                  <div class="flex-1">
                    <p class="text-text-primary">{{ item.title }}</p>
                    <p class="text-text-secondary text-sm">{{ item.requesterName }} • {{ formatDuration(item.duration) }}</p>
                  </div>
                  <span class="text-text-secondary text-sm">#{{ item.position + 1 }}</span>
                </div>
              }
            </div>
          }

          @if (queue()) {
            <div class="mt-4 pt-4 border-t border-border flex items-center gap-6">
              <div class="text-text-secondary text-sm">
                <span class="font-medium text-text-primary">Status:</span>
                {{ queue()!.isPlaying ? 'Playing' : queue()!.isPaused ? 'Paused' : 'Idle' }}
              </div>
              <div class="text-text-secondary text-sm">
                <span class="font-medium text-text-primary">Volume:</span>
                {{ queue()!.volume }}%
              </div>
              <div class="text-text-secondary text-sm">
                <span class="font-medium text-text-primary">Loop:</span>
                {{ queue()!.loopMode }}
              </div>
            </div>
          }
        </div>

        <!-- Config Form -->
        <div class="bg-bg-surface border border-border rounded-xl p-6">
          <h2 class="text-lg font-semibold text-text-primary mb-4">Music Configuration</h2>

          @if (saveSuccess()) {
            <app-alert type="success" message="Configuration saved successfully!" />
          }

          <form (ngSubmit)="saveConfig()" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-text-secondary text-sm mb-1">Default Volume</label>
                <input
                  type="number"
                  [(ngModel)]="configForm.defaultVolume"
                  name="defaultVolume"
                  min="0"
                  max="200"
                  class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label class="block text-text-secondary text-sm mb-1">Max Queue Size</label>
                <input
                  type="number"
                  [(ngModel)]="configForm.maxQueueSize"
                  name="maxQueueSize"
                  min="1"
                  class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div class="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  [(ngModel)]="configForm.autoCleanup"
                  name="autoCleanup"
                  id="autoCleanup"
                  class="w-4 h-4 rounded border-border bg-bg-base text-accent focus:ring-accent"
                />
                <label for="autoCleanup" class="text-text-secondary text-sm">Auto Cleanup</label>
              </div>
            </div>

            <button
              type="submit"
              [disabled]="saving()"
              class="bg-accent hover:bg-accent-hover text-text-primary px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {{ saving() ? 'Saving...' : 'Save Configuration' }}
            </button>
          </form>
        </div>
      }
    </div>
  `,
})
export class MusicComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  queueState = createApiState<MusicQueue>();
  configState = createApiState<MusicConfig>();

  saving = signal(false);
  saveSuccess = signal(false);

  queue = this.queueState.data;
  configForm: Partial<MusicConfig> = {};

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;

    this.queueState.setLoading();
    this.http.get<MusicQueue>(`/api/v1/music/queues/${guildId}`)
      .subscribe({
        next: (data) => this.queueState.setData(data),
        error: (err) => {
          if (err.status === 404) {
            // No queue yet — treat as empty
            this.queueState.setData({
              id: '', guildId, isPlaying: false, isPaused: false,
              volume: 50, loopMode: 'none', lastSeek: 0, items: [],
            });
          } else {
            this.queueState.setError(err);
          }
        },
      });

    this.configState.setLoading();
    this.http.get<MusicConfig>(`/api/v1/music/config/${guildId}`)
      .subscribe({
        next: (data) => {
          this.configState.setData(data);
          this.configForm = { ...data };
        },
        error: (err) => {
          if (err.status === 404) {
            // No config yet — use defaults so user can create one
            const defaults: MusicConfig = { guildId, defaultVolume: 50, autoCleanup: true, maxQueueSize: 50 };
            this.configState.setData(defaults);
            this.configForm = { ...defaults };
          } else {
            this.configState.setError(err);
          }
        },
      });
  }

  saveConfig(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;
    this.saving.set(true);
    this.saveSuccess.set(false);

    this.http.put<MusicConfig>(`/api/v1/music/config/${guildId}`, this.configForm)
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

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
