import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { Auth } from '../../services/auth/auth';

interface InterviewSession {
  date: string;
  duration: string;
  status: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  username!: string;
  email!: string;
  abbrev!: string;
  recentSessions: InterviewSession[] = [
    { date: 'Oct 8, 2025', duration: '45 min', status: 'Completed' },
    { date: 'Oct 5, 2025', duration: '60 min', status: 'Completed' },
    { date: 'Oct 2, 2025', duration: '50 min', status: 'Completed' },
    { date: 'Sep 28, 2025', duration: '55 min', status: 'Completed' },
    { date: 'Sep 25, 2025', duration: '40 min', status: 'Completed' },
  ];

  ngOnInit(): void {
    this.getUser();
  }

  constructor(private router: Router, private authService: Auth) {}

  onLogout() {
    this.authService.logout();
  }

  getUser() {
    const userInfo = this.authService.getUserInfo();
    if (userInfo) {
      this.username = userInfo.username;
      this.email = userInfo.email;
      this.abbrev = userInfo.username[0];
    }
  }

  startInterview() {
    this.router.navigate(['interview']);
  }
}
