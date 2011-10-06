
// Include Statements.
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;

const Lang = imports.lang;
const Main = imports.ui.main;

const Ext = imports.ui.extensionSystem.extensions['nexus@wsidre.egloos.com'];
	const Pool = Ext.pool;

var is_setup;

var src_pellets;

var pellet_colors;
var pellet_default_alpha;
var pellet_trail_length;
var pellet_width; 
var pellet_glow_radius;

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


function make_cstruct( color ){
	let result;
	let is_def_alpha_applied = false;
	if( typeof(color) == 'string' ){
		result = new Gdk.RGBA();
		
		is_def_alpha_applied = 			//Whether default alpha is applied.
			(result.charAt(0) == '#') || //#rrggbb has no alpha param
			(result.charAt(3) != 'a') ;  //rgba has alpha param
			
		if( ! result.parse( color ) )
			throw new TypeError('Given string ' + result + ' cannot be parsed.' );
		
		if( is_def_alpha_applied )
			result.alpha = pellet_default_alpha;
		return result;
	}
	else return color;
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
	//_step_x: double
	//_step_y: double
	
	_init: function( ) {
		
		this.actor = new Clutter.Clone({});
		
		this.actor.set_anchor_point( pellet_center_x, pellet_glow_radius );
		this.actor.visible = false;
		pellet_plane.add_actor(this.actor);	//<<<
		
	},
	
		/** move_step: void
		 * move this pellet one step.
		 */
	move_step: function( ) {
		this.actor.move_by( this._step_x, this._step_y );

	},
	set_source: function( psrc ) {
		this.actor.source = psrc.actor;
	}
};


/* **** 2. PelletSource.	***** */

	/** PelletSource:
	 * visual source of pellet.
	 */
function PelletSource( width, trail_length, glow_radius, color ) {
	this._init( width, trail_length, glow_radius, color );
}

PelletSource.prototype = {
	//TODO(0.6): drop using Clutter.CairoTexture.create() 
	//			 Instead use draw signal
	
	//Dimension Information
	//	width:			double
	//	trail_length:	double
	//	glow_radius:	double
	//Color Information
	//	cstruct:		object{
	//						red:	double
	//						green:	double
	//						blue:	double
	//						alpha:	double
	//					}
	//Misc
	//	actor: 			Clutter.CairoTexture

	_init: function ( width, trail_length, glow_radius, color ){
		this.width = width;
		this.trail_length = trail_length;
		this.glow_radius = glow_radius;
		this.cstruct = make_cstruct( color );
		this.actor = new Clutter.CairoTexture();
		
		this.paint();
		this.actor.set_anchor_point( Math.max(glow_radius, trail_length), glow_radius );
		this.actor.visible = false;
		pellet_plane.add_actor( this.actor );
	},
		/** paint: void
		 * Paints colorized energy pellet. It uses cairo rather than images.
		 *
		 * width		:float				: width of pellet
		 * trail_length	:float				: length of trailing
		 * glow_radius	:float				: radius of glowing
		 * color		:object{
		 *					red		:double	: Red value of energy
		 *					green	:double	: Green value of energy
		 *					blue	:double	: ...
		 *					alpha	:double	: Alpha value of energy
		 *				 }
		 *				 or string			: String representation that read by
		 *									  Gdk.RGBA.parse
		 */
	paint: function (){
		let center_x = Math.max(this.glow_radius, this.trail_length);
	
		let trail_start	= center_x - this.trail_length;
		let trail_end	= center_x + (this.width / 2);
	
		let glow_start = center_x - this.glow_radius;
		let glow_end = center_x + this.glow_radius;
	
		let surface_width = center_x + this.glow_radius;
		let surface_height = this.glow_radius << 1;
	
		this.actor.clear();
		this.actor['surface-width'] = surface_width;
		this.actor['surface-height'] = surface_height;

		let context = this.actor.create();
	
		/* Draw Trailing with Linear Gradient */
		let trailing_pat = new Cairo.LinearGradient(0, trail_start, trail_end,	0 );
		trailing_pat.addColorStopRGBA( 0,	this.cstruct.red,
											this.cstruct.green,
											this.cstruct.blue,
											0 );
		trailing_pat.addColorStopRGBA( 1,	this.cstruct.red,
											this.cstruct.green,
											this.cstruct.blue,
											this.cstruct.alpha );

			context.setSource( trailing_pat );
			context.rectangle( trail_start, this.glow_radius - (this.width / 2),
							   trail_end - trail_start, this.width );
			context.fill( );

		/* Draw glowing with Radial Gradient */
		let glow_pat = new Cairo.RadialGradient( center_x, this.glow_radius, this.width / 2,
												 center_x, this.glow_radius, this.glow_radius );
		glow_pat.addColorStopRGBA( 0,	this.cstruct.red,
										this.cstruct.green,
										this.cstruct.blue,
										this.cstruct.alpha );
		glow_pat.addColorStopRGBA( 1,	this.cstruct.red,
										this.cstruct.green,
										this.cstruct.blue, 0 );

			context.setSource( glow_pat );
			context.rectangle( glow_start, 0,
							   glow_end - glow_start, surface_height );
			context.fill( );
		delete context;
		context = null;
	}

}

