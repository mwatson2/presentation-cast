# presentation-cast

This is a polyfill of the [Presentation API](http://w3c.github.io/presentation-api/)
that leverages the [Google Cast Sender SDK for Chrome](https://developers.google.com/cast/docs/reference/chrome/).
To use it you must have a Chromecast available on your browser's WiFi network, use the
Chrome browser, and install the [Google Cast extension](https://chrome.google.com/webstore/detail/google-cast-beta/dliochdbjfkdbacpmhlcpmleaejidimm).

Currently this polyfill is only intended to be used on pages that control
(```startSession```/```joinSession```) presentations, not on pages that render
presentations.  Presentation rendering is supplied by a modified version of the
[slidyremote](https://github.com/webscreens/slidyremote) Cast application.

Additionally, support is provided for discovering and launching DIAL applications.

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

  // Define a function in your page that will be called when the polyfill is
  // ready to use.
  window['__onPresentationAvailable'] = initializeController;
</script>
<link href="http://www.example.com/#__castAppId__=B46B8FE4" rel="default-presentation"/>
```

To request a DIAL application, use the __dialAppName__ and __dialPostData__ parameters in the URL
fragment, as follows:
```
<link href="http://www.example.com/#__dialAppName__=Netflix/__dialPostDat__=667ouy7==" rel="default-presentation"/>
```

See the demo below for a more complete example of Presentation API use.

## Missing features

The polyfill currently does not persist the presentation state to localStorage
so ```joinSession``` is not fully implemented, e.g. you cannot yet:

1. Join an existing presentation by reloading the same tab
2. Join an existing presentation from a different tab
3. Close and rejoin an existing presentation

# Demos

Each demo directory has a README.md file with implementation notes.

## Slideshow

https://mfoltzgoogle.github.io/presentation-cast/demo/slideshow/

