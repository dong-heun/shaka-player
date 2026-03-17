/*! @license
 * Shaka Player
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

goog.provide('shaka.device.WebOS');
goog.provide('shaka.device.WebOSBrowser');

goog.require('shaka.config.CrossBoundaryStrategy');
goog.require('shaka.device.AbstractDevice');
goog.require('shaka.device.DeviceFactory');
goog.require('shaka.device.IDevice');
goog.require('shaka.log');


/**
 * @final
 */
shaka.device.WebOS = class extends shaka.device.AbstractDevice {
  constructor() {
    super();

    /** @private {?number} */
    this.osVersion_ = this.guessWebOSVersion_();

    /** @private {?boolean} */
    this.supportHdr_ = null;

    try {
      const bridge = new PalmServiceBridge();
      bridge.onservicecallback = (n) => {
        shaka.log.info('WebOS: config support', n);
        /** @type {!shaka.device.WebOS.PalmServiceBridgeResponse} */
        const configsJSON =
        /** @type {shaka.device.WebOS.PalmServiceBridgeResponse} */ (
            JSON.parse(n));
        this.supportHdr_ = configsJSON['configs']['tv.model.supportHDR'] ||
          configsJSON['configs']['tv.config.supportDolbyHDRContents'] || false;
      };
      const configs = {
        'configNames': [
          'tv.model.supportHDR',
          'tv.config.supportDolbyHDRContents',
        ],
      };
      // eslint-disable-next-line no-restricted-syntax
      bridge.call('luna://com.webos.service.config/getConfigs',
          JSON.stringify(configs));
    } catch (e) {
      shaka.log.alwaysWarn('WebOS: getConfigs call failed', e);
      // Ignore errors.
    }
  }

  /**
   * @override
   */
  getVersion() {
    return this.osVersion_;
  }

  /**
   * @override
   */
  getDeviceName() {
    return 'WebOS';
  }

  /**
   * @override
   */
  getDeviceType() {
    return shaka.device.IDevice.DeviceType.TV;
  }

  /**
   * @override
   */
  getBrowserEngine() {
    return shaka.device.IDevice.BrowserEngine.CHROMIUM;
  }

  /**
   * @override
   */
  supportsMediaCapabilities() {
    return false;
  }

  /**
   * @override
   */
  supportsSequenceMode() {
    const version = this.getVersion();
    return version !== null ? version > 3 : super.supportsSequenceMode();
  }

  /**
   * @override
   */
  supportsSmoothCodecSwitching() {
    const version = this.getVersion();
    return version !== null ?
        version > 6 : super.supportsSmoothCodecSwitching();
  }

  /**
   * @override
   */
  supportsServerCertificate() {
    const version = this.getVersion();
    return version !== null ? version > 3 : super.supportsServerCertificate();
  }

  /**
   * @override
   */
  detectMaxHardwareResolution() {
    const maxResolution = {width: 1920, height: 1080};
    try {
      const deviceInfo =
      /** @type {{screenWidth: number, screenHeight: number}} */(
          JSON.parse(window.PalmSystem.deviceInfo));
      // WebOS has always been able to do 1080p.  Assume a 1080p limit.
      maxResolution.width = Math.max(1920, deviceInfo['screenWidth']);
      maxResolution.height = Math.max(1080, deviceInfo['screenHeight']);
    } catch (e) {
      shaka.log.alwaysWarn('WebOS: Error detecting screen size, default ' +
          'screen size 1920x1080.');
    }

    return Promise.resolve(maxResolution);
  }

  /**
   * @override
   */
  adjustConfig(config) {
    super.adjustConfig(config);

    if (this.getVersion() === 3) {
      config.streaming.crossBoundaryStrategy =
          shaka.config.CrossBoundaryStrategy.RESET;
    }
    config.streaming.shouldFixTimestampOffset = true;
    // WebOS has long hardware pipeline that respond slowly to seeking.
    // Therefore we should not seek when we detect a stall on this platform.
    // Instead, default stallSkip to 0 to force the stall detector to pause
    // and play instead.
    config.streaming.stallSkip = 0;
    return config;
  }

  /**
   * @override
   */
  getHdrLevel(preferHLG) {
    if (this.supportHdr_ == null) {
      shaka.log.alwaysWarn('WebOS: getConfigs call haven\'t finished');
      return super.getHdrLevel(preferHLG);
    }
    if (this.supportHdr_) {
      // It relies on previous codec filtering
      return preferHLG ? 'HLG' : 'PQ';
    }
    return 'SDR';
  }

  /**
   * @return {?number}
   * @private
   */
  guessWebOSVersion_() {
    let browserVersion = null;
    const match = navigator.userAgent.match(/Chrome\/(\d+)/);
    if (match) {
      browserVersion = parseInt(match[1], /* base= */ 10);
    }

    switch (browserVersion) {
      case 38:
        return 3;
      case 53:
        return 4;
      case 68:
        return 5;
      case 79:
        return 6;
      case 87:
        return 22;
      case 94:
        return 23;
      case 108:
        return 24;
      case 120:
        return 25;
      default:
        return null;
    }
  }

  /**
   * @override
   */
  supportStandardVP9Checking() {
    return false;
  }

  /**
   * @override
   */
  supportsCbcsWithoutEncryptionSchemeSupport() {
    const version = this.getVersion();
    return version !== null ?
        version >= 6 : super.supportsCbcsWithoutEncryptionSchemeSupport();
  }

  /**
   * Sets mediaOption on video element based on manifest information.
   *
   * WebOS manages background resource cleanup based on media resource
   * information. For MSE (Media Source Extensions), since adaptive streaming
   * is inherently supported, the platform allocates maximum resources for
   * the given codec by default. By providing resolution and frame rate hints
   * upfront through mediaOption, we enable the platform to optimize resource
   * allocation and minimize unnecessary resource cleanup of in-use resources.
   *
   * This proactive hint prevents the platform from over-allocating resources
   * and reduces the likelihood of resource conflicts during playback.
   *
   * @override
   */
  setMediaOptionFromManifest(video, manifest) {
    // Check if mediaOption property is available (WebOS only)
    if (!('mediaOption' in video)) {
      return;
    }

    // Extract max resolution and frame rate from all variants
    let manifestMaxWidth = 0;
    let manifestMaxHeight = 0;
    let manifestMaxFrameRate = 0;

    for (const variant of manifest.variants) {
      if (variant.video) {
        manifestMaxWidth = Math.max(manifestMaxWidth,
            variant.video.width || 0);
        manifestMaxHeight = Math.max(manifestMaxHeight,
            variant.video.height || 0);
        manifestMaxFrameRate = Math.max(manifestMaxFrameRate,
            variant.video.frameRate || 0);
      }
    }

    // If no valid resolution info in manifest, nothing to do
    if (manifestMaxWidth === 0 || manifestMaxHeight === 0) {
      shaka.log.debug('WebOS: No video streams in manifest, ' +
          'skipping mediaOption configuration');
      return;
    }

    // Parse existing mediaOption if present
    let existingOptions = null;
    if (video.mediaOption) {
      try {
        existingOptions = /** @type {?} */ (JSON.parse(video.mediaOption));
      } catch (e) {
        shaka.log.alwaysWarn('WebOS: Failed to parse existing mediaOption', e);
      }
    }

    // Get existing adaptiveStreaming settings if any
    const existingAdaptiveStreaming = /** @type {Object} */ ((existingOptions &&
        existingOptions['option'] &&
        existingOptions['option']['adaptiveStreaming']) || {});

    // Merge: prioritize existing user settings, use manifest for missing values
    const maxWidth = existingAdaptiveStreaming['maxWidth'] !== undefined ?
        existingAdaptiveStreaming['maxWidth'] : manifestMaxWidth;
    const maxHeight = existingAdaptiveStreaming['maxHeight'] !== undefined ?
        existingAdaptiveStreaming['maxHeight'] : manifestMaxHeight;

    // Build adaptiveStreaming object with available values
    const adaptiveStreaming = {
      maxWidth: maxWidth,
      maxHeight: maxHeight,
    };

    // Only add maxFrameRate if we have valid information
    if (existingAdaptiveStreaming['maxFrameRate'] !== undefined) {
      // Use user-provided value, rounded up to integer
      adaptiveStreaming.maxFrameRate = Math.ceil(
          existingAdaptiveStreaming['maxFrameRate']);
    } else if (manifestMaxFrameRate > 0) {
      // Use manifest value if available, rounded up to integer
      // e.g., 29.97fps -> 30fps, 59.94fps -> 60fps
      adaptiveStreaming.maxFrameRate = Math.ceil(manifestMaxFrameRate);
    }
    // If neither exists, don't set maxFrameRate at all

    // Build final options object
    const options = {
      'option': Object.assign(
          {},
          existingOptions && existingOptions['option'],
          {'adaptiveStreaming': adaptiveStreaming}),
    };

    try {
      video.mediaOption = JSON.stringify(options);
      const source =
          existingAdaptiveStreaming['maxWidth'] !== undefined ||
          existingAdaptiveStreaming['maxHeight'] !== undefined ||
          existingAdaptiveStreaming['maxFrameRate'] !== undefined ?
              'merged with user settings' : 'from manifest';
      const fpsInfo = adaptiveStreaming.maxFrameRate ?
          '@' + adaptiveStreaming.maxFrameRate + 'fps' : '';
      shaka.log.info('WebOS: Set mediaOption ' + source,
          maxWidth + 'x' + maxHeight + fpsInfo);
    } catch (e) {
      shaka.log.alwaysWarn('WebOS: Failed to set mediaOption', e);
    }
  }

  /**
   * @return {boolean}
   * @private
   */
  static isWebOS_() {
    return navigator.userAgent.includes('Web0S');
  }
};


