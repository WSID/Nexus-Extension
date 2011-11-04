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

const Meta = imports.gi.Meta;
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
var shandler_map;
var shandler_destroy;
var shandler_switch_workspace;

var maximized_list;
var lefttiled_list;
var righttiled_list;

var maximized_group;

var paused;
var paused_preserve;
var in_overview;

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
	
	maximized_list = new Array();
	lefttiled_list = new Array();
	righttiled_list = new Array();
	
	maximized_group = [maximized_list, lefttiled_list, righttiled_list];
	
	in_overview = false;
	
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
	shandler_map = Main.wm._shellwm.connect('map', shand_map );
	shandler_destroy = Main.wm._shellwm.connect('destroy', shand_destroy );
	shandler_switch_workspace = Main.wm._shellwm.connect('switch-workspace', shand_switch_workspace );
	is_setup = true;
	
	set_maximized_list_from_workspace(
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
	in_overview = true;
	wrap_plane_clone.visible = true;
	paused_preserve = (paused == undefined) ? false : paused;
	resume();
}

	/** shand_overview_hidden: void
	 * Just like shand_overview_showing() - but it hides wrap_plane_clone and
	 * it is activated when overview screen is gone.
	 */
function shand_overview_hidden(){
	in_overview = false;
	wrap_plane_clone.visible = false;
	if( paused_preserve ) pause();
}

function shand_maximize( shellwm, actor ){
	add_to_list( actor.meta_window );
}

function shand_unmaximize( shellwm, actor ){
	remove_from_list( actor.meta_window );
}

function shand_map( shellwm, actor ){
	if( add_to_list( actor.meta_window ) == null )
		remove_from_list( actor.meta_window );
}

function shand_destroy( shellwm, actor ){
	remove_from_list( actor.meta_window );
}

function shand_switch_workspace( shellwm, from, to, direction ){
	set_maximized_list_from_workspace(
		global.screen.get_workspace_by_index( to ) );
}

function set_maximized_list_from_workspace( workspace ){
	wlist = workspace.list_windows();
	clean_list();
	for( var i = 0; i < wlist.length ; i++ )
		add_to_list( wlist[i] );
	
	if( in_overview ){
		paused_preserve = check_maximized();
	}
	else{
		if( check_maximized() ) pause();
		else resume();
	}
}


function add_to_list( mwin ) {
	global.log( 'add_to_list(' + mwin + ')' );
	let added_list = null;
	
	//Check where to add it
	if( mwin.is_fullscreen() ){
		added_list = maximized_list;
		global.log( '  mwin is fullscreen - added_list = maximized_list' );
	}
	else if( ( mwin.get_maximized() & Meta.MaximizeFlags.VERTICAL ) > 0 ){
		let rect = mwin.get_outer_rect();
		if( ( mwin.get_maximized() & Meta.MaximizeFlags.HORIZONTAL ) > 0 ){
			added_list = maximized_list;
			global.log( '  mwin is maximized - added_list = maximized_list' );
		}
		else if(rect.x == 0){
			added_list = lefttiled_list;
			global.log( '  mwin is tiled left - added_list = lefttiled_list' );
		}
		else{
			added_list = righttiled_list;
			global.log( '  mwin is tiled right - added_list = righttiled_list' );
		}
	}
	else{
		global.log( '  mwin is not tiled or maximized window. returning.' );
		return null;
	}
	
	for( let i in maximized_group ){
		let index = maximized_group[i].indexOf( mwin );
		if( index != -1 ){
			if( maximized_group[i] == added_list ){
				global.log( '    already has mwin in added_list' );
				return added_list;
			}
			else{
				maximized_group[i].splice( index, 1 );
				global.log( '    mwin is in other list. removing it.' );
				break;
			}
		}
	}
	added_list.push( mwin );
	global.log( '    pushing mwin in added_list' );
	
	if( in_overview ){
		paused_preserve = check_maximized();
	}
	else{
		if( check_maximized() ) pause();
	}
	return added_list;
}

function remove_from_list( mwin ) {
	let removed_list = null;
	for( let i in maximized_group ){
		let index = maximized_group[i].indexOf( mwin );
		if( index != -1 ){
			maximized_group[i].splice( index, 1 );
			removed_list = maximized_group[i];
			break;
		}
	}
	if( in_overview ){
		paused_preserve = check_maximized();
	}
	else{
		if( !check_maximized() ) resume();
	}
	return removed_list;
}

function clean_list(){
	for( let i in maximized_group )
		maximized_group[i].splice( 0, maximized_group[i].length );
}

function check_maximized(){
	return maximized_list.length > 0 ||
		   (lefttiled_list.length > 0 && righttiled_list.length > 0 );
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
	paused = true;
}

function resume(){
	for( let i = 0; i < subplanes.length ; i++ ){
		subplanes[i].resume();
	}
	paused = false;
}
