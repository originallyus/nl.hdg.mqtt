var $app;
var language = "en";
var loading = true;
var running = false;
var hubSettings = {};
var refreshLogEnabled = false;
var log = "";
var logTimeout = 0;
var FETCH_LOG_DELAY = 5000;
var $progress = null;
var devices = [];

const STATUS_TOPIC = "hass/status";
const STATUS_ONLINE = "online";
const STATUS_OFFLINE = "offline";

const defaultSettings = {
  systemName: "Homey",
  deviceId: "",
  protocol: "custom",
  homieTopic: "homie/{deviceId}",

  customTopic: "homie/{deviceId}",
  topicIncludeClass: false,
  topicIncludeZone: false,
  normalize: false,
  percentageScale: "int",
  colorFormat: "hsv",
  broadcastDevices: true,

  hass: false,
  hassTopic: "homeassistant",
  hassStatusTopic: "hass/status",
  hassOnlineMessage: "online",
  hassOfflineMessage: "offline",

  broadcastSystemState: true,
  systemStateTopic: "{deviceId}/system/info",

  commands: true,
  commandTopic: "{deviceId}/$command",

  birthWill: true,
  birthTopic: "{deviceId}/hub/status",
  birthMessage: "online",
  willTopic: "{deviceId}/hub/status",
  willMessage: "offline",

  loglevel: "info",
};

//////////////////////////////////////////////

//const testDevices = {
//    test: { id: 'test0', name: "test some long named device lkfjdh sdlkfjhgsldkfhg lksdjfhslkdh ", zone: "zone", iconObj: { url: "../assets/icon.svg" }},
//    test1: { id: 'test1', name: "device 1", zone: "zone" },
//    test2: { id: 'test2', name: "device 2", zone: "zone" },
//    test3: { id: 'test3', name: "device 3", zone: "zone" },
//    test4: { id: 'test4', name: "device 4", zone: "zone" },
//    test5: { id: 'test5', name: "device 5", zone: "zone" },
//    test6: { id: 'test6', name: "device 6", zone: "zone" },
//    test7: { id: 'test7', name: "device 7", zone: "zone" },
//    test8: { id: 'test8', name: "device 8", zone: "zone" },
//    test9: { id: 'test9', name: "device 9", zone: "zone" },
//    test10: { id: 'test10', name: "device 10", zone: "zone" }
//};
//$(document).ready(function () {
//    onHomeyReady({
//        ready: () => { },
//        get: (_, callback) => callback(null, {
//            ...defaultSettings, ...{
//                systemName: 'Homey',
//                deviceId: "Harrie",
//                protocol: 'custom',
//                hass: true,
//                broadcastSystemState: true,
//                commands: true,
//                birthWill: true,
//                devices: {
//                    test1: false
//                }
//            }
//        }),
//        api: (method, url, _, callback) => {
//            switch (url) {
//                case '/devices':
//                    return setTimeout(() => callback(null, testDevices), 2000);
//                case '/zones':
//                    return callback(null, { zone: { name: 'zone' } });
//                case '/log':
//                    return callback(null, ["test " + Math.random(), "test " + Math.random()]);
//                case '/state':
//                    return callback(null, { total: 1000, progress: Math.round(Math.random() * 1000) });
//                default:
//                    return callback(null, {});
//            }
//        },
//        getLanguage: (cb) => cb(null, 'en'),
//        set: (_, settings) => console.log(settings),
//        alert: (...args) => alert(...args)
//    })
//});

//////////////////////////////////////////////

const ALL_DEVICES = {
  id: "all",
  name: "# ALL DEVICES",
  zone: "___hub",
  iconObj: {
    url: "../assets/icon.svg",
  },
};

