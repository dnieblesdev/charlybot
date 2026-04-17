import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <div class="bg-bg-surface border border-border rounded-xl p-6">
      <div class="text-text-secondary text-sm mb-1">{{ label() }}</div>
      <div class="text-2xl font-bold text-text-primary">{{ value() }}</div>
    </div>
  `,
})
export class StatCardComponent {
  label = input<string>('');
  value = input<string>('');
}
