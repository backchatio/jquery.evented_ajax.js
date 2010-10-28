/**
 * Evented Ajax jQuery Plugin
 *
 * Web applications are becoming more event driven as non-blocking servers, such as NodeJS or Twistd, become more popular.
 * Posting Ajax requests in these sorts of architectures means we can no longer expect an immediate result, instead, the
 * results will be raised within a streaming connection (such as websocket, or comet).
 * This plugin provides a way of attaching callbacks to success or failure states of these non-blocking Ajax requests
 * through the use of the "future" method.
 *
 * The future method listens for a future namespaced event raised through an asynch communication stream (websocket, comet)
 * and triggers what would have been the ajax callback (success or fail) methods (just like a normal $.ajax request).
 *
 * <code>
 *   // Example usage
 *   $.eventedAjax(
 *     {
 *       type: 'POST',
 *       url: "/steam/user",
 *       data: { username: "dummyuser" },
 *       success: function(data) {
 *         // The Ajax request was OK... now we wait!
 *       },
 *       error: function(req, status, errorThrown) {
 *         // Handle an Ajax error herre
 *       }
 *     }, {
 *       // These custom events would trigger the success callback
 *       successEvents: ["UserCreated"],
 *       success: function(e, data) {
 *         $("#status").html("User created!");
 *       },
 *       errorEvents: ["UserCreationFailed", "UserExists"],
 *       error: function(e, data) {
 *         $("#status").html("There was a problem creating the user.");
 *       },
 *       futureTimeout: 1000,
 *       onFutureTimeout: function() {
 *         $("#status").html("Your request timed out.");
 *       }
 *     }
 *   );
 * </code>
 *
 * @author      Adam Burmister <adam@mojolly.com>
 * @copyright   2010, Mojolly Ltd
 */
(function( $ ){  
  $.extend({
    // Default settings for the future method
    futureOptions : {
      notificationElement: $("body"), // element on which events are triggered
      futureTimeout: 10000,     // How long should the future stick around for before giving up
      onFutureTimeout: $.noop,  // Do this if the future never triggers and timesout
      successEvents: [],        // Custom jQuery Event's that trigger the success callback
      success: $.noop,
      errorEvents: [],          // Custom jQuery Event's that trigger the error callback
      error: $.noop,
      clientMsgId: "undefined"  // Used to match outgoing Ajax POSTs with raised jQuery Event's
    },
    
    /**
     * Set default values for future future() requests.
     * @param {object} options A set of key/value pairs that configure the default future request. All options are optional.
     */
    futureSetup : function(options) {
      $.extend($.futureOptions, options);
    },
    
    /**
     * Create a future event listener.
     *
     * @param {Object} futureOptions A set of key/value pairs that configure
     * the future() method. This defines the target event that will be
     * raised from the stream, and the callback for that event, amongst others.
     * @see futureOptions
     */
    future : function(options) {
      // Ensure we have sane defaults for options
      options = $.extend(true, {}, $.futureOptions, options);
      
      // Namespace the event names with the clientMsgId
      options.successEvents = ($.isArray(options.successEvents) ? options.successEvents : [options.successEvents]);
      options.errorEvents = ($.isArray(options.errorEvents) ? options.errorEvents : [options.errorEvents]);
      var namespace = "."+options.clientMsgId;
      var allEvents = $.merge([], options.successEvents); allEvents = $.merge(allEvents, options.errorEvents);
      var eventsToListenTo = "";
      for(var i=0; i<allEvents.length; i++) {
        eventsToListenTo += allEvents[i]+namespace+" ";
      }
      eventsToListenTo = eventsToListenTo.trim();

      // start a timer so we can deal with a timeout
      var timer = setTimeout(function() {
        // Call any callback for timeout
        options.onFutureTimeout();

        // Stop listening to the events for this future
        options.notificationElement.unbind(namespace);
      }, options.futureTimeout);

      // Listen for the events
      options.notificationElement.bind(eventsToListenTo, 
        function(e, data) {
          if(""+e.namespace !== ""+options.clientMsgId) {
            return;
          }
          
          clearTimeout(timer);
          
          // Stop listening to the events for this future
          options.notificationElement.unbind(namespace);
          
          // Callbacks
          if($.inArray(e.type, options.successEvents) !== -1) {
            options.success(e, data);
          } else if($.inArray(e.type, options.errorEvents) !== -1) {
            options.error(e, data);
          }
          
          // Republish the event without the namespace for general handlers
          options.notificationElement.trigger(e.type, data);
        }
      );
    },
    
    /**
     * Perform an asynchronous HTTP (Ajax) request, not blocking for
     * the HTTP response, rather expecting the result to raised as an
     * event triggered by a message in an open
     * comet/websocket/long-polling stream.
     * A clientMsgId is generated from the current timestamp (unless
     * one has been passed through already) and attached as a
     * parameter to any outgoing Ajax requests. This ID needs to be 
     * included in the stream's response as it will be used to match 
     * the callback to the event.
     * <code>
     *   // Example stream data-received handler pseudo code:
     *   var data = $.parseJSON(response.responseBody);
     *   var eventName = data.eventName;
     *   // If this is a response to a client-event then namespace the event with the clientMsgId
     *   // This was we can bind to responses from a specific client raised event
     *   if(data.clientMsgId) {
     *     eventName += "."+data.clientMsgId
     *   }
     *   $("#eventNotifications").trigger(eventName, data)
     * </code>
     * @param {Object} ajaxOptions A set of key/value pairs that configure the
     * Ajax request. All options are optional. See jQuery.ajax() for
     * full option descriptions.
     * @see jQuery#ajax
     * @param {Object} futureOptions A set of key/value pairs that configure
     * the future() method. This defines the target event that will be
     * raised from the stream, and the callback for that event, amongst others.
     * @return clientMsgId The ID of the message sent to the server within the
     * Ajax request, and expected within the raised event from the stream.
     * @type String
     */
    eventedAjax : function(ajaxOptions, futureOptions) {
      // Generate the clientMsgId if none passed through
      var clientMsgId = "" + new Date().valueOf();
      
      // Now listen for the next instance of these events
      $.future($.extend(true, { clientMsgId: clientMsgId }, futureOptions));
      
      // Make the Ajax request
      $.ajax($.extend(true, { data: { clientMsgId: clientMsgId }}, ajaxOptions));
    }
  });
})( jQuery );
