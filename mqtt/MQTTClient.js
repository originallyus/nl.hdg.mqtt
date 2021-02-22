'use strict';

const Homey = require('homey');
const Mqtt = require('mqtt');
const Log = require("../Log.js");
const EventHandler = require('../EventHandler');
const Message = require('./Message');

const CLIENT_STARTUP_DELAY = 10000; // Wait 10 sec. before sending messages to the MQTT Client on app install

class MQTTClient  {

    isRegistered() { return this.registered; }

    constructor(autoConnect) {
        this.clientApp = CLIENT;

        this.onRegistered = new EventHandler('MQTTClient.registered');
        this.onUnRegistered = new EventHandler('MQTTClient.unregistered');
        this.onMessage = new EventHandler('MQTTClient.message');
        if (autoConnect)
            this.connect()

        // if (autoConnect) {
        //     this.connect()
        //         .then(() => Log.info("MQTTClient connected"))
        //         .catch(error => Log.error(error));
        // }
    }

    async connect() {
        try {
            if (this._connected) return;
            this._connected = true;

            const clientID = 'homey-574566d72b5ebe541b913956'
            const lwt_struct = {};
            lwt_struct.topic = clientID+"/status";
            lwt_struct.payload = "Offline";
            lwt_struct.qos = 0;
            lwt_struct.retain = true;

            var connect_options = {};
            connect_options.keepalive = 10;
            connect_options.username = 'iZBDEquFWVlnmC0h7JKRqL9ZZZofLygm3hUWSJnx';
            connect_options.password = 'XHu7CNzuOZFdZ9CGfuhsMqQ3nqSpar2yV1DKEydO';
            connect_options.rejectUnauthorized = false;
            connect_options.clientId = clientID;
            connect_options.will = lwt_struct;

            this.client = Mqtt.connect('mqtt://ousa.originally.us:1884', connect_options)
            // On connection ...
            this.client.on('connect', () => {
                Log.info("MQTTClient connected")
                this._onReady()
            })

            // // Register to app events
            // this._installedCallback = this._onClientAppInstalled.bind(this);
            // this._uninstalledCallback = this._onClientAppUninstalled.bind(this);
            // this._handleMessageCallback = this._handleMessage.bind(this);

            // // Register future events
            // this.clientApp
            //     //.register() // NOTE: Registering multiple time results unsubscription of previous listeners
            //     .on('install', this._installedCallback)
            //     .on('uninstall', this._uninstalledCallback)
            //     .on('realtime', this._handleMessageCallback);

            // // Fetch installed app
            // var installed = await this.clientApp.getInstalled();
            
            // // call installed handlers
            this._onClientAppInstalled(0);

        } catch (e) {
            Log.error('Failed to connect MQTTClient');
            Log.error(e);
        }
    }

    async disconnect() {
        if (!this._connected) return;
        this._connected = false;

        try {
            this.client.end()

            // this.clientApp.removeListener('realtime', this._handleMessageCallback);
            // this.clientApp.removeListener('install', this._installedCallback);
            // this.clientApp.removeListener('uninstall', this._uninstalledCallback);

            // await this.clientApp.unregister();
            // this._onClientAppUninstalled();
        } catch (e) {
            Log.error('Failed to disconnect MQTTClient');
            Log.error(e);
        }
    }

    async subscribe(topic, force) {
        if (!topic) {
            Log.error("No topic provided to subscribe to");
            return;
        }
        try {
            if (topic) {
                this.topics = this.topics || new Set();
                if (!force && this.topics.has(topic)) {
                    Log.debug('[SKIP] Already subscribed to topic: ' + topic);
                }
                this.topics.add(topic);

                Log.info('subscribing to topic: ' + topic);
                return this.client.subscribe(topic, {}, (error) => {
                    if (error) {
                        Log.error(error);
                    } else {
                        Log.info('sucessfully subscribed to topic: ' + topic);
                    }
                })
                
                // return await this.clientApp.post('subscribe', { topic: topic }, error => {
                //     if (error) {
                //         Log.error(error);
                //     } else {
                //         Log.info('sucessfully subscribed to topic: ' + topic);
                //     }
                // });
            } else {
                Log.info("skipped topic subscription: No topic provided");
            }
        } catch (e) {
            Log.error("Failed to subscribe to topic: " + topic);

            if (!force) {
                Log.info("Wait 5 sec. and rety to subscription to topic: " + topic);
                setTimeout(async () => {
                    Log.info("Retry subscription to topic: " + topic);
                    await this.subscribe(topic, true);
                }, 5000);
            } else {
                this._failedSubscriptions = true;
                Log.info("Retry failed...could not subscribe to topic: " + topic);
                Log.error(e);
            }
        }
    }

