import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, combineLatest, filter, tap } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { SubSink } from 'subsink';

@Component({
   selector: 'app-login',
   templateUrl: './login.component.html',
   styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit, OnDestroy {
   private subs = new SubSink();
   loginForm!: FormGroup;
   loginError = '';
   redirectUrl = '';

   constructor(
      private formBuilder: FormBuilder,
      private authService: AuthService,
      private router: Router,
      private route: ActivatedRoute
   ) {
      // this.subs.sink = this.route.paramMap.subscribe(
      //    (params) => {
      //       this.redirectUrl = params.get('redirectUrl') ?? ''
      //    }
      // );

   }

   ngOnInit(): void {
      this.authService.logout();
      this.buildLoginForm();
   }

   buildLoginForm() {
      this.loginForm = this.formBuilder.group({
         email: ['', [Validators.required, Validators.email]],
         password: [
            '',
            [
               Validators.required,
               Validators.minLength(8),
               Validators.maxLength(50),
            ],
         ],
      });
   }

   async login(submitedForm: FormGroup) {
      this.authService
         .login(submitedForm.value.email, submitedForm.value.password)
         .pipe(catchError((err) => (this.loginError = err)));

      this.subs.sink = combineLatest([
         this.authService.authStatus$,
         this.authService.currentUser$,
      ])
         .pipe(
            filter(
               ([authStatus, user]) =>
                  authStatus.isAuthenticated && user?._id !== ''
            ),
            tap(([authStatus, user]) => {
               this.router.navigate([this.redirectUrl || '/']);
            })
         )
         .subscribe();
   }

   // Unsubscribe when the component dies
   ngOnDestroy() {
      this.subs.unsubscribe();
   }
}
