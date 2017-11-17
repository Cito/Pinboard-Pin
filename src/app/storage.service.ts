import {Injectable} from '@angular/core';

import {Observable} from 'rxjs/Observable';
import {fromPromise as ObservableFromPromise} from 'rxjs/observable/fromPromise';
import {map} from 'rxjs/operators';

export interface Options {
  ping: boolean;
  unshared: boolean;
  toread: boolean;
  blockquote: boolean;
  alpha: boolean;
}

const defaultOptions: Options = {
  ping: false,
  unshared: false,
  toread: false,
  blockquote: false,
  alpha: false
};


// Wrapper around the browser local storage for the web extension,
// using Observables instead of Promises for flexibility and consistency.

@Injectable()
export class StorageService {

  private storage = browser.storage.local;  // needs "storage" permission

  private info: Object;

  constructor() {
    this.info = {}; // for various info shared via this service
  }

  // get keys from local storage as an Observable
  // when only one key is requested, only its value is returned
  get(keys: string | string[] | null): Observable<any> {
    return ObservableFromPromise(this.storage.get(keys)).pipe(
      map(res => typeof keys === 'string' ? res[keys] : res));
  }

  // set keys in local storage as an Observable
  set(keys: any): Observable<any> {
    return ObservableFromPromise(this.storage.set(keys));
  }

  // remove keys in local storage as an Observable
  remove(keys: string | string[]): Observable<any> {
    return ObservableFromPromise(this.storage.remove(keys));
  }

  // retrieve options from local storage
  getOptions(): Observable<Options> {
    return this.get('options').pipe(
      map(options => options || defaultOptions));
  }

  // store options in local storage
  setOptions(options: Options): Observable<any> {
    return this.set({options: options});
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
