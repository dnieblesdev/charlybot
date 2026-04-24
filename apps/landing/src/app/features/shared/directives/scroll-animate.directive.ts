import { Directive, ElementRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[scrollAnimate]',
  standalone: true,
  exportAs: 'scrollAnimate',
})
export class ScrollAnimateDirective {
  private readonly el = inject(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);

  isVisible = signal(!isPlatformBrowser(this.platformId));
  animationClass = signal<string | null>(null);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    let lastScrollY = window.scrollY;
    const element = this.el.nativeElement as HTMLElement;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const scrollingDown = window.scrollY >= lastScrollY;
        lastScrollY = window.scrollY;

        if (entry.isIntersecting && scrollingDown) {
          this.animationClass.set('fade-in-up');
          this.isVisible.set(true);
        } else if (!entry.isIntersecting && !scrollingDown) {
          this.animationClass.set('fade-out-down');
          this.isVisible.set(false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
  }
}
