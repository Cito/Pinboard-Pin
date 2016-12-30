// this component is the save bookmark dialog displayed in the popup

import {Component, OnInit, OnDestroy} from '@angular/core';
import {Router} from "@angular/router";

import {Subscription, Subject} from "rxjs";

import {IconService} from "../icon.service";
import {PinboardService, pinboardPage} from "../pinboard.service";
import {Options, StorageService} from "../storage.service";
import {NgForm} from "@angular/forms";

const debounceTime = 250; // timeout in ms for reacting to changes
const maxCompletions = 9; // maximum number of suggested completions

export interface Post {
  url: string;
  title: string;
  description: string;
  tags: string;
  unshared: boolean;
  toread: boolean;
}


// Pin page form
// TODO: This class is too big, should be refactored.
// At least the tag handling should go into sub component(s).

@Component({
  selector: 'app-popup',
  templateUrl: './pinpage.component.html',
  styleUrls: ['./pinpage.component.css']
})
export class PinPageComponent implements OnInit, OnDestroy {

  url: string;
  title: string;
  description: string; // description
  tags: string; // current tags
  allTags: string[]; // all of our tags
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
  error: boolean;
  retry: boolean;
  options: Options;

  private tagsSubject = new Subject();
  private tagsSubscription: Subscription;

  constructor(private pinboard: PinboardService,
              private storage: StorageService,
              private icon: IconService,
              private router: Router) { }

  ngOnInit() {
    this.ready = this.update = this.error = this.retry = false;
    this.storage.getOptions().subscribe(options => {
      this.options = options;
      browser.tabs.executeScript({file: '/js/content.js'}).then(
        content => this.setContent(content),
        error => this.logError(
          'Can only pin normal web pages.', error.toString()));
    });
    this.tagsFocus = false;
    this.tagsSubscription = this.tagsSubject.debounceTime(
      debounceTime).distinctUntilChanged().subscribe(value =>
        this.tagsChanged(value));
  }

  ngOnDestroy() {
    this.tagsSubscription.unsubscribe();
  }

  // store info on current content in the form inputs
  setContent(content) {
    if (content) content = content[0];
    if (content && content.url) {
      this.url = content.url;
      this.title = content.title;
      this.description = content.description;
      if (this.description && this.options.blockquote)
        this.description = '<blockquote>' +
          this.description.slice(0, 64000 - 25) + '</blockquote>';
      this.keywords = content.keywords;
      this.tags = null;
      this.unshared = this.options.unshared;
      this.toread = this.options.toread;
      this.retry = true;
      this.suggested = this.popular = null;
      // query both page data and suggested tags
      this.pinboard.getAndSuggest(this.url).subscribe(
          data => this.setData(data),
          error => this.logError(
            'Cannot check this page on Pinboard.', error.toString()));
    } else {
      this.logError('Can only pin normal web pages.',
        'Cannot access page content');
    }
  }

  // receive page data and suggested tags from parallel queries
  setData(data: any): void {
    if (data.posts && data.posts.length) {
      this.date = data ? data.date : null;
      const post = data.posts[0];
      this.url = post.href;
      this.title = post.description;
      this.description = post.extended;
      this.tags = post.tags;
      this.unshared = post.shared != 'yes';
      this.toread = post.toread == 'yes';
      this.update = true;
      // set browser icon to saved state
      browser.tabs.query({url: this.url}).then(tabs => {
          for (let tab of tabs) this.icon.setIcon(tab.id, true); },
        error => console.error(error.toString()));
    }
    // Note: "popular" and "recommended" are interchanged in Pinboard
    if (data.popular)
      this.suggested = data.popular;
    if (data.recommended)
      this.popular = data.recommended;
    this.pinboard.cachedTags().subscribe(tags => {
      this.allTags = tags;
      if (this.tags) this.tags = this.tags.trim() + ' ';
      this.completions = null;
      this.ready = true;
    });
  }

  // check whether the give tags have already been added
  hasTags(tags: string|string[]): boolean {
    if (!this.tags) return false;
    if (!Array.isArray(tags)) tags = [tags as string];
    let allTags = this.tags.split(' ').filter(tag => !!tag);
    return (tags as string[]).every(tag => allTags.indexOf(tag) >= 0);
  }

  // add the given tags if they have not already been added, otherwise remove
  addTags(tags: string|string[]): void {
    if (!Array.isArray(tags)) tags = [tags as string];
    let allTags = (this.tags || '').split(' ').filter(tag => !!tag);
    let newTags = (tags as string[]).filter(tag => allTags.indexOf(tag) < 0);
    if (newTags.length) // some tags are new
      allTags.push(...newTags);  // add these tags
    else // all tags have already been added, remove these tags again
      allTags = allTags.filter(tag => (tags as string[]).indexOf(tag) < 0);
    this.tags = allTags.join(' ');
  }

