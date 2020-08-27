import { Injectable } from '@angular/core';

import { Observable, from as ObservableFrom } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Options {
  ping: boolean;  // check whether pages are bookmarked
  unshared: boolean;  // add as private by default
  toread: boolean;  // add as to read by default
  meta: boolean;  // parse meta elements
  selection: boolean;  // use selected text
  blockquote: boolean;  // wrap as block quote
  alpha: boolean;  // sort alphabetically
  popular: boolean;  // show popular tags
  menu: boolean;  // add entry to context menu
  dark: boolean;  // use dark mode
}

const defaultOptions: Options = {
  ping: false,
  unshared: false,
  toread: false,
  meta: true,
  selection: true,
  blockquote: false,
  alpha: false,
  popular: true,
  menu: false,
  dark: null,
};


// Wrapper around the browser local storage for the web extension,
// using Observables instead of Promises for flexibility and consistency.

@Injectable()
export class StorageService {

  private storage = browser.storage.local;  // needs "storage" permission

  private readonly info: Object;

  constructor() {
    this.info = {}; // for various info shared via this service
  }

  // get keys from local storage as an Observable
  // when only one key is requested, only its value is returned
  get(keys: string | string[] | null): Observable<any> {
    return ObservableFrom(this.storage.get(keys)).pipe(
      map(res => typeof keys === 'string' ? res[keys] : res));
  }

  // set keys in local storage as an Observable
  set(keys: any): Observable<any> {
    return ObservableFrom(this.storage.set(keys));
  }

  // remove keys in local storage as an Observable
  remove(keys: string | string[]): Observable<any> {
    return ObservableFrom(this.storage.remove(keys));
  }

  // retrieve options from local storage
  getOptions(): Observable<Options> {
    return this.get('options').pipe(
      map(options => {
        const opts = {};
        Object.keys(defaultOptions).forEach(
          key => {
            const val = options[key];
            opts[key] = val === undefined ? defaultOptions[key] : val;
          });
        return opts as Options;
      }));
  }

  // store options in local storage
  setOptions(options: Options): Observable<any> {
    return this.set({ options: options });
  }

  // set a volatile info for users of this service
  setInfo(name: string, value: any): void {
    this.info[name] = value;
  }

  // get a volatile info that was previously set
  getInfo(name: string): any {
    return this.info[name];
  }

}
