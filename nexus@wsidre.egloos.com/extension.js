/* Nexus Extension
 * Port of Nexus Live Wallpaper from Android.
 *
 * 1. Pellets.
 * 2. PelletSource.
 * 2. Pellet-related functions.
 * 3. Timeout callbacks, Signal Handlers.
 *
 * Written by WSID ( wsidre.egloos.com )
 */

//Include Statements
const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;

const Lang = imports.lang;
const Main = imports.ui.main;

const Ext = imports.ui.extensionSystem.extensions['nexus@wsidre.egloos.com'];
	const PelletPlane = Ext.pelletplane;
	const ActorWrap = Ext.actorwrap;

var settings;

//Pellet and background plane.
var pellet_plane;			/* for background */

function init(metadata) {

}

function enable() {
	/* Getting parameters from metadata */
	settings = new Gio.Settings({ schema: 'org.gnome.shell.extensions.nexus' });
	pellet_plane = new PelletPlane.PelletPlane( settings );
	
	ActorWrap.setup( settings );
	ActorWrap.add_plane( pellet_plane );
	
	pellet_plane.start();
}

function disable() {
	pellet_plane.stop();

	ActorWrap.unsetup();
}
