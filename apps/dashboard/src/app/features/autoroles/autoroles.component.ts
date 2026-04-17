import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { createApiState } from '../../shared/http/api-state';

interface RoleMapping {
  id?: number;
  roleId: string;
  type: 'reaction' | 'button';
  emoji?: string;
  buttonLabel?: string;
  buttonStyle?: string;
  order: number;
}

interface AutoRole {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string;
  mode: 'multiple' | 'unique';
  embedTitle?: string;
  embedDesc?: string;
  embedColor?: string;
  embedFooter?: string;
  embedThumb?: string;
  embedImage?: string;
  embedTimestamp?: boolean;
  embedAuthor?: string;
  createdBy: string;
  mappings: RoleMapping[];
}

interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

@Component({
  selector: 'app-autoroles',
  standalone: true,
  imports: [FormsModule, LoaderComponent, AlertComponent],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-text-primary mb-6">AutoRoles</h1>

      @if (state.loading()) {
        <app-loader />
      } @else if (state.error()) {
        <app-alert type="error" [message]="state.error()!" [retry]="loadData.bind(this)" />
      } @else {
        <!-- Create Form -->
        <div class="bg-bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 class="text-lg font-semibold text-text-primary mb-4">Create AutoRole</h2>

          @if (createSuccess()) {
            <app-alert type="success" message="AutoRole created successfully!" />
          }

          <form (ngSubmit)="createAutoRole()" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-text-secondary text-sm mb-1">Channel ID</label>
              <input
                type="text"
                [(ngModel)]="createForm.channelId"
                name="channelId"
                required
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Message ID</label>
              <input
                type="text"
                [(ngModel)]="createForm.messageId"
                name="messageId"
                required
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Mode</label>
              <select
                [(ngModel)]="createForm.mode"
                name="mode"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="multiple">Multiple</option>
                <option value="unique">Unique</option>
              </select>
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Embed Title</label>
              <input
                type="text"
                [(ngModel)]="createForm.embedTitle"
                name="embedTitle"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div class="md:col-span-2">
              <label class="block text-text-secondary text-sm mb-1">Embed Description</label>
              <textarea
                [(ngModel)]="createForm.embedDesc"
                name="embedDesc"
                rows="2"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              ></textarea>
            </div>

            <div class="md:col-span-2">
              <button
                type="submit"
                [disabled]="creating()"
                class="bg-accent hover:bg-accent-hover text-text-primary px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {{ creating() ? 'Creating...' : 'Create AutoRole' }}
              </button>
            </div>
          </form>
        </div>

        <!-- List -->
        <div class="bg-bg-surface border border-border rounded-xl p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-semibold text-text-primary">AutoRole List</h2>
            <span class="text-text-secondary text-sm">Total: {{ total() }}</span>
          </div>

          @if (!autoRoleItems() || autoRoleItems()!.length === 0) {
            <p class="text-text-secondary">No autoroles configured</p>
          } @else {
            <div class="space-y-4">
              @for (autorole of autoRoleItems()!; track autorole.id) {
                <div class="bg-bg-base border border-border rounded-lg p-4">
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="text-text-primary font-medium">{{ autorole.embedTitle || 'AutoRole #' + autorole.id }}</p>
                      <p class="text-text-secondary text-sm">Channel: {{ autorole.channelId }}</p>
                      <p class="text-text-secondary text-sm">Mode: {{ autorole.mode }}</p>
                      <p class="text-text-secondary text-sm">Mappings: {{ autorole.mappings?.length || 0 }}</p>
                    </div>
                    <div class="flex gap-2">
                      <button
                        (click)="deleteAutoRole(autorole.id)"
                        [disabled]="actionLoading()"
                        class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  @if (autorole.mappings && autorole.mappings.length > 0) {
                    <div class="mt-3 pt-3 border-t border-border">
                      <p class="text-text-secondary text-sm mb-2">Role Mappings:</p>
                      <div class="flex flex-wrap gap-2">
                        @for (mapping of autorole.mappings; track mapping.id) {
                          <span class="inline-flex items-center gap-1 bg-bg-surface px-2 py-1 rounded text-sm">
                            @if (mapping.type === 'reaction' && mapping.emoji) {
                              <span>{{ mapping.emoji }}</span>
                            } @else if (mapping.type === 'button' && mapping.buttonLabel) {
                              <span>{{ mapping.buttonLabel }}</span>
                            }
                            <span class="text-text-secondary">→ {{ mapping.roleId }}</span>
                          </span>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AutorolesComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  state = createApiState<PaginatedResponse<AutoRole>>();

  creating = signal(false);
  actionLoading = signal(false);
  createSuccess = signal(false);
  total = signal(0);

  autoRoleItems = signal<AutoRole[]>([]);
  autoroles = this.state.data;

  createForm: Partial<AutoRole> & { mappings?: RoleMapping[] } = {
    channelId: '',
    messageId: '',
    mode: 'multiple',
    embedTitle: '',
    embedDesc: '',
    mappings: [],
  };

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;
    this.state.setLoading();

    this.http.get<PaginatedResponse<AutoRole>>(`/api/v1/autoroles/guild/${guildId}`)
      .subscribe({
        next: (data) => {
          this.state.setData(data);
          this.autoRoleItems.set(data.data);
          this.total.set(data.total);
        },
        error: (err) => this.state.setError(err),
      });
  }

  createAutoRole(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;
    this.creating.set(true);
    this.createSuccess.set(false);

    const payload = {
      ...this.createForm,
      guildId,
      createdBy: '',
      mappings: [],
    };

    this.http.post<AutoRole>(`/api/v1/autoroles`, payload)
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.createSuccess.set(true);
          this.createForm = {
            channelId: '',
            messageId: '',
            mode: 'multiple',
            embedTitle: '',
            embedDesc: '',
            mappings: [],
          };
          this.loadData();
          setTimeout(() => this.createSuccess.set(false), 3000);
        },
        error: (err) => {
          this.creating.set(false);
          this.state.setError(err);
        },
      });
  }

  deleteAutoRole(id: number): void {
    if (!confirm('Are you sure you want to delete this AutoRole?')) return;

    this.actionLoading.set(true);
    this.http.delete(`/api/v1/autoroles/${id}`)
      .subscribe({
        next: () => {
          this.actionLoading.set(false);
          this.loadData();
        },
        error: (err) => {
          this.actionLoading.set(false);
          this.state.setError(err);
        },
      });
  }
}
