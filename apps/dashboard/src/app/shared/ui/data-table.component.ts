import { Component, input } from '@angular/core';

export interface TableColumn {
  key: string;
  label: string;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  template: `
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border">
            @for (col of columns(); track col.key) {
              <th class="text-left py-3 px-4 text-text-secondary font-medium text-sm">{{ col.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @if (loading()) {
            <tr>
              <td [attr.colspan]="columns().length" class="py-8 text-center text-text-secondary">
                Cargando...
              </td>
            </tr>
          } @else if (data().length === 0) {
            <tr>
              <td [attr.colspan]="columns().length" class="py-8 text-center text-text-secondary">
                No hay datos
              </td>
            </tr>
          } @else {
            @for (row of data(); track $index) {
              <tr class="border-b border-border hover:bg-bg-surface/50 transition-colors">
                @for (col of columns(); track col.key) {
                  <td class="py-3 px-4 text-text-primary">
                    <ng-content [select]="'[slot=' + col.key + ']'" />
                    {{ getValue(row, col.key) }}
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
})
export class DataTableComponent {
  columns = input<TableColumn[]>([]);
  data = input<any[]>([]);
  loading = input<boolean>(false);

  getValue(row: any, key: string): any {
    return row[key];
  }
}
