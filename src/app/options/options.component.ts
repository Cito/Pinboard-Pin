// this component is the user setting dialog displayed under options

import {Component, OnInit, OnDestroy, ApplicationRef} from '@angular/core';
import {Options, StorageService} from "../storage.service";


// Options form

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.css']
})
export class OptionsComponent implements OnInit, OnDestroy {

  options: Options;

  page: string; // type of page (popup or options)

  private messageListener: (message: any) => void;

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
  }

  ngOnDestroy() {
    this.setOnMessageListener(false);
  }

  // check whether given options are the same
  sameOptions(options: Options): boolean {
    for (let key in this.options) {
      if (typeof this.options[key] == 'boolean')
        options[key] = !!options[key];
    }
    for (let key in options)
      if (options[key] != this.options[key])
        return false;
    return true;
  }

  // set the listener for internal messages
  setOnMessageListener(on: boolean) {
    const listener = this.messageListener;
    if (browser.runtime.onMessage.hasListener(listener)) {
      if (!on) browser.runtime.onMessage.removeListener(listener);
    } else {
      if (on) browser.runtime.onMessage.addListener(listener);
    }
  }

  // fires when another process connects
  // this synchronizes the settings if options popup and options page
  // are open at the same time
  onMessage(message: any): void {
    let options = message.options;
    if (options && !this.sameOptions(options)) {
      this.options = options;
      this.appRef.tick(); // run change detection
    }
  }

  // submit form (store options in local storage)
  submit({value, valid}: {value: Options, valid: boolean}) {
    if (!value || !valid || this.sameOptions(value)) return false;
    this.options = value;
    this.storage.setOptions(value).subscribe();
    browser.runtime.sendMessage({'options': value});
    return false;
  }

  // close the options popup
  close() {
    if (this.page == 'popup')
      window.close();
  }

}
