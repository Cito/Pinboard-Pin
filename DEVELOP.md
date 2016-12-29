Development Notes for Pinboard Pin
==================================

This is an add-on for pinning pages on [Pinboard](https://pinboard.in) in the web browser, based on the [WebExtensions](https://developer.mozilla.org/de/Add-ons/WebExtensions) system. This web extension has been developed for and tested with Firefox 50 for Windows and Linux. Since WebExtensions was created as a cross-browser standard, it should be portable to other platforms and web browsers like Chrome, Opera or Edge with only few adaptations.

The web extension has been created using [Angular](https://angular.io/) and the [Angular CLI](https://github.com/angular/angular-cli).

Installation
------------

Install the application for development:

    npm install

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

* Unfortunately, storing tabsets is not supported by the Pinboard API. Therefore this feature has not been implemented in this add-on.

* If you get errors when requesting data from the Pinboard API via https, these could be caused by the Privacy Badger extension. Make sure that the domain pinboard.in is fully enabled in Privacy Badger or whitelist it.

* The web-ext tool currently doesn't work with the 64bit version for Firefox on Windows. As a workaround, set a the path with "--firefox=" when calling "web-ext run" or replace "(64)" with "(64-64)" in the line starting with "arch = " in node_modules/web-ext/node_modules/fx-runner/lib/utils.js.

* Since Firefox supports ES6, theoretically, it should be possible to set target="es6" in tsconfig.json. However, the current version of UglifyJS which is used by the Angular CLI to pack the JavaScript bundle doesn't support ES6 yet. It is possible to use the "harmony" branch of UglifyJS, which already supports ES 6. But this branch still has some problems with scoping which might result in glitches in the resulting code. Furthermore, the vendor.js bundle which is larger than main.js will still be ES 5.

Future development
------------------

* Wait for UglifyJS to fully support ES6, then switch to target="es6" in tsconfig.json. Also find a way to create vendor.js in ES6.

* The Pinboard API seems to have the "popular" and "recommended" categories interchanged in the "suggest" method for tags. "Popular" are actually those taken from our own tags, contrary to what the Pinboard API docs say. This has already been reported to the Pinboard support. If they will changed this behavior, we need to adapt our code that currently swaps these categories.

* Ask Pinboard author to provide a method for storing tabsets and support it in the add-on.

* The PinPageComponent is much too big, and should be refactored to use child components, and objects instead of individual properties for the form fields, similar to the OptionsComponent.

* Make this extension also work with Chrome (use the chrome.* API instead of the browser.* API provided by Firefox).
