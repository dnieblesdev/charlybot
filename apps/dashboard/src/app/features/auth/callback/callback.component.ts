import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  template: `
    <div class="flex items-center justify-center min-h-screen bg-bg-base">
      <div class="text-center">
        <div class="text-2xl font-semibold text-text-primary mb-2">Authenticating...</div>
        <div class="text-text-secondary">Please wait while we connect to Discord.</div>
      </div>
    </div>
  `,
})
export class CallbackComponent implements OnInit {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Backend already set HttpOnly cookies — just fetch profile
    this.authService.fetchProfile()
      .then(() => this.router.navigate(['/']))
      .catch(() => {
        window.location.href = '/api/v1/auth/login';
      });
  }
}
