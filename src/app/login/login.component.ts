// this component is the login dialog displayed in the popup

import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';

import { passwordPage, PinboardService } from '../pinboard.service';
import { Options, StorageService } from '../storage.service';

export interface Login {
  token: string;
}


// Log in form

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  checking = false;
  error = false;

  theme = 'light'; // color scheme of the page

  constructor(
    private pinboard: PinboardService,
    private storage: StorageService,
    private router: Router) { }

  ngOnInit() {
    this.storage.getOptions().subscribe(options =>
      this.setTheme(options));
  }

  setTheme(options: Options) {
    this.theme = (
      options.dark === true ||
      options.dark !== false &&
      window.matchMedia('(prefers-color-scheme: dark)').matches) ?
      'dark' : 'light';
  }

  openPasswordPage() {
    browser.windows.create({ url: passwordPage });
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

