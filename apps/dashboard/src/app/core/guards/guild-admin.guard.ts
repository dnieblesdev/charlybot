import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const guildAdminGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // In child routes, parent params are not in route.paramMap
  // Traverse up to find guildId from parent route
  let guildId: string | null = null;
  let current: ActivatedRouteSnapshot | null = route;
  while (current) {
    guildId = current.paramMap.get('guildId');
    if (guildId) break;
    current = current.parent;
  }

  if (!guildId) {
    return false;
  }

  const guilds = authService.guilds();
  const hasGuild = guilds.some((g) => g.id === guildId);

  if (hasGuild) {
    return true;
  }

  router.navigate(['/']);
  return false;
};
