// this component is the user setting dialog displayed under options

import {Component, OnInit, OnDestroy, ApplicationRef} from '@angular/core';
import {NgForm} from '@angular/forms';
import {Options, StorageService} from '../storage.service';
import {Post} from "../pinpage/pinpage.component";


// Options form

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.css']
})
export class OptionsComponent implements OnInit, OnDestroy {

  options: Options;

  shortcut: string;  // default keyboard shortcut

  page: string; // type of page (popup or options)

  private readonly messageListener: (message: any) => void;

  constructor(private storage: StorageService,
              private appRef: ApplicationRef) {
    this.messageListener = this.onMessage.bind(this);
  }

  ngOnInit() {
    this.page = this.storage.getInfo('options.page') || 'options';
    this.storage.getOptions().subscribe(options => {
      this.options = options;
      this.setOnMessageListener(true);
    });
    browser.commands.getAll().then(commands => {
      for (const command of commands) {
        if (command.name === '_execute_browser_action') {
          this.shortcut = command.shortcut;
        }
      }
    });
  }

  ngOnDestroy() {
    this.setOnMessageListener(false);
  }

  // check whether given options are the same
  sameOptions(options: Options): boolean {
    for (const key in this.options) {
      if (typeof this.options[key] === 'boolean') {
        options[key] = !!options[key];
      }
    }
    for (const key in options) {
      if (options[key] !== this.options[key]) {
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
        event.removeListener(listener);
      }
    } else {
      if (on) {
        event.addListener(listener);
      }
    }
  }

  // fires when another process connects
  // this synchronizes the settings if options popup and options page
  // are open at the same time
  onMessage(message: any): void {
    const options = message.options;
    if (options && !this.sameOptions(options)) {
      this.options = options;
      this.appRef.tick(); // run change detection
    }
  }

  // submit form (store options in local storage)
  submit(form: NgForm) {
    if (!form.valid) {
      return false;
    }
    const value: Options = form.value;
    if (!value || this.sameOptions(value)) {
      return false;
    }
    this.options = value;
    this.storage.setOptions(value).subscribe();
    browser.runtime.sendMessage({'options': value});
    return false;
  }

  // close the options popup
  close() {
    if (this.page === 'popup') {
      window.close();
    }
  }

}
