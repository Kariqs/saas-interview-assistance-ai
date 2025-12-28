import { Routes } from '@angular/router';
import { UsersComponent } from './components/admin/users/users';
import { Dashboard } from './components/dashboard/dashboard';
import { GotchYou } from './components/gotch-you/gotch-you';
import { Interview } from './components/interview/interview';
import { Login } from './components/login/login';
import { Pricing } from './components/pricing/pricing';
import { Signup } from './components/signup/signup';
import { Support } from './components/support/support';
import { authGuard } from './services/guards/auth-guard';
import { Notfound } from './components/notfound/notfound';
import { remainingTimeGuard } from './services/guards/time-guard';

export const routes: Routes = [
  { path: '', component: GotchYou },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: '404', component: Notfound },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard, remainingTimeGuard] },
  { path: 'interview', component: Interview, canActivate: [authGuard, remainingTimeGuard] },
  { path: 'support', component: Support, canActivate: [authGuard] },
  { path: 'pricing', component: Pricing, canActivate: [authGuard] },
  { path: 'admin', component: UsersComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '404' },
];
