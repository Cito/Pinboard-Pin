// this component pings the saved state of pages in the background

import {Component, OnInit, OnDestroy} from '@angular/core';
import {StorageService} from '../storage.service';
import {PinboardService} from '../pinboard.service';
import {IconService} from '../icon.service';


// Background page used for checking whether pages are saved in Pinboard

@Component({
  selector: 'app-background',
  template: '<h1>Background page for Pinboard</h1>'
})
export class BackgroundComponent implements OnInit, OnDestroy {

  private updatedListener: (tabId: number, changeInfo: any, tab: any) => void;
  private messageListener: (message: any) => void;

  constructor(private storage: StorageService,
              private pinboard: PinboardService,
              private icon: IconService) {
    this.updatedListener = this.onUpdated.bind(this);
    this.messageListener = this.onMessage.bind(this);
  }

  private ping: boolean;

  ngOnInit() {
    this.storage.getOptions().subscribe(options => {
      this.ping = options.ping;
      this.setOnMessageListener(true);
      this.setOnUpdateListener(this.ping);
    });
  }

  ngOnDestroy() {
    this.setOnUpdateListener(false);
    this.setOnMessageListener(false);
  }

  // set the listener for internal messages
  setOnMessageListener(on: boolean) {
    const listener = this.messageListener;
    if (browser.runtime.onMessage.hasListener(listener)) {
      if (!on) {
        browser.runtime.onMessage.removeListener(listener);
      }
    } else {
      if (on) {
        browser.runtime.onMessage.addListener(listener);
      }
    }
  }

  // fires when another process connects
  onMessage(message: any): void {
    if (message.options && message.options.ping !== this.ping) {
      this.ping = message.options.ping;
      this.setOnUpdateListener(this.ping);
    }
  }

  // set the listener for url update in browser tabs
  setOnUpdateListener(on: boolean) {
    const listener = this.updatedListener;
    if (browser.tabs.onUpdated.hasListener(listener)) {
      if (!on) {
        browser.tabs.onUpdated.removeListener(listener);
      }
    } else {
      if (on) {
        browser.tabs.onUpdated.addListener(listener);
      }
    }
  }

  // fires when the active tab in a window changes
  onUpdated(tabId: number, changeInfo: any, tab: any): void {
    // do not ping Pinboard in incognito mode
    if (tab.incognito) {
      return;
    }
    const url = changeInfo.url;
    if (url) {
      if (/^https?:\/\//.test(url)) {
        this.pinboard.get(url).subscribe(
          data => this.icon.setIcon(
            tabId, !!(data && data.posts && data.posts.length)),
          error => this.icon.setIcon(tabId, false));
      } else {
        this.icon.setIcon(tabId, false);
      }
    }
  }

}
