/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

// strict mode
'use strict';

// import modules
const Lang = imports.lang;
const { St, Gio, GObject } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const Util = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Menu = Me.imports.menu;
const Notification = Me.imports.notification;
const Enum = Me.imports.enum;
const Vagrant = Me.imports.vagrant;
const Icons = Me.imports.icons;
const Settings = Me.imports.settings;
const Translation = Me.imports.translation;
const _ = Translation.translate;

/**
 * Indicator.Base constructor
 *
 * @param  {Object}
 * @return {Object}
 */
var Base = GObject.registerClass(class Base extends PanelMenu.Button {

    /**
     * Constructor
     *
     * @return {void}
     */
    _init() {
        super._init(null, Me.metadata.name);
        this._def();
        this._ui();
        this.refresh();

        Main.panel.addToStatusArea(Me.metadata.uuid, this);
    }

    /**
     * Destructor
     *
     * @return {void}
     */
    destroy() {
        if (this.vagrant)
            this.vagrant.destroy();
        if (this.settings)
            this.settings.run_dispose();

        super.destroy();
    }

    /**
     * Initialize object properties
     *
     * @return {void}
     */
    _def() {
        this.notification = new Notification.Base();

        this.settings = Settings.settings();
        this.settings.connect('changed', this._handle_settings.bind(this));

        this.vagrant = new Vagrant.Emulator();
        this.vagrant.connect('error', this._handle_vagrant_error.bind(this));
        this.vagrant.monitor.connect('add', this._handle_vagrant_add.bind(this));
        this.vagrant.monitor.connect('remove', this._handle_vagrant_remove.bind(this));
        this.vagrant.monitor.connect('state', this._handle_vagrant_state.bind(this));
        this.vagrant.monitor.start();
    }

    /**
     * Create user interface
     *
     * @return {void}
     */
    _ui() {
        this.add_style_class_name('panel-status-button');
        this.add_style_class_name('gnome-vagrant-indicator');

        this.icon = new St.Icon({
            icon_name: Icons.DEFAULT,
            style_class: 'system-status-icon',
        });
        this.icon.set_gicon(Gio.icon_new_for_string(Me.path + '/assets/' + Icons.DEFAULT + ".svg"));
        this.add_actor(this.icon);

        this.machine = new Menu.Machine(this);
        this.machine.shorten = !this.settings.get_boolean('machine-full-path');
        this.machine.setDisplayVagrant(this._get_settings_machine_menu_display_vagrant());
        this.machine.setDisplaySystem(this._get_settings_machine_menu_display_system());
        this.machine.connect('system', this._handle_machine_system.bind(this));
        this.machine.connect('vagrant', this._handle_machine_vagrant.bind(this));
        this.menu.addMenuItem(this.machine);
        this.menu.addMenuItem(new Menu.PopupSeparatorMenuItem());

        this.preferences = new Menu.PopupMenuItem(_("Preferences"));
        this.preferences.connect('activate', this._handle_preferences.bind(this));
        this.menu.addMenuItem(this.preferences);
    }

    /**
     * Refresh machine menu
     *
     * @return {void}
     */
    refresh() {
        this.machine.clear();

        for (let id in this.vagrant.index.machines) {
            let machine = this.vagrant.index.machines[id];
            this.machine.add(id, machine.vagrantfile_path, machine.state);
        }
    }

    /**
     * Convert settings boolean display-vagrant
     * values to Menu.DisplayVagrant value
     *
     * @return {Number}
     */
    _get_settings_machine_menu_display_vagrant() {
        let display = Enum.toObject(Menu.DisplayVagrant);
        let result = 0;

        for (let key in display) {
            let value = display[key];
            let setting = 'display-vagrant-' + key.toLowerCase().replace(/_/g, '-');

            result += this.settings.get_boolean(setting) ? display[key] : 0;
        }

        return result;
    }

    /**
     * Convert settings boolean display-system
     * values to Menu.DisplaySystem value
     *
     * @return {Number}
     */
    _get_settings_machine_menu_display_system() {
        let display = Enum.toObject(Menu.DisplaySystem);
        let result = 0;

        for (let key in display) {
            let value = display[key];
            let setting = 'display-system-' + key.toLowerCase().replace(/_/g, '-');

            result += this.settings.get_boolean(setting) ? display[key] : 0;
        }

        return result;
    }

    /**
     * Settings changed event handler
     *
     * @param  {Object} widget
     * @param  {String} key
     * @return {void}
     */
    _handle_settings(widget, key) {
        if (key === 'machine-full-path')
            this.machine.shorten = !widget.get_boolean(key);
        else if (key.startsWith('display-system-'))
            this.machine.setDisplaySystem(this._get_settings_machine_menu_display_system());
        else if (key.startsWith('display-vagrant-'))
            this.machine.setDisplayVagrant(this._get_settings_machine_menu_display_vagrant());
    }

    /**
     * Monitor machine add event handler
     *
     * @param  {Object} widget
     * @param  {Object} event
     * @return {void}
     */
    _handle_vagrant_add(widget, event) {
        let machine = this.vagrant.index.machines[event.id];
        let index = Object.keys(this.vagrant.index.machines).indexOf(event.id);

        this.machine.add(event.id, machine.vagrantfile_path, machine.state, index);
    }

    /**
     * Monitor machine remove event handler
     *
     * @param  {Object} widget
     * @param  {Object} event
     * @return {void}
     */
    _handle_vagrant_remove(widget, event) {
        this.machine.remove(event.id);
    }

    /**
     * Monitor machine state change event handler
     *
     * @param  {Object} widget
     * @param  {Object} event
     * @return {void}
     */
    _handle_vagrant_state(widget, event) {
        let machine = this.vagrant.index.machines[event.id];
        this.machine.state(event.id, machine.state);

        if (this.settings.get_boolean('notifications'))
            this.notification.show('Machine went %s'.format(machine.state), machine.vagrantfile_path);
    }

    /**
     * Monitor error event handler
     *
     * @param  {Object} widget
     * @param  {Object} event
     * @return {void}
     */
    _handle_vagrant_error(widget, event) {
        if (!this.settings.get_boolean('notifications'))
            return;

        let arr = event.toString().split(':');
        let title = arr[0].trim();
        let message = arr.slice(1).join(':').trim();

        if (!message) {
            message = title;
            title = 'Vagrant.Unknown';
        }

        this.notification.show(title, message);
    }

    /**
     * Machines item (system command)
     * activate event handler
     *
     * @param  {Object} widget
     * @param  {String} id
     * @param  {Number} command
     * @return {void}
     */
    _handle_machine_system(widget, id, command) {
        try {
            this.vagrant.open(id, command);
        } catch (e) {
            this.vagrant.emit('error', e);
        }
    }

    /**
     * Machines item (vagrant command)
     * activate event handler
     *
     * @param  {Object} widget
     * @param  {String} id
     * @param  {Number} command
     * @return {void}
     */
    _handle_machine_vagrant(widget, id, command) {
        try {
            let action = this.settings.get_string('post-terminal-action');
            action = Enum.getValue(Vagrant.PostTerminalAction, action);

            this.vagrant.execute(id, command, action);
        } catch (e) {
            this.vagrant.emit('error', e);
        }
    }

    /**
     * Preferences activate event handler
     *
     * @param  {Object} widget
     * @param  {Object} event
     * @return {void}
     */
    _handle_preferences(widget, event) {
        Util.spawn(['gnome-shell-extension-prefs', Me.metadata.uuid]);
    }

    /* --- */

});