    async retryFailedSubscriptions() {
        if (this._failedSubscriptions) {
            try {
                await this._registerTopics();
            } catch (e) {
                Log.error("Still unable to register to earlier failed topics");
                Log.error(e);
            }
        }
    }

    unsubscribe(topic) {
        if (!topic) {
            Log.error("No topic provided to unsubscribe");
            return;
        }
        try {
            this.topics.delete(topic);

            // TODO: implement topic unsubscription

        } catch (e) {
            Log.error("Failed to unsubscribe from topic: " + topic);
        }
    }

    /**
    * Publish MQTT Message
    * @param {any} msg Message model
    * @returns {Promise} Promise
    */
    async publish(msg) {
        //Log.debug(msg);
        try {
            if (this.registered) {
                if (msg.mqttMessage === undefined) {
                    msg.mqttMessage = null;
                }
                msg.mqttMessage = msg.mqttMessage ? msg.mqttMessage.toString() : 'null'
                return this.client.publish(msg.mqttTopic, msg.mqttMessage.toString(), { qos: msg.qos, retain: msg.retain })
                //return await this.clientApp.post('send', msg);
            }
        } catch (error) {
            Log.info('Error publishing message');
            Log.debug(msg);
            Log.error(error);
        }
    }

    /**
     * Just a Publish, but with seperate arguments
     * @param {string} topic topic
     * @param {any} payload message payload
     * @param {number} qos qos
     * @param {boolean} retain retain
     * @returns {Promise} Promise
     */
    async send(topic, payload, qos, retain) {
        return await this.publish(new Message(topic, payload, qos, retain));
    }

    /**
     * Clear a (retained) topic
     * @param {string} topic topic
     * @param {number} qos qos
     * @returns {Promise} Promise
     */
    async clear(topic, qos) {
        return await this.publish(new Message(topic, null, qos || 0, true));
    }

    _onClientAppInstalled(delay) {
        Log.debug('mqttClient.onClientAppInstalled');

        if (delay === undefined) {
            delay = CLIENT_STARTUP_DELAY;
        }

        if (delay > 0) {
            Log.debug(`Waiting ${delay / 1000} sec. before sending messages to just started MQTT client`);
            this._registeredTimeout = setTimeout(() => this._onReady().catch(e => Log.error(e)), delay);
        } else {
            this._onReady().catch(e => Log.error(e));
        }
    }

    async _onReady() {
        Log.info("MQTTClient ready");
        this.registered = true;
        try {
            await this._registerTopics();
        } catch (e) {
            Log.error("Failed to subscribe to previous registered topics");
            Log.error(e);
        }
        try {
            Log.debug("Notify subscribers");
            await this.onRegistered.emit().catch(error => Log.error(error));
        } catch (e) {
            Log.error(e);
        }
    }

    async _registerTopics() {
        this._failedSubscriptions = false;
        if (!this.topics) return;

        Log.debug("Subscribing to previous registered topics");
        for (let topic of this.topics.values()) {
            await this.subscribe(topic, true);
        }
        Log.debug("Topics registered");
    }

    _onClientAppUninstalled() {
        Log.debug('mqttClient.onClientAppUnInstalled');
        this.registered = false;

        if (this._registeredTimeout) {
            clearTimeout(this._registeredTimeout);
            delete this._registeredTimeout;
        }

        this.onUnRegistered.emit()
            .catch(error => Log.error(error));
    }

    _handleMessage(topic, message) {
        if (!this.registered) return;

        console.log("_handleMessage: " + topic);
        console.log(message);

        this.onMessage.emit(topic, message)
            .catch(error => Log.error(error));
    }
}

module.exports = MQTTClient;