// this component is the login dialog displayed in the popup

import { Component, OnInit, signal, inject } from "@angular/core";
import {
  form,
  FormField,
  required,
  pattern,
  disabled,
} from "@angular/forms/signals";
import { Router } from "@angular/router";

import { passwordPage, PinboardService } from "../pinboard.service";
import { Options, StorageService } from "../storage.service";
import { logError, resolveTheme } from "../util";

export interface Login {
  token: string;
}

// an API token is two non-empty parts separated by a colon (user:hex)
const tokenPattern = /.+:.+/;

// Log in form

@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"],
  imports: [FormField],
})
export class LoginComponent implements OnInit {
  private pinboard = inject(PinboardService);
  private storage = inject(StorageService);
  private router = inject(Router);

  readonly checking = signal(false);
  readonly error = signal(false);

  readonly theme = signal("light");

  // the API token bound to the form; the input is disabled while logging in
  readonly model = signal<Login>({ token: "" });
  readonly form = form(this.model, (field) => {
    required(field.token);
    pattern(field.token, tokenPattern);
    disabled(field, { when: () => this.checking() });
  });

  ngOnInit() {
    this.storage.getOptions().subscribe((options) => {
      this.setTheme(options);
    });
  }

  setTheme(options: Options) {
    this.theme.set(resolveTheme(options.dark));
  }

  openPasswordPage() {
    void browser.windows.create({ url: passwordPage });
    return false;
  }

  // submit form (store token)
  submit(event: Event) {
    event.preventDefault();
    if (!this.form().valid()) {
      return;
    }
    const token = this.model().token.trim();
    if (!token) {
      return;
    }
    this.checking.set(true);
    this.pinboard.setToken(token).subscribe({
      next: (ok) => {
        this.error.set(!ok);
        if (ok) {
          this.continue();
        } else {
          this.checking.set(false);
        }
      },
      error: (error: unknown) => {
        this.error.set(true);
        logError(error);
        this.checking.set(false);
      },
    });
  }

  continue() {
    void this.router.navigate(["/popup"]);
  }
}