var currentValues = {};
function onHomeyReady(homeyReady) {
  Homey = homeyReady;
  hubSettings = { ...defaultSettings };
  Homey.api("GET", "/running", null, (err, result) => {
    $("#running").prop("disabled", false);
    running = !err && result;
  });

  HomeyAPI = Homey;
  Homey.get("url", function (err, url) {
    if (err) {
      console.error(err);
    } else {
      document.getElementById("url").value = url;
      currentValues.url = url;
    }
  });
  Homey.get("ip_port", function (err, ip_port) {
    if (err) {
      console.error(err);
    } else {
      document.getElementById("ip_port").value = ip_port;
      currentValues.ip_port = ip_port;
    }
  });
  Homey.get("tls", function (err, tls) {
    if (err) {
      console.error(err);
    } else {
      document.getElementById("tls").value = tls;
    }
    if (typeof tls == "undefined" || tls == null) tls = false;
    document.getElementById("tls").checked = tls;
    currentValues.tls = tls;
  });
  Homey.get("selfsigned", function (err, selfsigned) {
    if (err) {
      console.error(err);
    } else {
      document.getElementById("selfsigned").value = selfsigned;
    }
    if (typeof selfsigned == "undefined" || selfsigned == null)
      selfsigned = false;
    document.getElementById("selfsigned").checked = selfsigned;
    currentValues.selfsigned = selfsigned;
  });

  Homey.get("user", function (err, user) {
    if (err) {
      console.error(err);
    } else {
      document.getElementById("user").value = user;
      currentValues.user = user;
    }
  });
  Homey.get("password", function (err, password) {
    if (err) {
      console.error(err);
    } else {
      document.getElementById("password").value = password;
      currentValues.password = password;
    }
  });
  Homey.get("custom_clientid", function (err, custom_clientid) {
    if (err) {
      console.error(err);
    } else {
      document.getElementById("custom_clientid").value = custom_clientid;
    }
    if (typeof custom_clientid == "undefined" || custom_clientid == null)
      custom_clientid = false;
    document.getElementById("custom_clientid").checked = custom_clientid;
    document.getElementById("clientid").disabled = !custom_clientid;
    currentValues.custom_clientid = custom_clientid;
  });
  Homey.get("clientid", function (err, clientid) {
    if (err) {
      console.error(err);
    } else {
      document.getElementById("clientid").value = clientid;
      currentValues.clientid = clientid;
    }
  });

  Homey.ready();

  showTab(1);
  getLanguage();

  $app = new Vue({
    el: "#app",
    data: {
      devices: {},
      zones: {},
    },
    methods: {
      getZones() {
        return Homey.api("GET", "/zones", null, (err, result) => {
          if (err) return Homey.alert("getZones " + err);
          this.zones = result;
          this.zones["___hub"] = { id: "___hub", name: "MQTT Hub", order: 0 };
        });
      },
      getDevices() {
        return Homey.api("GET", "/devices", null, (err, result) => {
          loading = false;
          if (err) return Homey.alert("getDevices " + err);
          devices = Object.keys(result).map((key) => result[key]);
          devices.unshift(ALL_DEVICES);
          this.devices = devices;
        });
      },
      getZone: function (device) {
        try {
          const zoneId =
            typeof device.zone === "object" ? device.zone.id : device.zone;
          const zone = this.zones && this.zones[zoneId];
          return zone.name ? zone.name : zoneId || "";
        } catch (e) {
          return "";
        }
      },
      getIcon: function (device) {
        try {
          if (device && device.iconObj && device.iconObj.url) {
            return (
              '<img src="' +
              device.iconObj.url +
              '" style="width:auto;height:auto;max-width:50px;max-height:30px;"/>'
            );
          }
        } catch (e) {
          // nothing
        }
        return "<!-- no device.iconObj.url -->";
      },
      setRunning: function (value) {
        running = !!value;
        const el = document.getElementById("running");
        if (el) {
          el.checked = running;
          Homey.api("post", "/running", { running }, (err, result) => {
            // nothing...
          });
        }
      },
      refresh: function () {
        $("#refreshButton").prop("disabled", true);
        setTimeout(() => {
          Homey.api("GET", "/refresh", null, (err, result) => {
            $("#refreshButton").prop("disabled", false);
            if (err) {
              Homey.alert("Failed to refresh device states");
            }
            //Homey.alert(err ? 'failed to refresh device states' : 'refreshed sucessfully');
          });
        }, 0);
      },
      reset: function () {
        // confirm?
        //if(Homey.confirm("Reset default settings?")){
        const deviceId = hubSettings.systemName;
        hubSettings = { ...defaultSettings };
        hubSettings.deviceId = deviceId || "Homey";
        updateValues();
        _writeSettings();
        //}
      },
    },
    async mounted() {
      try {
        await this.getZones();
        await this.getDevices();
      } catch (e) {
        // nothing...
      }

      updateInterface();
    },
    computed: {
      devices() {
        return this.devices;
      },
      zones() {
        return this.zones;
      },
    },
  });

  Homey.get("settings", function (err, savedSettings) {
    if (err) {
      Homey.alert(err);
    } else if (savedSettings) {
      Object.assign(hubSettings, savedSettings);
    }
    updateValues();
  });

  // Display progress percentage in broadcast button
  initProgressDisplay();
}

