/* Nexus Extension
 * Port of Nexus Live Wallpaper from Android.
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

//Settings
var settings;

//Pellet and background plane.
var pellet_plane;			/* for background */

	/* init: void
	 * Initialize the extension for being enabled.
	 * As we have nothing to initiate, doing nothing here.
	 *
	 * metadata: object:	information needed to initiate extension.
	 */
function init(metadata) {
}

	/* enable: void
	 * Starts the extension to work.
	 */
function enable() {
	/* Getting parameters from metadata */
	settings = new Gio.Settings({ schema: 'org.gnome.shell.extensions.nexus' });
	pellet_plane = new PelletPlane.PelletPlane( settings );
	
	ActorWrap.setup( settings );
	ActorWrap.add_plane( pellet_plane );
	
	pellet_plane.start();
}

	/* disable: void
	 * Stops the extension to work.
	 */
function disable() {
	pellet_plane.stop();
	ActorWrap.unsetup();
}
