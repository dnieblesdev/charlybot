import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Cookies go automatically — no header injection needed
  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        window.location.href = '/api/v1/auth/login';
      }
      return throwError(() => error);
    })
  );
};
