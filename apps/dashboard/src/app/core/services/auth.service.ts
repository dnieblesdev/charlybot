import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthUser, AuthTokens, FilteredGuild } from '../../shared/types/auth.types';

const STORAGE_KEYS = {
  accessToken: 'cb_access_token',
  refreshToken: 'cb_refresh_token',
  user: 'cb_user',
  guilds: 'cb_guilds',
} as const;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _guilds = signal<FilteredGuild[]>([]);
  private readonly _tokens = signal<AuthTokens | null>(null);

  readonly user = this._user.asReadonly();
  readonly guilds = this._guilds.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());

  constructor(private http: HttpClient) {
    this.loadFromStorage();
  }

  loadFromStorage(): void {
    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
    const userJson = localStorage.getItem(STORAGE_KEYS.user);
    const guildsJson = localStorage.getItem(STORAGE_KEYS.guilds);

    if (accessToken && refreshToken) {
      this._tokens.set({ accessToken, refreshToken });
    }

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

  setTokens(tokens: AuthTokens): void {
    this._tokens.set(tokens);
    localStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken);
    localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refreshToken);
  }

  getAccessToken(): string | null {
    return this._tokens()?.accessToken ?? null;
  }

  getRefreshToken(): string | null {
    return this._tokens()?.refreshToken ?? null;
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
    this._tokens.set(null);
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.guilds);
  }

  fetchProfile(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<{ user: AuthUser; guilds: FilteredGuild[] }>('/api/v1/auth/me')
        .subscribe({
          next: (res) => {
            this.setUser(res.user, res.guilds);
            resolve();
          },
          error: (err) => {
            this.clearAuth();
            reject(err);
          },
        });
    });
  }
}
