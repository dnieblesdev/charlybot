import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { createApiState } from '../../shared/http/api-state';

interface VerificationRequest {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
  reviewedAt?: Date;
}

interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

@Component({
  selector: 'app-moderation',
  standalone: true,
  imports: [LoaderComponent, AlertComponent],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-text-primary mb-6">Moderation</h1>

      @if (state.loading()) {
        <app-loader />
      } @else if (state.error()) {
        <app-alert type="error" [message]="state.error()!" [retry]="loadData.bind(this)" />
      } @else {
        <div class="bg-bg-surface border border-border rounded-xl p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-semibold text-text-primary">Pending Verifications</h2>
            <span class="text-text-secondary text-sm">Total: {{ total() }}</span>
          </div>

          @if (!items() || items()!.length === 0) {
            <p class="text-text-secondary">No pending verifications</p>
          } @else {
            <div class="space-y-4">
              @for (verification of items()!; track verification.id) {
                <div class="bg-bg-base border border-border rounded-lg p-4">
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="text-text-primary font-medium">{{ verification.username || verification.userId }}</p>
                      <p class="text-text-secondary text-sm">User ID: {{ verification.userId }}</p>
                      <p class="text-text-secondary text-sm">Requested: {{ formatDate(verification.requestedAt) }}</p>
                    </div>
                    <div class="flex gap-2">
                      <button
                        (click)="approveVerification(verification.id)"
                        [disabled]="actionLoading()"
                        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        (click)="rejectVerification(verification.id)"
                        [disabled]="actionLoading()"
                        class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>

            @if (total() > pageSize()) {
              <div class="mt-4 flex justify-center gap-2">
                <button
                  (click)="prevPage()"
                  [disabled]="page() <= 1"
                  class="px-4 py-2 bg-bg-base border border-border rounded-lg text-text-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <span class="px-4 py-2 text-text-secondary">Page {{ page() }} of {{ totalPages() }}</span>
                <button
                  (click)="nextPage()"
                  [disabled]="page() >= totalPages()"
                  class="px-4 py-2 bg-bg-base border border-border rounded-lg text-text-secondary disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
})
export class ModerationComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  state = createApiState<PaginatedResponse<VerificationRequest>>();

  actionLoading = signal(false);
  total = signal(0);
  page = signal(1);
  pageSize = signal(50);

  items = signal<VerificationRequest[]>([]);
  verifications = this.state.data;

  totalPages = signal(1);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const guildId = this.route.parent!.snapshot.paramMap.get('guildId')!;
    this.state.setLoading();

    this.http.get<PaginatedResponse<VerificationRequest>>(
      `/api/v1/verifications/pending/${guildId}?page=${this.page()}&pageSize=${this.pageSize()}`
    )
      .subscribe({
        next: (data) => {
          this.state.setData(data);
          this.items.set(data.data);
          this.total.set(data.total);
          this.totalPages.set(Math.ceil(data.total / this.pageSize()));
        },
        error: (err) => this.state.setError(err),
      });
  }

  approveVerification(id: string): void {
    this.actionLoading.set(true);
    this.http.patch<VerificationRequest>(`/api/v1/verifications/${id}`, { status: 'APPROVED' })
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

  rejectVerification(id: string): void {
    this.actionLoading.set(true);
    this.http.patch<VerificationRequest>(`/api/v1/verifications/${id}`, { status: 'REJECTED' })
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

  prevPage(): void {
    if (this.page() > 1) {
      this.page.set(this.page() - 1);
      this.loadData();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.set(this.page() + 1);
      this.loadData();
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }
}
