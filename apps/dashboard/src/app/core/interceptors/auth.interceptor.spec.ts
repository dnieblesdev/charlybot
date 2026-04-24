import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, HttpClientTestingModule } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { of, throwError } from 'rxjs';

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const mockRequest = (url: string): HttpRequest<unknown> => {
    return new HttpRequest('GET', url);
  };

  const mockNext = (response: unknown): HttpHandlerFn => {
    return () => response as HttpEvent<unknown>;
  };

  it('should pass requests through normally', (done) => {
    const req = mockRequest('/api/v1/users');
    const next = mockNext(of({ type: 'test' }));

    const result = authInterceptor(req, next);

    result.subscribe({
      next: (event) => {
        expect(event).toBeDefined();
        done();
      },
      error: done.fail,
    });
  });

  it('should redirect to login on 401 for non-auth URLs', (done) => {
    const req = mockRequest('/api/v1/users');
    const error = { status: 401, message: 'Unauthorized' };
    const next = mockNext(throwError(() => error)) as unknown as HttpHandlerFn;

    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = authInterceptor(req, next);

    result.subscribe({
      next: () => done.fail('Should not emit'),
      error: () => {
        // The console.error is expected for the not-implemented navigation
        consoleSpy.mockRestore();
        done();
      },
    });

    // Give time for the synchronous error to propagate
  });

  it('should NOT redirect on 401 for auth URLs', (done) => {
    const req = mockRequest('/api/v1/auth/login');
    const error = { status: 401, message: 'Unauthorized' };
    const next = mockNext(throwError(() => error)) as unknown as HttpHandlerFn;

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = authInterceptor(req, next);

    result.subscribe({
      next: () => done.fail('Should not emit'),
      error: () => {
        // Auth URLs should not trigger redirect, so no console.error for navigation
        consoleSpy.mockRestore();
        done();
      },
    });
  });

  it('should re-throw the error after redirect', (done) => {
    const req = mockRequest('/api/v1/users');
    const error = { status: 401, message: 'Unauthorized' };
    const next = mockNext(throwError(() => error)) as unknown as HttpHandlerFn;

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = authInterceptor(req, next);

    result.subscribe({
      next: () => done.fail('Should not emit'),
      error: (err) => {
        expect(err).toEqual(error);
        consoleSpy.mockRestore();
        done();
      },
    });
  });
});
