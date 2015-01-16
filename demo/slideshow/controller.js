// slideshow.js
// Demonstration of the Presentation API [1] using the Presentation-Cast polyfill [2]
// mark a. foltz <mfoltz@google.com>
// [1] http://w3c.github.io/presentation-api/
// [2] https://github.com/mfoltzgoogle/presentation-cast

(function() {

  var slideshow = {}

  // TODO(mfoltz): Fix this to get high resolution photos

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

  // Presentation API integration.  Handles start/join behavior and tracks screen availability.

  var presentation = null;
  var session = null;
  var presentationUrl = window.location.origin + '/presentation-cast/demo/slideshow/player.html';
  var presentationId = localStorage['presentationId'];

  var startPresent = function() {
    return new Promise(function(resolve, reject) {
      presentation.startSession(presentationUrl).then(
          function(newSession) {
            setSession(newSession, true);
            resolve(newSession);
          },
          function() {
            reject(Error('User canceled presentation'));
          });
      });
  };

  var sendMessage = function(obj) {
    if (!session) {
      log.warning('sendMessage: No session!');
      return;
    }
    var str = JSON.stringify(obj);
    log.info('sendMessage: ' + str);
    session.postMessage(str);
  };

  var stopPresent = function() {
    return new Promise(function(resolve, reject) {
      if (!session) reject(Error('No session'))
      if (session.state == 'connected') {
        session.close();
      }
      clearSession();
      resolve();
    });
  };

  var setSession = function(theSession, isNew) {
    if (session) {
      log.warning('setSession: Already have a session ' + session.url + '|' + session.id);
      return;
    }
    session = theSession;
    localStorage['presentationId'] = session.id;
  };

  var clearSession = function() {
    delete localStorage['presentationId'];
    session = null;
  };

  // Slideshow-specific controller logic.

  // Last status update from the player.
  var status = null;

  // Current status of screen availability.
  var screenAvailable = false;

  var buttons = {
    'show': null,
    'play': null,
    'next': null,
    'previous': null
  };

  var updateButtons = function() {
    log.info('Updating button state');
    buttons['show'].disabled = !(session || screenAvailable)
    buttons['show'].innerText = !!session ? 'Stop' : 'Show';
    buttons['play'].disabled = !session || session.state != 'connected';
    buttons['play'].innerText = (status && status.playing) ? 'Pause' : 'Play';
    buttons['next'].disabled = !session || session.state != 'connected';
    buttons['previous'].disabled = !session || session.state != 'connected';
  };

  var onShow = function(e) {
    if (!session && screenAvailable) {
      startPresent().then(function(newSession) {
        setControllerSession(newSession);
        updateButtons();
      });
    } else if (session) {
      stopPresent().then(updateButtons);
    }
    return true;
  };

  var onPlay = function(e) {
    if (!session || session.state != 'connected') {
      log.warning('onPlay called with no connected session!');
      return true;
    }
    if (status && status.playing) {
      sendMessage({cmd: 'pause'});
    } else {
      sendMessage({cmd: 'play'});
    }
    return true;
  };

  var onNext = function(e) {
    if (!session || session.state != 'connected') {
      log.warning('onNext called with no connected session!');
      return;
    }
    sendMessage({cmd: 'next'});
  };

  var onPrevious = function(e) {
    if (!session || session.state != 'connected') {
      log.warning('onPrevious called with no connected session!');
      return;
    }
    sendMessage({cmd: 'previous'});
  };

  // Tells the slideshow controller that there is a presentation session
  // available.
  var setControllerSession = function(session) {
    log.info('setControllerSession: ' + session.url + '|' + session.id + ', state = ' + session.state);
    session.onmessage = function(event) {
      log.info('onmessage: ' + event.data);
      onPlayerStatus(JSON.parse(event.data));
    };
    session.onstatechange = function() {
      switch (session.state) {
        case 'connected':
          log.info('Session ' + session.url + '|' + session.id + ' connected');
          break;
        case 'disconnected':
          log.info('Session ' + session.url + '|' + session.id + ' disconnected');
          clearSession();
          break;
      }
      updateButtons();
    };
  };

  var onPlayerStatus = function(newStatus) {
    if (newStatus.numPhotos === 0) {
      // Initialize player with photo list.
      sendMessage({cmd: 'init', params: [photos]});
    }
    status = newStatus;
    updateButtons();
  };

  var buttonHandlers = {
    'show': onShow,
    'play': onPlay,
    'next': onNext,
    'previous': onPrevious
  };

  // Initialization
  var init = function() {
    presentation = navigator.presentation;

    // Listen for screen availability.
    presentation.onavailablechange = function(e) {
      screenAvailable = e.available;
      updateButtons();
    };

    // Join an existing presentation if one exists.
    presentation.joinSession(presentationUrl, presentationId).then(
        function(existingSession) {
          setSession(existingSession, false);
          setControllerSession(existingSession);
          updateButtons();
        },
        function() {
          log.info('No presentation to join');
        });

  };

  window['__onPresentationAvailable'] = init;

  // Bind buttons on document load.
  window.addEventListener('DOMContentLoaded', function() {
    for (var buttonName in buttons) {
      buttons[buttonName] = document.getElementById(buttonName);
      buttons[buttonName].onclick = buttonHandlers[buttonName];
    }
  });
})();
