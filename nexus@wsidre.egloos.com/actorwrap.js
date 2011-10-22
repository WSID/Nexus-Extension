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

var is_setup;

var subplanes;

var wrap_plane;
var wrap_plane_clone;

var background_plane;
var overview_plane;

var shandler_restacked;
var shandler_showing;
var shandler_hidden;

var shandler_maximize;
var shandler_unmaximize;
var shandler_switch_workspace;

var maximize_counter;

		/* **** 1. Core functions.		*/
function setup( ){
	
	subplanes = new Array();
	
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
	shandler_restacked = global.screen.connect("restacked", shand_wrap_plane_lower );
		
		/* Monkey Patching Main.wm._switchWorkspaceDone() to add some statement,
		 * as wrap_plane tends to raise above windows after switching work-
		 * spaces (and after restacking windows).
		 * Chaining up original function to fit any version of shell.	*/
	Main.wm._switchWorkspaceDone_orig__nexus = Main.wm._switchWorkspaceDone;
	Main.wm._switchWorkspaceDone = function( shellwm ){
		this._switchWorkspaceDone_orig__nexus( shellwm );
		shand_wrap_plane_lower();
	}
	
		/* Connect Signal handlers for wrap_plane_clone to show and
		 * hide at right timing.
		 */
	shandler_showing = Main.overview.connect("showing", shand_overview_showing );
	shandler_hiding = Main.overview.connect("hidden", shand_overview_hidden );
	shandler_maximize = Main.wm._shellwm.connect('maximize', shand_maximize );
	shandler_unmaximize = Main.wm._shellwm.connect('unmaximize', shand_unmaximize );
	shandler_unmaximize = Main.wm._shellwm.connect('map', shand_map );
	shandler_switch_workspace = Main.wm._shellwm.connect('switch-workspace', shand_switch_workspace );
	is_setup = true;
	
	set_maximize_counter_from_workspace(
		global.screen.get_workspace_by_index(
			global.screen.get_active_workspace_index() ) );
	global.log('ActorWrap.setup: done!');
}

function unsetup( ){
	if( is_setup ){
		Main.overview.disconnect( shandler_showing );
		Main.overview.disconnect( shandler_hiding );
		Main.wm._switchWorkspaceDone = Main.wm._switchWorkspaceDone_orig__nexus;
		global.screen.disconnect( shandler_restacked );

		wrap_plane.get_parent().remove_actor( wrap_plane );
		wrap_plane_clone.get_parent().remove_actor( wrap_plane_clone );

		for( let a = 0; a < wrap_plane.get_children().length; a++ ){
			wrap_plane.remove_actor( wrap_plane.get_children()[a] );
		}
		wrap_plane = null;
		wrap_plane_clone = null;

		//Releasing external ref
		overview_plane = null;
		background_plane = null;
		is_setup = false;
	}
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

function shand_maximize( shellwm, actor ){
	global.log('shand_maximized: called!!');
	increase_maximize_counter();
}

function shand_unmaximize( shellwm, actor ){
	global.log('shand_unmaximize: called!!');
	decrease_maximize_counter();
}

function shand_map( shellwm, actor ){
	global.log('shand_map: called with ' + actor );
	if( actor.meta_window.is_fullscreen() ||
		actor.meta_window.get_maximized() == 3 ) increase_maximize_counter();
}

function shand_switch_workspace( shellwm, from, to, direction ){
	global.log('shand_switch_workspace: called!!');
	set_maximize_counter_from_workspace(
		global.screen.get_workspace_by_index( to ) );
}

function set_maximize_counter_from_workspace( workspace ){
	global.log("set_maximize_counter_from_workspace(): called for " + workspace );
	wlist = workspace.list_windows();
	maximize_counter = 0;
	for( var i = 0; i < wlist.length ; i++ ){
		if( wlist[i].get_maximized() == 3 ) maximize_counter++;
	}
	if( maximize_counter > 0 ) pause();
	else resume();
	global.log('set_maximize_counter_from_workspace(): maximize_counter = ' + maximize_counter);
}

function increase_maximize_counter( ) {
	if( ++maximize_counter > 0 ) pause();
	global.log('increase_maximize_counter(): maximize_counter = ' + maximize_counter);
}

function decrease_maximize_counter( ) {
	if( --maximize_counter == 0 ) resume();
	maximize_counter = Math.max( 0 , maximize_counter);
	global.log('decrease_maximize_counter(): maximize_counter = ' + maximize_counter);
}

		/* **** 2. Public functions to add or remove actor to wrap.	*/
function add_actor( actor ){
	wrap_plane.add_actor( actor );
}

function remove_actor( actor ){
	wrap_plane.remove_actor( actor );
}

function add_plane( plane ){
	subplanes.push( plane );
	wrap_plane.add_actor( plane.actor );
}

function remove_plane( plane ){
	subplanes.pop( plane );
	wrap_plane.remove_actor( plane.actor );
}

function pause(){
	for( let i = 0; i < subplanes.length ; i++ ){
		subplanes[i].pause();
	}
}

function resume(){
	for( let i = 0; i < subplanes.length ; i++ ){
		subplanes[i].resume();
	}
}
