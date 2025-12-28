import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { Auth } from '../auth/auth';
import { environment } from '../../../environments/environment';

export interface IInterview {
  _id?: string;
  date: string;
  timeTaken: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICreateInterviewResponse {
  message: string;
  interviewId: string;
}

export interface IFetchInterviewsResponse {
  message: string;
  interviews: IInterview[];
  count: number;
}

export interface IDeleteInterviewResponse {
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class InterviewService {
  constructor(private http: HttpClient, private authService: Auth) {}
  apiUrl = environment.apiUrl;

  createInterview(interviewInfo: IInterview): Observable<ICreateInterviewResponse> {
    return this.http
      .post<ICreateInterviewResponse>(`${this.apiUrl}/interview`, interviewInfo)
      .pipe(catchError((error) => this.authService.handleError(error)));
  }

  fetchInterviews(): Observable<IFetchInterviewsResponse> {
    return this.http
      .get<IFetchInterviewsResponse>(`${this.apiUrl}/interviews`)
      .pipe(catchError((error) => this.authService.handleError(error)));
  }

  deleteInterview(id: string): Observable<IDeleteInterviewResponse> {
    return this.http
      .delete<IDeleteInterviewResponse>(`${this.apiUrl}/interview/${id}`)
      .pipe(catchError((error) => this.authService.handleError(error)));
  }
}
