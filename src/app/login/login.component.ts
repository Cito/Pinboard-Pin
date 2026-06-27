// this component is the login dialog displayed in the popup

import { Component, OnInit, signal, inject } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { Router } from "@angular/router";

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

  readonly checking = signal(false);
  readonly error = signal(false);

  readonly theme = signal("light");

  ngOnInit() {
    this.storage.getOptions().subscribe((options) => {
      this.setTheme(options);
    });
  }

  setTheme(options: Options) {
    this.theme.set(
      options.dark === true ||
        (options.dark !== false &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light"
    );
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
    return false;
  }

  continue() {
    void this.router.navigate(["/popup"]);
  }
}
