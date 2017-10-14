Pinboard Pin Web Extension for Firefox
--------------------------------------

Pinboard Pin is a modern web extension for pinning pages on [Pinboard](https://pinboard.in) with Firefox.

It pretty much replicates the functionality of the [Pinboard Plus](https://github.com/clvrobj/Pinboard-Plus) extension that has been created for the Chrome browser, but it has been rewritten from scratch to support Firefox using the modern [Angular](https://angular.io/) framework instead of a mix of the older [AngularJS](https://angularjs.org/), [jQuery](https://jquery.com/) and [Underscore](http://underscorejs.org/) libraries used by Pinboard Plus. This rewrite was also intended as a proof-of-concept that modern Angular is a viable platform for building web extensions.

The current version has been tested with Firefox 56 for Windows and Linux.

Features:
---------

* Icon changing color to show whether the current page has been bookmarked in Pinboard.
* Save a new bookmark for the current page in Pinboard, adding description and tags in a popup dialog.
* Update and delete the bookmark for the current page in Pinboard from the popup.
* Automatic creation of a description from a selected text on the page or using an existing meta tag on the page.
* Enter or update tags using automatic suggestions in the popup dialog.

Installation:
-------------

You can install the extension using the [Mozilla Add-ons](https://addons.mozilla.org/de/firefox/addon/pinboard-pin/) page.

Notes:
------

Note that you must explicitly enable the option for displaying whether the page has already been saved on Pinboard, because this will send the URL of the page to the Pinboard server for every page. Therefore this feature is also automatically disabled in "incognito mode".

Also note that if you are using the Privacy Badger extension and Pinboard Pin shows an error when accessing Pinboard, make sure that the domain pinboard.in is not blocked in the filter settings of Privacy Badger, or simply put in on the whitelist of Privacy Badger.

Development:
------------

- Follow the instructions outlined in [DEVELOP.md](https://github.com/cito/Pinboard-Pin/blob/master/DEVELOP.md) if you want to build this extension on your own or run it in development mode.
- Read my blog post [Web Extensions made with Angular](https://cito.github.io/blog/web-ext-with-angular/) to learn more about how and why this extension has been created.
- Contact the author, open GitHub issues or send in pull requests to contribute.

Author:
-------

- [Christoph Zwerschke](https://github.com/cito)
