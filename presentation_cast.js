// presentation_cast.js
// Implementation of the Presentation API [1] using the Google Cast SDK [2]
// mark a. foltz <mfoltz@google.com>
// [1] http://w3c.github.io/presentation-api/
// [2] https://developers.google.com/cast/docs/reference/chrome/

(function() {

  // Utility for logging messages to the developer console.
  window.log = {
    info: function(message) {console.info('[presentation_cast] ' + message);},
    warn: function(message) {console.warn('[presentation_cast] ' + message);},
    error: function(message) {console.error('[presentation_cast] ' + message);}
  };

  ////////////////////////////////////////////////////////////////////////////
  // Bookkeeping for the polyfill.

  // Whether the SDK is initialized.
  var castApiInitialized_ = false;
  // Map from presentationUrlL|id to the corresponding PresentationSession.
  var presentationSessions_ = {};
  // Map from Cast session id to the corresponding PresentationSession.
  var castSessions_ = {};
  // Keeps track of the PresentationSession that is currently being started or
  // joined, to link up with listeners in the Cast SDK.
  var pendingSession_ = null;

  // https://webscreens.github.io/slidyremote/receiver.html
  var PRESENTATION_APP_ID = '673D55D4';
  var PRESENTATION_API_NAMESPACE_ =
      'urn:x-cast:org.w3.webscreens.presentationapi.shim';
  var ORIGIN_RE_ = new RegExp('https?://[^/]+');

  // @return {string} A random 8 character identifier.
  var generateId_ = function() {
    return (Math.round(Math.random() * 3221225472) + 1073741824).toString(16);
  };

  ////////////////////////////////////////////////////////////////////////////
  // Implementation of Presentation API at
  // http://webscreens.github.io/presentation-api/

  // Namespace for the Presentation API
  var presentation = {
    // Event handler for AvailableChangeEvent.
    onavailablechange: null,
    // Is always null on the controlling page.
    session: null
  };

  // Constructor for AvailableChangeEvent.
  // @param {boolean} available True if a screen is available, false otherwise.
  var AvailableChangeEvent = function(available) {
    this.bubbles = false;
    this.cancelable = false;
    this.available = available;
  };

  // Constructor for StateChangeEvent.
  var StateChangeEvent = function(state) {
    this.bubbles = false;
    this.cancelable = false;
    this.state = state;
  };

  // Requests the initiation of a new presentation.
  // @param {string} presentationUrl The URL of the document to present.
  // @param {string=} presentationId An optional id to assign the presentation.
  //     If not provided, a random one will be assigned.
  presentation.startSession = function(presentationUrl, presentationId) {
    var session = new PresentationSession(presentationUrl,
                                          presentationId || generateId_());
    return new Promise(function(resolve, reject) {
      if (!castApiInitialized_) {
        reject(Error('Cast SDK not initialized'));
        return;
      }

      var existingSession = presentationSessions_[session.key_];
      if (existingSession) {
        // User agent cannot have two sessions with identical URL+id.
        // TODO(mfoltz): Resolve to the existing session if the user selects
        // a screen running the same Cast session.
        reject(Error('Session already running for ' + session.key_));
        return;
      }

      presentationSessions_[session.key_] = session;

      // Request a new session from the Cast SDK.
      chrome.cast.requestSession(function(castSession) {
        log.info('Got cast session ' + castSession.sessionId +
            ' for presentation ' + session.key_);
        session.setCastSession_(castSession);
        castSessions_[castSession.sessionId] = session;
        session.maybePresentUrl_();
        resolve(session);
      }, function(castError) {
        reject(Error('Unable to create Cast session: ' + JSON.stringify(castError)));
      });
    });
  };

  // Requests the PresentationSession for an existing presentation.
  // @param {string} presentationUrl The URL of the document being presented.
  // @param {string} presentationId The id of the presentation..
  presentation.joinSession = function(presentationUrl, presentationId) {
    var session = new PresentationSession(presentationUrl,
                                          presentationId || generateId_());
    return new Promise(function(resolve, reject) {
      if (!castApiInitialized_) {
        reject(Error('Cast SDK not initialized'));
        return;
      }

      var existingSession = presentationSessions_[session.key_];
      if (existingSession) {
        resolve(existingSession);
      } else {
        // TODO(mfoltz): Keep promise pending in case the session is discovered later.
        reject(Error('No session available for ' + session.key_));
      }
    });
  };

  // Constructor for PresentationSession.
  // @param {string} presentationUrl The URL of the presentation.
  // @param {string} presentationId The id of the presentation.
  var PresentationSession = function(presentationUrl, presentationId) {
    this.url = presentationUrl;
    this.id = presentationId;
    this.state = 'disconnected';
    this.onmessage = null;
    this.onstatechange = null;

    // Private properties.
    this.key_ = this.url + '|' + this.id;
    this.origin_ = ORIGIN_RE_.exec(this.url)[0];
    this.castSessionId_ = null;
    this.castSession_ = null;
  };

  // Posts a message to the presentation.
  // @param {string} message The message to send.
  PresentationSession.prototype.postMessage = function(message) {
    if (this.castSession_ && this.state == 'connected') {
      log.info('postMessage to ' + this.key_ + ': ' + message);
      this.castSession_.sendMessage(PRESENTATION_API_NAMESPACE,
                                    message,
                                    null,
                                    this.close.bind(this));
    } else {
      log.warn('postMessage failed for session ' + this.key_ +
          '; no Cast session or not connected');
    }
  };

  // Closes the presentation (by disconnecting from the underlying Cast
  // session).
  PresentationSession.prototype.close = function() {
    if (this.state == 'disconnected') {
      return;
    }
    if (this.castSession_) {
      this.castSession_.leave(
          function() {
            log.info('Cast session ' + this.castSessionId_ +
                ' left for presentation ' + this.key_);
          }.bind(this),
          function(error) {
            log.error('Cast session ' + this.castSessionId_ +
                ' for presentation ' + this.key_ + ' not left: ' +
                JSON.stringify(error));
          }.bind(this));
    }
    this.state = 'disconnected';
    this.fireStateChange_();
  };


  ////////////////////////////////////////////////////////////////////////////
  // Implementation specific functions.  Not part of public API.
  PresentationSession.prototype.setCastSession_ = function(session) {
    if (this.castSession_) {
      console.info('PresentationSession ' + this.getKey_() +
          ' already associated with Cast session ' + session.id);
      return;
    }
    this.castSession_ = session;
    this.castSessionId = session.id;
    this.castSession_.addMessageListener(PRESENTATION_API_NAMESPACE_,
                                         this.onPresentationMessage_.bind(this));
    this.castSession_.addUpdateListener(this.onCastSessionUpdate_.bind(this));
    this.state = 'connected';
    this.fireStateChange_();
  };

  PresentationSession.prototype.onPresentationMessage_ =
      function(namespace, message) {
    if (namespace != CAST_NAMESPACE_ ||
        typeof(this.onmessage) != 'function') {
      return;
    }
    this.onmessage({data: message, origin: this.origin_, lastEventId: '',
                    source: null, ports: null});
  };

  PresentationSession.prototype.onCastSessionUpdate_ = function(isAlive) {
    if (isAlive && this.state == 'disconnected') {
      this.state = 'connected';
      this.fireStateChange_();
    }
    if (!isAlive && this.state == 'connected') {
      this.state = 'disconnected';
      this.fireStateChange_();
    }
  };

  PresentationSession.prototype.fireStateChange_ = function() {
    if (typeof(this.onstatechange) == 'function') {
      this.onstatechange(new StateChangeEvent(this.state));
    }
  };

  PresentationSession.prototype.getKey_ = function() {
    return this.url + '|' + this.id;
  };

  PresentationSession.prototype.hasCastSession_ = function() {
    return typeof(this.castSession_) == 'object';
  };

  PresentationSession.prototype.maybePresentUrl_ = function() {
    // TODO(mfoltz): Check if the receiver is already displaying the URL.
    this.postMessage({cmd: 'open', url: this.url});
  };


  ////////////////////////////////////////////////////////////////////////////
  // Integration with Cast SDK.

  // Invoked when a Cast session is connected.  Currently we don't support
  // automatic connection.
  var onCastSession_ = function(castSession) {
    log.info('onCastSession: connected to session ' + castSession.sessionId);
  };

  // Invoked when a Cast receiver is available or not.
  var onCastReceiverAvailable_ = function(availability) {
    if (typeof(presentation.onavailablechange) != 'function') {
      return;
    }
    log.info('onCastReceiverAvailable: available = ' + availability);
    if (availability == chrome.cast.ReceiverAvailability.AVAILABLE) {
      presentation.onavailablechange(new AvailableChangeEvent(true));
    } else {
      presentation.onavailablechange(new AvailableChangeEvent(false));
    }
  };

  var initializeCast_ = function() {
    return new Promise(function(resolve, reject) {
      var apiConfig = new chrome.cast.ApiConfig(
          new chrome.cast.SessionRequest(PRESENTATION_APP_ID),
          onCastSession_,
          onCastReceiverAvailable_,
          chrome.cast.AutoJoinPolicy.PAGE_SCOPED);
      chrome.cast.initialize(
          apiConfig,
          function() {
            log.info('Cast Sender SDK initialized successfully'),
            resolve();
          },
          function(error) {
            log.error('Unable to initialize Cast Sender SDK: ' + JSON.stringify(error));
            reject(Error(JSON.stringify(error)));
          });
      });
  };

  // Load the Cast Sender SDK.
  window['__onGCastApiAvailable'] = function(loaded, error) {
    if (loaded) {
      initializeCast_().then(function() {
        castApiInitialized_ = true;
        // Bind polyfill.
        navigator['presentation'] = presentation;
      });
    } else {
      log.error('Cast Sender SDK not available: ' + JSON.stringify(error));
    };
  }
  var script = document.createElement('script');
  script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js';
  document.head.appendChild(script);
})();
