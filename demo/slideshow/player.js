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

  var currentIndex = 0;
  var photos = [];
  var img = null;
  var interval = null;

  slideshow.init = function(thePhotos) {
    log.info('Init called with ' + thePhotos.length + ' photos');
    photos = thePhotos;
    slideshow.show(currentIndex);
  };

  slideshow.show = function(index) {
    log.info('Showing photo ' + index);
    if (!img) return;
    if (img.style.display == 'none') {
      img.style.display = 'block';
    }
    img.src = photos[index];
    img.alt = 'Slideshow photo number ' + index;
    slideshow.sendStatus();
  };

  slideshow.next = function() {
    log.info('next');
    slideshow.pause();
    slideshow.advance();
  }

  slideshow.advance = function() {
    currentIndex = (currentIndex + 1) % photos.length;
    slideshow.show(currentIndex);
  };

  slideshow.previous = function() {
    log.info('previous');
    slideshow.pause();
    currentIndex = currentIndex == 0 ? photos.length - 1 : currentIndex - 1;
    slideshow.show(currentIndex);
  };

  slideshow.play = function() {
    log.info('play');
    if (!!interval) return;
    interval = window.setInterval(slideshow.advance, 5000);
    slideshow.sendStatus();
  };

  slideshow.pause = function() {
    log.info('pause');
    if (!interval) return;
    window.clearInterval(interval);
    interval = null;
    slideshow.sendStatus();
  };

  slideshow.sendStatus = function() {
    if (!slideshow.postMessage) {
      log.warning('sendStatus: postMessage not set!');
      return;
    }
    var status = JSON.stringify({
      currentIndex: currentIndex,
      numPhotos: photos.length,
      playing: (interval != null)
    });
    log.info('sendStatus: ' + status);
    slideshow.postMessage(status);
  };

  // Integration with slidyremote receiver.
  slideshow.postMessage = null;
  slideshow.onLoad = function(postMessage) {
    slideshow.postMessage = postMessage;
    img = document.getElementsByTagName('img')[0];
    img.style.display = 'none';
    slideshow.sendStatus();
  };

  window['w3c_slidy'] = slideshow;
})();
