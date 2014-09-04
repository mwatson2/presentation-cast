(function() {

  var CAST_NAMESPACE_ = 'org.w3c.PresentationAPI';
  var ORIGIN_RE_ = new RegExp('https?://[^/]+');

  var PresentationSession = function(url, id) {
    this.url = url;
    this.id = id;
    this.state = 'disconnected';

    this.origin_ = ORIGIN_RE_.exec(url)[0];
    this.castSession_ = null;
  };

  PresentationSession.prototype.postMessage = function(message) {
    if (this.castSession_) {
      this.castSession_.sendMessage(CAST_NAMESPACE,
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

  PresentationSession.prototype.setCastSession_ = function(session) {
    if (this.castSession_) {
      return;
    }
    this.castSession_ = session;
    this.castSession_.addMessageListener(CAST_NAMESPACE_,
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
    this.onmessage({data: message, origin: this.origin_, lastEventId: '', source: null, ports: null});
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

  PresentationSession.prototype.onmessage = null;
  PresentationSession.prototype.onstatechange = null;

  var castSessionIds_ = null;
  var presentationSessions_ = {};

  var lookupCastSessionId_ = function(sessionKey) {
    if (castSessionIds_) {
      return castSessionIds_[presentationId];
    } else {
      var storedIds = localStorage['presentations'];
      if (storedIds) {
        castSessionIds_ = JSON.parse(storedIds);
        return castSessionIds_[presentationId];
      } else {
        castSessionIds_ = {};
        localStorage['presentations'] = JSON.stringify(castSessionIds_);
        return null;
      }
    }
  };


  presentation.requestSession = function(url, presentationId, opt_onlyReconnect) {
    presentationId = presentationId ? presentationId : '';
    var sessionKey = url + '|' + presentationId;

    // See if we already have a session for this request.  If so, return it.
    if (presentationSessions_[sessionKey]) {
      return presentationSessions_[sessionKey];
    }

    // Create a new session.
    var session = new PresentationSession(url, presentationId);
    presentationSessions_[sessionKey] = session;

    // If there is a known Cast session for the Presentation session, request it.
    // Otherwise, request a new Cast session if opt_onlyReconnect != true.
    var castSessionId = lookupCastSessionId_(url, presentationId);
    if (castSessionId) {
      chrome.cast.lookupSessionById(castSessionId);
    } else if (!opt_onlyReconnect) {
      var castSessionRequest = new chrome.cast.SessionRequest(
      chrome.cast.requestSession(
  };

  presentation.onavailablechange = null;

  window['presentation'] = presentation;
})();
