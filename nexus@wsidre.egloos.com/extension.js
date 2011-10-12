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

var is_setup;

var settings;

//Pellet and background plane.
var pellet_plane;			/* for background */

//Main ( 3.0.x Entry Point )
//TODO(0.6): Drop this.
function main(metadata) {
	init( metadata );
	enable( );
}

//init, enable, disable ( 3.1.x Entry Point )
function init(metadata) {

}

function enable() {

	/* Getting parameters from metadata */
	settings = new Gio.Settings({ schema: 'org.gnome.shell.extensions.nexus' });
	pellet_plane = new PelletPlane.PelletPlane( settings );
	
	ActorWrap.setup();
	ActorWrap.add_actor( pellet_plane.actor );
	
	pellet_plane.start();

	is_setup = true;
}

function disable() {
	if( is_setup ){
		pellet_plane.stop();
	
		ActorWrap.unsetup();
		
		delete pellet_plane;
		
		is_setup = false;
	}
}
