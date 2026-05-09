import { Injectable, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface DiscordUser {
  userId: string;
  username: string;
  avatar: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly user = signal<DiscordUser | null>(null);
  private readonly loading = signal<boolean>(true);

  readonly currentUser = this.user.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);

  readonly avatarUrl = computed(() => {
    const u = this.user();
    if (!u?.avatar) return null;
    return `https://cdn.discordapp.com/avatars/${u.userId}/${u.avatar}.png?size=64`;
  });

  constructor(@Inject(PLATFORM_ID) private readonly platformId: Object) {
    if (isPlatformBrowser(platformId)) {
      this.checkSession();
    } else {
      this.loading.set(false);
    }
  }

  private async checkSession(): Promise<void> {
    try {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const profile = data.user ?? data;
        this.user.set({
          userId: profile.userId,
          username: profile.username,
          avatar: profile.avatar ?? null,
        });
      }
    } catch {
      // session check failed — treat as unauthenticated
    } finally {
      this.loading.set(false);
    }
  }

  async logout(): Promise<void> {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      this.user.set(null);
      this.loading.set(false);
    }
  }
}