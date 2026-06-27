// this component is the save bookmark dialog displayed in the popup

import {
  Component,
  ElementRef,
  OnInit,
  Injector,
  afterNextRender,
  computed,
  signal,
  inject,
} from "@angular/core";
import {
  form,
  FormField,
  required,
  maxLength,
  disabled,
} from "@angular/forms/signals";
import { Router } from "@angular/router";
import { AgoPipe } from "../interval.pipe";

import { finalize, timeout } from "rxjs/operators";

import { ContentService, Content } from "../content.service";
import { TagsService } from "../tags.service";
import { IconService } from "../icon.service";
import {
  BookmarkResponse,
  PinboardService,
  pinboardPage,
  Post,
} from "../pinboard.service";
import { defaultOptions, Options, StorageService } from "../storage.service";
import { errorMessage, logError, resolveTheme } from "../util";
import { TaggingComponent } from "./tagging.component";

// timeout in ms for the Pinboard bookmark lookup; this blocks the form, so
// it is kept short: the lookup is normally fast, and if it stalls we want to
// fall back to a usable form quickly rather than keep showing "Loading..."
const pinboardLookupTimeout = 5000;
// timeout in ms for the suggested tags; this runs in the background and does
// not block the form, so it is kept generous because Pinboard's "suggest"
// call analyzes the page server-side and can be slow (e.g. for PDF pages)
const pinboardSuggestTimeout = 10000;

// the editable bookmark fields backing the signal form; the tags live in the
// child TaggingComponent and noreplace is not user-editable, so both are
// excluded here and merged back into a Post on save
type PinForm = Omit<Post, "tags" | "noreplace">;

// Pin page form (the tag handling lives in the TaggingComponent)

@Component({
  selector: "app-popup",
  templateUrl: "./pinpage.component.html",
  styleUrls: ["./pinpage.component.scss"],
  imports: [FormField, AgoPipe, TaggingComponent],
})
export class PinPageComponent implements OnInit {
  private pinboard = inject(PinboardService);
  private content = inject(ContentService);
  private tagCache = inject(TagsService);
  private storage = inject(StorageService);
  private icon = inject(IconService);
  private router = inject(Router);
  private eref = inject(ElementRef);
  private injector = inject(Injector);

  // the editable bookmark fields, bound to the signal form below
  readonly model = signal<PinForm>({
    url: "",
    title: "",
    description: "",
    unshared: false,
    toread: false,
  });

  // current tags as a space separated string (two-way bound to the tag editor)
  readonly tags = signal<string | null>(null);

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

  // signal form over the editable fields; the [formField] directive binds the
  // validators (required/maxlength) to the native controls and keeps every
  // field disabled until the bookmark data has finished loading
  readonly form = form(this.model, (field) => {
    required(field.url);
    maxLength(field.url, 2000);
    required(field.title);
    maxLength(field.title, 255);
    maxLength(field.description, 3200);
    disabled(field, { when: () => !this.ready() });
  });

  // the user options (seeded with the defaults until they have loaded)
  private readonly options = signal<Options>(defaultOptions);

  // expose the alpha-sort option to the tag editor
  protected readonly sortAlpha = computed(() => this.options().alpha);

  ngOnInit() {
    this.ready.set(false);
    this.update.set(false);
    this.error.set(null);
    this.retry.set(false);
    this.storage.getOptions().subscribe((options) => {
      this.options.set(options);
      // apply the theme right away; the signal schedules a repaint so the
      // popup does not stay light while the page content is loading
      this.setTheme();
      void this.content.getContent(options).then(
        (content) => this.setContent(content),
        (error: unknown) =>
          this.logError("Can only pin normal web pages.", errorMessage(error))
      );
    });
  }

  setTheme() {
    this.theme.set(resolveTheme(this.options().dark));
  }

