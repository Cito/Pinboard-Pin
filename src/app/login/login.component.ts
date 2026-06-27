// this component is the login dialog displayed in the popup

import { Component, OnInit, ChangeDetectorRef, inject } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { Router } from "@angular/router";
import { finalize } from "rxjs/operators";

import { passwordPage, PinboardService } from "../pinboard.service";
import { Options, StorageService } from "../storage.service";
import { logError } from "../util";

export interface Login {
  token: string;
}

// Log in form

@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"],
  imports: [FormsModule],
})
export class LoginComponent implements OnInit {
  private pinboard = inject(PinboardService);
  private storage = inject(StorageService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  checking = false;
  error = false;

  theme = "light";

  ngOnInit() {
    this.storage.getOptions().subscribe((options) => {
      this.setTheme(options);
      this.cdr.detectChanges();
    });
  }

  setTheme(options: Options) {
    this.theme =
      options.dark === true ||
      (options.dark !== false &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
  }

  openPasswordPage() {
    void browser.windows.create({ url: passwordPage });
    return false;
  }

  // submit form (store token)
  submit(form: NgForm) {
    if (!form.valid) {
      return false;
    }
    let token: string = (form.value as Record<string, unknown>).token as string;
    if (!token) {
      return false;
    }
    token = token.trim();
    if (!token) {
      return false;
    }
    this.checking = true;
    this.pinboard
      .setToken(token)
      .pipe(finalize(() => this.cdr.detectChanges()))
      .subscribe({
        next: (ok) => {
          this.error = !ok;
          if (ok) {
            this.continue();
          } else {
            this.checking = false;
          }
        },
        error: (error: unknown) => {
          this.error = true;
          logError(error);
          this.checking = false;
        },
      });
    return false;
  }

  continue() {
    void this.router.navigate(["/popup"]);
  }
}
