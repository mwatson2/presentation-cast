// slideshow.js
// Demonstration of the Presentation API [1] using the Presentation-Cast polyfill [2]
// mark a. foltz <mfoltz@google.com>
// [1] http://w3c.github.io/presentation-api/
// [2] https://github.com/mfoltzgoogle/presentation-cast

(function() {

  // Utility for logging messages to the developer console.
  window.log = {
    info: function(message) {console.info('[slideshow] ' + message);},
    warn: function(message) {console.warn('[slideshow] ' + message);},
    error: function(message) {console.error('[slideshow] ' + message);}
  };

  var current_index = 0;
  var photos = [];
  var img = null;
  var interval = null;

  slideshow.init = function(thePhotos) {
    photos = thePhotos;
    slideshow.show(current_index);
  };

  slideshow.show = function(index) {
    log.info('Showing photo ' + index);
    if (!img) return;
    if (img.style.display == 'none') {
      img.style.display = 'block';
    }
    img.src = photos[index];
    img.alt = 'Slideshow photo number ' + index;
  };

  slideshow.next = function() {
    log.info('next');
    slideshow.pause();
    slideshow.advance();
  }

  slideshow.advance = function() {
    slideshow.current_index_ = (slideshow.current_index_ + 1) % slideshow.photos_.length;
    slideshow.show(slideshow.current_index_);
  };

  slideshow.previous = function() {
    log.info('previous');
    slideshow.pause();
    slideshow.current_index_ = (slideshow.current_index_ - 1) % slideshow.photos_.length;
    slideshow.show(slideshow.current_index_);
  };

  slideshow.play = function() {
    log.info('play');
    if (!!interval) return;
    interval = window.setInterval(advance, 5000);
  };

  slideshow.pause = function() {
    log.info('pause');
    if (!interval) return;
    window.clearInterval(interval);
    interval = null;
  };

  // Bind the control functions to the correct property so commands are
  // forwarded from the receiver shim.
  window.w3c_slidy = slideshow;

  window.addEventListener('DOMContentLoaded', function() {
    img = document.getElementsByTagName('img')[0];
    // TODO(mfoltz): Show a spinner or other interstitial while waiting for
    // photos
    if (photos.length > 0) {
      slideshow.show(current_index);
    } else {
      img.style.display = 'none';
    }
  });
})();