  // store info on current content in the form inputs
  setContent(content: Content): void {
    if (content && content.url && this.pinboard.isValidUrl(content.url)) {
      let description = content.description;
      if (description && this.options().blockquote) {
        description =
          "<blockquote>" + description.slice(0, 3200 - 25) + "</blockquote>";
      }
      this.model.set({
        url: content.url,
        title: content.title ?? "",
        description: description ?? "",
        unshared: this.options().unshared,
        toread: this.options().toread,
      });
      this.keywords.set(content.keywords);
      this.tags.set(null);
      this.retry.set(true);
      this.suggested.set(null);
      this.popular.set(null);
      // Look up any existing bookmark for this page and enable the form as
      // soon as that (fast) query returns. The suggested tags are fetched
      // separately below and must not block the form: Pinboard's "suggest"
      // call analyzes the page server-side and can be slow, in particular
      // for PDF pages, which used to make the popup appear to hang.
      this.pinboard
        .get(this.model().url)
        .pipe(timeout(pinboardLookupTimeout))
        .subscribe({
          next: (data) => this.setPost(data),
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
        .suggest(this.model().url)
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
  setPost(data: BookmarkResponse): void {
    if (data.posts && data.posts.length) {
      this.date.set(data?.date);
      const post = data.posts[0];
      this.model.update((m) => ({
        ...m,
        url: post.href,
        title: post.description,
        description: post.extended,
        unshared: post.shared !== "yes",
        toread: post.toread === "yes",
      }));
      this.tags.set(post.tags);
      this.update.set(true);
      // set browser icon to saved state
      void this.setTabIcons(true);
    }
    this.loadTagsAndSetReady();
  }

  // set the toolbar icon for every tab showing the current url
  private setTabIcons(saved: boolean): Promise<void> {
    return browser.tabs.query({ url: this.model().url }).then(
      (tabs) => {
        for (const tab of tabs) {
          this.icon.setIcon(tab.id, saved);
        }
      },
      (error: unknown) => {
        logError(error);
      }
    );
  }

  // update the toolbar icon to the saved/unsaved state, then close the popup
  private updateIconAndClose(saved: boolean): void {
    void this.setTabIcons(saved).then(() => this.cancel());
  }

  // receive the suggested tags (fetched in the background)
  setSuggestions(tags: { popular: string[]; recommended: string[] }): void {
    // Note: "popular" and "recommended" are interchanged in Pinboard
    if (tags.popular) {
      this.suggested.set(tags.popular);
    }
    if (this.options().popular && tags.recommended) {
      this.popular.set(tags.recommended);
    }
  }

  // load the cached tags and then enable the form for input
  loadTagsAndSetReady(): void {
    this.tagCache.get().subscribe({
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
        const fields = this.model();
        const focus = fields.url
          ? fields.title
            ? this.tags() && !fields.description
              ? "description"
              : "tags"
            : "title"
          : "url";
        const element = (
          this.eref.nativeElement as HTMLElement
        ).querySelector("#" + focus);
        if (element instanceof HTMLElement) {
          element.focus();
          // the [formField] directive lifts the disabled state one tick after
          // `ready` flips, and focusing a disabled control is a no-op; if the
          // focus did not take yet, retry once the control has been enabled
          if (document.activeElement !== element) {
            requestAnimationFrame(() => element.focus());
          }
        }
      },
      { injector: this.injector }
    );
  }

  // delete the current bookmark
  remove(): boolean {
    if (this.ready() && this.update() && this.model().url) {
      this.pinboard.delete(this.model().url).subscribe({
        next: () => {
          // update the tags in the cache
          const savedTags = this.savedTags ? this.savedTags.split(" ") : [];
          this.tagCache
            .update([], savedTags)
            // set the browser icon to unsaved state
            .pipe(finalize(() => this.updateIconAndClose(false)))
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
  submit(event: Event): void {
    event.preventDefault();
    if (this.form().valid()) {
      // the tags field lives in the child tag editor, noreplace is unused
      this.save({ ...this.model(), tags: this.tags() ?? "", noreplace: false });
    }
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
          this.tagCache
            .update(tags, savedTags)
            // set the browser icon to saved state
            .pipe(finalize(() => this.updateIconAndClose(true)))
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
    this.pinboard.saveCurrentTabs().subscribe({
      next: () => this.cancel(),
      error: (error: unknown) =>
        this.logError(
          "Sorry, could not save this tab set to Pinboard.",
          errorMessage(error)
        ),
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
