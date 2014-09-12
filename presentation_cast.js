(function() {

  var presentation = {};

  // https://webscreens.github.io/slidyremote/receiver.html
  var CAST_APP_ID = '673D55D4';
  var PRESENTATION_API_NAMESPACE_ =
      'urn:x-cast:org.w3.webscreens.presentationapi.shim';
  var ORIGIN_RE_ = new RegExp('https?://[^/]+');


  ////////////////////////////////////////////////////////////////////////////
  // Implementation of Presentation API at
  // http://webscreens.github.io/presentation-api/ with some proposed changes:
  // - Added an |id| property to PresentationSession
  // - Added |presentationId| and |opt_onlyReconnect| parameters to
  //   requestSession
  presentation.requestSession = function(url, presentationId, opt_onlyReconnect) {
    if (this.requestedSession_) {
      console.log('There is already a presentation request pending for '
          + this.requestedSession_.getKey());
      return;
    }

    presentationId = presentationId ? presentationId : '';
    var sessionKey = url + '|' + presentationId;

    // See if we already have a PresentationSession for this request.
    session = presentationSessions_[sessionKey];
    // Otherwise create a new PresentationSession.
    if (!session) {
      session = new PresentationSession(url, presentationId);
      presentationSessions_[sessionKey] = session;
    }

    // If the PresentationSession already has a Cast session attached return it.
    if (session.hasCastSession_()) {
      return session;
    } else if (session.castSessionId_) {
      // If the Cast session id is known for the PresentationSession, request
      // it.
      //
      // TODO(mfoltz): Keep a persistent map of session key -> cast session id
      // for connections across pages.
      this.requestedSession_ = session;
      chrome.cast.lookupSessionById(session.castSessionId_);
    } else if (!opt_onlyReconnect) {
      // Otherwise, if opt_onlyReconnect != true, request a new Cast session.
      this.requestedSession_ = session;
      chrome.cast.requestSession();
    }

    // Return the PresentationSession.
    return session;
  };

  presentation.navailablechange = null;

  var PresentationSession = function(url, id) {
    this.url = url;
    this.id = id;
    this.state = 'disconnected';
    this.onmessage = null;
    this.onstatechange = null;

    // Private properties
    this.origin_ = ORIGIN_RE_.exec(url)[0];
    this.castSessionId_ = null;
    this.castSession_ = null;
  };

  PresentationSession.prototype.postMessage = function(message) {
    if (this.castSession_ && this.state == 'connected') {
      this.castSession_.sendMessage(PRESENTATION_API_NAMESPACE,
                                    message,
                                    null,
                                    this.close.bind(this));
    }
  };

  PresentationSession.prototype.close = function() {
    if (this.state == 'disconnected') {
      return;
    }
    if (this.castSession_) {
      this.castSession_.stop();
    }
    this.state = 'disconnected';
    this.fireStateChange_();
  };


  ////////////////////////////////////////////////////////////////////////////
  // Implementation specific functions.  Not part of public API.
  PresentationSession.prototype.setCastSession_ = function(session) {
    if (this.castSession_) {
      console.log('PresentationSession ' + this.getKey_() +
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

  var presentationSessions_ = {};
  var requestedSession_ = null;

  // var loadCastSessionIds_ = function() {
  //   if (castSessionIds_) return;
  //   var storedIds = localStorage['presentations'];
  //   if (storedIds) {
  //     castSessionIds_ = JSON.parse(storedIds);
  //   } else {
  //     castSessionIds_ = {};
  //     localStorage['presentations'] = JSON.stringify(castSessionIds_);
  //   }
  // };

  // var lookupCastSessionId_ = function(sessionKey) {
  //   loadCastSessionIds_();
  //   return castSessionIds_[presentationId] || null;
  // };


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
          console.log('Cast Sender SDK initialized successfully'),
          if (typeof window['__OnPresentationAPIAvailable'] == 'function') {
            window['__OnPresentationAPIAvailable']();
          }
        },
        function(error) {
          console.log('Unable to initialize Cast Sender SDK: ' + JSON.stringify(error));
        });
  };


  // Load the Cast Sender SDK.
  window['__onGCastApiAvailable'] = function(loaded, error) {
    if (loaded) {
      initializeCast_();
    } else {
      console.log('Cast Sender SDK not available: ' + JSON.stringify(error));
    };
  var script = document.createElement('script');
  script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js';
  document.head.appendChild(script);

  // Bind polyfill.
  navigator['presentation'] = presentation;
})();