// this component is the user setting dialog displayed under options

import { Component, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, NgForm } from "@angular/forms";
import { Options, StorageService } from "../storage.service";

interface MessagePayload {
  options?: Options;
}

// Options form

@Component({
  selector: "app-options",
  templateUrl: "./options.component.html",
  styleUrls: ["./options.component.scss"],
  imports: [CommonModule, FormsModule],
})
export class OptionsComponent implements OnInit, OnDestroy {
  options: Options;

  shortcut: string; // default keyboard shortcut

  page: string; // type of page (popup or options)

  theme = "light"; // color scheme of the page

  private readonly messageListener: (message: MessagePayload) => void;

  constructor(private storage: StorageService, private cdr: ChangeDetectorRef) {
    this.messageListener = this.onMessage.bind(this) as (
      message: MessagePayload
    ) => void;
  }

  ngOnInit() {
    this.page = (this.storage.getInfo("options.page") as string) || "options";
    this.storage.getOptions().subscribe((options) => {
      this.options = options;
      this.setTheme();
      this.setOnMessageListener(true);
      this.cdr.detectChanges();
    });
    void browser.commands.getAll().then((commands) => {
      for (const command of commands) {
        if (command.name === "_execute_browser_action") {
          this.shortcut = command.shortcut;
        }
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.setOnMessageListener(false);
  }

  setTheme() {
    this.theme =
      this.options.dark === true ||
      (this.options.dark !== false &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
  }

  // check whether given options are the same
  sameOptions(options: Options): boolean {
    const opts: Partial<Options> = { ...options };
    for (const key in this.options) {
      if (typeof this.options[key] === "boolean" && key !== "dark") {
        opts[key as keyof Options] = !!opts[key as keyof Options];
      }
    }
    for (const key in opts) {
      if (opts[key as keyof Options] !== this.options[key as keyof Options]) {
        return false;
      }
    }
    return true;
  }

  // set the listener for internal messages
  setOnMessageListener(on: boolean) {
    const event = browser.runtime.onMessage;
    const listener = this.messageListener;
    if (event.hasListener(listener)) {
      if (!on) {
        void event.removeListener(listener);
      }
    } else {
      if (on) {
        void event.addListener(listener);
      }
    }
  }

  // fires when another process connects
  // this synchronizes the settings if options popup and options page
  // are open at the same time
  onMessage(message: MessagePayload): void {
    const options = message.options;
    if (options && !this.sameOptions(options)) {
      this.options = options;
      this.setTheme();
      this.cdr.detectChanges(); // run change detection
    }
  }

  // submit form (store options in local storage)
  submit(form: NgForm) {
    if (!form.valid) {
      return false;
    }
    const value: Options = form.value as Options;
    if (!value || this.sameOptions(value)) {
      return false;
    }
    this.options = value;
    this.setTheme();
    this.storage.setOptions(value).subscribe();
    void browser.runtime.sendMessage({ options: value });
    return false;
  }

  // close the options popup
  close() {
    if (this.page === "popup") {
      window.close();
    }
  }
}
