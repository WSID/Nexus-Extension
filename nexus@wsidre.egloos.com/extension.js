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
	const Pellet = Ext.pellet;
	const Pool = Ext.pool;
	const ActorWrap = Ext.actorwrap;

var is_setup;

var settings;

	/* Value of parameters - Refer to README for more information. 'u' */
var pool_capacity;
var spawn_timeout;
var spawn_probability;
var proceed_timeout;
var speed_min;
var speed_max;
	/* Pellet appearance parameters - Refer to README too. 'u' */
var pellet_offset_x;
var pellet_offset_y;

var pellet_directions;
var pellet_direction_map;

var step_min;
var step_max;

var pellet_center_x;

var settings_change_id;
var screen_width_change_id;
var screen_height_change_id;

var proceed_source_id;
var spawning_source_id;
	/** Direction:
	 * Enum about direction.
	 * Right direction is 0 and values are increases in clockwise order.
	 */
const Direction = {
	LEFT	: 2,
	DOWN	: 1,
	RIGHT	: 0,
	UP		: 3
}

//Pellet and background plane.
var pellet_plane;			/* for background */


function direction_map( directions ){
	let result = new Array();
	
	for( let i = 0; i < directions.length ; i++ ){
	
		if( Direction[ directions[i].toUpperCase() ] != undefined ){
			let dirnum = Direction[ directions[i].toUpperCase() ];
			if( ! ( dirnum in result ) ) result.push(dirnum);
		}
	}
	if( result.length == 0 )
		return [Direction.LEFT, Direction.DOWN, Direction.RIGHT, Direction.UP];
	return result;
}

/* **** 3. Pellet-related functions ***** */

	/** pellet_init: void
	 * Initialize pellet management system before it would be usable.
	 */
function setup( ) {
	/* Initialize Plane */
	pellet_plane = new Clutter.Group();
	pellet_plane.set_anchor_point( -pellet_width / 2 + pellet_offset_x,
								   -pellet_width / 2 + pellet_offset_y );
	
	
	/* Initialize pool */
	Pool.setup( pool_capacity, Pellet );
	
	/* wrap_plane */
	ActorWrap.setup( );
	ActorWrap.add_actor( pellet_plane );
	
	/* Initialize source actors */
	src_pellets = new Array(pellet_colors.length);
	for( let i = 0; i < pellet_colors.length ; i++ ){
		src_pellets[i] = new PelletSource( pellet_width,
											pellet_trail_length,
											pellet_glow_radius,
											pellet_colors[i] );
	}
}

function unsetup( ) {
		//As contents of pool depends on src_pellets, uninitialize pool first.
	Pool.foreach( function( obj ){
		obj.actor.get_parent().remove_actor( obj.actor );
	} );
	Pool.unsetup();

	src_pellets = null;

	ActorWrap.unsetup();
	pellet_plane = null;
}

	/** pellet_pool_proceed: void
	 * Proceed pellets in pool one step and recycles a pellet out of screen.
	 */
function pellet_pool_proceed(  ) {

	
	Pool.foreach( function( obj ){
		obj.proceed( );
	} );
	
	Pool.recycle_if( function( obj ){
		return obj.is_out( );
	} );
	
	return true;
}




/* **** 4. Timeout callbacks, Signal Handlers ***** */

	/** tout_pellet_spawn: void
	 * calls pellet_spawn() in probability of 0.3 for each timeout. (default
	 *	setting )
	 */
function tout_pellet_spawn( ){
	if( Math.random() < spawn_probability )
		pellet_spawn( );
	
	return true;
}

function shandler_settings_change(s, k){
	switch( k ){
	case 'pool-capacity':
		break;
	case 'spawn-timeout':
		Mainloop.source_remove( spawning_source_id );
		spawn_timeout = settings.get_int('spawn-timeout');
		spawning_source_id = 
			Mainloop.timeout_add( spawn_timeout, tout_pellet_spawn );
		break;
	case 'proceed-timeout':
		Mainloop.source_remove( proceed_source_id );
		proceed_timeout = settings.get_int('proceed-timeout');
		proceed_source_id =
			Mainloop.timeout_add( proceed_timeout, pellet_pool_proceed );
	case 'spawn-probability':
		spawn_probability = settings.get_double('spawn-probability');
		break;
	case 'speed-min':
		speed_min = settings.get_double('speed-min');
		step_min = speed_min * proceed_timeout / 1000 ;
		break;
	case 'speed-max':
		speed_max = settings.get_double('speed-max');
		step_max = speed_max * proceed_timeout / 1000 ;
		break;
	case 'pellet-directions':
		pellet_directions = settings.get_strv('pellet-directions');
		pellet_direction_map = direction_map( pellet_directions );
		break;
	}
}

//Main ( 3.0.x Entry Point )
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
	
	pool_capacity = settings.get_int('pool-capacity');
	spawn_timeout = settings.get_int('spawn-timeout');
	proceed_timeout = settings.get_int('proceed-timeout');
	spawn_probability = settings.get_double('spawn-probability');
	speed_min = settings.get_double('speed-min');
	speed_max = settings.get_double('speed-max');
	
	pellet_colors = settings.get_strv('pellet-colors');
	pellet_default_alpha = settings.get_double('pellet-default-alpha');
	pellet_trail_length = settings.get_double('pellet-trail-length');
	pellet_width = settings.get_double('pellet-width');
	pellet_glow_radius = settings.get_double('pellet-glow-radius');
	pellet_offset_x = settings.get_double('pellet-offset-x');
	pellet_offset_y = settings.get_double('pellet-offset-y');
	
	pellet_directions = settings.get_strv('pellet-directions');
	
	step_min = speed_min * proceed_timeout / 1000 ;
	step_max = speed_max * proceed_timeout / 1000 ;
	
	pellet_center_x = Math.max(pellet_trail_length, pellet_glow_radius);
	
	pellet_direction_map = direction_map( pellet_directions );
	setup( );

	/* Get notify when settings is changed */
	settings_change_id = settings.connect('changed', shandler_settings_change );
	screen_width_change_id = global.stage.connect('notify::width', shandler_screen_change );
	screen_height_change_id = global.stage.connect('notify::height', shandler_screen_change );
	
	/* Adding timeout */
	spawning_source_id =
		Mainloop.timeout_add( spawn_timeout, tout_pellet_spawn );
	proceed_source_id =
		Mainloop.timeout_add( proceed_timeout , pellet_pool_proceed );

	is_setup = true;
}

function disable() {
	if( is_setup ){
		settings.disconnect( settings_change_id );
		global.stage.disconnect( screen_width_change_id );
		global.stage.disconnect( screen_height_change_id );
	
		Mainloop.source_remove( spawning_source_id );
		Mainloop.source_remove( proceed_source_id );

		unsetup();

		pellet_direction_map = null;
		pellet_colors = null;
		settings = null;

		is_setup = false;
	}
}