const normalize = function (topic) {
  if (typeof topic !== "string") return undefined;

  return topic
    .split("/")
    .map((name) =>
      name
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[ _]/g, "-")
        .replace(/[^a-z0-9-]/g, "")
    )
    .join("/");
};

function parseTopic(key, value) {
  if (value && typeof value === "string") {
    if (hubSettings.deviceId) {
      value = value.replace("{deviceId}", normalize(hubSettings.deviceId));
    }
    return key === "homieTopic" ? normalize(value) : value;
  }
  return value;
}

function updateValues() {
  for (let key of Object.keys(defaultSettings)) {
    if (defaultSettings.hasOwnProperty(key)) {
      const el = document.getElementById(key);
      if (el) {
        const value = hubSettings[key];
        switch (typeof defaultSettings[key]) {
          case "boolean":
            el.checked = value;
            break;
          default:
            el.value =
              key.indexOf("Topic") !== -1 ? parseTopic(key, value) : value;
            break;
        }
      }
    }
  }

  if ($app) {
    $app.$forceUpdate();
  }

  updateInterface();
}

function showTab(tab, log) {
  $(".tab").removeClass("tab-active");
  $(".tab").addClass("tab-inactive");
  $("#tabb" + tab).removeClass("tab-inactive");
  $("#tabb" + tab).addClass("active");
  $(".panel").hide();
  $("#tab" + tab).show();

  refreshLog(log);
}

function getLanguage() {
  const el = document.getElementById("instructionsen");
  if (el) {
    el.style.display = "inline";
  }
}

function selectProtocol(protocol) {
  saveSettings();
}

function updateInterface() {
  $("#homieSettings").toggle(hubSettings.protocol === "homie3");
  $("#customSettings").toggle(hubSettings.protocol === "custom");
  $("#hassSettings").toggle(hubSettings.hass);
  $("#systemStateSettings").toggle(hubSettings.broadcastSystemState);
  $("#commandsSettings").toggle(hubSettings.commands);
  $("#birthWillSettings").toggle(hubSettings.birthWill);
}

function saveSettings(broadcast, write) {
  for (let key in defaultSettings) {
    let el = document.getElementById(key);
    if (el) {
      hubSettings[key] =
        typeof defaultSettings[key] === "boolean" ? el.checked : el.value;
    }
  }

  updateInterface();
  _writeSettings();
}

function _writeSettings() {
  try {
    Homey.set("settings", hubSettings);
    Homey.api("GET", "/settings_changed", null, (err, result) => {
      if (err) Homey.alert("Failed to save changes");
    });
  } catch (e) {
    Homey.alert("Failed to save settings: " + e);
  }
}

function saveDevice(device, checked) {
  if (typeof device !== "object" || !device.id) return;

  if (device.id === ALL_DEVICES.id) {
    hubSettings.devices = {};
    for (let device of devices.filter((d) => d.id !== ALL_DEVICES.id)) {
      hubSettings.devices[device.id] = checked;
    }
  } else {
    hubSettings.devices = hubSettings.devices || {};
    hubSettings.devices[device.id] = checked;
  }

  _writeSettings();
  $app.$forceUpdate();
}

function deviceEnabled(device) {
  try {
    if (
      !device ||
      typeof device !== "object" ||
      !device.id ||
      !devices ||
      !Array.isArray(devices)
    )
      return false;

    const deviceSettings =
      hubSettings && hubSettings.devices ? hubSettings.devices : {};

    if (device.id === ALL_DEVICES.id) {
      return !devices
        .filter((d) => d && d.id !== ALL_DEVICES)
        .some((d) => deviceSettings[d.id] === false);
    }

    return !deviceSettings || deviceSettings[device.id] !== false;
  } catch (e) {
    // nothing...
  }
  return false;
}

function initProgressDisplay() {
  // register elements
  $progress = $("#progress");
  $progress.prependTo("#refreshButton"); // Strange Homey BUG!!!

  // run
  setInterval(updateProgress, 1000);
}

function updateProgress() {
  Homey.api("GET", "/state", null, (err, result) => {
    if (result) {
      let total = Number(result.total || 0);
      let progress = Number(result.progress || 0);
      let percent = total > 10 ? progress / total : 0;
      let width = Math.ceil(percent * 100) + "%";
      $progress.css("width", width);
    }
  });
}

/*** LOG ***/

