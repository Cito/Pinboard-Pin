// tag input with a completion dropdown and suggested/popular/keyword chips,
// extracted from the pin-page form so the tag handling lives on its own

import {
  Component,
  DestroyRef,
  input,
  model,
  signal,
  inject,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { Subject } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";

const debounceDueTime = 250; // timeout in ms for reacting to changes
const maxCompletions = 9; // maximum number of suggested completions

@Component({
  selector: "app-tagging",
  templateUrl: "./tagging.component.html",
  styleUrls: ["./tagging.component.scss"],
})
export class TaggingComponent {
  private destroyRef = inject(DestroyRef);

  // the current tags as a space separated string (two-way bound)
  readonly tags = model<string | null>(null);
  // all of our tags with frequency, used to compute completions
  readonly allTags = input<{ [tag: string]: number }>({});
  // tags suggested by Pinboard, by our own history, and by the page
  readonly suggested = input<string[] | null>(null);
  readonly popular = input<string[] | null>(null);
  readonly keywords = input<string[] | null>(null);
  // sort completions alphabetically instead of by frequency
  readonly alpha = input(false);
  // disable the input until the surrounding form is ready
  readonly disabled = input(false);

  readonly completions = signal<string[] | null>(null); // tag completions
  readonly tagsFocus = signal(false); // whether the tags field has focus
  readonly tagSelected = signal(0); // index of the selected completion

  private tagsSubject = new Subject<string>();

  constructor() {
    this.tagsSubject
      .pipe(
        debounceTime(debounceDueTime),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((value: string) => this.tagsChanged(value));
  }

  // check whether the given tags have already been added
  hasTags(tags: string | string[]): boolean {
    const current = this.tags();
    if (!current) {
      return false;
    }
    if (!Array.isArray(tags)) {
      tags = [tags];
    }
    const allTags = current.split(" ").filter((tag) => !!tag);
    return tags.every((tag) => allTags.includes(tag));
  }

  // add the given tags if they have not already been added, otherwise remove
  addTags(tags: string | string[]): void {
    if (!Array.isArray(tags)) {
      tags = [tags];
    }
    let allTags = (this.tags() || "").split(" ").filter((tag) => !!tag);
    const newTags = tags.filter((tag) => !allTags.includes(tag));
    if (newTags.length) {
      // some tags are new
      allTags.push(...newTags); // add these tags
    } else {
      // all tags have already been added, remove these tags again
      allTags = allTags.filter((tag) => !tags.includes(tag));
    }
    this.tags.set(allTags.join(" "));
  }

  // this method is called when keys have been pressed down in the tags field
  tagsKeyDown(event: KeyboardEvent): boolean {
    const completions = this.completions();
    if (this.disabled() || !this.tagsFocus() || !completions) {
      return true;
    }
    // Firefox reacts to some of our control keys as well, so to prevent this
    // from happening, we have to listen here before the key has been pressed
    let control = true;
    switch (event.code) {
      case "Home":
        this.tagSelected.set(0);
        break;
      case "End":
        this.tagSelected.set(completions.length - 1);
        break;
      case "ArrowDown":
        if (this.tagSelected() < completions.length - 1) {
          this.tagSelected.update((i) => i + 1);
        }
        break;
      case "ArrowUp":
        if (this.tagSelected() > 0) {
          this.tagSelected.update((i) => i - 1);
        }
        break;
      case "Enter":
      case "Tab":
      case "ArrowRight":
        const tag = completions[this.tagSelected()];
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
          this.tags.set(value);
        }
        break;
      default:
        control = false;
    }
    return !control;
  }

  // this method is called when keys have been released in the tags field
  tagsKeyUp(event: KeyboardEvent): boolean {
    // the field value is changed after the key has been pressed,
    // so this is the right moment for checking for value changes
    if (!this.disabled() && this.tagsFocus()) {
      this.tagsSubject.next((event.target as HTMLInputElement).value);
    }
    return true;
  }

  // this method is called with debounce when tags have changed
  // it must then determine the list of tag completions
  tagsChanged(tags: string): void {
    const words = tags.replace(",", " ").split(" ");
    let word = words.length ? words.pop() : null;
    const allTags = this.allTags();
    const matches: [string, number][] = [];
    const alpha = this.alpha();
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
      const oldCompletions = this.completions();
      if (
        !oldCompletions ||
        completions.length !== oldCompletions.length ||
        completions.some((tag, i) => completions[i] !== oldCompletions[i])
      ) {
        this.completions.set(completions);
        this.tagSelected.set(completions.length - 1);
      }
    } else {
      this.completions.set(null);
    }
  }

  // this method is called when a tag completion was clicked
  selectCompletion(tag: string): boolean {
    let value = this.tags() || "";
    const words = value.split(" ");
    if (words.length) {
      words.pop();
    }
    if (!words.includes(tag)) {
      words.push(tag);
      value = words.join(" ") + " ";
      this.tagsChanged(value);
      this.tags.set(value);
    }
    return false;
  }
}
