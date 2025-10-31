import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-gotch-you',
  imports: [],
  templateUrl: './gotch-you.html',
  styleUrl: './gotch-you.css',
})
export class GotchYou {
  constructor(private router: Router) {}
  accessSystem() {
    this.router.navigate(['dashboard']);
  }
}
