import { Component, input } from '@angular/core';

@Component({
  selector: 'app-alert',
  standalone: true,
  template: `
    <div
      class="rounded-lg p-4 mb-4"
      [class]="alertClass()"
    >
      <div class="flex items-start gap-3">
        @if (type() === 'error') {
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        } @else if (type() === 'success') {
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mt-0.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        } @else {
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        }
        <div class="flex-1">
          <p class="font-medium">{{ message() }}</p>
          @if (retry()) {
            <button
              (click)="retry()!"
              class="mt-2 text-sm underline hover:no-underline"
            >
              Reintentar
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class AlertComponent {
  type = input<'success' | 'error' | 'info'>('info');
  message = input<string>('');
  retry = input<(() => void) | null>(null);

  alertClass(): string {
    switch (this.type()) {
      case 'error':
        return 'bg-red-900/30 border border-red-700 text-red-200';
      case 'success':
        return 'bg-green-900/30 border border-green-700 text-green-200';
      default:
        return 'bg-blue-900/30 border border-blue-700 text-blue-200';
    }
  }
}
