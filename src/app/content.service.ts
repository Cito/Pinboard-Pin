import { Service } from "@angular/core";

import { Options } from "./storage.service";

// timeout in ms after which we stop waiting for the content script;
// this is needed because executeScript() never settles on pages where
// content scripts cannot be injected (e.g. the built-in PDF viewer)
const contentScriptTimeout = 1000;

// the page content gathered for a new bookmark
export interface Content {
  url: string | null;
  title: string | null;
  description: string | null;
  keywords: string[] | null;
}

// the raw data returned by the content script (src/js/content.js)
interface RawContent {
  url: string;
  title: string;
  selection: string;
  description: string;
  keywords: string;
}

// Service for gathering the content of the current page to be bookmarked

@Service()
export class ContentService {
  // get the content of the active tab; when the options ask for the page
  // description or tags this runs the content script (with a fallback for
  // pages where it cannot be injected, e.g. the PDF viewer), otherwise it
  // just reads the url and title from the tab
  getContent(options: Options): Promise<Content> {
    if (options.meta || options.selection) {
      return Promise.race([
        browser.tabs
          .executeScript({ file: "/js/content.js" })
          .then((content: Array<RawContent>) =>
            this.processContent(content[0], options)
          ),
        // guard against executeScript() never settling (e.g. PDF viewer)
        new Promise<Content>((_resolve, reject) =>
          setTimeout(
            () => reject(new Error("content script timed out")),
            contentScriptTimeout
          )
        ),
      ]).catch(() => this.fromTab());
    }
    return this.fromTab();
  }

  // process the data gathered by the content script
  private processContent(content: RawContent, options: Options): Content {
    let url: string | null = content.url;
    let title: string | null = content.title;
    url = url || null;
    title = title
      ? title.length > 255 // trim title
        ? title.slice(0, 254) + "…"
        : title
      : null;
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

  // get url and title from the active tab (used if the content script cannot run)
  private fromTab(): Promise<Content> {
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
}
