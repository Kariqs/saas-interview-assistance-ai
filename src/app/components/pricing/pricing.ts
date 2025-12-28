import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pricing.html',
  styleUrl: './pricing.css',
})
export class Pricing {
  isLoading = false;
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient, private router: Router) {}

  buyCredits(plan: 'one' | 'two' | 'three'): void {
    this.isLoading = true;

    this.http.post(`${this.apiUrl}/create-checkout-session`, { type: 'credits', plan }).subscribe({
      next: (res: any) => {
        window.location.href = res.url;
      },
      error: (err) => {
        console.error('Payment error:', err);
        alert('There was an error initiating payment. Please try again.');
        this.isLoading = false;
      },
    });
  }

  contactAdmin(): void {
    this.router.navigate(['support']);
  }
}
