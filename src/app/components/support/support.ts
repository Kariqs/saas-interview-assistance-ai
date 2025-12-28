import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';
import { Back } from '../shared/back/back';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Back],
  templateUrl: './support.html',
  styleUrl: './support.css',
})
export class Support {
  supportForm: FormGroup;
  isSubmitted = false;
  isSending = false;

  private apiUrl = `${environment.apiUrl}/support`;

  constructor(private fb: FormBuilder, private http: HttpClient, private toaster: ToastrService) {
    this.supportForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: [''],
      message: ['', [Validators.required, Validators.minLength(10)]],
    });
  }

  get f() {
    return this.supportForm.controls;
  }

  submitSupportRequest(): void {
    if (this.supportForm.invalid) {
      this.supportForm.markAllAsTouched();
      return;
    }

    this.isSending = true;

    const formData = this.supportForm.value;

    this.http.post(this.apiUrl, formData).subscribe({
      next: () => {
        this.isSubmitted = true;
        this.isSending = false;
      },
      error: (error) => {
        console.error('Support request failed:', error);
        this.toaster.error('Failed to send your message. Please try again later.');
        this.isSending = false;
      },
    });
  }

  resetForm(): void {
    this.isSubmitted = false;
    this.isSending = false;
    this.supportForm.reset();
  }
}
