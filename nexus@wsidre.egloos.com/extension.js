/* Nexus Extension
 * Port of Nexus Live Wallpaper from Android.
 *
 * Metadata parameter :
 *	pool_capacity		: Capacity of pool
 *	spawn_timeout		: How often try to spawn pellets. ( in millisecond )
 *	spawn_probability	: Probability of spawning a pellet when it try to do.
 *	proceed_timeout		: How often move pellets and redraw screens?
 *  speed_min			: Minimum Speed of pellet in pixel/sec
 *	speed_max			: Maximum Speed of pellet in pixel/sec
 *
 * 1. Pellets.
 * 2. Pellet-related functions.
 * 3. Timeout callbacks, Signal Handlers.
 *
 * Written by WSID ( wsidre.egloos.com )
 */

//Include Statements
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;

const Lang = imports.lang;
const Main = imports.ui.main;

const Ext = imports.ui.extensionSystem.extensions['nexus@wsidre.egloos.com'];
	const Pool = Ext.pool;
	const ActorWrap = Ext.actorwrap;

var settings;

	/* Value of parameters */
var pool_capacity;
var spawn_timeout;
var spawn_probability;
var proceed_timeout;
var speed_min;
var speed_max;
var extension_path;

var step_min;
var step_max;

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

	/** SrcFileName: string[4]
	 * (Relative) Paths of image files of pellet.
	 */
const SrcFileName = [
	'image/pellet_r.png',
	'image/pellet_g.png',
	'image/pellet_b.png',
	'image/pellet_y.png'];

//Source pellets
var src_pellets;

//Pellet and background plane.
var pellet_plane;			/* for background */

//Screen width and height.
var swidth = global.stage.width;
var sheight = global.stage.height;

//As pellets are aligned by 14 pixels in an axis, we use integer based index
//	to place pellets. Used with index_2_pos().
var xindexe = (swidth + 13) / 14;
var yindexe = (sheight + 13 ) / 14;

	/** index_2_pos: int
	 * index:	int:	index of place.
	 * Return:	int:	position of index.
	 */
function index_2_pos( index ) {
	return index * 14;
}


/* **** 1. Pellet ***** */

	/** Pellet:
	 * Representation of pellet
	 * It has one of 4 directions(#_direction) and speed.
	 * Pellets are managed central in a pool and recycled after use.
	 */
function Pellet( ) {
	this._init( );
}


Pellet.prototype = {
	_step_x: 0.0,
	_step_y: 0.0,
	
	_init: function( ) {
		
		this.actor = new Clutter.Clone({});
		
		this.actor.set_anchor_point( 393, 21 );
		this.actor.visible = false;
		pellet_plane.add_actor(this.actor);
		
	},
	
		/** proceed: void
		 * proceed this pellet one step
		 */
	proceed: function( ) {
		this.actor.move_by( this._step_x, this._step_y );

	},
	
		/** is_out: bool
		 * Returns:	bool:	Whether it is out of screen and getting more farther
		 *					the screen.
		 */
	is_out: function( ) {
		let x = this.actor.x;
		let y = this.actor.y;
		
		let res;
		
		res = ( x <= -393 ) || ( (swidth + 393 ) <= x ) ||
			  ( y <= -393 ) || ( (sheight + 393 ) <= y);
		return res;
	},
};

/* **** 2. Pellet-related functions ***** */

	/** pellet_init: void
	 * Initialize pellet management system before it would be usable.
	 */
function pellet_init( ) {
	/* Initialize Plane */
	pellet_plane = new Clutter.Group();
	pellet_plane.set_anchor_point( -7, -7 );
	
	/* wrap_plane */
	ActorWrap.add_actor( pellet_plane );
	
	/* Initialize pool */
	Pool.init( pool_capacity, Pellet );
	
	/* Initialize source actors */
	src_pellets = new Array(4);
	for( let i = 0; i < 4; i++ ){
		src_pellets[i] =
			new Clutter.Texture( {filename:extension_path + '/' + SrcFileName[i]} );
		src_pellets[i].visible = false;
		pellet_plane.add_actor( src_pellets[i] );
	}
	
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


	/** pellet_spawn: void
	 * Spawn a pellet at edge of screen from pool. If no pellet is idle, It doesn't
	 * spawn any pellet.
	 */
function pellet_spawn( ){
	let spawnee = Pool.retrive( );
	
	if( spawnee != null ){

		let rand_num = GLib.random_int();

		let rand_dir = rand_num & 3;
		let rand_col = (rand_num & 12) >> 2;
		
		let rand_spd = GLib.random_double_range(step_min, step_max);
		let rand_pos;
	
		// Setting basic property
		spawnee._direction = rand_dir;
	
		spawnee.actor.rotation_angle_z = rand_dir*90 ;
	
		// Put on starting place.
		switch( rand_num & 3 ){
		case Direction.LEFT:
			rand_pos = index_2_pos( GLib.random_int_range(0, xindexe) );
			spawnee._step_x = -rand_spd;
			spawnee._step_y = 0;
			spawnee.actor.x = swidth + 21;
			spawnee.actor.y = rand_pos;
			break;
		case Direction.RIGHT:
			rand_pos = index_2_pos( GLib.random_int_range(0, xindexe) );
			spawnee._step_x = rand_spd;
			spawnee._step_y = 0;
			spawnee.actor.x = -21;
			spawnee.actor.y = rand_pos;
			break;
		case Direction.UP:
			rand_pos = index_2_pos( GLib.random_int_range(0, yindexe) );
			spawnee._step_x = 0;
			spawnee._step_y = -rand_spd;
			spawnee.actor.x = rand_pos;
			spawnee.actor.y = sheight + 21;
			break;
		case Direction.DOWN:
			rand_pos = index_2_pos( GLib.random_int_range(0, yindexe) );
			spawnee._step_x = 0;
			spawnee._step_y = rand_spd;
			spawnee.actor.x = rand_pos;
			spawnee.actor.y = -21;
			break;
		}

	
		// Set object bitmap
		spawnee.actor.source = src_pellets[ rand_col ];
		spawnee.actor.visible = true;
	}
}

/* **** 3. Timeout callbacks, Signal Handlers ***** */

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
	}
}

function shandler_screen_change(){
	swidth = global.stage.width;
	sheight = global.stage.height;
	
	xindexe = (swidth + 13) / 14;
	yindexe = (sheight + 13 ) / 14;
}

//Main
function main(metadata) {
	
	/* Getting parameters from metadata */
	settings = new Gio.Settings({ schema: 'org.gnome.shell.extensions.nexus' });
	
	pool_capacity = settings.get_int('pool-capacity');
	spawn_timeout = settings.get_int('spawn-timeout');
	proceed_timeout = settings.get_int('proceed-timeout');
	spawn_probability = settings.get_double('spawn-probability');
	speed_min = settings.get_double('speed-min');
	speed_max = settings.get_double('speed-max');
	
	step_min = speed_min * proceed_timeout / 1000 ;
	step_max = speed_max * proceed_timeout / 1000 ;
	
	extension_path = metadata.path;
					
	ActorWrap.init( );
	pellet_init( );
	
	/* Get notify when settings is changed */
	settings.connect('changed', shandler_settings_change );
	global.stage.connect('notify::width', shandler_screen_change );
	global.stage.connect('notify::height', shandler_screen_change );
	
	/* Adding timeout */
	spawning_source_id =
		Mainloop.timeout_add( spawn_timeout, tout_pellet_spawn );
	proceed_source_id =
		Mainloop.timeout_add( proceed_timeout , pellet_pool_proceed );
}
