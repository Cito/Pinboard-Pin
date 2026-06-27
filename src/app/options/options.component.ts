// this component is the user setting dialog displayed under options

import { Component, OnInit, OnDestroy, signal, inject } from "@angular/core";
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
  imports: [FormsModule],
})
export class OptionsComponent implements OnInit, OnDestroy {
  private storage = inject(StorageService);

  readonly options = signal<Options | null>(null);

  readonly shortcut = signal(""); // default keyboard shortcut

  readonly page = signal("options"); // type of page (popup or options)

  readonly theme = signal("light"); // color scheme of the page

  // stable listener reference (bound once) for add/removeListener
  private readonly messageListener: (message: MessagePayload) => void =
    this.onMessage.bind(this);

  ngOnInit() {
    this.page.set((this.storage.getInfo("options.page") as string) || "options");
    this.storage.getOptions().subscribe((options) => {
      this.options.set(options);
      this.setTheme(options);
      this.setOnMessageListener(true);
    });
    void browser.commands.getAll().then((commands) => {
      for (const command of commands) {
        if (command.name === "_execute_browser_action") {
          this.shortcut.set(command.shortcut ?? "");
        }
      }
    });
  }

  ngOnDestroy() {
    this.setOnMessageListener(false);
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

  // check whether given options are the same as the current ones
  sameOptions(options: Options): boolean {
    const current = this.options();
    if (!current) {
      return false;
    }
    const opts: Partial<Options> = { ...options };
    for (const key in current) {
      if (typeof current[key as keyof Options] === "boolean" && key !== "dark") {
        opts[key as keyof Options] = !!opts[key as keyof Options];
      }
    }
    for (const key in opts) {
      if (opts[key as keyof Options] !== current[key as keyof Options]) {
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
      this.options.set(options);
      this.setTheme(options);
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
    this.options.set(value);
    this.setTheme(value);
    this.storage.setOptions(value).subscribe();
    void browser.runtime.sendMessage({ options: value });
    return false;
  }

  // close the options popup
  close() {
    if (this.page() === "popup") {
      window.close();
    }
  }
}
