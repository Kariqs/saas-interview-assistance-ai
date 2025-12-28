import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, throwError } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';

export interface IUser {
  username: string;
  email: string;
  activationKey?: string;
  accountActivated: boolean;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  tier: 'free' | '1hour' | '2hour' | '3hour';
  totalAllocatedMinutes: number;
  consumedMinutes: number;
  remainingMinutes: number;
  hasUsedFreeTier: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGetUserResponse {
  message: string;
  user: IUser;
}
export interface ISignup {
  username: string;
  email: string;
  password: string;
}
export interface IUserInfo {
  username: string;
  email: string;
}

export interface Ilogin {
  email: string;
  password: string;
}

export interface IJwtPayload {
  exp: number;
  username: string;
  email: string;
}

export interface IUserLoginResponse {
  message: string;
  user: IUserInfo;
  token: string;
  remainingMinutes: number;
  tier: string;
  hasUsedFreeTier: boolean;
}

export interface IUserSignUpResponse {
  message: string;
  user: IUserInfo;
}

export interface IGetCreditsResponse {
  remainingMinutes: number;
  tier: string;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  constructor(private http: HttpClient, private router: Router) {}

  apiUrl = environment.apiUrl;

  signup(signupInfo: ISignup): Observable<IUserSignUpResponse> {
    return this.http
      .post<IUserSignUpResponse>(`${this.apiUrl}/signup`, signupInfo)
      .pipe(catchError((error) => this.handleError(error)));
  }

  login(loginInfo: Ilogin): Observable<IUserLoginResponse> {
    return this.http
      .post<IUserLoginResponse>(`${this.apiUrl}/login`, loginInfo)
      .pipe(catchError((error) => this.handleError(error)));
  }

  getUser(): Observable<IGetUserResponse> {
    return this.http
      .get<IGetUserResponse>(`${this.apiUrl}/user`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  getUserCredits(): Observable<IGetCreditsResponse> {
    return this.http
      .get<IGetCreditsResponse>(`${this.apiUrl}/credits`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  isAuthenticated() {
    const token = localStorage.getItem('token');
    if (!token) {
      return false;
    }
    try {
      const decoded: IJwtPayload = jwtDecode(token);
      const isExpired = decoded.exp * 1000 < Date.now();
      if (isExpired) {
        localStorage.removeItem('token');
        return false;
      }
      return true;
    } catch (error) {
      localStorage.removeItem('token');
      return false;
    }
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['login']);
  }

  public handleError(error: HttpErrorResponse) {
    if (error.status === 401) {
      this.router.navigate(['login']);
    }

    let errorMsg = 'An unknown error occurred!';

    if (error.error) {
      if (error.error.message) {
        errorMsg = error.error.message;
      }
      if (error.error.details) {
        errorMsg += ` - ${error.error.details}`;
      }
    }
    return throwError(() => new Error(errorMsg));
  }

  public getUserInfo(): IUserInfo | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const decoded: IJwtPayload = jwtDecode(token);
      const userinfo: IUserInfo = {
        username: decoded.username,
        email: decoded.email,
      };
      return userinfo;
    } catch (error) {
      console.log(error);
      return null;
    }
  }
}
