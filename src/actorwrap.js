/* actorwrap.js
 *
 * Contains function to wrap some actor on screen but keep it under any window.
 *
 * You may take out it and use it with your extensions. And you'll want to write
 * this.
 * 	const ActorWrap = imports.ui.extensionSystem['yourextension@yoursite.com'].actorwrap;
 *
 * section index :
 *	1. Core functions
 *	2. Public functions to add or remove actor to wrap.
 */

const Lang = imports.lang;
const Main = imports.ui.main;

const Clutter = imports.gi.Clutter;

const Ext = imports.ui.extensionSystem.extensions['nexus@wsidre.egloos.com'];

var wrap_plane;
var wrap_plane_clone;

var background_plane;
var overview_plane;

		/* **** 1. Core functions.		*/
function init( ){
	
	wrap_plane = new Clutter.Group();
	wrap_plane_clone = new Clutter.Clone( {source:wrap_plane } );
	
	background_plane = global.background_actor;
	overview_plane = Main.overview._background;
	
	background_plane.get_parent().add_actor(wrap_plane);
	wrap_plane.raise( background_plane );
	
	overview_plane.get_parent().add_actor( wrap_plane_clone );
	wrap_plane_clone.raise( overview_plane );
	wrap_plane_clone.visible = false;
	
		/* When we pick or maximize window, wrap_plane goes over windows.
		 * Therefore, we should take measure to put it under windows. */
	global.screen.connect("restacked", shand_wrap_plane_lower );
		
		/* Monkey Patching Main.wm._switchWorkspaceDone() to add some statement,
		 * as wrap_plane tends to raise above windows after switching work-
		 * spaces (and after restacking windows).
		 * Chaining up original function to fit any version of shell.	*/
	Main.wm._switchWorkspaceDone_orig__nexus = Main.wm._switchWorkspaceDone;
	Main.wm._switchWorkspaceDone = function( shellwm ){
		this._switchWorkspaceDone_orig__nexus( shellwm );
		shand_wrap_plane_lower();
	}
	
	Main.overview.connect("showing", shand_overview_showing );
	Main.overview.connect("hidden", shand_overview_hidden );
	
}

	/** shand_wrap_plane_lower: void
	 * When windows are restacked and wrap_plane goes on top of them, this
	 * will move it below of them.
	 */
function shand_wrap_plane_lower(){
	wrap_plane.raise( background_plane );
	return false;
}

	/** shand_overview_showing: void
	 * When overview screen is becoming visible, show wrap_plane_clone as if
	 * it was part of overview screen.
	 */
function shand_overview_showing(){
	wrap_plane_clone.visible = true;
}

	/** shand_overview_hidden: void
	 * Just like shand_overview_showing() - but it hides wrap_plane_clone and
	 * it is activated when overview screen is gone.
	 */
function shand_overview_hidden(){
	wrap_plane_clone.visible = false;
}

		/* **** 2. Public functions to add or remove actor to wrap.	*/
function add_actor( actor ){
	wrap_plane.add_actor( actor );
}

function remove_actor( actor ){
	wrap_plane.remove_actor( actor );
}
