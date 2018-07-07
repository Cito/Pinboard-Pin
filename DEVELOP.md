Development Notes for Pinboard Pin
==================================

This is an add-on for pinning pages on [Pinboard](https://pinboard.in) in the web browser, based on the [WebExtensions](https://developer.mozilla.org/de/Add-ons/WebExtensions) system. This web extension has been developed for and tested with Firefox 56 for Windows and Linux. Since WebExtensions was created as a cross-browser standard, it should be portable to other platforms and web browsers like Chrome, Opera or Edge with only few adaptations.

The web extension has been created using [Angular](https://angular.io/) and the [Angular CLI](https://github.com/angular/angular-cli).

Installation
------------

Install the application for development:

    npm install
    
On Windows, use latest Node or Yarn if installation fails.

Building and testing
--------------------

Build extension for development:

    npm run build

Test extension with Firefox:

    npm run test

Build unsigned extension for production:

    npm run build:prod

Package unsigned extension as zip file:

    npm run build:zip

Known issues
------------

* When building the extension, you currently need to patch Angular-CLI as mentioned in https://github.com/angular/angular/issues/21948

* Due to limitations in the Web-Ext API, the keyboard shortcut (Alt+P) cannot be changed or deactivated (at least I don't see a simple way how to do this - let me know if I'm overlooking something).

* Unfortunately, storing tabsets is not supported by the Pinboard API. Therefore you need to be logged in to Pinboard in order use this feature. This works the same as in the official add-on.

* If you get errors when requesting data from the Pinboard API via https, these could be caused by the Privacy Badger extension. Make sure that the domain pinboard.in is fully enabled in Privacy Badger or whitelist it.

Future development
------------------

* The Pinboard API seems to have the "popular" and "recommended" categories interchanged in the "suggest" method for tags. "Popular" are actually those taken from our own tags, contrary to what the Pinboard API docs say. This has already been reported to the Pinboard support. If they will changed this behavior, we need to adapt our code that currently swaps these categories.

* Ask Pinboard author to provide a method for storing tabsets and support it in the add-on.

* The PinPageComponent is much too big, and should be refactored to use child components, and objects instead of individual properties for the form fields, similar to the OptionsComponent.

* Make this extension also work with Chrome (use the chrome.* API instead of the browser.* API provided by Firefox).
