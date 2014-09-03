# presentation-cast

This is an implementation of the Presentation API [1] via the Google Cast Chrome
SDK [2].  To use it you must have a Chromecast available on your WiFi network
and the Google Cast extension (beta or stable release):

https://chrome.google.com/webstore/detail/google-cast-beta/dliochdbjfkdbacpmhlcpmleaejidimm
https://chrome.google.com/webstore/detail/google-cast/boadgeojelhgndaghljhdicfkmllpafd

To use the implementation as a polyfill for the Presentation API in your document,
source the following script:

https://raw.githubusercontent.com/mfoltzgoogle/presentation-cast/master/presentation.js

TODO: Repace with github.io URL

The implementation may function in either 1-UA or 2-UA mode.  Toggle the mode of
usage as follows:

```
// All presentations will be rendered locally and streamed to the Chromecast.
presentation.singleUserAgent = true;

// All presentations will be rendered on the Chromecast.
presentation.singleUserAgent = false;
```

[1] http://webscreens.github.io/presentation-api/
[2] https://developers.google.com/cast/docs/reference/chrome/