function refreshLog(refresh) {
  refreshLogEnabled = refresh;

  if (refresh && !log) {
    displayLog("loading...");
  }

  stopLogUpdateTimer();
  if (refresh) {
    updateLog();
  }
}

function displayLog(lines) {
  log = lines;
  $app.$forceUpdate();
}

function updateLog() {
  try {
    stopLogUpdateTimer();
    Homey.api("GET", "/log", null, (err, result) => {
      stopLogUpdateTimer();
      if (!err) {
        let lines = "";
        for (var i = 0; i < result.length; i++) {
          lines += result[i] + "<br />";
        }
        displayLog(lines);

        if (refreshLogEnabled) {
          setLogUpdateTimer();
        }
      } else {
        displayLog(err);
      }
    });
  } catch (e) {
    displayLog(e);
  }
}

function setLogUpdateTimer() {
  logTimeout = setTimeout(updateLog, FETCH_LOG_DELAY);
}

function stopLogUpdateTimer() {
  if (logTimeout) {
    clearTimeout(logTimeout);
    logTimeout = 0;
  }
}

function setLogLevel(level) {
  hubSettings.loglevel = level;
  saveSettings();
  try {
    Homey.api("post", "/loglevel", { level }, (err, result) => updateLog());
  } catch (e) {
    displayLog(e);
  }
}

function saveSettings() {
  var oldValues = JSON.parse(JSON.stringify(currentValues));
  console.log(oldValues);
  var valuesHaveBeenChanged = false;

  if (currentValues.url != document.getElementById("url").value) {
    console.log("url has been changed");
    HomeyAPI.set("url", document.getElementById("url").value);
    valuesHaveBeenChanged = true;
    currentValues.url = document.getElementById("url").value;
  }

  if (currentValues.ip_port != document.getElementById("ip_port").value) {
    console.log("ip_port has been changed");
    HomeyAPI.set("ip_port", document.getElementById("ip_port").value);
    valuesHaveBeenChanged = true;
    currentValues.ip_port = document.getElementById("ip_port").value;
  }

  if (currentValues.tls != document.getElementById("tls").checked) {
    console.log("tls has been changed");
    HomeyAPI.set("tls", document.getElementById("tls").checked);
    valuesHaveBeenChanged = true;
    currentValues.tls = document.getElementById("tls").checked;
  }

  if (
    currentValues.selfsigned != document.getElementById("selfsigned").checked
  ) {
    console.log("selfsigned has been changed");
    HomeyAPI.set("selfsigned", document.getElementById("selfsigned").checked);
    valuesHaveBeenChanged = true;
    currentValues.selfsigned = document.getElementById("selfsigned").checked;
  }

  if (currentValues.user != document.getElementById("user").value) {
    console.log("user has been changed");
    HomeyAPI.set("user", document.getElementById("user").value);
    valuesHaveBeenChanged = true;
    currentValues.user = document.getElementById("user").value;
  }

  if (currentValues.password != document.getElementById("password").value) {
    console.log("password has been changed");
    HomeyAPI.set("password", document.getElementById("password").value);
    valuesHaveBeenChanged = true;
    currentValues.password = document.getElementById("password").value;
  }

  if (
    currentValues.custom_clientid !=
    document.getElementById("custom_clientid").checked
  ) {
    console.log("custom_clientid has been changed");
    HomeyAPI.set(
      "custom_clientid",
      document.getElementById("custom_clientid").checked
    );
    valuesHaveBeenChanged = true;
    currentValues.custom_clientid = document.getElementById(
      "custom_clientid"
    ).checked;
  }

  if (currentValues.clientid != document.getElementById("clientid").value) {
    console.log("clientid has been changed");
    HomeyAPI.set("clientid", document.getElementById("clientid").value);
    valuesHaveBeenChanged = true;
    currentValues.clientid = document.getElementById("clientid").value;
  }

  if (valuesHaveBeenChanged == true) {
    notifySettings(oldValues);
    HomeyAPI.alert(__("settings.app.messages.settings_saved"));
  } else {
    HomeyAPI.alert(__("settings.app.messages.settings_noSettingsChanged"));
  }
}

function notifySettings(values) {
  HomeyAPI.api("POST", "test/settingschange/", values, function (err, result) {
    if (!err) {
      console.log("Settings change succesfull");
    } else {
      // Oeps, something went wrong here
      Homey.alert(__("settings.app.messages.unable_set_settings"));
    }
  });
}
