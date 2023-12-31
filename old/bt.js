class DeviceSpecs extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'closed' });
    this.state = {};

    // Bind this to methods
    this.updateGeolocation = this._updateGeolocation.bind(this);
    this.updateConnection = this._updateConnection.bind(this);

    // Collect data and permissions
    this.initData();
  }

  async initData() {
    // Browser Information
    if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
      const highEntropyValues = await navigator.userAgentData.getHighEntropyValues([
        'architecture',
        'platform',
        'platformVersion'
      ]);
      this.state.architecture = highEntropyValues.architecture;
      this.state.platform = highEntropyValues.platform;
      this.state.platformVersion = highEntropyValues.platformVersion;
      this.state.userAgentInfo = {
        browserName: highEntropyValues.brands[0]?.brand,
        browserVersion: highEntropyValues.brands[0]?.version,
        osName: highEntropyValues.platform,
        osVersion: highEntropyValues.platformVersion,
      };
    } else {
      // Fallback to User-Agent string parsing
      const userAgent = navigator.userAgent;
      this.state.userAgentInfo = this.parseUserAgent(userAgent);
    }

    const { osName, osVersion } = this.state.userAgentInfo;
    const { os, device } = this.mapPlatformToHumanReadable(osName, osVersion, navigator.userAgent);
    this.state.humanReadableOS = os;
    this.state.deviceType = device;

    // Screen & Display
    const { availWidth, availHeight, orientation, colorDepth } = window.screen;
    this.state.screenInfo = { availWidth, availHeight, orientation, colorDepth };

    this.state.humanReadableOrientation = this.humanReadableOrientation(this.state?.screenInfo?.orientation);

    // Hardware Capabilities
    this.state.cpuCores = navigator.hardwareConcurrency || 'N/A';
    this.state.deviceMemory = navigator.deviceMemory || 'N/A';
    this.state.architecture = this.state.architecture ? this.state.architecture.toUpperCase() : 'N/A';

    // Network Information
    if ('connection' in navigator) {
      this.state.connectionType = (navigator.connection.type || navigator.connection.effectiveType || 'N/A').toLocaleUpperCase();
      this.state.roundTrip = navigator.connection.rtt || 'N/A';
      navigator.connection.addEventListener('change', this.updateConnection);
    }

    // Battery Status
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      this.state.battery = {
        level: battery.level,
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime
      };
    }

    // Geolocation
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        this.updateGeolocation,
        () => { this.state.geoError = 'Permission Denied'; this.render(); },
        { timeout: 10000 }
      );
      navigator.geolocation.watchPosition(this.updateGeolocation);
    } else {
      this.state.geoError = 'N/A';
    }

    // Accelerometer
    if ('Accelerometer' in window) {
      const accelerometer = new Accelerometer({ frequency: 60 });
      accelerometer.addEventListener('reading', () => {
        this.state.accelerometer = {
          x: accelerometer.x,
          y: accelerometer.y,
          z: accelerometer.z
        };
        this.render();
      });
      accelerometer.start();
    } else {
      this.state.accelerometer = 'N/A';
    }

    // Initial Render
    this.render();
  }

  parseUserAgent(ua) {
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    let osName = 'Unknown';
    let osVersion = 'Unknown';
    // Simplified browser and OS detection logic (you can use a comprehensive library for this)
    if (ua.includes('Chrome')) {
      browserName = 'Chrome';
      browserVersion = ua.match(/Chrome\/([\d.]+)/i)[1];
    } else if (ua.includes('Safari')) {
      browserName = 'Safari';
      browserVersion = ua.match(/Safari\/([\d.]+)/i)[1];
    }

    if (ua.includes('Mac OS')) {
      osName = 'Mac OS';
      osVersion = ua.match(/Mac OS[\D]*([\d_]+)/i)[1].replace(/_/g, '.');
    } else if (ua.includes('Windows')) {
      osName = 'Windows';
      osVersion = ua.match(/Windows NT ([\d.]+)/i)[1];
    }

    return {
      browserName,
      browserVersion,
      osName,
      osVersion
    };
  }

  _updateGeolocation(position) {
    this.state.latitude = position.coords.latitude;
    this.state.longitude = position.coords.longitude;
    this.render();
  }

  _updateConnection() {
    this.state.connectionType = navigator.connection.type;
    this.state.roundTrip = navigator.connection.rtt;
    this.render();
  }

  humanReadableColors(depth) {
    let colors = Math.pow(2, depth);
    const suffixes = [' thousand', ' million', ' billion'];
    let i = 0;
    while (colors >= 1000 && i < suffixes.length) {
      colors /= 1000;
      i++;
    }
    return colors.toFixed(1) + (suffixes[i-1] || '') + ' colors';
  }

  mapPlatformToHumanReadable(platform, version, ua) {
    let os = 'Unknown', device = '';

    const getVersionPrefix = v => v.split('.')[0];

    if (/Mac/i.test(platform)) {
      os = { '10': 'macOS' }[getVersionPrefix(version)] || 'macOS';
    } else if (/Win/i.test(platform)) {
      os = { '10': 'Windows 10', '6': 'Windows 7/8.1' }[getVersionPrefix(version)] || 'Windows';
    } else if (/Linux/i.test(platform)) {
      os = 'Linux';
    } else if (/Android/i.test(platform)) {
      os = `Android ${version}`;
      device = ua.match(/; (.+?) Build\//)?.[1] || '';
    } else if (/iPhone|iPad/i.test(platform)) {
      os = `iOS ${version}`;
      device = /iPhone/.test(ua) ? 'iPhone' : 'iPad';
    }

    return { os, device };
  }

  humanReadableOrientation(orientation) {
    const angle = orientation?.angle ? ` (${orientation.angle}°)` : '';
    return {
      'landscape-primary': 'Landscape' + angle,
      'landscape-secondary': 'Landscape' + angle,
      'portrait-primary': 'Portrait' + angle,
      'portrait-secondary': 'Portrait' + angle
    }[orientation?.type] || 'N/A';
  }

  render() {
    const {
      userAgentInfo, architecture, platform, platformVersion, cpuCores, screenInfo,
      deviceMemory, connectionType, roundTrip,
      battery, latitude, longitude, accelerometer,
      geoError
    } = this.state;

    // You could map platformVersion to macOS code names here
    const macOsCodename = platformVersion === "13.6" ? "Sonoma" : "N/A";  // Just an example
    const cpuInfo = `${this.state.cpuCores} cores (${this.state.architecture})`;

    this.shadow.innerHTML = `
      <table>
        <!-- Browser Information -->
        <tr><th colspan="2">Browser Information</th></tr>
        <tr><td>Browser</td><td>${userAgentInfo.browserName || 'N/A'} ${userAgentInfo.browserVersion || ''}</td></tr>
        <tr><td>OS</td><td>${userAgentInfo.osName || 'N/A'} ${userAgentInfo.osVersion || ''} (${macOsCodename})</td></tr>
        <tr><td>OS</td><td>${this.state.humanReadableOS || 'N/A'}</td></tr>
        <tr><td>Device</td><td>${this.state.deviceType || 'N/A'}</td></tr>
        <!-- Screen & Display -->
        <tr><th colspan="2">Screen & Display</th></tr>
        <tr><td>Size</td><td>${screenInfo?.availWidth || 'N/A'} x ${screenInfo?.availHeight || 'N/A'} pixels</td></tr>
        <tr><td>Orientation</td><td>${this.state.humanReadableOrientation}</td></tr>
        <tr><td>Color Depth</td><td>${this.humanReadableColors(screenInfo?.colorDepth) || 'N/A'}</td></tr>

        <!-- Hardware Capabilities -->
        <tr><th colspan="2">Hardware Capabilities</th></tr>
        <tr><td>CPU Cores</td><td>${cpuInfo}</td></tr>
        <tr><td>Device Memory</td><td>${deviceMemory || 'N/A'} GB</td></tr>

        <!-- Network Information -->
        <tr><th colspan="2">Network Information</th></tr>
        <tr><td>Connection Type</td><td>${connectionType || 'N/A'}</td></tr>
        <tr><td>Ping</td><td>${Math.round(roundTrip/2) || 'N/A'} milliseconds</td></tr>

        <!-- Battery Status -->
        <tr><th colspan="2">Battery Status</th></tr>
        <tr><td>Level</td><td><meter value="${battery?.level || 0}" min="0" max="1"></meter></td></tr>
        <tr><td>Charging</td><td>${battery?.charging ? 'Yes' : 'No'}</td></tr>

        <!-- Geolocation -->
        <tr><th colspan="2">Geolocation</th></tr>
        <tr><td>Latitude</td><td>${latitude || geoError || 'N/A'}</td></tr>
        <tr><td>Longitude</td><td>${longitude || geoError || 'N/A'}</td></tr>

        <!-- Accelerometer -->
        <tr><th colspan="2">Accelerometer</th></tr>
        <tr><td>X</td><td>${accelerometer?.x?.toFixed(2) || 'N/A'} m/s²</td></tr>
        <tr><td>Y</td><td>${accelerometer?.y?.toFixed(2) || 'N/A'} m/s²</td></tr>
        <tr><td>Z</td><td>${accelerometer?.z?.toFixed(2) || 'N/A'} m/s²</td></tr>
      </table>
    `;
  }
}

// Register the custom element
customElements.define('device-specs', DeviceSpecs);
