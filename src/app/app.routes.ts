import { Routes } from '@angular/router';
import { GotchYou } from './components/gotch-you/gotch-you';
import { Login } from './components/login/login';
import { Signup } from './components/signup/signup';
import { Dashboard } from './components/dashboard/dashboard';
import { Interview } from './components/interview/interview';
import { authGuard } from './services/guards/auth-guard';

export const routes: Routes = [
  { path: '', component: GotchYou },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'interview', component: Interview, canActivate: [authGuard] },
];
