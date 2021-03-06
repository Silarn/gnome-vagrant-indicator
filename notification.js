/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

// strict mode
'use strict';

// import modules
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Icons = Me.imports.icons;

/**
 * Notification.Base constructor
 *
 * @param  {Object}
 * @return {Object}
 */
var Base = class Base {

    /**
     * Constructor
     *
     * @param  {String} title
     * @param  {String} icon
     * @return {Void}
     */
    constructor(title, icon) {
        this._title = title || Me.metadata.name;
        this._icon = icon || Icons.DEFAULT;

        this._source = null;
    }

    /**
     * Prepare source
     *
     * @return {Void}
     */
    _prepare() {
        if (this._source !== null)
            return;

        this._source = new MessageTray.Source(this._title, this._icon);
        this._source.connect('destroy', this._handle_destroy.bind(this));

        Main.messageTray.add(this._source);
    }

    /**
     * Get existing notification from
     * source or create new one
     *
     * @param  {String} title
     * @param  {String} message
     * @return {Object}
     */
    _notification(title, message) {
        let result = null;
        if (this._source.notifications.length) {
            result = this._source.notifications[0];
            result.update(title, message, {
                clear: true,
            });
        }
        else {
            result = new MessageTray.Notification(this._source, title, message);
            result.setTransient(true);
            result.setResident(false);
        }

        return result;
    }

    /**
     * Source destroy event handler:
     * clear source
     *
     * @return {Void}
     */
    _handle_destroy() {
        this._source = null;
    }

    /**
     * Show notification
     *
     * @param  {String} title
     * @param  {String} message
     * @return {Void}
     */
    show(title, message) {
        this._prepare();

        let notify = this._notification(title, message);
        this._source.notify(notify);

    }

    /* --- */

};
