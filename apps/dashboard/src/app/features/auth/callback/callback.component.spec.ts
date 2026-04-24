import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { CallbackComponent } from './callback.component';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('CallbackComponent', () => {
  let component: CallbackComponent;
  let fixture: ComponentFixture<CallbackComponent>;
  let router: Router;
  let authService: AuthService;
  let navigateSpy: jest.SpyInstance;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CallbackComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [AuthService],
    }).compileComponents();

    fixture = TestBed.createComponent(CallbackComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    authService = TestBed.inject(AuthService);
    navigateSpy = jest.spyOn(router, 'navigate');
  });

  describe('ngOnInit', () => {
    it('should navigate to home on successful fetch', async () => {
      const fetchProfileSpy = jest.spyOn(authService, 'fetchProfile').mockResolvedValue(undefined);

      component.ngOnInit();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(fetchProfileSpy).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/']);
    });

    it('should redirect to login on fetch failure', async () => {
      const fetchProfileSpy = jest.spyOn(authService, 'fetchProfile').mockRejectedValue(new Error('Auth failed'));

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      component.ngOnInit();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(fetchProfileSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
