import { Injectable } from '@angular/core';

const defaultIcon = {
  '16': '/img/pinboard_idle_16.png',
  '24': '/img/pinboard_idle_24.png',
  '32': '/img/pinboard_idle_32.png',
  '48': '/img/pinboard_idle_48.png',
  '64': '/img/pinboard_idle_64.png',
  '96': '/img/pinboard_idle_96.png',
  '128': '/img/pinboard_idle_128.png',
  '256': '/img/pinboard_idle_256.png'
 };

const savedIcon = {
  '16': '/img/pinboard_16.png',
  '24': '/img/pinboard_24.png',
  '32': '/img/pinboard_32.png',
  '48': '/img/pinboard_48.png',
  '64': '/img/pinboard_64.png',
  '96': '/img/pinboard_96.png',
  '128': '/img/pinboard_128.png',
  '256': '/img/pinboard_256.png'
 };


// Service for setting the browser action icon

@Injectable()
export class IconService {

  constructor() { }

  // set the icon for saved or unsaved for the given tab
  setIcon(tabId: number, saved: boolean) {
    browser.browserAction.setIcon({
      tabId: tabId, path: saved ? savedIcon : defaultIcon
    });
  }

}