/**
 * @final
 */
shaka.device.WebOSBrowser = class extends shaka.device.AbstractDevice {
  constructor() {
    super();

    /** @private {?number} */
    this.osVersion_ = this.guessWebOSVersion_();
  }

  /**
   * @override
   */
  getVersion() {
    return this.osVersion_;
  }

  /**
   * @override
   */
  getDeviceName() {
    return 'WebOSBrowser';
  }

  /**
   * @override
   */
  getDeviceType() {
    return shaka.device.IDevice.DeviceType.TV;
  }

  /**
   * @override
   */
  getBrowserEngine() {
    return shaka.device.IDevice.BrowserEngine.CHROMIUM;
  }

  /**
   * @override
   */
  supportsMediaCapabilities() {
    return false;
  }

  /**
   * @override
   */
  supportsSequenceMode() {
    const version = this.getVersion();
    return version !== null ? version > 3 : super.supportsSequenceMode();
  }

  /**
   * @override
   */
  supportsSmoothCodecSwitching() {
    const version = this.getVersion();
    return version !== null ?
        version > 6 : super.supportsSmoothCodecSwitching();
  }

  /**
   * @override
   */
  supportsServerCertificate() {
    const version = this.getVersion();
    return version !== null ? version > 3 : super.supportsServerCertificate();
  }

  /**
   * @override
   */
  adjustConfig(config) {
    super.adjustConfig(config);

    if (this.getVersion() === 3) {
      config.streaming.crossBoundaryStrategy =
          shaka.config.CrossBoundaryStrategy.RESET;
    }
    config.streaming.shouldFixTimestampOffset = true;
    // WebOS has long hardware pipeline that respond slowly to seeking.
    // Therefore we should not seek when we detect a stall on this platform.
    // Instead, default stallSkip to 0 to force the stall detector to pause
    // and play instead.
    config.streaming.stallSkip = 0;
    return config;
  }

  /**
   * @override
   */
  getHdrLevel(preferHLG) {
    // WebOSBrowser always supports HDR
    return preferHLG ? 'HLG' : 'PQ';
  }

  /**
   * @return {?number}
   * @private
   */
  guessWebOSVersion_() {
    let browserVersion = null;
    const match = navigator.userAgent.match(/Chrome\/(\d+)/);
    if (match) {
      browserVersion = parseInt(match[1], /* base= */ 10);
    }

    switch (browserVersion) {
      case 38:
        return 3;
      case 53:
        return 4;
      case 68:
        return 5;
      case 79:
        return 6;
      case 87:
        return 22;
      case 94:
        return 23;
      case 108:
        return 24;
      case 120:
        return 25;
      default:
        return null;
    }
  }

  /**
   * @override
   */
  supportStandardVP9Checking() {
    return false;
  }

  /**
   * @override
   */
  supportsCbcsWithoutEncryptionSchemeSupport() {
    const version = this.getVersion();
    return version !== null ?
        version >= 6 : super.supportsCbcsWithoutEncryptionSchemeSupport();
  }

  /**
   * @return {boolean}
   * @private
   */
  static isWebOSBrowser_() {
    return navigator.userAgent.includes('Colt');
  }
};


/**
 * @typedef {{
 *   configs: Object,
 * }}
 *
 * @property {Object} configs
 */
shaka.device.WebOS.PalmServiceBridgeResponse;

if (shaka.device.WebOS.isWebOS_()) {
  const webOSDevice = new shaka.device.WebOS();
  shaka.device.DeviceFactory.registerDeviceFactory(
      () => webOSDevice);
}

if (shaka.device.WebOSBrowser.isWebOSBrowser_()) {
  const webOSBrowserDevice = new shaka.device.WebOSBrowser();
  shaka.device.DeviceFactory.registerDeviceFactory(
      () => webOSBrowserDevice);
}
