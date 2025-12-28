import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { Auth } from '../auth/auth';

export const remainingTimeGuard: CanActivateFn = (route, state) => {
  const authService = inject(Auth);
  const router = inject(Router);
  const toastr = inject(ToastrService);

  return authService.getUser().pipe(
    map((response) => {
      if (!response || !response.user) {
        router.navigate(['/login']);
        return false;
      }

      const remainingMinutes = response.user.remainingMinutes ?? 0;

      if (remainingMinutes > 0) {
        return true;
      }

      router.navigate(['/pricing']).then(() => {
        toastr.warning(
          'You are out of interview credits. Purchase credits to continue',
          'Access Denied'
        );
      });
      return false;
    }),
    catchError((error) => {
      console.error('Error checking remaining time:', error);
      toastr.error('Failed to verify your account status.');
      router.navigate(['/login']);
      return of(false);
    })
  );
};
