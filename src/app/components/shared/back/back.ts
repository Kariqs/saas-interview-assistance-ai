import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-back',
  imports: [],
  templateUrl: './back.html',
  styleUrl: './back.css',
})
export class Back {
  constructor(private router: Router) {}
  backToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}
