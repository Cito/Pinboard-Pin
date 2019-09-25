import {Injectable} from '@angular/core';

import {throwError as observableThrow, Observable,
  of as ObservableOf, forkJoin, from as ObservableFrom} from 'rxjs';
import {filter, map, mergeMap, switchMap, tap} from 'rxjs/operators';

import {StorageService} from './storage.service';
import {Post} from './pinpage/pinpage.component';
import {HttpClient, HttpParameterCodec, HttpParams} from '@angular/common/http';

export const pinboardPage = 'https://pinboard.in/';

export const passwordPage = pinboardPage + 'settings/password';
const tabsPage = pinboardPage + 'tabs/';

const apiUrl = 'https://api.pinboard.in/v1/';

const cacheTimeout = 1000 * 60 * 60; // one hour cache time

// Create a custom encoder for query parameters that can be used
// as a workaround for https://github.com/angular/angular/issues/18261
// in order to fix https://github.com/Cito/Pinboard-Pin/issues/17

class ParamsEncoder implements HttpParameterCodec {
  encodeKey(key: string): string {
    return encodeURIComponent(key);
  }

  encodeValue(value: string): string {
    return encodeURIComponent(value);
  }

  decodeKey(key: string): string {
    return decodeURIComponent(key);
  }

  decodeValue(value: string): string {
    return decodeURIComponent(value);
  }
}

const paramsEncoder = new ParamsEncoder();


// Service for dealing with the Pinboard API

@Injectable()
export class PinboardService {

  constructor(private http: HttpClient, private storage: StorageService) { }

  // get an object via the Pinboard API
  httpGet(method: string, params?: any): Observable<any> {
    params = params || {};
    if (!params.auth_token) {
      return this.storage.get('token').pipe(switchMap(token => {
        if (!token) {
          observableThrow(new Error('No API token!'));
        }
        params.auth_token = token;
        return this.httpGet(method, params);
      }));
    }
    params.format = 'json';
    const httpParams = Object.entries(params).reduce(
      (params: HttpParams, [key, value]: [string, string]) =>
        params.set(key, value), new HttpParams({encoder: paramsEncoder}));
    return this.http.get(
      apiUrl + method, {params: httpParams});
  }

  // check the given API token and memorize it if valid
  setToken(value: string): Observable<boolean> {
    const values = value.split(':', 2);
    if (values.length !== 2) {
      return ObservableOf(false);
    }
    return this.httpGet(
      'user/api_token', {auth_token: value}).pipe(
      map(data => data.result === values[1]),
      switchMap(ok => ok ?
        this.storage.set({token: value}).pipe(map(() => true)) :
        ObservableOf(false)));
  }

  // check whether we still need an API token
  get needToken(): Observable<boolean> {
    return this.storage.get('token').pipe(map(res => !res));
  }

  // extract user name from API token
  get userName(): Observable<string> {
    return this.storage.get('token').pipe(
      map(res => res && res.split(':', 1)[0]), filter(res => res));
  }

  // forget the API token
  forgetToken(): Observable<any> {
    // also clear the tags cache when leaving
    return this.storage.remove(['token', 'tags']);
  }

  // get bookmark with the given url
  get(url): Observable<any> {
    return this.httpGet('posts/get', {url: url, meta: 'no'});
  }

  // add or replace bookmark with given attributes
  save(post: Post):
      Observable<string> {
    const params: any = {url: post.url, description: post.title};
    if (post.description) {
      params.extended = post.description;
    }
    if (post.tags) {
      params.tags = post.tags;
    }
    params.shared = post.unshared ? 'no' : 'yes';
    params.toread = post.toread ? 'yes' : 'no';
    return this.httpGet('posts/add', params).pipe(
      map(res => res.result_code === 'done' ? null : res.result_code));
  }

  // delete bookmark with the given url
  delete(url): Observable<any> {
    return this.httpGet('posts/delete', {url: url});
  }

  // get suggested tags for the given url
  suggest(url): Observable<any> {
    return this.httpGet(
      'posts/suggest', {url: url}).pipe(map(data => {
      const tags = {popular: [], recommended: []};
      for (const d of data) {
        if (d.popular) {
          tags.popular.push(...d.popular);
        }
        if (d.recommended) {
          tags.recommended.push(...d.recommended);
        }
      }
      return tags;
    }));
  }

  // get post for the given url together with the suggested tags
  getAndSuggest(url): Observable<any> {
    return forkJoin([this.get(url), this.suggest(url)]).pipe(map(
      data => Object.assign(data[0], data[1])));
  }

  // get the list of all used tags (with numeric tag counters)
  tags(): Observable<{[tag: string]: number}> {
    return this.httpGet('tags/get').pipe(map(tags => {
        for (const tag in tags) {
          if (tags.hasOwnProperty(tag)) {
            tags[tag] = +tags[tag];
          }
        }
        return tags;
      }));
  }

  // get a cached list of all used tags
  cachedTags(): Observable<{[tag: string]: number}> {
    return this.storage.get('tags').pipe(switchMap(tags => {
      const date = Date.now();
      if (!tags || !tags.tags || !tags.date ||
          tags.tags instanceof Array) {  // old version used arrays
        // no tags cached, retrieve tags first from Pinboard
        return this.tags().pipe(tap(tags =>
          this.storage.set({tags: {tags: tags, date: date}}).subscribe()));
      }
      // replace outdated tags in the background
      if (tags.date > date || date - tags.date > cacheTimeout) {
        this.tags().subscribe(tags =>
          this.storage.set({tags: {tags: tags, date: date}}).subscribe());
      }
      // but still return the cached tags for faster access
      return ObservableOf(tags.tags);
    }));
  }

  // update the cached object with all used tags and their frequency
  updateTagCache(addTags: string[], savedTags: string[]): Observable<any> {
    return this.storage.get('tags').pipe(mergeMap(cache => {
      let tags, date;
      if (cache && cache.tags && cache.date) {
        tags = cache.tags;
        date = cache.date;
      } else {
        tags = {};
        date = Date.now();
      }
      for (const tag of savedTags) {
        if (!addTags.includes[tag]) {
          if (tags.hasOwnProperty(tag)) {
            if (--tags[tag] <= 0) {
              delete tags[tag];
            }
          }
        }
      }
      for (const tag of addTags) {
        if (!savedTags.includes[tag]) {
          if (tags.hasOwnProperty(tag)) {
            ++tags[tag];
          } else {
            tags[tag] = 1;
          }
        }
      }
      return this.storage.set({tags: {tags: tags, date: date}});
    }));
  }

  // save the current tabs as tabset using the web form
  // (this operation is not provided by the Pinboard API)
  saveTabs(data): Observable<browser.tabs.Tab> {
    const params = new FormData();
    params.append('data', JSON.stringify(data));
    const post = this.http.post(tabsPage + 'save/', params);
    const show = ObservableFrom(browser.tabs.create(
      {url: tabsPage + 'show/'}));
    return post.pipe(switchMap(() => show));
  }

  // check if the given URL is valid (can be saved in Pinboard)
  isValidUrl(url: string): boolean {
    return url && /:\/\//.test(url);
  }

}
