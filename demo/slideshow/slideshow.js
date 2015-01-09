// slideshow.js
// Demonstration of the Presentation API [1] using the Presentation-Cast polyfill [2]
// mark a. foltz <mfoltz@google.com>
// [1] http://w3c.github.io/presentation-api/
// [2] https://github.com/mfoltzgoogle/presentation-cast

(function() {

  // Utility for logging messages to the developer console.
  window.log = {
    info: function(message) {console.info('[presentation_cast] ' + message);},
    warn: function(message) {console.warn('[presentation_cast] ' + message);},
    error: function(message) {console.error('[presentation_cast] ' + message);}
  };

window.slideshow = foo;

})();
