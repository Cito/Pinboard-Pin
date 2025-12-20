import { Injectable } from "@angular/core";

import { throwError, Observable, of, forkJoin, from } from "rxjs";
import { catchError, filter, map, mergeMap, switchMap } from "rxjs/operators";

import { StorageService } from "./storage.service";
import { Post } from "./pinpage/pinpage.component";
import {
  HttpClient,
  HttpParameterCodec,
  HttpParams,
} from "@angular/common/http";

export const pinboardPage = "https://pinboard.in/";

export const passwordPage = pinboardPage + "settings/password";
const tabsPage = pinboardPage + "tabs/";

const apiUrl = "https://api.pinboard.in/v1/";

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

@Injectable({ providedIn: "root" })
export class PinboardService {
  constructor(private http: HttpClient, private storage: StorageService) {}

  // get an object via the Pinboard API
  httpGet<T = any>(
    method: string,
    params?: Record<string, string>
  ): Observable<T> {
    const p: Record<string, string> = params ?? {};
    if (!p.auth_token) {
      return this.storage.get("token").pipe(
        switchMap((token) => {
          if (typeof token !== "string" || !token) {
            return throwError(() => new Error("No API token!"));
          }
          p.auth_token = token;
          return this.httpGet<T>(method, p);
        })
      );
    }
    p.format = "json";
    const httpParams = Object.entries(p).reduce(
      (params: HttpParams, [key, value]: [string, string]) =>
        params.set(key, value),
      new HttpParams({ encoder: paramsEncoder })
    );
    return this.http.get<T>(apiUrl + method, { params: httpParams });
  }

  // check the given API token and memorize it if valid
  setToken(value: string): Observable<boolean> {
    const values = value.split(":", 2);
    if (values.length !== 2) {
      return of(false);
    }
    return this.httpGet<{ result: string }>("user/api_token", {
      auth_token: value,
    }).pipe(
      map((data) => data.result === values[1]),
      switchMap((ok) =>
        ok
          ? this.storage.set({ token: value }).pipe(map(() => true))
          : of(false)
      )
    );
  }

  // check whether we still need an API token
  get needToken(): Observable<boolean> {
    return this.storage.get("token").pipe(map((res) => !res));
  }

  // extract user name from API token
  get userName(): Observable<string> {
    return this.storage.get("token").pipe(
      map((res) =>
        typeof res === "string" ? res.split(":", 1)[0] : undefined
      ),
      filter((res): res is string => !!res)
    );
  }

  // forget the API token
  forgetToken(): Observable<any> {
    // also clear the tags cache when leaving
    return this.storage.remove(["token", "tags"]);
  }

  // get bookmark with the given url
  get(url: string): Observable<any> {
    return this.httpGet("posts/get", { url: url, meta: "no" });
  }

  // add or replace bookmark with given attributes
  save(post: Post): Observable<string> {
    const params: Record<string, string> = {
      url: post.url,
      description: post.title,
      dt: new Date().toISOString(),
    };
    if (post.description) {
      params.extended = post.description;
    }
    if (post.tags) {
      params.tags = post.tags;
    }
    params.replace = post.noreplace ? "no" : "yes";
    params.shared = post.unshared ? "no" : "yes";
    params.toread = post.toread ? "yes" : "no";
    return this.httpGet<{ result_code: string }>("posts/add", params).pipe(
      map((res) => (res.result_code === "done" ? null : res.result_code))
    );
  }

  // delete bookmark with the given url
  delete(url: string): Observable<any> {
    return this.httpGet("posts/delete", { url: url });
  }

  // get suggested tags for the given url
  suggest(
    url: string
  ): Observable<{ popular: string[]; recommended: string[] }> {
    return this.httpGet<Array<{ popular?: string[]; recommended?: string[] }>>(
      "posts/suggest",
      { url: url }
    ).pipe(
      map((data) => {
        const tags = { popular: [] as string[], recommended: [] as string[] };
        for (const d of data) {
          if (d.popular) {
            tags.popular.push(...d.popular);
          }
          if (d.recommended) {
            tags.recommended.push(...d.recommended);
          }
        }
        return tags;
      })
    );
  }

  // get post for the given url together with the suggested tags
  getAndSuggest(url: string): Observable<any> {
    return forkJoin([this.get(url), this.suggest(url)]).pipe(
      map(([post, tags]) =>
        Object.assign(post as Record<string, unknown>, tags)
      )
    );
  }

  // get the list of all used tags (with numeric tag counters)
  tags(): Observable<{ [tag: string]: number }> {
    return this.httpGet<Record<string, string>>("tags/get").pipe(
      map((tags) => {
        const result: Record<string, number> = {};
        for (const tag of Object.keys(tags)) {
          result[tag] = +tags[tag];
        }
        return result;
      })
    );
  }

  // get a cached list of all used tags
  cachedTags(): Observable<{ [tag: string]: number }> {
    return this.storage.get("tags").pipe(
      switchMap(
        (
          cached: { tags?: { [tag: string]: number }; date?: number } | null
        ) => {
          const date = Date.now();
          const needsRefresh =
            !cached ||
            !cached.tags ||
            !cached.date ||
            cached.tags instanceof Array || // old version used arrays
            cached.date > date ||
            date - cached.date > cacheTimeout;

          if (needsRefresh) {
            return this.tags().pipe(
              switchMap((freshTags) =>
                this.storage.set({ tags: { tags: freshTags, date } }).pipe(
                  catchError(() => of(null)), // ignore cache write failures
                  map(() => freshTags)
                )
              ),
              catchError(() => of({} as { [tag: string]: number }))
            );
          }

          return of(cached.tags as { [tag: string]: number });
        }
      )
    );
  }

  // update the cached object with all used tags and their frequency
  updateTagCache(addTags: string[], savedTags: string[]): Observable<any> {
    return this.storage.get("tags").pipe(
      mergeMap(
        (cache: { tags?: { [tag: string]: number }; date?: number } | null) => {
          let tags: { [tag: string]: number }, date: number;
          if (cache && cache.tags && cache.date) {
            tags = cache.tags;
            date = cache.date;
          } else {
            tags = {};
            date = Date.now();
          }
          for (const tag of savedTags) {
            if (!addTags.includes(tag)) {
              if (Object.hasOwn(tags, tag)) {
                if (--tags[tag] <= 0) {
                  delete tags[tag];
                }
              }
            }
          }
          for (const tag of addTags) {
            if (!savedTags.includes(tag)) {
              if (Object.hasOwn(tags, tag)) {
                ++tags[tag];
              } else {
                tags[tag] = 1;
              }
            }
          }
          return this.storage.set({ tags: { tags: tags, date: date } });
        }
      )
    );
  }

  // save the current tabs as tabset using the web form
  // (this operation is not provided by the Pinboard API)
  saveTabs(data: any): Observable<browser.tabs.Tab> {
    const params = new FormData();
    params.append("data", JSON.stringify(data));
    const post = this.http.post(tabsPage + "save/", params);
    const show = from(browser.tabs.create({ url: tabsPage + "show/" }));
    return post.pipe(switchMap(() => show));
  }

  // check if the given URL is valid (can be saved in Pinboard)
  isValidUrl(url: string): boolean {
    return url && /:\/\//.test(url);
  }
}
