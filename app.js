'use strict';

const Homey = require('homey');
const { HomeyAPI } = require('athom-api');
const MQTTClient = require('./mqtt/MQTTClient.js');

// Services
const Log = require("./Log.js");
const DeviceManager = require("./DeviceManager.js");
const MessageHandler = require("./MessageHandler.js");

// Dispatchers
const DeviceStateChangeDispatcher = require("./dispatchers/DeviceStateChangeDispatcher.js");
const SystemStateDispatcher = require("./dispatchers/SystemStateDispatcher.js");
const FlowTriggerDispatcher = require("./dispatchers/FlowTriggerDispatcher.js");
const HomieDispatcher = require("./dispatchers/HomieDispatcher.js");

// Commands
const DescribeCommandHandler = require("./commands/DescribeCommandHandler.js");
const StateRequestCommandHandler = require("./commands/StateRequestCommandHandler.js");
const UpdateCommandHandler = require("./commands/UpdateCommandHandler.js");

const HOMIE_CONVENTION = true;  // TODO: Read from app settings
const SYSTEM_INFO = false;      // TODO: Read from app settings

class MQTTGateway extends Homey.App {

	async onInit() {
        Log.info('MQTT Gateway is running...');

        this.api = await HomeyAPI.forCurrentHomey();
        this.system = await this._getSystemInfo();
        this.mqttClient = new MQTTClient(this.system.name);

        // Suppress memory leak warning
        this.api.devices.setMaxListeners(9999); 

        // devices
        this.deviceManager = new DeviceManager(this);
        await this.deviceManager.register();

        // TODO: Read from app settings
        if (HOMIE_CONVENTION) {
            this.homieDispatcher = new HomieDispatcher(this);
        } else {
            this.messageHandler = new MessageHandler(this);

            // dispatchers
            this.deviceStateChangeDispatcher = new DeviceStateChangeDispatcher(this);
            this.flowTriggerDispatcher = new FlowTriggerDispatcher(this);

            // commands
            this.messageHandler.addMessageHandler(new DescribeCommandHandler(this));
            this.messageHandler.addMessageHandler(new StateRequestCommandHandler(this));
            this.messageHandler.addMessageHandler(new UpdateCommandHandler(this));
        }

        // TODO: Read from app settings
        if (SYSTEM_INFO) {
            this.systemStateDispatcher = new SystemStateDispatcher(this);
        }
    }

    //async _getSystemName() {
    //    return this.api.system.getSystemName ? await this.api.system.getSystemName() : (await this.api.system.getInfo()).hostname;
    //}
    async _getSystemInfo() {
        const info = await this.api.system.getInfo();
        return {
            name: info.hostname,
            version: info.homey_version
        };
    }
}

module.exports = MQTTGateway;