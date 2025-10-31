import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, throwError } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

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

@Injectable({
  providedIn: 'root',
})
export class Auth {
  constructor(private http: HttpClient, private router: Router) {}

  apiUrl = 'http://localhost:3000';

  signup(signupInfo: ISignup): Observable<{
    message: string;
    user: {
      username: string;
      email: string;
    };
  }> {
    return this.http
      .post<{ message: string; user: { username: string; email: string } }>(
        `${this.apiUrl}/signup`,
        signupInfo
      )
      .pipe(catchError((error) => this.handleError(error)));
  }

  login(
    loginInfo: Ilogin
  ): Observable<{ message: string; user: { username: string; email: string }; token: string }> {
    return this.http
      .post<{
        message: string;
        user: { username: string; email: string };
        token: string;
      }>(`${this.apiUrl}/login`, loginInfo)
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
      this.router.navigate(['auth', 'login']);
    }

    let errorMsg = 'An unknown error occurred!';

    if (error.error) {
      if (error.error.message) {
        errorMsg = error.error.message; // Primary message
      }
      if (error.error.details) {
        errorMsg += ` - ${error.error.details}`; // Additional details
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
