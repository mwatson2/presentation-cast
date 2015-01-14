// slideshow.js
// Demonstration of the Presentation API [1] using the Presentation-Cast polyfill [2]
// mark a. foltz <mfoltz@google.com>
// [1] http://w3c.github.io/presentation-api/
// [2] https://github.com/mfoltzgoogle/presentation-cast

(function() {

  var slideshow = {}

  photos = [
    'https://lh6.googleusercontent.com/-WgmfKhudwbk/U-hux8yAVVI/AAAAAAAAo_w/8EiO-DsvaBE/w624-h1109-no/IMG_20140805_174338.jpg',
    'https://lh3.googleusercontent.com/-v-vyJ2YRMlE/U-huxzJwYII/AAAAAAAApCI/oMNmyvd94Cc/w878-h494-no/IMG_20140805_174453.jpg',
    'https://lh6.googleusercontent.com/-Jp88xjj1nVc/U-hux-AboOI/AAAAAAAApCM/UUMKL_aVVj8/w878-h494-no/IMG_20140806_110947.jpg',
    'https://lh5.googleusercontent.com/-E3qWb3uG6Ds/U-huxwyMBdI/AAAAAAAAo_w/fF52y8ooQJk/w879-h501-no/IMG_20140806_123754.jpg',
    'https://lh5.googleusercontent.com/-zSC6SbSrovM/U-huxymq3aI/AAAAAAAApCQ/Gig6zhwqxII/w878-h494-no/IMG_20140808_105718.jpg',
    'https://lh6.googleusercontent.com/-2TVhWpWiCPQ/U-hux137AjI/AAAAAAAApCU/kE__lvORLSw/w879-h501-no/IMG_20140808_113453.jpg',
    'https://lh3.googleusercontent.com/-98eicxdbTPA/U-hux_RdYzI/AAAAAAAApuM/pv655GdRSPQ/w633-h1110-no/IMG_20140808_113823.jpg',
    'https://lh4.googleusercontent.com/-hLzVqPvwcno/U-huxzSnkNI/AAAAAAAApCc/GO0_8VGkmiw/w879-h501-no/IMG_20140808_113708.jpg'
  ];

  // Presentation API integration

  var presentation = null;
  var session = null;
  var screenAvailable = false;
//  var presentationUrl = 'http://mfoltzgoogle.github.io/presentation-cast/demo/slideshow/player.html';
  var presentationUrl = 'https://x20.corp.google.com/~mfoltz/presentation-cast/demo/slideshow/player.html';
  var presentationId = localStorage['presentationId'] || new String((Math.random() * 10000).toFixed(0));

  var startPresent = function() {
    presentation.startSession(presentationUrl, presentationId).then(
        function(newSession) {
          setSession(newSession, true);
          updateButtons();
        },
        function() {
          // User cancelled, etc.
        });
  };

  var stopPresent = function() {
    if (!session) return;
    session.close();
    delete localStorage['presentationId'];
  };

  var setSession = function(theSession, isNew) {
    if (session) {
      log.warning('setSession: Already have a session ' + session.url + '#' + session.id);
      return;
    }
    session = theSession;
    localStorage['presentationId'] = session.id;
    session.onstatechange = function() {
      switch (session.state) {
        case 'connected':
        log.info('Session ' + session.url + '#' + session.id + ' connected');
        if (isNew) {
          session.postMessage(JSON.stringify({cmd: 'init', params: photos}));
        }
        updateButtons();
        break;
        case 'disconnected':
        log.info('Session ' + session.url + '#' + session.id + ' disconnected');
        updateButtons();
        break;
      }
    };
  };

  // UX

  var playing = false;

  var buttons = {
    'show': null,
    'play': null,
    'next': null,
    'previous': null
  };

  var updateButtons = function() {
    log.info('Updating button state');
    buttons['show'].disabled = !(session || screenAvailable)
    buttons['show'].name = !!session ? 'Stop' : 'Show';
    buttons['play'].disabled = !session || session.state != 'connected';
    buttons['play'].name = playing ? 'Pause' : 'Play';
    buttons['next'].disabled = !session || session.state != 'connected';
    buttons['previous'].disabled = !session || session.state != 'connected';
  };

  var onShow = function(e) {
    if (!session && screenAvailable) {
      startPresent().then(function() {
        updateButtons();
      });
    } else if (session) {
      stopPresent().then(function() {
        updateButtons();
      });
    }
    return true;
  };

  var onPlay = function(e) {
    if (!session || session.state != 'connected') {
      log.warning('onPlay called with no connected session!');
      return true;
    }
    if (playing) {
      session.postMessage(JSON.stringify({cmd: 'pause'}));
      // TODO(mfoltz): More reliable to have presentation send status back to
      // the controller, rather than assuming success.
      playing = false;
      updateButtons();
    } else {
      session.postMessage(JSON.stringify({cmd: 'play'}));
      // TODO(mfoltz): More reliable to have presentation send status back to
      // the controller, rather than assuming success.
      playing = true;
      updateButtons();
    }
    return true;
  };

  var onNext = function(e) {
    if (!session || session.state != 'connected') {
      log.warning('onNext called with no connected session!');
      return;
    }
    session.postMessage(JSON.stringify({cmd: 'next'}));
    // TODO(mfoltz): More reliable to have presentation send status back to
    // the controller, rather than assuming success.
    playing = false;
    updateButtons();
  };

  var onPrevious = function(e) {
    if (!session || session.state != 'connected') {
      log.warning('onPrevious called with no connected session!');
      return;
    }
    session.postMessage(JSON.stringify({cmd: 'previous'}));
    // TODO(mfoltz): More reliable to have presentation send status back to
    // the controller, rather than assuming success.
    playing = false;
    updateButtons();
  };

  var buttonHandlers = {
    'show': onShow,
    'play': onPlay,
    'next': onNext,
    'previous': onPrevious
  };

  // Bind buttons on document load.
  window.addEventListener('DOMContentLoaded', function() {
    for var buttonName in buttons {
      buttons[buttonName] = document.getElementById(buttonName);
      buttons[buttonName].onclick = buttonHandlers[buttonName];
    }
  };

  // Initialization
  var init = function() {
    presentation = navigator.presentation;

    // Join an existing presentation if one exists.
    presentation.joinSession(presentationUrl, presentationId).then(
        function(existingSession) {
          setSession(existingSession, false);
          updateButtons();
        },
        function() {
          log.info('No presentation to join');
        });

    presentation.onavailablechange = function(e) {
      screenAvailable = e.available;
      updateButtons();
    };
  };

  window['__onPresentationAvailable'] = init;
})();
