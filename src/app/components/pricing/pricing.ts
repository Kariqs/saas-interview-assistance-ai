import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';

const priceIds = {
  sixty: 'price_1SjFBJFZ79d2YXeIwfCf9zb5',
  oneTwenty: 'price_1SjFCMFZ79d2YXeIbHoPAvU5',
  oneEighty: 'price_1SjFCwFZ79d2YXeIQKvjLo3d',
};

type PlanKey = keyof typeof priceIds;

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pricing.html',
  styleUrl: './pricing.css',
})
export class Pricing implements OnInit {
  loading: Record<PlanKey, boolean> = {
    sixty: false,
    oneTwenty: false,
    oneEighty: false,
  };

  showSuccess = false;
  showCanceled = false;

  constructor(
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;

    if (params['success']) {
      this.showSuccess = true;
      this.toastr.success('Credits added successfully! Enjoy practicing.', 'Success!', {
        timeOut: 8000,
      });
    }

    if (params['canceled']) {
      this.showCanceled = true;
      this.toastr.info('Payment was canceled. No credits were charged.', 'Canceled');
    }
  }

  async buy(plan: PlanKey): Promise<void> {
    this.loading[plan] = true;

    try {
      if (!window.electronAPI?.openExternal) {
        throw new Error('Electron bridge unavailable');
      }

      const token = localStorage.getItem('token');
      if (!token) {
        this.toastr.error('Please log in to purchase credits');
        return;
      }

      const response = await fetch(`${environment.apiUrl}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ priceId: priceIds[plan] }),
      });

      if (!response.ok) {
        throw new Error('Checkout session failed');
      }

      const data = await response.json();

      if (!data?.url) {
        throw new Error('Invalid checkout response');
      }

      await window.electronAPI.openExternal(data.url);

      this.toastr.success('Opening secure checkout in your browser...', 'Redirecting', {
        timeOut: 5000,
      });
    } catch (err) {
      console.error(err);
      this.toastr.error('Unable to start checkout. Please try again.', 'Checkout Error');
    } finally {
      this.loading[plan] = false;
    }
  }

  contactAdmin(): void {
    this.router.navigate(['/support']);
  }
}
