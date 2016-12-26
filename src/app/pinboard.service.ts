import {Injectable} from '@angular/core';
import {Http, URLSearchParams} from "@angular/http";

import {Observable} from "rxjs";

import {StorageService} from "./storage.service";
import {Post} from "./pinpage/pinpage.component";

export const pinboardPage = 'https://pinboard.in/';

export const passwordPage = pinboardPage + 'settings/password';

const apiUrl = 'https://api.pinboard.in/v1/';

const cacheTimeout = 1000 * 60 * 60; // one hour cache time


// Service for dealing with the Pinboard API

@Injectable()
export class PinboardService {

  constructor(private http: Http, private storage: StorageService) { }

  // get an object via the Pinboard API
  httpGet(method: string, params?: any): Observable<any> {
    params = params || {};
    if (!params.auth_token)
      return this.storage.get('token').switchMap(token => {
          if (!token) Observable.throw(new Error('No API token!'));
          params.auth_token = token;
          return this.httpGet(method, params);
        });
    params.format = 'json';
    let search = new URLSearchParams();
    for (let key in params) search.set(key, params[key]);
    return this.http.get(
      apiUrl + method, {search: search}).map(res => res.json());
  }

  // check the given API token and memorize it if valid
  setToken(value: string): Observable<boolean> {
    let values = value.split(':', 2);
    if (values.length != 2) return Observable.of(false);
    return this.httpGet('user/api_token', {auth_token: value}).map(
      data => data.result == values[1]).switchMap(ok =>
        ok ? this.storage.set({token: value}).map(() => true) :
             Observable.of(false));
  }

  // check whether we still need an API token
  get needToken(): Observable<boolean> {
    return this.storage.get('token').map(res => !res);
  }

  // extract user name from API token
  get userName(): Observable<string> {
    return this.storage.get('token').map(res => res && res.split(':', 1)[0]
      ).filter(res => res);
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
    let params: any = {url: post.url, description: post.title};
    if (post.description) params.extended = post.description;
    if (post.tags) params.tags = post.tags;
    params.shared = post.unshared ? 'no' : 'yes';
    params.toread = post.toread ? 'yes' : 'no';
    return this.httpGet('posts/add', params).map(res =>
      res.result_code == 'done' ? null : res.result_code);
  }

  // delete bookmark with the given url
  delete(url): Observable<any> {
    return this.httpGet('posts/delete', {url: url});
  }

  // get suggested tags for the given url
  suggest(url): Observable<any> {
    return this.httpGet('posts/suggest', {url: url}).map(data => {
      let tags = {popular: [], recommended: []};
      for (let d of data) {
        if (d.popular) tags.popular.push(...d.popular);
        if (d.recommended) tags.recommended.push(...d.recommended);
      }
      return tags;
    });
  }

  // get post for the given url together with the suggested tags
  getAndSuggest(url): Observable<any> {
    return Observable.forkJoin([this.get(url), this.suggest(url)]).map(
      data => Object.assign(data[0], data[1]));
  }

  // get the list of all used tags (without the tag counters)
  tags(): Observable<string[]> {
    return this.httpGet('tags/get').map(
      tags => Object.keys(tags));
  }

  // get a cached list of all used tags
  cachedTags(): Observable<string[]> {
    return this.storage.get('tags').switchMap(tags => {
      let date = Date.now();
      if (!tags || !tags.tags || !tags.date) {
        // no tags cached, retrieve tags first from Pinboard
        return this.tags().do(tags =>
          this.storage.set({tags: {tags: tags, date: date}}).subscribe());
      }
      // replace outdated tags in the background
      if (tags.date > date || date - tags.date > cacheTimeout)
        this.tags().subscribe(tags =>
          this.storage.set({tags: {tags: tags, date: date}}).subscribe());
      // but still return the cached tags for faster access
      return Observable.of(tags.tags);
    });
  }

  // update the cached list of all used tags
  updateTagCache(tags: string[]): Observable<any> {
    if (!tags || !tags.length) return Observable.empty();
    return this.storage.get('tags').flatMap(oldtags => {
      let oldlist, olddate;
      if (oldtags && oldtags.tags && oldtags.date) {
        oldlist = oldtags.tags;
        olddate = oldtags.date;
      } else {
        oldlist = [];
        olddate = Date.now();
      }
      let oldlength = oldlist.length;
      let newtags = {};
      for (let tag of tags) newtags[tag] = true;
      for (let tag of oldlist) newtags[tag] = true;
      let newlist = Object.keys(newtags);
      if (newlist.length > oldlength)
        return this.storage.set({tags: {tags: newlist, date: olddate}});
      return Observable.empty();
    });
  }

}
