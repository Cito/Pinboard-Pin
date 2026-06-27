// this component is the user setting dialog displayed under options

import { Component, OnInit, OnDestroy, signal, inject } from "@angular/core";
import { form, FormField, disabled } from "@angular/forms/signals";
import {
  MessagePayload,
  Options,
  StorageService,
  defaultOptions,
} from "../storage.service";
import { resolveTheme } from "../util";

// the options as bound to the signal form; the tri-state dark mode is a string
// here because native radio controls are string-valued, and is mapped back to
// Options.dark (boolean | null) when the options are persisted
interface OptionsForm extends Omit<Options, "dark"> {
  dark: "auto" | "on" | "off";
}

function toForm(options: Options): OptionsForm {
  return {
    ...options,
    dark: options.dark === null ? "auto" : options.dark ? "on" : "off",
  };
}

function toOptions(value: OptionsForm): Options {
  return { ...value, dark: value.dark === "auto" ? null : value.dark === "on" };
}

// Options form

@Component({
  selector: "app-options",
  templateUrl: "./options.component.html",
  styleUrls: ["./options.component.scss"],
  imports: [FormField],
})
export class OptionsComponent implements OnInit, OnDestroy {
  private storage = inject(StorageService);

  readonly loaded = signal(false); // whether the options have been loaded

  readonly shortcut = signal(""); // default keyboard shortcut

  readonly page = signal("options"); // type of page (popup or options)

  readonly theme = signal("light"); // color scheme of the page

  // the options bound to the form; the fields stay disabled until loaded
  readonly model = signal<OptionsForm>(toForm(defaultOptions));
  readonly form = form(this.model, (field) => {
    disabled(field, { when: () => !this.loaded() });
  });

  // stable listener reference (bound once) for add/removeListener
  private readonly messageListener: (message: MessagePayload) => void =
    this.onMessage.bind(this);

  ngOnInit() {
    this.page.set((this.storage.getInfo("options.page") as string) || "options");
    this.storage.getOptions().subscribe((options) => {
      this.setOptions(options);
      this.loaded.set(true);
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
    this.theme.set(resolveTheme(options.dark));
  }

  // load the given options into the form without persisting them
  setOptions(options: Options) {
    this.model.set(toForm(options));
    this.setTheme(options);
  }

  // check whether the given options are the same as the current ones
  sameOptions(options: Options): boolean {
    const current = toOptions(this.model());
    return (Object.keys(options) as (keyof Options)[]).every(
      (key) => options[key] === current[key]
    );
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
      this.setOptions(options);
    }
  }

  // store the current options in local storage and notify the other surfaces
  // (called from the change handlers, i.e. only on actual user input)
  save() {
    const options = toOptions(this.model());
    this.setTheme(options);
    this.storage.setOptions(options).subscribe();
    void browser.runtime.sendMessage({ options });
  }

  // close the options popup
  close() {
    if (this.page() === "popup") {
      window.close();
    }
  }
}
