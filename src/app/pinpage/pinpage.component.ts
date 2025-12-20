// this component is the save bookmark dialog displayed in the popup

import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { AgoPipe } from "../interval.pipe";

import { Subscription, Subject, timer } from "rxjs";
import { debounceTime, distinctUntilChanged, finalize } from "rxjs/operators";

import { IconService } from "../icon.service";
import { PinboardService, pinboardPage } from "../pinboard.service";
import { Options, StorageService } from "../storage.service";
import { errorMessage, logError } from "../util";

const debounceDueTime = 250; // timeout in ms for reacting to changes
const maxCompletions = 9; // maximum number of suggested completions

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
  url: string;
  title: string;
  description: string;
  keywords: string[];
}

interface RawContent {
  url: string;
  title: string;
  selection: string;
  description: string;
  keywords: string;
}

// Pin page form
// TODO: This class is too big, should be refactored.
// At least the tag handling should go into sub component(s).

@Component({
  selector: "app-popup",
  templateUrl: "./pinpage.component.html",
  styleUrls: ["./pinpage.component.scss"],
  imports: [CommonModule, FormsModule, AgoPipe],
})
export class PinPageComponent implements OnInit, OnDestroy {
  url: string;
  title: string;
  description: string; // description
  tags: string; // current tags
  savedTags: string; // tags already saved for this URL
  allTags: { [tag: string]: number }; // all of our tags with frequency
  suggested: string[]; // recommended tags from our own
  popular: string[]; // other popular tags
  keywords: string[]; // keywords taken from the page
  completions: string[]; // tag completions
  tagsFocus: boolean; // whether the tags field has focus
  tagSelected: number; // index of the selected tag
  unshared: boolean;
  toread: boolean;
  ready: boolean;
  update: boolean;
  date: string;
  error: string | null;
  retry: boolean;
  options: Options;

  theme = "light"; // color scheme of the page

  private tagsSubject = new Subject<string>();
  private tagsSubscription: Subscription;

  constructor(
    private pinboard: PinboardService,
    private storage: StorageService,
    private icon: IconService,
    private router: Router,
    private eref: ElementRef,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.ready = false;
    this.update = false;
    this.error = null;
    this.retry = false;
    this.storage.getOptions().subscribe((options) => {
      this.options = options;
      this.setTheme();
      const getContent =
        options.meta || options.selection
          ? browser.tabs
              .executeScript(null, { file: "/js/content.js" })
              .then((content: Array<RawContent>) =>
                this.processContent(content[0])
              )
              .catch(() => this.getContent())
          : this.getContent();
      void getContent.then(
        (content: Content) => {
          this.setContent(content);
          this.cdr.detectChanges();
        },
        (error: unknown) => {
          this.logError("Can only pin normal web pages.", errorMessage(error));
          this.cdr.detectChanges();
        }
      );
    });
    this.tagsFocus = false;
    this.tagsSubscription = this.tagsSubject
      .pipe(debounceTime(debounceDueTime), distinctUntilChanged())
      .subscribe((value: string) => this.tagsChanged(value));
  }

  ngOnDestroy() {
    this.tagsSubscription.unsubscribe();
  }

  setTheme() {
    this.theme =
      this.options.dark === true ||
      (this.options.dark !== false &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
  }

  // process the data gathered by the content script
  processContent(content: RawContent): Content {
    let { url, title } = content;
    url = url || null;
    title = title
      ? title.length > 255 // trim title
        ? title.slice(0, 254) + "\u2026"
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
          description.slice(0, 3199) + "\u2026"
        : description
      : null;
    let keywords: string[] = [];
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
    keywords = keywords.length ? keywords.slice(0, 6400) : null;
    return { url, title, description, keywords };
  }

  // get url and title of content (used if content script cannot run)
  getContent(): Promise<Content> {
    return browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => tabs[0])
      .then((tab) => ({
        url: tab.url,
        title: tab.title,
        description: null,
        keywords: null,
      }));
  }

