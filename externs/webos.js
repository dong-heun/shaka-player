/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for WebOS
 *
 * @externs
 */


/** @const */
var PalmSystem = {};


/** @type {string} */
PalmSystem.deviceInfo;


/** @constructor */
function PalmServiceBridge() {}


/** @type {?Function} */
PalmServiceBridge.prototype.onservicecallback;


/** @type {Function} */
PalmServiceBridge.prototype.call = function() {};


/**
 * @typedef {{
 *   mediaOption: (string|undefined)
 * }}
 */
var HTMLVideoElementWebOS;


/**
 * WebOS-specific mediaOption property for HTMLVideoElement.
 * Used to provide resolution and frame rate hints to the WebOS platform
 * for optimal resource allocation during adaptive streaming.
 * @type {string|undefined}
 */
HTMLVideoElement.prototype.mediaOption;


/**
 * WebOS-specific mediaOption property for HTMLMediaElement.
 * Used to provide resolution and frame rate hints to the WebOS platform
 * for optimal resource allocation during adaptive streaming.
 * @type {string|undefined}
 */
HTMLMediaElement.prototype.mediaOption;
