import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { HttpClient } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const http = inject(HttpClient);
  const publicPaths = ['/api/v1/auth/login', '/api/v1/auth/callback', '/api/v1/auth/refresh'];

  // Skip auth for public paths
  if (publicPaths.some((path) => req.url.includes(path))) {
    return next(req);
  }

  // Skip if not an API request
  if (!req.url.includes('/api/v1/')) {
    return next(req);
  }

  const accessToken = authService.getAccessToken();
  const headers: Record<string, string> = {};

  // API requires X-API-Key for all /api/* routes
  headers['X-API-Key'] = 'charly_secret_key';

  // Add JWT if available
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const authenticatedReq = req.clone({ setHeaders: headers });

  return next(authenticatedReq).pipe(
    catchError((error) => {
      // Try refresh for any 401, but avoid infinite loops by not refreshing if already on refresh endpoint
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        const refreshToken = authService.getRefreshToken();

        if (refreshToken) {
          return http
            .post<{ accessToken: string }>('/api/v1/auth/refresh', { refreshToken })
            .pipe(
              switchMap((res) => {
                authService.setTokens({ accessToken: res.accessToken, refreshToken });
                const newReq = req.clone({
                  setHeaders: {
                    'X-API-Key': 'charly_secret_key',
                    Authorization: `Bearer ${res.accessToken}`,
                  },
                });
                return next(newReq);
              }),
              catchError(() => {
                authService.clearAuth();
                window.location.href = '/api/v1/auth/login';
                return throwError(() => error);
              })
            );
        } else {
          authService.clearAuth();
          window.location.href = '/api/v1/auth/login';
        }
      }
      return throwError(() => error);
    })
  );
};
