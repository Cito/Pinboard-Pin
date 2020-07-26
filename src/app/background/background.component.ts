// this component pings the saved state of pages in the background

import {Component, OnInit, OnDestroy} from '@angular/core';
import {StorageService} from '../storage.service';
import {PinboardService} from '../pinboard.service';
import {Post} from '../pinpage/pinpage.component';
import {IconService} from '../icon.service';
import {Options} from '../storage.service';

// Background page used for checking whether pages are saved in Pinboard

@Component({
  selector: 'app-background',
  template: '<h1>Background page for Pinboard</h1>'
})
export class BackgroundComponent implements OnInit, OnDestroy {

  private readonly updatedListener:
    (tabId: number, changeInfo: any, tab: browser.tabs.Tab) => void;
  private readonly messageListener:
    (message: any) => void;
  private readonly menuListener:
    (info: browser.menus.OnClickData, tab: browser.tabs.Tab) => void;

  constructor(private storage: StorageService,
              private pinboard: PinboardService,
              private icon: IconService) {
    this.updatedListener = this.onUpdated.bind(this);
    this.messageListener = this.onMessage.bind(this);
    this.menuListener = this.onMenuClicked.bind(this);
  }

  private ping = false;
  private menu = false;
  private toread = false;
  private unshared = false;

  ngOnInit() {
    this.storage.getOptions().subscribe(options => {
      this.setOnMessageListener(true);
      this.onMessage({options});
    });
  }

  ngOnDestroy() {
    this.setOnUpdateListener(false);
    this.setOnMessageListener(false);
    this.setOnMenuClickedListener(false);
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
  onMessage(message: any): void {
    const options: Options = message.options;
    if (options) {
      if (options.ping !== this.ping) {
        this.setOnUpdateListener(options.ping);
      }
      if (options.menu !== this.menu) {
        this.setOnMenuClickedListener(options.menu);
      }
      this.toread = options.toread;
      this.unshared = options.unshared;
    }
  }

  // set the listener for url update in browser tabs
  setOnUpdateListener(on: boolean) {
    const event = browser.tabs.onUpdated;
    const listener = this.updatedListener;
    if (event.hasListener(listener)) {
      if (!on) {
        event.removeListener(listener);
      }
    } else {
      if (on) {
        event.addListener(listener);
      }
    }
    this.ping = on;
  }

  // fires when the active tab in a window changes
  onUpdated(tabId: number, changeInfo: any, tab: browser.tabs.Tab): void {
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

  // set the listener for context menu clicks
  setOnMenuClickedListener(on: boolean) {
    const menus = browser.contextMenus;
    const event = menus.onClicked;
    const listener = this.menuListener;
    if (event.hasListener(listener)) {
      if (!on) {
        event.removeListener(listener);
        menus.remove('save-link-to-pinboard');
        menus.remove('save-page-to-pinboard');
      }
    } else {
      if (on) {
        browser.contextMenus.create({
          id: 'save-page-to-pinboard',
          title: 'Save page to Pinboard',
          contexts: ['page'],
          documentUrlPatterns: ['http://*/*', 'https://*/*'],
          command: '_execute_browser_action'
        });
        browser.contextMenus.create({
          id: 'save-link-to-pinboard',
          title: 'Save link to Pinboard',
          contexts: ['link'],
          targetUrlPatterns: ['http://*/*', 'https://*/*']
        });
        event.addListener(listener);
      }
    }
    this.menu = on;
  }

  // handle menu clicks for saving links in the background
  onMenuClicked(info: browser.menus.OnClickData, tab: browser.tabs.Tab): void {
    if (info.menuItemId === 'save-link-to-pinboard' && info.linkUrl) {
      const url = info.linkUrl;
      // since we cannot get the actual title, we use the link text instead
      const title = info.linkText || 'Link saved with Pinboard Pin';
      const post: Post = {
        url, title, description: '', tags: '',
        unshared: this.unshared, toread: this.toread,
        // links will be only added,
        // we do not want to overwrite existing titles and descriptions
        noreplace: true
      };
      this.pinboard.save(post).subscribe(
        error => {
          if (error && !/already exists/.test(error)) {
            this.saveLinkError(error);
          }
        },
        error => {
          this.saveLinkError(error.toString());
        });
    }
  }

  saveLinkError(error: string): void {
    console.error(error);
    // we cannot display an alert directly, so we use a workaround
    const showAlert = 'alert("Could not save the link to Pinboard.")';
    browser.tabs.executeScript(null, {code : showAlert});
  }

}
