// this component is the save bookmark dialog displayed in the popup

import {
  Component,
  ElementRef,
  OnInit,
  Injector,
  afterNextRender,
  signal,
  inject,
} from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { Router } from "@angular/router";
import { AgoPipe } from "../interval.pipe";

import { finalize, timeout } from "rxjs/operators";

import { IconService } from "../icon.service";
import { PinboardService, pinboardPage } from "../pinboard.service";
import { Options, StorageService } from "../storage.service";
import { errorMessage, logError, resolveTheme } from "../util";
import { TagEditorComponent } from "./tag-editor.component";

// timeout in ms after which we stop waiting for the content script;
// this is needed because executeScript() never settles on pages where
// content scripts cannot be injected (e.g. the built-in PDF viewer)
const contentScriptTimeout = 1000;
// timeout in ms for the Pinboard bookmark lookup; this blocks the form, so
// it is kept short: the lookup is normally fast, and if it stalls we want to
// fall back to a usable form quickly rather than keep showing "Loading..."
const pinboardLookupTimeout = 5000;
// timeout in ms for the suggested tags; this runs in the background and does
// not block the form, so it is kept generous because Pinboard's "suggest"
// call analyzes the page server-side and can be slow (e.g. for PDF pages)
const pinboardSuggestTimeout = 10000;

export interface Post {
  url: string;
  title: string;
  description: string;
  tags: string;
  unshared: boolean;
  toread: boolean;
  noreplace: boolean;
}

interface Content {
  url: string | null;
  title: string | null;
  description: string | null;
  keywords: string[] | null;
}

interface RawContent {
  url: string;
  title: string;
  selection: string;
  description: string;
  keywords: string;
}

// Pin page form (the tag handling lives in the TagEditorComponent)

@Component({
  selector: "app-popup",
  templateUrl: "./pinpage.component.html",
  styleUrls: ["./pinpage.component.scss"],
  imports: [FormsModule, AgoPipe, TagEditorComponent],
})
export class PinPageComponent implements OnInit {
  private pinboard = inject(PinboardService);
  private storage = inject(StorageService);
  private icon = inject(IconService);
  private router = inject(Router);
  private eref = inject(ElementRef);
  private injector = inject(Injector);

  // form fields
  readonly url = signal("");
  readonly title = signal<string | null>(null);
  readonly description = signal<string | null>(null);
  readonly tags = signal<string | null>(null); // current tags
  readonly unshared = signal(false);
  readonly toread = signal(false);

  // tags already saved for this URL (used to diff the tag cache on save)
  savedTags: string | null = null;
  // all of our tags with frequency, passed to the tag editor for completions
  readonly allTags = signal<{ [tag: string]: number }>({});

  readonly suggested = signal<string[] | null>(null); // recommended tags from our own
  readonly popular = signal<string[] | null>(null); // other popular tags
  readonly keywords = signal<string[] | null>(null); // keywords taken from the page
  readonly ready = signal(false);
  readonly update = signal(false);
  readonly date = signal<string | undefined>(undefined);
  readonly error = signal<string | null>(null);
  readonly retry = signal(false);

  readonly theme = signal("light"); // color scheme of the page

  private options!: Options;

  // expose the alpha-sort option to the tag editor (false until options load)
  protected get sortAlpha(): boolean {
    return this.options ? this.options.alpha : false;
  }

  ngOnInit() {
    this.ready.set(false);
    this.update.set(false);
    this.error.set(null);
    this.retry.set(false);
    this.storage.getOptions().subscribe((options) => {
      this.options = options;
      // apply the theme right away; the signal schedules a repaint so the
      // popup does not stay light while the page content is loading
      this.setTheme();
      const getContent =
        options.meta || options.selection
          ? Promise.race([
              browser.tabs
                .executeScript({ file: "/js/content.js" })
                .then((content: Array<RawContent>) =>
                  this.processContent(content[0])
                ),
              // guard against executeScript() never settling (e.g. PDF viewer)
              new Promise<Content>((_resolve, reject) =>
                setTimeout(
                  () => reject(new Error("content script timed out")),
                  contentScriptTimeout
                )
              ),
            ]).catch(() => this.getContent())
          : this.getContent();
      void getContent.then(
        (content: Content) => this.setContent(content),
        (error: unknown) =>
          this.logError("Can only pin normal web pages.", errorMessage(error))
      );
    });
  }

  setTheme() {
    this.theme.set(resolveTheme(this.options.dark));
  }

  // process the data gathered by the content script
  processContent(content: RawContent): Content {
    let url: string | null = content.url;
    let title: string | null = content.title;
    url = url || null;
    title = title
      ? title.length > 255 // trim title
        ? title.slice(0, 254) + "…"
        : title
      : null;
    const options = this.options;
    let description = options.selection ? content.selection : null;
    if (!description && options.meta) {
      description = content.description;
    }
    description = description
      ? description.length > 3200
        ? // trim description (actual max. size seems to be 3798 chars)
          description.slice(0, 3199) + "…"
        : description
      : null;
    const keywords: string[] = [];
    if (options.meta && content.keywords) {
      for (let word of content.keywords.split(",")) {
        word = word.replace(/\s+/, "").slice(0, 255).toLowerCase();
        if (word && !keywords.includes(word)) {
          keywords.push(word);
          if (keywords.length >= 100) {
            break;
          }
        }
      }
    }
    return {
      url,
      title,
      description,
      keywords: keywords.length ? keywords.slice(0, 6400) : null,
    };
  }

