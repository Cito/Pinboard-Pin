// this component is the login dialog displayed in the popup

import {Component, OnInit} from '@angular/core';
import {NgForm} from '@angular/forms';
import {Router} from '@angular/router';

import {passwordPage, PinboardService} from '../pinboard.service';

export interface Login {
  token: string;
}


// Log in form

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  checking = false;
  error = false;

  constructor(private pinboard: PinboardService, private router: Router) { }

  ngOnInit() {
  }

  openPasswordPage() {
    browser.windows.create({url: passwordPage});
    return false;
  }

  // submit form (store token)
  submit(form: NgForm) {
    if (!form.valid) {
      return false;
    }
    let token = form.value.token;
    if (!token) {
      return false;
    }
    token = token.trim();
    if (!token) {
      return false;
    }
    this.checking = true;
    this.pinboard.setToken(token).subscribe(
      ok => {
        this.error = !ok;
        if (ok) {
          this.continue();
        } else {
          this.checking = false;
        }
      },
      error => {
        this.error = true;
        console.error(error.toString());
        this.checking = false;
      });
    return false;
  }

  continue() {
    this.router.navigate(['/popup']);
  }

}