/* **** 3. PelletPlane.		***** */
function PelletPlane( ){
	this._init( );
}

PelletPlane.prototype = {
	//Basic Information
	//	swidth:							int
	//	sheight:						int
	//	xindexe:						int
	//	yindexe:						int
	//	pellet_pool:					Pool<Pellet>
	//	pellet_srcs:					PelletSource[]
	//Spawning Parameters
	//	pellet_colors:					Something means color[]
	//	pellet_directions:				(int from Direction)[]
	//	offset_x:						double
	//	offset_y:						double
	//	pellet_step_min:				double
	//	pellet_step_max:				double
	//	pellet_width:					double
	//	pellet_trail_length:			double
	//	pellet_glow_radius:				double
	//Internal Processing variable
	//	_pellet_center_x:				double
	//Signal Handlers' IDs
	//	_sigid_screen_change_width:		uint
	//	_sigid_screen_change_height:	uint
	_init: function( ){
		this.actor = new Clutter.Group();
		this.set_pellet_offset( offset_x, offset_y);
		config_screen_size();
		
		this._sigid_screen_change_width =
			global.stage.connect('notify::width', this.config_screen_size );
		this._sigid_screen_change_height =
			global.stage.connect('notify::height', this.config_screen_size );
	},
	finalize(){
		global.log( "PelletPlane - finalize() called" );
		global.stage.disconnect( this._sigid_screen_change_width );
		global.stage.disconnect( this._sigid_screen_change_height );
	},
	
	set_pellet_directions: function( directions ){
		...
	}
	
	set_pellet_offset: function( offset_x, offset_y ){
		let half_width = this.pellet_width / 2;
		this.offset_x = ( ( offset_x + half_width ) % this.width ) - half_width;
		this.offset_y = ( ( offset_y + half_width ) % this.width ) - half_width;
		this.actor.set_anchor_point( -half_width + this.offset_x,
									 -half_width + this.offset_y );
	},
	
	set_pellet_step: function( _min, _max ){
		this.pellet_step_min = _min;
		this.pellet_step_max = _max;
	},
	
	set_pellet_
	
	config_screen_size: function( ){
		this.swidth = global.stage.width;
		this.sheight = global.stage.height;
	
		this.xindexe = Math.ceil(this.swidth / pellet_width);
		this.yindexe = Math.ceil(this.sheight / pellet_width );
	},
		/** pellet_spawn: void
		 * Spawn a pellet at edge of screen from pool. If no pellet is idle, It doesn't
		 * spawn any pellet.
		 */
	pellet_spawn: function( ){
		let spawnee = Pool.retrive( );
	
		if( spawnee != null ){

			let rand_dir = GLib.random_int_range( 0, pellet_direction_map.length );
			rand_dir = pellet_direction_map[ rand_dir ];
			let rand_col = GLib.random_int_range( 0, src_pellets.length );
		
			let rand_spd = GLib.random_double_range(step_min, step_max);
			let rand_pos;
	
			// Setting basic property
			spawnee._direction = rand_dir;
	
			spawnee.actor.rotation_angle_z = rand_dir*90 ;
	
			// Put on starting place.
			switch( rand_dir ){
			case Direction.LEFT:
				rand_pos = index_2_pos( GLib.random_int_range(0, xindexe) );
				spawnee._step_x = -rand_spd;
				spawnee._step_y = 0;
				spawnee.actor.x = swidth + pellet_glow_radius;
				spawnee.actor.y = rand_pos;
				break;
			case Direction.RIGHT:
				rand_pos = index_2_pos( GLib.random_int_range(0, xindexe) );
				spawnee._step_x = rand_spd;
				spawnee._step_y = 0;
				spawnee.actor.x = -pellet_glow_radius;
				spawnee.actor.y = rand_pos;
				break;
			case Direction.UP:
				rand_pos = index_2_pos( GLib.random_int_range(0, yindexe) );
				spawnee._step_x = 0;
				spawnee._step_y = -rand_spd;
				spawnee.actor.x = rand_pos;
				spawnee.actor.y = sheight + pellet_glow_radius;
				break;
			case Direction.DOWN:
				rand_pos = index_2_pos( GLib.random_int_range(0, yindexe) );
				spawnee._step_x = 0;
				spawnee._step_y = rand_spd;
				spawnee.actor.x = rand_pos;
				spawnee.actor.y = -pellet_glow_radius;
				break;
			}

	
			// Set pellet source
			spawnee.set_source( src_pellets[ rand_col ] );
			spawnee.actor.visible = true;
		},
			/** index_2_pos: int
			 * index:	int:	index of place.
			 * Return:	double:	position of index.
			 */
		index_2_pos : function( index ) {
			return index * pellet_width;
		},
		
			/** is_out: bool
			 * Returns:	bool:	Whether it is out of screen and getting more farther
			 *					the screen.
			 */
		is_out: function( child ) {
			let x = child.actor.x;
			let y = child.actor.y;
		
			let res;
		
			res = ( x <= -(this.pellet_center_x) ) || ( (this.swidth + this.pellet_center_x ) <= x ) ||
				  ( y <= -(this.pellet_center_x) ) || ( (this.sheight + this.pellet_center_x ) <= y);
			return res;
		}
		
		direction_map: function( directions ){
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
	}
}
