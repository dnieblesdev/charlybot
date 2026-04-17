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
    // Read tokens from URL hash fragment (set by API callback redirect)
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (!accessToken || !refreshToken) {
      // No tokens in hash — redirect to login
      window.location.href = '/api/v1/auth/login';
      return;
    }

    // Store tokens
    this.authService.setTokens({ accessToken, refreshToken });

    // Fetch user profile and guilds, then navigate to dashboard
    this.authService.fetchProfile().then(() => {
      this.router.navigate(['/']);
    }).catch(() => {
      window.location.href = '/api/v1/auth/login';
    });
  }
}
