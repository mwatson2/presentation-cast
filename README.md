# presentation-cast

This is a polyfill of the [Presentation API](http://w3c.github.io/presentation-api/)
that leverages the [Google Cast Sender SDK for Chrome](https://developers.google.com/cast/docs/reference/chrome/).
To use it you must have a Chromecast available on your browser's WiFi network, use the
Chrome browser, and install the [Google Cast extension](https://chrome.google.com/webstore/detail/google-cast-beta/dliochdbjfkdbacpmhlcpmleaejidimm).

Currently this polyfill is only intended to be used on pages that control (open)
presentations, not on pages that render presentations.  Presentation rendering
is supplied by a modified version of the
[slidyremote](https://github.com/webscreens/slidyremote) Cast application.

## How to use

To use the polyfill:

```
<script src="http://mfoltzgoogle.github.io/presentation-cast/presentation_cast.js"
        type="text/javascript"></script>
<script>
  // Set up UI to request presentation, etc.
  var initializeController = function() {
    ...
  }

  // Define a function in your page that will be called when the polyfill is ready to use.
  window['__onPresentationAvailable'] = initializeController;
</script>
```

See the demo below for a more complete example of Presentation API use.

## Missing features

1. Join an existing presentation by reloading the same tab
2. Join an existing presentation from a different tab
3. Close and rejoin an existing presentation

# Demos

Each demo directory has a README.md file with implementation notes.

## Slideshow

https://mfoltzgoogle.github.io/presentation-cast/demo/slideshow/

