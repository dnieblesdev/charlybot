import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthUser, FilteredGuild } from '../../shared/types/auth.types';

const STORAGE_KEYS = {
  user: 'cb_user',
  guilds: 'cb_guilds',
} as const;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _guilds = signal<FilteredGuild[]>([]);
  private readonly _loading = signal(false);

  readonly user = this._user.asReadonly();
  readonly guilds = this._guilds.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());

  constructor(private http: HttpClient) {
    this.loadFromStorage();
  }

  loadFromStorage(): void {
    const userJson = localStorage.getItem(STORAGE_KEYS.user);
    const guildsJson = localStorage.getItem(STORAGE_KEYS.guilds);

    if (userJson) {
      try {
        this._user.set(JSON.parse(userJson));
      } catch {
        this.clearAuth();
      }
    }

    if (guildsJson) {
      try {
        this._guilds.set(JSON.parse(guildsJson));
      } catch {
        this._guilds.set([]);
      }
    }
  }

  setUser(user: AuthUser, guilds: FilteredGuild[]): void {
    this._user.set(user);
    this._guilds.set(guilds);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.guilds, JSON.stringify(guilds));
  }

  clearAuth(): void {
    this._user.set(null);
    this._guilds.set([]);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.guilds);
  }

  async fetchProfile(): Promise<void> {
    this._loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ user: AuthUser; guilds: FilteredGuild[] }>('/api/v1/auth/me')
      );
      this.setUser(res.user, res.guilds);
    } catch (err) {
      this.clearAuth();
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/v1/auth/logout', {}));
    } catch {
      // Ignore errors
    }
    this.clearAuth();
  }
}
