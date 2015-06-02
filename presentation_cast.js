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
    // Cast Application Id for which the SDK was initialized
    var castApplicationId_ = undefined;
    // DIAL application name for which the SDK was initialized
    var dialApplicationName_ = undefined;
    // Map from presentationUrlL|id to the corresponding PresentationSession.
    var presentationSessions_ = {};
    // Map from Cast session id to the corresponding PresentationSession.
    var castSessions_ = {};
    // Keeps track of the PresentationSession that is currently being started or
    // joined, to link up with listeners in the Cast SDK.
    var pendingSession_ = null;

    var ORIGIN_RE_ = new RegExp('https?://[^/]+');
    var DIAL_URL_RE_ = new RegExp('https?://[^#]*#__dialAppName__=([^/]*)(/__dialPostData__=(.*))?$');
    var CAST_URL_RE_ = new RegExp('https?://[^#]*#__castAppId__=.*$');
    
    // Register DIAL applications that support WebSocket messaging here
    var DIAL_CAST_REGISTRY = {
    	"Netflix" : { "cast" : "CA5E8412", "port" : 9080 }
    };
    
    // Register CAST applications that support CAST messaging here
    var CAST_NAMESPACE_REGISTRY = {
    	"B46B8FE4" : 'urn:x-cast:org.w3.webscreens.presentationapi.shim',
    	"5E735230" : 'urn:x-cast:org.w3.webscreens.presentationapi.shim',
    	"CC9C7FD8" : 'urn:x-cast:org.w3.webscreens.presentationapi.shim'
    };

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

                resolve(session);

                // If it was a DIAL launch, after resolving the promise we'll asynchronously
                // post a message to the presentation session with the additionalData field
                // containing the <webSocketUrl> field.
                // CAST does not expose the additionalData from the DIAL REST API, so 
                // we reconstruct it here from the things that CAST does expose
                if (castSession.receiver.receiverType === "dial") {
                    window.setTimeout(function() {
                    
                    	// CAST does not pass back the Additional Data field, so for the
                    	// moment we need to fake out what it would contain
                        var ipAddress = castSession.receiver.ipAddress;

                        // Hardcoded port for now
                        var port = DIAL_CAST_REGISTRY[ dialApplicationName_ ]['port'];

                        // This ID is only required for Netflix MDX
                        var id = encodeURIComponent(castSession.receiver.label);

                        // Return the URL with all the info we need encoded
                        var wsUrl = "ws://" + ipAddress + ":" + port + "?id=" + id,
                        	wsElement = "<webSocketUrl>" + wsUrl + "</webSocketUrl>",
                        	adElement = "<additionalData>" + wsElement + "</additionalData>";
                        session.onmessage(adElement);
                    }, 0);
                }
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
        if (this.castSession_ && this.state == 'connected' && this.castNamespace_ ) {
            log.info('postMessage to ' + this.key_ + ': ' + message);
            this.castSession_.sendMessage(this.castNamespace_,
                                          message,
                                          null,
                                          this.close.bind(this));
        } else {
            log.warn('postMessage failed for session ' + this.key_ +
                     '; no Cast session or not connected or app does not support cast messaging');
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
        
        // See if this cast application is registered for CAST messaging
        if ( CAST_NAMESPACE_REGISTRY[ castApplicationId_ ] ) {
        
        	this.castNamespace_ = CAST_NAMESPACE_REGISTRY[ castApplicationId_ ];
             
			this.castSession_.addMessageListener(this.castNamespace_,
												 this.onPresentationMessage_.bind(this));
		}
		
		this.castSession_.addUpdateListener(this.onCastSessionUpdate_.bind(this));
        
        this.state = 'connected';
        this.fireStateChange_();
    };

    PresentationSession.prototype.onPresentationMessage_ =
        function(namespace, message) {
            if (namespace != this.castNamespace_ ||
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

    // Invoked when a Cast session is automatically connected.  Currently we don't
    // support auto-join/auto-fling with this polyfill.
    var onCastSession_ = function(castSession) {
        log.info('onCastSession: connected to session ' + castSession.sessionId);
    };

    // Invoked when a Cast receiver is available or not.
    var onCastReceiverAvailable_ = function(availability) {
        if (typeof(navigator.presentation.onavailablechange) != 'function') {
            return;
        }
        log.info('onCastReceiverAvailable: available = ' + availability);
        if (availability == chrome.cast.ReceiverAvailability.AVAILABLE) {
            navigator.presentation.onavailablechange(new AvailableChangeEvent(true));
        } else {
            navigator.presentation.onavailablechange(new AvailableChangeEvent(false));
        }
    };

    // Initialization function for CAST detection
	var initializeCast_ = function( castAppId ) {
		return new Promise(function(resolve, reject) {
			var apiConfig = new chrome.cast.ApiConfig(
				new chrome.cast.SessionRequest(castAppId),
				onCastSession_,
				onCastReceiverAvailable_,
				chrome.cast.AutoJoinPolicy.PAGE_SCOPED);
			chrome.cast.initialize(
				apiConfig,
				function() {
					log.info('Cast Sender SDK initialized successfully for CAST App Id ' + castAppId );
					castApiInitialized_ = true;
					castApplicationId_ = castAppId;
					resolve();
				},
				function(error) {
					log.error('Unable to initialize Cast Sender SDK: ' + JSON.stringify(error));
					reject(Error(JSON.stringify(error)));
            	});
		});
	};
	
	// Initialization function for DIAL detection
    var initializeDial_ = function(castAppId, dialAppName, dialLaunchPayload) {
        return new Promise(function(resolve, reject) {
            chrome.cast.timeout.requestSession = 30000;
            var sessionRequest = new chrome.cast.SessionRequest(castAppId);
            sessionRequest.dialRequest = new chrome.cast.DialRequest(dialAppName, dialLaunchPayload);
            var apiConfig = new chrome.cast.ApiConfig(
                sessionRequest,
                onCastSession_,
                onCastReceiverAvailable_,
                chrome.cast.AutoJoinPolicy.PAGE_SCOPED,
                chrome.cast.DefaultActionPolicy.CREATE_SESSION);
            chrome.cast.initialize(
                apiConfig,
                function() {
                    log.info('Cast Sender SDK initialized successfully for DIAL application ' + dialAppName),
                    castApiInitialized_ = true;
                    castApplicationId_ = castAppId;
                    dialApplicationName_ = dialAppName;
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
        if (!loaded) {
       		log.error('Cast Sender SDK not available: ' + JSON.stringify(error));
       		return;
       	}

		// Look for default URL
		var links = Array.prototype.slice.call( document.head.getElementsByTagName("link") )
			.filter( function( l ) { return l.rel == "default-presentation"; } );
		
		if ( links.length == 0 ) {
			log.error("No default presentation URL found");
			return;
		}
	
		var match = DIAL_URL_RE_.exec( links[ 0 ].href );
		if ( match && match[ 0 ] ) {
		
			// Initialize Cast detection for this application
			var dialAppName = match[1],
				castAppId = DIAL_CAST_REGISTRY[ dialAppName ]['cast'];
				
			if ( !castAppId ) {
				log.error("No CAST Application ID for DIAL Application " + dialAppName );
				return;
			}
			
			log.info("Initializing with DIAL Application Name: " + dialAppName
					+ " and post data: " + match[3] );
			
			// Bind polyfill.
			navigator['presentation'] = presentation;
			
			// Initialize DIAL	
			initializeDial_( castAppId, dialAppName, match[3] ).then( function() {
				// Invoke a well-known callback so clients are notified when they can
				// call functions in the polyfill.
				if (typeof window['__onPresentationAvailable'] == 'function') {
					window['__onPresentationAvailable']();
				}
			} );
		} else {
		
			match = CAST_URL_RE_.exec( links[ 0 ].href );
			if ( !match || !match[0] ) {
				log.error("No CAST or DIAL application name in default presentation URL");
				return;
			}
			
			// Bind polyfill.
			navigator['presentation'] = presentation;
			
			// Initialize CAST	
			initializeCast_( match[0] ).then( function() {
				// Invoke a well-known callback so clients are notified when they can
				// call functions in the polyfill.
				if (typeof window['__onPresentationAvailable'] == 'function') {
					window['__onPresentationAvailable']();
				}
			} );	
		}
    };
    
    // Pull in the CAST sender SDK
    var script = document.createElement('script');
    script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js';
    document.head.appendChild(script);

})();


// TODO: Fix this
// Uncaught TypeError: Cannot read property 'state' of nullcontroller.js:61 session.onstatechangepresentation_cast.js:222 PresentationSession.fireStateChange_presentation_cast.js:212 PresentationSession.onCastSessionUpdate_cast_sender.js:5875 (anonymous function)cast_sender.js:5874 b.uicast_sender.js:5867 b.Clcast_sender.js:5825 b.Wncast_sender.js:5703 chrome.cast.pc.Ip
