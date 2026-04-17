import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loader',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center py-12">
      <div class="animate-spin rounded-full h-10 w-10 border-4 border-accent border-t-transparent"></div>
      <p class="text-text-secondary mt-4">Cargando...</p>
    </div>
  `,
})
export class LoaderComponent {}
