import { Service, inject } from "@angular/core";

import { Observable, of } from "rxjs";
import { catchError, map, mergeMap, switchMap } from "rxjs/operators";

import { PinboardService } from "./pinboard.service";
import { StorageService } from "./storage.service";

// how long a cached tag list stays valid (one hour)
const cacheTimeout = 1000 * 60 * 60;

// the cached tag list as kept in extension storage
interface TagCache {
  tags?: { [tag: string]: number };
  date?: number;
}

// Service caching the list of all used tags (with their frequency) in
// extension storage, refreshing it from the Pinboard API when it expires

@Service()
export class TagCacheService {
  private pinboard = inject(PinboardService);
  private storage = inject(StorageService);

  // get the cached list of all used tags, refreshing it when it has expired
  get(): Observable<{ [tag: string]: number }> {
    return this.storage.get<TagCache | null>("tags").pipe(
      switchMap((cached) => {
        const date = Date.now();
        const needsRefresh =
          !cached ||
          !cached.tags ||
          !cached.date ||
          cached.tags instanceof Array || // old version used arrays
          cached.date > date ||
          date - cached.date > cacheTimeout;

        if (needsRefresh) {
          return this.pinboard.tags().pipe(
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
      })
    );
  }

  // update the cached tags and their frequency after a save or removal
  update(addTags: string[], savedTags: string[]): Observable<void> {
    return this.storage.get<TagCache | null>("tags").pipe(
      mergeMap((cache) => {
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
      })
    );
  }
}
