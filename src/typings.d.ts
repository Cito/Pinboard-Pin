// Typings reference file, you can add your own global typings here
// https://www.typescriptlang.org/docs/handbook/writing-declaration-files.html

// Unfortunately, I could not find typings for the web extensions API using
// the generic "browser" namespace. Therefore I'm using the following ad-hoc
// type definitions, using the existing bindings for the "chrome" namespace.
// Note that we need to make some changes: Particularly, the "chrome" namespace
// uses callbacks where the "browser" namespace uses Promises.
// TODO: Replace with full/official bindings for the "browser" namespace.

interface Window {
    browser: typeof browser;
}

declare namespace browser.browserAction {
  export function setIcon(details: chrome.browserAction.TabIconDetails): void;
}
declare namespace browser.runtime {
  const onMessage: chrome.gcm.MessageReceptionEvent;
  const sendMessage: (message: any) => Promise<JSON>;
}
declare namespace browser.storage {
  interface StorageArea {
    get(keys: string | string[] | null): Promise<any>;
    remove(keys: string | string[]): Promise<void>;
    set(keys: Object): Promise<void>;
  }
  const local: StorageArea;
}
declare namespace browser.tabs {
  const create: (createProperties: chrome.tabs.CreateProperties) => Promise<chrome.tabs.Tab>;
  const executeScript: (details: chrome.tabs.InjectDetails) => Promise<any[]>;
  const onUpdated: chrome.tabs.TabUpdatedEvent;
  const query: (queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>;
}
declare namespace browser.windows {
  const create: (createData: chrome.windows.CreateData) => Promise<Window>;
}
