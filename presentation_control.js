// The PresentationController encapsulates the basic flow to start, rejoin and
// stop presentations.  It requires that the Presentation API polyfill be
// available and initialized.  Two buttons with ids 'show' and 'stop' will be
// used to start and stop presentation.
//
// Usage:
//
// var p = new PresentationController();
// window['__OnPresentationAPIAvailable'] = function() {
//   p.initialize();
// };
// ...
// p.startPresent(url) // e.g., in onclick for 'show' button
// p.stopPresent() // e.g., in onclick for 'stop' button
//
// TODO: Support multiple simultaneous sessions.
function() {
  var presentation = navigator.presentation;

  var PresentationController = function() {
    this.session = null;
    this.screenAvailable = false;
    this.presentationUrl = localStorage['presentationUrl'] || null;
    this.presentationId = localStorage['presentationId'] || null;
    this.showButton = null;
    this.stopButton = null;
  };

  // Initializes the controller.
  PresentationController.prototype.initialize = function() {
    presentation.onavailablechange = function(e) {
      log.info('Screen availability changed from ' + this.screenAvailable +
          ' to ' + e.available);
      this.screenAvailable = e.available;
      updateButtons();
    }.bind(this);
    this.setupPage_();
    this.checkExisting_();
  };

  // Binds UI elements for the page.
  PresentationController.prototype.setupPage_ = function() {
    this.showButton = document.getElementById('show'),
    this.stopButton = document.getElementById('stop'),
    if (!this.showButton || !this.stopButton) {
      log.error('Show or stop button not found');
    }
  };

  // Attempt to join an existing presentation, if one was remembered.
  PresentationController.prototype.checkExisting_ = function() {
    if (this.presentationUrl && this.presentationId) {
      presentation.joinSession(this.presentationUrl, this.presentationId).then(
          function(existingSession) {
            log.info('Found existing session for [' + this.presentationUrl + ', ' +
                this.presentationId + ']');
            this.setSession(existingSession);
            this.updateButtons();
          }.bind(this),
          function() {
            log.info('No session found for [' + this.presentationUrl + ', ' +
                this.presentationId + ']');
            this.resetSession();
            this.updateButtons();
          }.bind(this));
      }
  };

  // Updates the state of the buttons based on screen availability and the
  // status of any presentation session.
  PresentationController.prototype.updateButtons_ = function() {
    var hasSession = this.session && this.session.state == 'connected';
    if (this.stopButton) {
      this.stopButton.disabled = !hasSession;
      this.stopButton.onClick = hasSession ? this.stopPresent : null;
    }
    if (this.showButton) {
      this.showButton.disabled = !this.screenAvailable;
      this.showButton.onclick = this.screenAvailable ? this.startPresent : null;
    }
  };

  // Requests new presentation of |url|.  Returns a Promise that resolves
  // to the new PresentationSession or rejects if the user cancelled presentation.
  PresentationController.prototype.startPresent = function(url) {
    if (!this.screenAvailable) {
      log.warn('Presentation requested but no screens available!?');
      return;
    }
    return presentation.requestSession(url).then(
        function(newSession) {
          log.info('New session obtained for [' + this.newSession.url +
              ', ' + this.newSession.id + ']');
          this.setSession_(newSession);
          this.updateButtons_();
          newSession.onstatechange = function() {
            log.info('Presentation [' + newSession.url + ', ' + newSession.id +
                '], new state = ' + newSession.state);
            if (newSession == this.session) {
              this.updateButtons_();
            }
          }.bind(this);
          return newSession;
        }.bind(this),
        function() {
          log.warn('User cancelled session request for ' + url);
          return Error('User cancelled session request');
        });
  };

  // Stops the current presentation session, if any.
  PresentationController.prototype.stopPresent = function() {
    if (this.session) {
      log.info('Stopping presentation of [' + this.presentationUrl +
          ', ' + this.presentationId + ']');
      this.session.close();
    } else {
      log.warn('Stopping was requested, but no session available');
    }
    this.resetSession_();
  };

  // Removes data stored for the current session.
  PresentationController.prototype.resetSession_ = function() {
    delete localStorage['presentationId'];
    delete localStorage['presentationUrl'];
    this.presentationId = null;
    this.presentationUrl = null;
  };

  // Sets the current presentation session for the controller.
  PresentationController.prototype.setSession_(theSession) {
    log.info('Setting current presentation to: [' + theSession.url +
      ', ' + theSession.id + '], state = ' + theSession.state);
    if (this.session) {
      this.stopPresent();
    }
    this.session = theSession;
    this.presentationUrl = this.session.url
    this.presentationId = this.session.id
    localStorage['presentationUrl'] = this.session.url;
    localStorage['presentationId'] = this.session.id;
  }
}