  // this method is called when keys have been pressed down in the tabs field
  tagsKeyDown(event: any): boolean {
    if (!this.ready || !this.tagsFocus || !this.completions)
      return true;
    // Firefox reacts to some of our control keys as well, so to prevent this
    // from happening, we have to listen here before the key has been pressed
    let control = true;
    switch (event.code) {
      case 'Home':
        this.tagSelected = 0;
        break;
      case 'End':
        this.tagSelected = this.completions.length - 1;
        break;
      case 'ArrowDown':
        if (this.tagSelected < this.completions.length - 1)
          ++this.tagSelected;
        break;
      case 'ArrowUp':
        if (this.tagSelected > 0)
          --this.tagSelected;
        break;
      case 'Enter':
      case 'Tab':
      case 'ArrowRight':
        let tag = this.completions[this.tagSelected];
        let value = event.target.value;
        let words = value.split(' ');
        if (words.length)
          words.pop();
        if (words.indexOf(tag) < 0) {
          words.push(tag);
          value = words.join(' ') + ' ';
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
  tagsKeyUp(event: any): boolean {
    // the field value is changed after the key has been pressed,
    // so this is the right moment for checking for value changes
    if (this.ready && this.tagsFocus)
      this.tagsSubject.next(event.target.value);
    return true;
  }

  // this method is called with debounce when tags have changed
  // it must then determine the list of tag completions
  tagsChanged(tags) {
    let words = tags.replace(',', ' ').split(' ');
    let word = words.length ? words.pop() : null;
    let completions: string[] = [];
    if (word) {
      for (let tag of this.allTags) {
        if (tag.startsWith(word) && words.indexOf(tag) < 0) {
          completions.push(tag);
          if (completions.length >= maxCompletions)
            break;
        }
      }
    }
    if (completions.length)
      completions.reverse();
    else
      completions = null;
    if (completions != this.completions) {
      this.completions = completions;
      if (completions) this.tagSelected = completions.length - 1;
    }
  }

  // this method is called when a tag completion was clicked
  selectCompletion(tag: string) {
    let value = this.tags || '';
    let words = value.split(' ');
    if (words.length)
      words.pop();
    if (words.indexOf(tag) < 0) {
      words.push(tag);
      value = words.join(' ') + ' ';
      this.tagsChanged(value);
      this.tags = value;
    }
    return false;
  }

  // delete the current bookmark
  remove() {
    if (this.ready && this.update && this.url)
      this.pinboard.delete(this.url).finally(
        // set the browser icon to unsaved state
        () => browser.tabs.query({url: this.url}).then(tabs => {
          for (let tab of tabs) this.icon.setIcon(tab.id, false);
          this.cancel();
        }, error => {
          console.error(error.toString());
          this.cancel();
        })).subscribe();
  }

  // submit form (save page to Pinboard)
  submit(form: NgForm) {
    if (!form.valid) return false;
    let value: Post = form.value;
    value.url = (value.url || '').trim();
    value.title = (value.title || '').trim();
    if (!value.url || !value.title) return false;
    value.description = (value.description || '').trim() || null;
    // clean up tags, maximum of 100 tags with 255 chars each
    let tags = value.tags ? value.tags.split(' ').filter(tag => !!tag).slice(
      0, 100).map(tag => tag.slice(0, 255)) : [];
    value.tags = tags.join(' ');
    this.pinboard.save(value).subscribe(
      error => {
        if (error)
          this.logError('Sorry, could not save this page to Pinboard',
            error);
        else {
          // update the tags in the cache
          this.pinboard.updateTagCache(tags).finally(
            // set the browser icon to saved state
            () => browser.tabs.query({url: this.url}).then(tabs => {
              for (let tab of tabs) this.icon.setIcon(tab.id, true);
              this.cancel();
            }, error => {
              console.error(error.toString());
              this.cancel();
            })).subscribe();
        }
      },
      error => {
        this.logError('Sorry, could not save this page to Pinboard',
          error.toString());
      });
    return false;
  }

  // navigate to options
  settings() {
    // store a note that we are showing on a popup page
    this.storage.setInfo('options.page', 'popup');
    this.router.navigate(['/options']);
  }

  // log out from Pinboard
  logOut() {
    this.pinboard.forgetToken().subscribe(
      () => this.router.navigate(['/login']));
  }

  // show error message and log it on the console
  logError(errmsg, logmsg) {
    if (errmsg) console.error(logmsg || errmsg);
    this.error = errmsg;
  }

  pinboardLink(page) {
    if (page && page.indexOf('~') >= 0)
      this.pinboard.userName.subscribe(
        name => this.pinboardLink(page.replace('~', 'u:' + name)));
    else {
      let url = pinboardPage;
      if (page) url += page;
      browser.tabs.create({url: url});
      this.cancel();
    }
    return false;
  }

  // close the whole popup
  cancel() {
    window.close();
  }

}
