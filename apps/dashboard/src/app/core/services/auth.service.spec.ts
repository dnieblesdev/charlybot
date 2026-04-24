import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('loadFromStorage', () => {
    it('should load user from localStorage', () => {
      const mockUser = { id: '123', username: 'test', avatar: 'abc' };
      localStorage.setItem('cb_user', JSON.stringify(mockUser));

      const freshService = new AuthService(TestBed.inject(HttpClientTestingModule as any));
      // Re-create service to trigger constructor
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [AuthService],
      });
      const newService = TestBed.inject(AuthService);

      expect(newService.user()).toEqual(mockUser);
    });

    it('should clear auth if localStorage has invalid JSON', () => {
      localStorage.setItem('cb_user', 'invalid-json');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [AuthService],
      });
      const newService = TestBed.inject(AuthService);

      expect(newService.user()).toBeNull();
      expect(localStorage.getItem('cb_user')).toBeNull();
    });

    it('should load guilds from localStorage', () => {
      const mockGuilds = [{ id: 'g1', name: 'Guild 1', icon: null, hasAccess: true }];
      localStorage.setItem('cb_guilds', JSON.stringify(mockGuilds));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [AuthService],
      });
      const newService = TestBed.inject(AuthService);

      expect(newService.guilds()).toEqual(mockGuilds);
    });
  });

  describe('setUser', () => {
    it('should update signals and localStorage', () => {
      const mockUser = { id: '123', username: 'test', avatar: 'abc' };
      const mockGuilds = [{ id: 'g1', name: 'Guild 1', icon: null, hasAccess: true }];

      service.setUser(mockUser as any, mockGuilds);

      expect(service.user()).toEqual(mockUser);
      expect(service.guilds()).toEqual(mockGuilds);
      expect(localStorage.getItem('cb_user')).toBe(JSON.stringify(mockUser));
      expect(localStorage.getItem('cb_guilds')).toBe(JSON.stringify(mockGuilds));
    });
  });

  describe('clearAuth', () => {
    it('should clear signals and localStorage', () => {
      const mockUser = { id: '123', username: 'test', avatar: 'abc' };
      service.setUser(mockUser as any, []);

      service.clearAuth();

      expect(service.user()).toBeNull();
      expect(service.guilds()).toEqual([]);
      expect(localStorage.getItem('cb_user')).toBeNull();
      expect(localStorage.getItem('cb_guilds')).toBeNull();
    });
  });

  describe('fetchProfile', () => {
    it('should fetch profile and call setUser', async () => {
      const mockResponse = {
        user: { id: '123', username: 'test', avatar: 'abc' },
        guilds: [{ id: 'g1', name: 'Guild 1', icon: null, hasAccess: true }],
      };

      const promise = service.fetchProfile();

      const req = httpMock.expectOne('/api/v1/auth/me');
      req.flush(mockResponse);

      await promise;

      expect(service.user()).toEqual(mockResponse.user);
      expect(service.guilds()).toEqual(mockResponse.guilds);
    });

    it('should clear auth on error', async () => {
      const promise = service.fetchProfile();

      const req = httpMock.expectOne('/api/v1/auth/me');
      req.flush(null, { status: 401, statusText: 'Unauthorized' });

      // Wait for the promise to settle (either resolve or reject)
      await promise.catch(() => {});
      expect(service.user()).toBeNull();
    });

    it('should set loading during fetch', async () => {
      expect(service.loading()).toBe(false);

      const promise = service.fetchProfile();
      expect(service.loading()).toBe(true);

      const req = httpMock.expectOne('/api/v1/auth/me');
      req.flush({ user: null, guilds: [] });

      await promise;
      expect(service.loading()).toBe(false);
    });
  });

  describe('logout', () => {
    it('should call logout endpoint and clear auth', async () => {
      const mockUser = { id: '123', username: 'test', avatar: 'abc' };
      service.setUser(mockUser as any, []);

      const promise = service.logout();

      const req = httpMock.expectOne('/api/v1/auth/logout');
      req.flush({});

      await promise;

      expect(service.user()).toBeNull();
    });

    it('should clear auth even if logout endpoint fails', async () => {
      const mockUser = { id: '123', username: 'test', avatar: 'abc' };
      service.setUser(mockUser as any, []);

      const promise = service.logout();

      const req = httpMock.expectOne('/api/v1/auth/logout');
      req.flush({}, { status: 500, statusText: 'Server Error' });

      await promise;

      expect(service.user()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should be false when no user', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should be true when user is set', () => {
      service.setUser({ id: '123', username: 'test', avatar: 'abc' } as any, []);
      expect(service.isAuthenticated()).toBe(true);
    });
  });
});
