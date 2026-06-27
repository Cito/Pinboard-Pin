import { Service, inject } from "@angular/core";

import { throwError, Observable, of, from, EMPTY } from "rxjs";
import { filter, map, mergeMap, switchMap } from "rxjs/operators";

import { StorageService } from "./storage.service";
import {
  HttpClient,
  HttpParameterCodec,
  HttpParams,
} from "@angular/common/http";

// a bookmark to be saved to Pinboard (the payload of the save method)
export interface Post {
  url: string;
  title: string;
  description: string;
  tags: string;
  unshared: boolean;
  toread: boolean;
  noreplace: boolean;
}

// a single bookmark as returned by the Pinboard "posts/get" method
export interface BookmarkPost {
  href: string;
  description: string;
  extended: string;
  tags: string;
  shared: string;
  toread: string;
}

// the response of the Pinboard "posts/get" method
export interface BookmarkResponse {
  posts?: BookmarkPost[];
  date?: string;
}

// a single tab within a saved tabset
interface TabsetTab {
  title?: string;
  url?: string;
}

// the payload of the Pinboard tabset web form (a list of windows, each a
// list of tabs)
interface Tabset {
  browser: string;
  windows: TabsetTab[][];
}

// group the given browser tabs by window into the structure that the
// Pinboard tabset form expects
function groupTabsByWindow(tabs: browser.tabs.Tab[]): TabsetTab[][] {
  const wTabs: Record<number, Record<number, TabsetTab>> = {};
  for (const tab of tabs) {
    const wId = tab.windowId;
    if (wId === undefined) {
      continue;
    }
    if (!wTabs[wId]) {
      wTabs[wId] = {};
    }
    wTabs[wId][tab.index] = {
      title: tab.title ?? undefined,
      url: tab.url ?? undefined,
    };
  }
  return Object.keys(wTabs).map((wId) =>
    Object.keys(wTabs[Number(wId)]).map(
      (index) => wTabs[Number(wId)][Number(index)]
    )
  );
}

export const pinboardPage = "https://pinboard.in/";

export const passwordPage = pinboardPage + "settings/password";
const tabsPage = pinboardPage + "tabs/";

const apiUrl = "https://api.pinboard.in/v1/";

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

@Service()
export class PinboardService {
  private http = inject(HttpClient);
  private storage = inject(StorageService);

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
  get(url: string): Observable<BookmarkResponse> {
    return this.httpGet<BookmarkResponse>("posts/get", {
      url: url,
      meta: "no",
    });
  }

  // add or replace bookmark with given attributes
  // (resolves to null on success, or the Pinboard error code otherwise)
  save(post: Post): Observable<string | null> {
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
  delete(url: string): Observable<unknown> {
    return this.httpGet<unknown>("posts/delete", { url: url });
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

  // save all currently open normal browser tabs as a tabset; completes
  // without emitting when there are no matching tabs to save
  saveCurrentTabs(): Observable<browser.tabs.Tab> {
    return from(
      browser.tabs.query({ windowType: "normal", url: "*://*/*" })
    ).pipe(
      mergeMap((tabs) => {
        const windows = groupTabsByWindow(tabs);
        return windows.length
          ? this.saveTabs({ browser: "ffox", windows })
          : EMPTY;
      })
    );
  }

  // save the given tabset using the web form
  // (this operation is not provided by the Pinboard API)
  private saveTabs(data: Tabset): Observable<browser.tabs.Tab> {
    const params = new FormData();
    params.append("data", JSON.stringify(data));
    const post = this.http.post(tabsPage + "save/", params);
    const show = from(browser.tabs.create({ url: tabsPage + "show/" }));
    return post.pipe(switchMap(() => show));
  }

  // check if the given URL is valid (can be saved in Pinboard)
  isValidUrl(url: string): boolean {
    return !!url && /:\/\//.test(url);
  }
}
