import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guildAdminGuard } from './core/guards/guild-admin.guard';

export const routes: Routes = [
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/callback/callback.component').then(
        (m) => m.CallbackComponent
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/guilds/guild-selector/guild-selector.component').then(
        (m) => m.GuildSelectorComponent
      ),
  },
  {
    path: ':guildId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/dashboard-layout/dashboard-layout.component').then(
        (m) => m.DashboardLayoutComponent
      ),
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      {
        path: 'overview',
        canActivate: [guildAdminGuard],
        loadComponent: () =>
          import('./features/overview/overview.component').then(
            (m) => m.OverviewComponent
          ),
      },
      {
        path: 'config',
        canActivate: [guildAdminGuard],
        loadComponent: () =>
          import('./features/config/config.component').then(
            (m) => m.ConfigComponent
          ),
      },
      {
        path: 'economy',
        canActivate: [guildAdminGuard],
        loadComponent: () =>
          import('./features/economy/economy.component').then(
            (m) => m.EconomyComponent
          ),
      },
      {
        path: 'users',
        canActivate: [guildAdminGuard],
        loadComponent: () =>
          import('./features/users/users.component').then(
            (m) => m.UsersComponent
          ),
      },
      {
        path: 'users/:userId',
        canActivate: [guildAdminGuard],
        loadComponent: () =>
          import('./features/users/user-detail/user-detail.component').then(
            (m) => m.UserDetailComponent
          ),
      },
      {
        path: 'music',
        canActivate: [guildAdminGuard],
        loadComponent: () =>
          import('./features/music/music.component').then(
            (m) => m.MusicComponent
          ),
      },
      {
        path: 'moderation',
        canActivate: [guildAdminGuard],
        loadComponent: () =>
          import('./features/moderation/moderation.component').then(
            (m) => m.ModerationComponent
          ),
      },
      {
        path: 'autoroles',
        canActivate: [guildAdminGuard],
        loadComponent: () =>
          import('./features/autoroles/autoroles.component').then(
            (m) => m.AutorolesComponent
          ),
      },
      {
        path: 'classes',
        canActivate: [guildAdminGuard],
        loadComponent: () =>
          import('./features/classes/classes.component').then(
            (m) => m.ClassesComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
