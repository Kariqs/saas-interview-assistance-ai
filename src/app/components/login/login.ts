import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth/auth';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  loginForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: Auth,
    private toaster: ToastrService
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      const { rememberMe, ...loginData } = this.loginForm.value;
      this.authService.login(loginData).subscribe({
        next: (response) => {
          if (response) {
            localStorage.setItem('token', response.token);
            if (response.remainingMinutes > 0) {
              this.router.navigate(['dashboard']).then(() => {
                this.toaster.info(response.message);
              });
            } else {
              this.router.navigate(['access']).then(() => {
                this.toaster.warning(
                  'You are out of interview credits. Purchase credits to continue'
                );
              });
            }
          }
        },
        error: (error) => {
          this.toaster.error(error.message);
        },
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.loginForm.controls).forEach((key) => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }

  onCreateAccount() {
    this.router.navigate(['signup']);
  }
}
