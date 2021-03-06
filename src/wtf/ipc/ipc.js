/**
 * Copyright 2012 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview Browser simple IPC.
 * There should only be one channel open at a time.
 *
 * @author benvanik@google.com (Ben Vanik)
 */

goog.provide('wtf.ipc');

goog.require('goog.asserts');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('wtf.ipc.DomChannel');
goog.require('wtf.ipc.ExtensionChannel');
goog.require('wtf.ipc.MessageChannel');
goog.require('wtf.timing');


/**
 * Connects to the window that opened this window, if any.
 * When running inside a Chrome extension this will connect to the background
 * page.
 * @param {!function(this: T, wtf.ipc.Channel)} callback Connect callback.
 * @param {T=} opt_scope Scope for the callback.
 * @template T
 */
wtf.ipc.connectToParentWindow = function(callback, opt_scope) {
  var chrome = goog.global['chrome'];
  if (chrome && chrome['runtime'] &&
      chrome['runtime']['getBackgroundPage']) {
    chrome['runtime']['getBackgroundPage'](function(backgroundPage) {
      var channel = new wtf.ipc.MessageChannel(window, backgroundPage);
      channel.postMessage({
        'hello': true
      });
      callback.call(opt_scope, channel);
    });
  } else {
    if (!window.opener) {
      wtf.timing.setImmediate(function() {
        callback.call(opt_scope, null);
      });
      return;
    }

    var channel = new wtf.ipc.MessageChannel(window, window.opener);
    channel.postMessage({
      'hello': true
    });
    wtf.timing.setImmediate(function() {
      callback.call(opt_scope, channel);
    });
  }
};


/**
 * Waits for a single child window to connect.
 * @param {!function(this: T, !wtf.ipc.Channel)} callback Connect callback.
 * @param {T=} opt_scope Scope for the callback.
 * @template T
 */
wtf.ipc.waitForChildWindow = function(callback, opt_scope) {
  var key = goog.events.listen(
      window,
      goog.events.EventType.MESSAGE,
      /**
       * @param {!goog.events.BrowserEvent} browserEvent Event.
       */
      function(browserEvent) {
        var e = browserEvent.getBrowserEvent();
        if (e.data && e.data[wtf.ipc.MessageChannel.PACKET_TOKEN] &&
            e.data.data && e.data.data['hello'] == true) {
          e.stopPropagation();
          goog.events.unlistenByKey(key);

          goog.asserts.assert(e.source);
          var channel = new wtf.ipc.MessageChannel(window, e.source);
          callback.call(opt_scope, channel);
        }
      },
      true);
};


/**
 * Waits for a child window to connect.
 * This hooks the global message handler and sniffs for packets.
 * @param {!function(this: T, !wtf.ipc.Channel)} callback Connect callback.
 * @param {T=} opt_scope Scope for the callback.
 * @template T
 */
wtf.ipc.listenForChildWindows = function(callback, opt_scope) {
  goog.events.listen(
      window,
      goog.events.EventType.MESSAGE,
      /**
       * @param {!goog.events.BrowserEvent} browserEvent Event.
       */
      function(browserEvent) {
        var e = browserEvent.getBrowserEvent();
        if (e.data && e.data[wtf.ipc.MessageChannel.PACKET_TOKEN] &&
            e.data.data && e.data.data['hello'] == true) {
          e.stopPropagation();

          goog.asserts.assert(e.source);
          var channel = new wtf.ipc.MessageChannel(window, e.source);
          callback.call(opt_scope, channel);
        }
      },
      true);
};


/**
 * Connects to the extension with the given ID.
 * @param {string} extensionId Target extension ID.
 * @return {wtf.ipc.ExtensionChannel} Extension channel, if the other extension
 *     is installed.
 */
wtf.ipc.connectToExtension = function(extensionId) {
  var port = chrome.extension.connect(extensionId);
  if (!port) {
    return null;
  }
  var channel = new wtf.ipc.ExtensionChannel(port);
  return channel;
};


/**
 * Opens a new DOM channel on the given element.
 * @param {!(Document|Element)} el DOM element.
 * @param {string} eventType Event type name.
 * @return {wtf.ipc.DomChannel} DOM channel.
 */
wtf.ipc.openDomChannel = function(el, eventType) {
  // TODO(benvanik): feature detect CustomEvent/etc (no pre-IE9)
  return new wtf.ipc.DomChannel(el, eventType);
};
