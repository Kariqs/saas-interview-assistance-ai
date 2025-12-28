import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Auth, IUser } from '../../services/auth/auth';
import { IInterview, InterviewService } from '../../services/interview/interview';

interface InterviewSession {
  date: string;
  duration: string;
  status: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  username!: string;
  email!: string;
  abbrev!: string;
  recentSessions: IInterview[] = [];
  monthlySessionsCount!: number;
  user!: IUser;

  ngOnInit(): void {
    this.getUser();
    this.getInterviews();
    this.getUserInfo();
  }

  constructor(
    private router: Router,
    private authService: Auth,
    private interviewService: InterviewService,
    private toaster: ToastrService
  ) {}

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

  getUserInfo() {
    this.authService.getUser().subscribe({
      next: (response) => {
        if (response) {
          this.user = response.user;
        }
      },
      error: (error) => {
        this.toaster.error(error.message);
      },
    });
  }

  getInterviews() {
    this.interviewService.fetchInterviews().subscribe({
      next: (response) => {
        if (response) {
          this.recentSessions = response.interviews;
          this.monthlySessionsCount = response.count;
        }
      },
      error: (error) => {
        this.toaster.error(error.message);
      },
    });
  }

  formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const hrsStr = hrs.toString().padStart(2, '0');
    const minsStr = mins.toString().padStart(2, '0');
    const secsStr = secs.toString().padStart(2, '0');

    return `${hrsStr}:${minsStr}:${secsStr}`;
  }
}
