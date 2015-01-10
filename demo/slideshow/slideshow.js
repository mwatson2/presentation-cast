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
  
  var slideshow = {};

  slideshow.init = function(photos) {
    slideshow.photos_ = photos;
    slideshow.elt_ = document.getElementById('photo_img');
    slideshow.elt_.style.display = 'none';
    slideshow.current_index_ = 0;
  };

  slideshow.show = function(index) {
    if (slideshow.elt_.style.display == 'none') {
      slideshow.elt_.style.display = 'block';
    }
    log.info('Showing photo ' + index);
    slideshow.elt_.src = slideshow.photos_[index];
    slideshow.elt_.alt = 'Slideshow photo number ' + index;
  };

  slideshow.next = function() {
    slideshow.current_index_ = (slideshow.current_index_ + 1) % slideshow.photos_.length;
    slideshow.show(slideshow.current_index_);
  };

  slideshow.previous = function() {
    slideshow.current_index_ = (slideshow.current_index_ - 1) % slideshow.photos_.length;
    slideshow.show(slideshow.current_index_);
  };

  window.slideshow = slideshow;

})();