  // store info on current content in the form inputs
  setContent(content: Content): void {
    if (content && content.url && this.pinboard.isValidUrl(content.url)) {
      this.url = content.url;
      this.title = content.title;
      this.description = content.description;
      if (this.description && this.options.blockquote) {
        this.description =
          "<blockquote>" +
          this.description.slice(0, 3200 - 25) +
          "</blockquote>";
      }
      this.keywords = content.keywords;
      this.tags = null;
      this.unshared = this.options.unshared;
      this.toread = this.options.toread;
      this.retry = true;
      this.suggested = this.popular = null;
      // query both page data and suggested tags
      this.pinboard.getAndSuggest(this.url).subscribe({
        next: (data: unknown) =>
          this.setData(
            data as {
              posts?: Array<{
                href: string;
                description: string;
                extended: string;
                tags: string;
                shared: string;
                toread: string;
              }>;
            } & { popular?: string[]; recommended?: string[] } & {
              date?: string;
            }
          ),
        error: (error: unknown) =>
          this.logError(
            "Cannot check this page on Pinboard.",
            errorMessage(error)
          ),
      });
    } else {
      this.logError(
        "Can only pin normal web pages.",
        "Cannot get the URL of the page"
      );
    }
  }

  // receive page data and suggested tags from parallel queries
  setData(
    data: {
      posts?: Array<{
        href: string;
        description: string;
        extended: string;
        tags: string;
        shared: string;
        toread: string;
      }>;
    } & { popular?: string[]; recommended?: string[] } & { date?: string }
  ): void {
    if (data.posts && data.posts.length) {
      this.date = data?.date;
      const post = data.posts[0];
      this.url = post.href;
      this.title = post.description;
      this.description = post.extended;
      this.tags = post.tags;
      this.unshared = post.shared !== "yes";
      this.toread = post.toread === "yes";
      this.update = true;
      // set browser icon to saved state
      void browser.tabs.query({ url: this.url }).then(
        (tabs: browser.tabs.Tab[]) => {
          for (const tab of tabs) {
            this.icon.setIcon(tab.id, true);
          }
        },
        (error: unknown) => logError(error)
      );
    }
    // Note: "popular" and "recommended" are interchanged in Pinboard
    if (data.popular) {
      this.suggested = data.popular;
    }
    if (this.options.popular && data.recommended) {
      this.popular = data.recommended;
    }
    this.pinboard
      .cachedTags()
      .pipe(finalize(() => this.cdr.detectChanges()))
      .subscribe({
        next: (tags) => {
          this.allTags = tags;
          if (this.tags) {
            this.tags = this.tags.trim();
            this.savedTags = this.tags;
            this.tags += " ";
          } else {
            this.savedTags = null;
          }
          this.completions = null;
          this.setReady();
        },
      });
  }

  // set form as ready for input
  setReady(): void {
    this.ready = true;
    this.cdr.detectChanges();
    // wait until inputs have been enabled, then focus
    timer(0).subscribe(() => {
      const focus = this.url
        ? this.title
          ? this.tags && !this.description
            ? "description"
            : "tags"
          : "title"
        : "url";
      const element = (this.eref.nativeElement as HTMLElement).querySelector(
        "#" + focus
      );
      if (element instanceof HTMLElement) {
        element.focus();
      }
    });
  }

  // check whether the given tags have already been added
  hasTags(tags: string | string[]): boolean {
    if (!this.tags) {
      return false;
    }
    if (!Array.isArray(tags)) {
      tags = [tags];
    }
    const allTags = this.tags.split(" ").filter((tag) => !!tag);
    return tags.every((tag) => allTags.includes(tag));
  }

  // add the given tags if they have not already been added, otherwise remove
  addTags(tags: string | string[]): void {
    if (!Array.isArray(tags)) {
      tags = [tags];
    }
    let allTags = (this.tags || "").split(" ").filter((tag) => !!tag);
    const newTags = tags.filter((tag) => !allTags.includes(tag));
    if (newTags.length) {
      // some tags are new
      allTags.push(...newTags); // add these tags
    } else {
      // all tags have already been added, remove these tags again
      allTags = allTags.filter((tag) => !tags.includes(tag));
    }
    this.tags = allTags.join(" ");
  }