  // get url and title of content (used if content script cannot run)
  getContent(): Promise<Content> {
    return browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => tabs[0])
      .then((tab) => ({
        url: tab.url ?? null,
        title: tab.title ?? null,
        description: null,
        keywords: null,
      }));
  }

  // store info on current content in the form inputs
  setContent(content: Content): void {
    if (content && content.url && this.pinboard.isValidUrl(content.url)) {
      this.url.set(content.url);
      this.title.set(content.title);
      let description = content.description;
      if (description && this.options.blockquote) {
        description =
          "<blockquote>" + description.slice(0, 3200 - 25) + "</blockquote>";
      }
      this.description.set(description);
      this.keywords.set(content.keywords);
      this.tags.set(null);
      this.unshared.set(this.options.unshared);
      this.toread.set(this.options.toread);
      this.retry.set(true);
      this.suggested.set(null);
      this.popular.set(null);
      // Look up any existing bookmark for this page and enable the form as
      // soon as that (fast) query returns. The suggested tags are fetched
      // separately below and must not block the form: Pinboard's "suggest"
      // call analyzes the page server-side and can be slow, in particular
      // for PDF pages, which used to make the popup appear to hang.
      this.pinboard
        .get(this.url())
        .pipe(timeout(pinboardLookupTimeout))
        .subscribe({
          next: (data: unknown) =>
            this.setPost(
              data as {
                posts?: Array<{
                  href: string;
                  description: string;
                  extended: string;
                  tags: string;
                  shared: string;
                  toread: string;
                }>;
                date?: string;
              }
            ),
          // if the lookup fails or stalls, do not hang: log it and still
          // let the user add the bookmark, just without the existing data
          error: (error: unknown) => {
            logError(errorMessage(error));
            this.loadTagsAndSetReady();
          },
        });
      // fetch the suggested tags in the background; this does not block the
      // form and just fills in the suggestions once (and if) they arrive
      this.pinboard
        .suggest(this.url())
        .pipe(timeout(pinboardSuggestTimeout))
        .subscribe({
          next: (tags) => this.setSuggestions(tags),
          error: (error: unknown) => logError(errorMessage(error)),
        });
    } else {
      this.logError(
        "Can only pin normal web pages.",
        "Cannot get the URL of the page"
      );
    }
  }

  // receive the existing bookmark (if any) for the current page
  setPost(data: {
    posts?: Array<{
      href: string;
      description: string;
      extended: string;
      tags: string;
      shared: string;
      toread: string;
    }>;
    date?: string;
  }): void {
    if (data.posts && data.posts.length) {
      this.date.set(data?.date);
      const post = data.posts[0];
      this.url.set(post.href);
      this.title.set(post.description);
      this.description.set(post.extended);
      this.tags.set(post.tags);
      this.unshared.set(post.shared !== "yes");
      this.toread.set(post.toread === "yes");
      this.update.set(true);
      // set browser icon to saved state
      void browser.tabs.query({ url: this.url() }).then(
        (tabs: browser.tabs.Tab[]) => {
          for (const tab of tabs) {
            this.icon.setIcon(tab.id, true);
          }
        },
        (error: unknown) => logError(error)
      );
    }
    this.loadTagsAndSetReady();
  }

  // receive the suggested tags (fetched in the background)
  setSuggestions(tags: { popular: string[]; recommended: string[] }): void {
    // Note: "popular" and "recommended" are interchanged in Pinboard
    if (tags.popular) {
      this.suggested.set(tags.popular);
    }
    if (this.options.popular && tags.recommended) {
      this.popular.set(tags.recommended);
    }
  }

  // load the cached tags and then enable the form for input
  loadTagsAndSetReady(): void {
    this.pinboard.cachedTags().subscribe({
      next: (tags) => {
        this.allTags.set(tags);
        const current = this.tags();
        if (current) {
          const trimmed = current.trim();
          this.savedTags = trimmed;
          this.tags.set(trimmed + " ");
        } else {
          this.savedTags = null;
        }
        this.setReady();
      },
    });
  }

  // set form as ready for input
  setReady(): void {
    this.ready.set(true);
    // focus the most relevant field once the enabled inputs have rendered
    // (setting `ready` schedules the render; afterNextRender runs after it)
    afterNextRender(
      () => {
        const focus = this.url()
          ? this.title()
            ? this.tags() && !this.description()
              ? "description"
              : "tags"
            : "title"
          : "url";
        const element = (
          this.eref.nativeElement as HTMLElement
        ).querySelector("#" + focus);
        if (element instanceof HTMLElement) {
          element.focus();
        }
      },
      { injector: this.injector }
    );
  }

  // delete the current bookmark
  remove(): boolean {
    if (this.ready() && this.update() && this.url()) {
      this.pinboard.delete(this.url()).subscribe({
        next: () => {
          // update the tags in the cache
          const savedTags = this.savedTags ? this.savedTags.split(" ") : [];
          this.pinboard
            .updateTagCache([], savedTags)
            .pipe(
              finalize(
                // set the browser icon to unsaved state
                () =>
                  void browser.tabs.query({ url: this.url() }).then(
                    (tabs: browser.tabs.Tab[]) => {
                      for (const tab of tabs) {
                        this.icon.setIcon(tab.id, false);
                      }
                      this.cancel();
                    },
                    (error: unknown) => {
                      logError(error);
                      this.cancel();
                    }
                  )
              )
            )
            .subscribe();
        },
        error: (error: unknown) => {
          this.logError(
            "Sorry, could not remove this page from Pinboard",
            errorMessage(error)
          );
        },
      });
    }
    return false;
  }

  // reset error message
  reset(): boolean {
    this.error.set(null);
    return false;
  }

  // submit form
  submit(form: NgForm): boolean {
    if (form.valid) {
      // the tags field lives in the child tag editor, not the form
      this.save({ ...(form.value as Post), tags: this.tags() ?? "" });
    }
    return false;
  }

  // save page to Pinboard
  save(value: Post): void {
    value.url = (value.url || "").trim();
    value.title = (value.title || "").trim();
    if (!value.url || !value.title) {
      return;
    }
    value.description = (value.description || "").trim();
    // clean up tags, maximum of 100 tags with 255 chars each
    const tags = value.tags
      ? value.tags
          .split(" ")
          .filter((tag) => !!tag)
          .slice(0, 100)
          .map((tag) => tag.slice(0, 255))
      : [];
    value.tags = tags.join(" ");
    const savedTags = this.savedTags ? this.savedTags.split(" ") : [];
    this.pinboard.save(value).subscribe({
      next: (error: unknown) => {
        if (error) {
          this.logError(
            "Sorry, could not save this page to Pinboard",
            errorMessage(error)
          );
        } else {
          this.pinboard
            .updateTagCache(tags, savedTags)
            .pipe(
              finalize(
                () =>
                  void browser.tabs.query({ url: this.url() }).then(
                    (tabs: browser.tabs.Tab[]) => {
                      for (const tab of tabs) {
                        this.icon.setIcon(tab.id, true);
                      }
                      this.cancel();
                    },
                    (error: unknown) => {
                      logError(error);
                      this.cancel();
                    }
                  )
              )
            )
            .subscribe();
        }
      },
      error: (error: unknown) => {
        this.logError(
          "Sorry, could not save this page to Pinboard",
          errorMessage(error)
        );
      },
    });
  }

  // save current tabs as tab set to Pinboard
  saveTabs(): void {
    void browser.tabs
      .query({ windowType: "normal", url: "*://*/*" })
      .then((tabs: browser.tabs.Tab[]) => {
        const wTabs: Record<
          number,
          Record<number, { title?: string; url?: string }>
        > = {};
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
        const windows = Object.keys(wTabs).map((wId) =>
          Object.keys(wTabs[Number(wId)]).map(
            (index) => wTabs[Number(wId)][Number(index)]
          )
        );
        if (windows.length) {
          const data = {
            browser: "ffox",
            windows: windows,
          };
          this.pinboard.saveTabs(data).subscribe({
            next: () => {
              this.cancel();
            },
            error: (error: unknown) => {
              this.logError(
                "Sorry, could not save this tab set to Pinboard.",
                errorMessage(error)
              );
            },
          });
        }
      });
  }

  // navigate to options
  settings(): void {
    // store a note that we are showing on a popup page
    this.storage.setInfo("options.page", "popup");
    void this.router.navigate(["/options"]);
  }

  // log out from Pinboard
  logOut(): void {
    void this.pinboard.forgetToken().subscribe({
      next: () => void this.router.navigate(["/login"]),
    });
  }

  // show error message and log it on the console
  logError(errmsg: unknown, logmsg: unknown): void {
    if (errmsg) {
      logError(logmsg ?? errmsg);
    }
    this.error.set(errmsg ? errorMessage(errmsg) : null);
  }

  pinboardLink(page: unknown): boolean {
    const pageStr =
      typeof page === "string"
        ? page
        : typeof page === "number"
        ? String(page)
        : JSON.stringify(page);
    if (pageStr && pageStr.includes("~")) {
      void this.pinboard.userName.subscribe({
        next: (name: unknown) => {
          const nameStr =
            typeof name === "string"
              ? name
              : typeof name === "number"
              ? String(name)
              : JSON.stringify(name);
          this.pinboardLink(pageStr.replace("~", "u:" + nameStr));
        },
      });
    } else {
      let url = pinboardPage;
      if (pageStr) {
        url += pageStr;
      }
      void browser.tabs.create({ url: url });
      this.cancel();
    }
    return false;
  }

  // close the whole popup
  cancel(): void {
    window.close();
  }
}
