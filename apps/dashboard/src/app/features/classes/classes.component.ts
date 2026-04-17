import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { createApiState } from '../../shared/http/api-state';

interface Subclass {
  name: string;
  roleId: string;
  guildId?: string;
}

interface ClassConfig {
  name: string;
  roleId: string;
  type: string;
  typeRoleId: string;
  subclasses: Subclass[];
  guildId: string;
}

interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [FormsModule, LoaderComponent, AlertComponent],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-text-primary mb-6">Classes</h1>

      @if (state.loading()) {
        <app-loader />
      } @else if (state.error()) {
        <app-alert type="error" [message]="state.error()!" [retry]="loadData.bind(this)" />
      } @else {
        <!-- Create Form -->
        <div class="bg-bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 class="text-lg font-semibold text-text-primary mb-4">Create Class</h2>

          @if (createSuccess()) {
            <app-alert type="success" message="Class created successfully!" />
          }

          <form (ngSubmit)="createClass()" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-text-secondary text-sm mb-1">Class Name</label>
                <input
                  type="text"
                  [(ngModel)]="createForm.name"
                  name="name"
                  required
                  class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label class="block text-text-secondary text-sm mb-1">Class Role ID</label>
                <input
                  type="text"
                  [(ngModel)]="createForm.roleId"
                  name="roleId"
                  required
                  class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label class="block text-text-secondary text-sm mb-1">Type (e.g., Warrior, Mage)</label>
                <input
                  type="text"
                  [(ngModel)]="createForm.type"
                  name="type"
                  required
                  class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label class="block text-text-secondary text-sm mb-1">Type Role ID</label>
                <input
                  type="text"
                  [(ngModel)]="createForm.typeRoleId"
                  name="typeRoleId"
                  required
                  class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label class="block text-text-secondary text-sm mb-1">Subclasses (comma-separated name:roleId)</label>
              <input
                type="text"
                [(ngModel)]="subclassesInput"
                name="subclasses"
                placeholder="e.g., Fire:123456, Ice:789012"
                class="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <button
              type="submit"
              [disabled]="creating()"
              class="bg-accent hover:bg-accent-hover text-text-primary px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {{ creating() ? 'Creating...' : 'Create Class' }}
            </button>
          </form>
        </div>

        <!-- List -->
        <div class="bg-bg-surface border border-border rounded-xl p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-semibold text-text-primary">Class List</h2>
            <span class="text-text-secondary text-sm">Total: {{ total() }}</span>
          </div>

          @if (!classItems() || classItems()!.length === 0) {
            <p class="text-text-secondary">No classes configured</p>
          } @else {
            <div class="space-y-4">
              @for (cls of classItems()!; track cls.name) {
                <div class="bg-bg-base border border-border rounded-lg p-4">
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="text-text-primary font-medium text-lg">{{ cls.name }}</p>
                      <p class="text-text-secondary text-sm">Role ID: {{ cls.roleId }}</p>
                      <p class="text-text-secondary text-sm">Type: {{ cls.type }} (Role: {{ cls.typeRoleId }})</p>
                    </div>
                    <button
                      (click)="deleteClass(cls.name)"
                      [disabled]="actionLoading()"
                      class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>

                  @if (cls.subclasses && cls.subclasses.length > 0) {
                    <div class="mt-3 pt-3 border-t border-border">
                      <p class="text-text-secondary text-sm mb-2">Subclasses:</p>
                      <div class="flex flex-wrap gap-2">
                        @for (sub of cls.subclasses; track sub.name) {
                          <span class="inline-flex items-center gap-1 bg-bg-surface px-2 py-1 rounded text-sm">
                            <span class="text-text-primary">{{ sub.name }}</span>
                            <span class="text-text-secondary">→ {{ sub.roleId }}</span>
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
export class ClassesComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  state = createApiState<PaginatedResponse<ClassConfig>>();

  creating = signal(false);
  actionLoading = signal(false);
  createSuccess = signal(false);
  total = signal(0);
  subclassesInput = '';

  classItems = signal<ClassConfig[]>([]);
  classes = this.state.data;

  createForm: Partial<ClassConfig> = {
    name: '',
    roleId: '',
    type: '',
    typeRoleId: '',
    subclasses: [],
  };

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;
    this.state.setLoading();

    this.http.get<PaginatedResponse<ClassConfig>>(`/api/v1/classes/guild/${guildId}`)
      .subscribe({
        next: (data) => {
          this.state.setData(data);
          this.classItems.set(data.data);
          this.total.set(data.total);
        },
        error: (err) => this.state.setError(err),
      });
  }

  createClass(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;
    this.creating.set(true);
    this.createSuccess.set(false);

    // Parse subclasses from input
    const subclasses: Subclass[] = [];
    if (this.subclassesInput.trim()) {
      const pairs = this.subclassesInput.split(',');
      for (const pair of pairs) {
        const [name, roleId] = pair.split(':').map(s => s.trim());
        if (name && roleId) {
          subclasses.push({ name, roleId, guildId });
        }
      }
    }

    const payload = {
      ...this.createForm,
      guildId,
      subclasses,
    };

    this.http.post<ClassConfig>(`/api/v1/classes`, payload)
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.createSuccess.set(true);
          this.createForm = {
            name: '',
            roleId: '',
            type: '',
            typeRoleId: '',
            subclasses: [],
          };
          this.subclassesInput = '';
          this.loadData();
          setTimeout(() => this.createSuccess.set(false), 3000);
        },
        error: (err) => {
          this.creating.set(false);
          this.state.setError(err);
        },
      });
  }

  deleteClass(name: string): void {
    if (!confirm(`Are you sure you want to delete the class "${name}"?`)) return;

    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;
    this.actionLoading.set(true);

    this.http.delete(`/api/v1/classes/guild/${guildId}/${encodeURIComponent(name)}`)
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
