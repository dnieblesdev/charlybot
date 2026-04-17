import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { createApiState } from '../../shared/http/api-state';

interface GuildConfig {
  guildId: string;
  name?: string;
  targetChannelId?: string;
  voiceLogChannelId?: string;
  welcomeChannelId?: string;
  welcomeMessage?: string;
  leaveLogChannelId?: string;
  verificationChannelId?: string;
  verificationReviewChannelId?: string;
  verifiedRoleId?: string;
  messageLogChannelId?: string;
}

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [FormsModule, LoaderComponent, AlertComponent],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-text-primary mb-6">Guild Configuration</h1>

      @if (state.loading()) {
        <app-loader />
      } @else if (state.error()) {
        <app-alert type="error" [message]="state.error()!" [retry]="loadConfig.bind(this)" />
      } @else {
        <form (ngSubmit)="saveConfig()" class="max-w-2xl space-y-6">
          @if (successMessage()) {
            <app-alert type="success" [message]="successMessage()!" />
          }

          <div class="bg-bg-surface border border-border rounded-xl p-6 space-y-4">
            <h2 class="text-lg font-semibold text-text-primary">Channels</h2>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Welcome Channel ID</label>
              <input
                type="text"
                [(ngModel)]="formData.welcomeChannelId"
                name="welcomeChannelId"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                placeholder="Channel ID"
              />
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Verification Channel ID</label>
              <input
                type="text"
                [(ngModel)]="formData.verificationChannelId"
                name="verificationChannelId"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                placeholder="Channel ID"
              />
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Voice Log Channel ID</label>
              <input
                type="text"
                [(ngModel)]="formData.voiceLogChannelId"
                name="voiceLogChannelId"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                placeholder="Channel ID"
              />
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Message Log Channel ID</label>
              <input
                type="text"
                [(ngModel)]="formData.messageLogChannelId"
                name="messageLogChannelId"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                placeholder="Channel ID"
              />
            </div>
          </div>

          <div class="bg-bg-surface border border-border rounded-xl p-6 space-y-4">
            <h2 class="text-lg font-semibold text-text-primary">Welcome Message</h2>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Welcome Message</label>
              <textarea
                [(ngModel)]="formData.welcomeMessage"
                name="welcomeMessage"
                rows="3"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                placeholder="Welcome message..."
              ></textarea>
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Verified Role ID</label>
              <input
                type="text"
                [(ngModel)]="formData.verifiedRoleId"
                name="verifiedRoleId"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                placeholder="Role ID"
              />
            </div>
          </div>

          <div class="flex items-center gap-4">
            <button
              type="submit"
              [disabled]="saving()"
              class="bg-accent hover:bg-accent-hover text-text-primary px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {{ saving() ? 'Saving...' : 'Save Configuration' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class ConfigComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  state = createApiState<GuildConfig>();
  saving = signal(false);
  successMessage = signal<string | null>(null);

  formData: Partial<GuildConfig> = {};

  ngOnInit(): void {
    this.loadConfig();
  }

  loadConfig(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;
    this.state.setLoading();

    this.http.get<GuildConfig>(`/api/v1/guilds/${guildId}/config`)
      .subscribe({
        next: (data) => {
          this.state.setData(data);
          this.formData = { ...data };
        },
        error: (err) => this.state.setError(err),
      });
  }

  saveConfig(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;
    this.saving.set(true);
    this.successMessage.set(null);

    this.http.patch<GuildConfig>(`/api/v1/guilds/${guildId}/config`, this.formData)
      .subscribe({
        next: (data) => {
          this.state.setData(data);
          this.formData = { ...data };
          this.saving.set(false);
          this.successMessage.set('Configuration saved successfully!');
          setTimeout(() => this.successMessage.set(null), 3000);
        },
        error: (err) => {
          this.saving.set(false);
          this.state.setError(err);
        },
      });
  }
}
