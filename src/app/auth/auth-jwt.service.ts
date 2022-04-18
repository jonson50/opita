import { Injectable } from '@angular/core';
import decode from 'jwt-decode';
import { BehaviorSubject, Observable, pipe, throwError } from 'rxjs';
import { catchError, filter, map, mergeMap, tap } from 'rxjs/operators';

import { transformError } from '../_helpers/common';
import { IUser, User } from '../_models/user';
import { Role } from './auth.enum';
import { CacheService } from '../_services/cache.service';

export interface IAuthJwtService {
   readonly authStatus$: BehaviorSubject<IAuthStatus>;
   readonly currentUser$: BehaviorSubject<IUser>;
   login(email: string, password: string): Observable<void>;
   logout(clearToken?: boolean): void;
   getToken(): string;
}

export interface IAuthStatus {
   isAuthenticated: boolean;
   userRole: Role;
   userId: string;
}

export interface IServerAuthResponse {
   accessToken: string;
}

export const defaultAuthStatus: IAuthStatus = {
   isAuthenticated: false,
   userRole: Role.None,
   userId: '',
};

@Injectable()
export abstract class AuthJwtService extends CacheService implements IAuthJwtService {
   // Class Variables
   private getAndUpdateUserIfAuthenticated = pipe(
      filter((status: IAuthStatus) => status.isAuthenticated),
      mergeMap(() => this.getCurrentUser()),
      map((user: IUser) => this.currentUser$.next(user)),
      catchError(transformError)
   );

   readonly authStatus$ = new BehaviorSubject<IAuthStatus>(defaultAuthStatus);
   readonly currentUser$ = new BehaviorSubject<IUser>(new User());
   protected readonly resumeCurrentUser$ = this.authStatus$.pipe(
      this.getAndUpdateUserIfAuthenticated
   );

   constructor() {
      super();

      if (this.hasExpiredToken()) {
         this.logout(true);
      } else {
         this.authStatus$.next(this.getAuthStatusFromToken());
         // To load user on browser refresh, resume pipeline must activate on the next cycle
         // Which allows for all services to constructed properly
         setTimeout(() => this.resumeCurrentUser$.subscribe(), 0);
      }
   }

   // Protected Abstract Methods
   protected abstract authProvider(
      email: string,
      password: string
   ): Observable<IServerAuthResponse>;

   protected abstract transformJwtToken(token: unknown): IAuthStatus;

   protected abstract getCurrentUser(): Observable<User>;

   // Class methods
   login(email: string, password: string): Observable<void> {
      this.clearToken();
      
      const loginResponse$ = this.authProvider(email, password).pipe(
         map((value) => {
            this.setToken(value.accessToken);
            const token = decode(value.accessToken);
            return this.transformJwtToken(token);
         }),
         tap((status) => this.authStatus$.next(status)),
         this.getAndUpdateUserIfAuthenticated
      );

      loginResponse$.subscribe({
         error: (err) => {
            console.error(err)
            this.logout();
            return throwError(() => new Error(err));
         },
      });

      return loginResponse$;
   }

   logout(clearToken?: boolean) {
      if (clearToken) {
         this.clearToken();
      }
      setTimeout(() => this.authStatus$.next(defaultAuthStatus), 0);
   }

   getToken(): string {
      return this.getItem('jwt') ?? '';
   }

   // Protected Methods
   protected setToken(jwt: string) {
      this.setItem('jwt', jwt);
   }

   protected clearToken() {
      this.removeItem('jwt');
   }

   protected hasExpiredToken(): boolean {
      const jwt = this.getToken();

      if (jwt) {
         const payload = decode(jwt) as any;
         return Date.now() >= payload.exp * 1000;
      }

      return true;
   }

   protected getAuthStatusFromToken(): IAuthStatus {
      return this.transformJwtToken(decode(this.getToken()));
   }
}
