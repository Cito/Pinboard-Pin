import {Injectable} from '@angular/core';

import {Observable} from 'rxjs/Observable';
import {filter, map, mergeMap, switchMap, tap} from 'rxjs/operators';
import {empty as EmptyObservable} from 'rxjs/observable/empty';
import {of as ObservableOf} from 'rxjs/observable/of';
import {forkJoin} from 'rxjs/observable/forkJoin';

import {StorageService} from './storage.service';
import {Post} from './pinpage/pinpage.component';
import {HttpClient, HttpParams} from '@angular/common/http';

export const pinboardPage = 'https://pinboard.in/';

export const passwordPage = pinboardPage + 'settings/password';

const apiUrl = 'https://api.pinboard.in/v1/';

const cacheTimeout = 1000 * 60 * 60; // one hour cache time


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
          Observable.throw(new Error('No API token!'));
        }
        params.auth_token = token;
        return this.httpGet(method, params);
      }));
    }
    params.format = 'json';
    const httpParams = Object.entries(params).reduce(
      (params, [key, value]) => params.set(key, value), new HttpParams());
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

  // get the list of all used tags (without the tag counters)
  tags(): Observable<string[]> {
    return this.httpGet('tags/get').pipe(
      map(tags => Object.keys(tags)));
  }

  // get a cached list of all used tags
  cachedTags(): Observable<string[]> {
    return this.storage.get('tags').pipe(switchMap(tags => {
      const date = Date.now();
      if (!tags || !tags.tags || !tags.date) {
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

  // update the cached list of all used tags
  updateTagCache(tags: string[]): Observable<any> {
    if (!tags || !tags.length) {
      return EmptyObservable();
    }
    return this.storage.get('tags').pipe(mergeMap(oldtags => {
      let oldList, oldDate;
      if (oldtags && oldtags.tags && oldtags.date) {
        oldList = oldtags.tags;
        oldDate = oldtags.date;
      } else {
        oldList = [];
        oldDate = Date.now();
      }
      const oldLength = oldList.length;
      const newTags = {};
      for (const tag of tags) {
        newTags[tag] = true;
      }
      for (const tag of oldList) {
        newTags[tag] = true;
      }
      const newList = Object.keys(newTags);
      if (newList.length > oldLength) {
        return this.storage.set({tags: {tags: newList, date: oldDate}});
      }
      return EmptyObservable();
    }));
  }

}
