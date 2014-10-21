(function() {
  // Utility for logging messages to the developer console.
  window.log = {
    info: function(message) {console.info('[papi] ' + message);},
    warn: function(message) {console.warn('[papi] ' + message);},
    error: function(message) {console.error('[papi] ' + message);}
  };

  var presentation = {};

  // Event handler for OnAvailableChangeEvent.
  presentation.onavailablechange = null;

  ////////////////////////////////////////////////////////////////////////////
  // Bookkeeping for the polyfill.

  // Map from presentation-URL|id to the corresponding PresentationSession.
  var presentationSessions_ = {};
  // Map from Cast session id to the corresponding presentation-URL|id.
  var castSessions_ = {};
  // The next presentation id to hand out (if one is not provided).
  var nextId_ = null;

  // https://webscreens.github.io/slidyremote/receiver.html
  var CAST_APP_ID = '673D55D4';
  var PRESENTATION_API_NAMESPACE_ =
      'urn:x-cast:org.w3.webscreens.presentationapi.shim';
  var ORIGIN_RE_ = new RegExp('https?://[^/]+');
  var NEXT_ID_KEY_ = 'navigator.presentation.nextId';

  var getNextId_ = function() {
    if (!nextId) {
      // Initialize nextId.
      if (localStorage[NEXT_ID_KEY_]) {
        nextId = new Number(localStorage[NEXT_ID_KEY_]);
      } else {
        nextId = 9999;
      }
    }
    nextId++;
    localStorage[NEXT_ID_KEY_] = nextId;
    return nextId;
  };

  ////////////////////////////////////////////////////////////////////////////
  // Implementation of Presentation API at
  // http://webscreens.github.io/presentation-api/
  presentation.requestSession = function(url, opt_id) {
    var id = opt_id || getNextId_();
    var session = new PresentationSession(url, id);

    // See if we already have a PresentationSession for this request.
    if (presentationSessions_[session.key_]) {
      return presentationSessions_[session.key_];
    }
    // Otherwise create a new session.
    presentationSessions_[session.key_] = session;

    // If the PresentationSession already has a Cast session attached return it.
    if (session.hasCastSession_()) {
      return session;
    } else if (session.castSessionId_) {
      // If the Cast session id is known for the PresentationSession, request
      // it.
      chrome.cast.lookupSessionById(session.castSessionId_);
    } else {
      // Request a new Cast session.
      chrome.cast.requestSession();
    }
    // Return the PresentationSession.
    // TODO: Return a Promise that is resolved when the session is connected.
    return session;
  };

  presentation.joinSession = function(url, id) {
    // TODO: Reduce duplication between requestSession() and joinSession().
    var session = new PresentationSession(url, id);
    // If there is an existing session for the presentation, just return it.
    if (presentationSessions_[session.key_]) {
      return presentationSessions_[session.key_];
    }
    // Otherwise create a new session.
    presentationSessions_[session.key_] = session;

    // If the PresentationSession already has a Cast session attached return it.
    if (session.hasCastSession_()) {
      return session;
    } else if (session.castSessionId_) {
      // If the Cast session id is known for the PresentationSession, request
      // it.
      chrome.cast.lookupSessionById(session.castSessionId_);
    } else {
      // Must await for a session to be joined by the Cast SDK.
    }
    // Return the PresentationSession.
    // TODO: Return a Promise that is resolved when the session is connected.
    return session;
  };

  var PresentationSession = function(url, id) {
    this.url = url;
    this.id = id;
    this.state = 'disconnected';
    this.onmessage = null;
    this.onstatechange = null;

    // Protected properties
    this.key_ = url + '|' + id;
    this.origin_ = ORIGIN_RE_.exec(url)[0];
    this.castSessionId_ = null;
    this.castSession_ = null;
  };

  PresentationSession.prototype.postMessage = function(message) {
    if (this.castSession_ && this.state == 'connected') {
      log.info('postMessage to ' + this.key_ + ': ' + message);
      this.castSession_.sendMessage(PRESENTATION_API_NAMESPACE,
                                    message,
                                    null,
                                    this.close.bind(this));
    } else {
      log.warn('postMessage failed for ' + this.key_ +
          '; no Cast session or not connected');
    }
  };

  // NOTE: Should this return a Promise?
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
                                         this.onCastMessage_.bind(this));
    this.castSession_.addUpdateListener(this.onCastSessionUpdate_.bind(this));
    this.state = 'connected';
    this.fireStateChange_();
  };

  PresentationSession.prototype.onCastMessage_ = function(namespace, message) {
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
      // TODO(mfoltz): What is the event object???
      this.onstatechange();
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

  // Invoked when a Cast session is connected.  We assume there is at most one
  // pending PresentationSession.
  var onCastSession_ = function(castSession) {
    if (!requestedSession_) return;
    requestedSession_.setCastSession_(castSession);
    requestedSession_.maybePresentURL_();
    requestedSession_ = null;
  };

  // Invoked when a Cast receiver is available or not.
  var onCastReceiverAvailable_ = function(availability) {
    if (typeof(presentation.onavailablechange) != 'function') {
      return;
    }
    if (availability == chrome.cast.ReceiverAvailability.AVAILABLE) {
      presentation.onavailablechange({available: true});
    } else {
      presentation.onavailablechange({available: false});
    }
  };

  var initializeCast_ = function() {
    var apiConfig = new chrome.cast.ApiConfig(
        new chrome.cast.SessionRequest(CAST_APP_ID),
        onCastSession_,
        onCastReceiverAvailable_,
        chrome.cast.AutoJoinPolicy.PAGE_SCOPED);
    chrome.cast.initialize(
        apiConfig,
        function() {
          console.info('Cast Sender SDK initialized successfully'),
          if (typeof window['__OnPresentationAPIAvailable'] == 'function') {
            window['__OnPresentationAPIAvailable']();
          }
        },
        function(error) {
          console.info('Unable to initialize Cast Sender SDK: ' + JSON.stringify(error));
        });
  };


  // Load the Cast Sender SDK.
  window['__onGCastApiAvailable'] = function(loaded, error) {
    if (loaded) {
      initializeCast_();
    } else {
      console.info('Cast Sender SDK not available: ' + JSON.stringify(error));
    };
  var script = document.createElement('script');
  script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js';
  document.head.appendChild(script);

  // Bind polyfill.
  navigator['presentation'] = presentation;
})();