  // this method is called when keys have been pressed down in the tabs field
  tagsKeyDown(event: KeyboardEvent): boolean {
    if (!this.ready || !this.tagsFocus || !this.completions) {
      return true;
    }
    // Firefox reacts to some of our control keys as well, so to prevent this
    // from happening, we have to listen here before the key has been pressed
    let control = true;
    switch (event.code) {
      case "Home":
        this.tagSelected = 0;
        break;
      case "End":
        this.tagSelected = this.completions.length - 1;
        break;
      case "ArrowDown":
        if (this.tagSelected < this.completions.length - 1) {
          ++this.tagSelected;
        }
        break;
      case "ArrowUp":
        if (this.tagSelected > 0) {
          --this.tagSelected;
        }
        break;
      case "Enter":
      case "Tab":
      case "ArrowRight":
        const tag = this.completions[this.tagSelected];
        const inputElement = event.target as HTMLInputElement;
        let value = inputElement.value;
        const words = value.split(" ");
        if (words.length) {
          words.pop();
        }
        if (!words.includes(tag)) {
          words.push(tag);
          value = words.join(" ") + " ";
          this.tagsChanged(value);
          this.tags = value;
        }
        break;
      default:
        control = false;
    }
    return !control;
  }

  // this method is called when keys have been released in the tabs field
  tagsKeyUp(event: KeyboardEvent): boolean {
    // the field value is changed after the key has been pressed,
    // so this is the right moment for checking for value changes
    if (this.ready && this.tagsFocus) {
      this.tagsSubject.next((event.target as HTMLInputElement).value);
    }
    return true;
  }

  // this method is called with debounce when tags have changed
  // it must then determine the list of tag completions
  tagsChanged(tags: string): void {
    const words = tags.replace(",", " ").split(" ");
    let word = words.length ? words.pop() : null;
    const allTags = this.allTags;
    const matches: [string, number][] = [];
    const alpha = this.options.alpha;
    if (word) {
      word = word.toLowerCase();
      for (const tag of Object.keys(allTags)) {
        if (tag.toLowerCase().startsWith(word) && !words.includes(tag)) {
          matches.push([tag, alpha ? 0 : allTags[tag]]);
        }
      }
    }
    // sort matching tags by decreasing frequency
    matches.sort(
      (a: [string, number], b: [string, number]) =>
        b[1] - a[1] || a[0].localeCompare(b[0])
    );
    matches.splice(maxCompletions);
    const completions: string[] = matches.map((a) => a[0]).reverse();
    if (completions.length) {
      const oldCompletions = this.completions;
      if (
        !oldCompletions ||
        completions.length !== oldCompletions.length ||
        completions.some((tag, i) => completions[i] !== oldCompletions[i])
      ) {
        this.completions = completions;
        this.tagSelected = completions.length - 1;
      }
    } else {
      this.completions = null;
    }
  }

  // this method is called when a tag completion was clicked
  selectCompletion(tag: string): boolean {
    let value = this.tags || "";
    const words = value.split(" ");
    if (words.length) {
      words.pop();
    }
    if (!words.includes(tag)) {
      words.push(tag);
      value = words.join(" ") + " ";
      this.tagsChanged(value);
      this.tags = value;
    }
    return false;
  }

  // delete the current bookmark
  remove(): boolean {
    if (this.ready && this.update && this.url) {
      this.pinboard.delete(this.url).subscribe({
        next: () => {
          // update the tags in the cache
          const savedTags = this.savedTags ? this.savedTags.split(" ") : [];
          this.pinboard
            .updateTagCache([], savedTags)
            .pipe(
              finalize(
                // set the browser icon to unsaved state
                () =>
                  void browser.tabs.query({ url: this.url }).then(
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
    this.error = null;
    return false;
  }

  // submit form
  submit(form: NgForm): boolean {
    if (form.valid) {
      this.save(form.value as Post);
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
    value.description = (value.description || "").trim() || null;
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
                  void browser.tabs.query({ url: this.url }).then(
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
    this.error = errmsg ? errorMessage(errmsg) : null;
    this.cdr.detectChanges();
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
