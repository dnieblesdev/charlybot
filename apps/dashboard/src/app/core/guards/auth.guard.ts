import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Always validate session with server to get fresh guild data.
  // This ensures guilds are never stale from localStorage alone.
  try {
    await authService.fetchProfile();
    return true;
  } catch {
    // fetchProfile clears auth on failure — redirect to login
    window.location.href = '/api/v1/auth/login';
    return false;
  }
};
