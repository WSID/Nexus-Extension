
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;

const Lang = imports.lang;
const Main = imports.ui.main;

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
	if( typeof(color) == "string" ){
		result = new Gdk.RGBA();
		
		is_def_alpha_applied = 			//Whether default alpha is applied.
			(result.charAt(0) == '#') || //#rrggbb has no alpha param
			(result.charAt(3) != 'a') ;  //rgba has alpha param
			
		if( ! result.parse( color ) )
			throw new TypeError("Given string " + result + " cannot be parsed." );
		
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
	_step_x: 0.0,
	_step_y: 0.0,
	
	_init: function( ) {
		
		this.actor = new Clutter.Clone({});
		
		this.actor.set_anchor_point( pellet_center_x, pellet_glow_radius );
		this.actor.visible = false;
		pellet_plane.add_actor(this.actor);	//<<<
		
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
		
		res = ( x <= -pellet_center_x ) || ( (swidth + pellet_center_x ) <= x ) ||
			  ( y <= -pellet_center_x ) || ( (sheight + pellet_center_x ) <= y);
		return res;
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
	_init: function ( width, trail_length, glow_radius, color ){
		let cstruct = make_cstruct( color );
		this.actor = new Clutter.CairoTexture();
		this.ready( width, trail_length, glow_radius, cstruct );
		this.actor.set_anchor_point( Math.max(glow_radius, trail_length), glow_radius );
		this.actor.visible = false;
		pellet_plane.add_actor( this.actor );
	},
	ready: function ( width, trail_length, glow_radius, cstruct ){
		let center_x = Math.max(glow_radius, trail_length);
	
		let trail_start	= center_x - trail_length;
		let trail_end	= center_x + (width / 2);
	
		let glow_start = center_x - glow_radius;
		let glow_end = center_x + glow_radius;
	
		let surface_width = center_x + glow_radius;
		let surface_height = glow_radius << 1;
	
		this.actor['surface-width'] = surface_width;
		this.actor['surface-height'] = surface_height;
	
		var context = this.actor.create();
	
		/* Draw Trailing with Linear Gradient */
		let trailing_pat = new Cairo.LinearGradient(0, trail_start, trail_end,	0 );
		trailing_pat.addColorStopRGBA( 0, cstruct.red, cstruct.green, cstruct.blue, 0 );
		trailing_pat.addColorStopRGBA( 1, cstruct.red, cstruct.green, cstruct.blue, cstruct.alpha );

			context.setSource( trailing_pat );
			context.rectangle( trail_start, glow_radius - (width / 2),
							   trail_end - trail_start, width );
			context.fill( );

		/* Draw glowing with Radial Gradient */
		let glow_pat = new Cairo.RadialGradient( center_x, glow_radius, width / 2,
												 center_x, glow_radius, glow_radius );
		glow_pat.addColorStopRGBA( 0, cstruct.red, cstruct.green, cstruct.blue, cstruct.alpha );
		glow_pat.addColorStopRGBA( 1, cstruct.red, cstruct.green, cstruct.blue, 0 );

			context.setSource( glow_pat );
			context.rectangle( glow_start, 0,
							   glow_end - glow_start, surface_height );
			context.fill( );
		context = null;
	}
}

/* **** 3. PelletPlane.		***** */
function PelletPlane( ){
	this._init( );
}

PelletPlane.prototype = {
	//_sigid_screen_change_width : uint
	//_sigid_screen_change_height : uint
	_init: function( ){
		this.actor = new Clutter.Group();
		this.actor.set_anchor_point( -pellet_width / 2 + pellet_offset_x,
									 -pellet_width / 2 + pellet_offset_y );
		this.swidth = global.stage.width;
		this.sheight = global.stage.height;
		
		this._sigid_screen_change_width =
			global.stage.connect('notify::width', this.shandler_screen_change );
		this._sigid_screen_change_height =
			global.stage.connect('notify::height', this.shandler_screen_change );
	},
	shandler_screen_change: function( ){
		this.swidth = global.stage.width;
		this.sheight = global.stage.height;
	
		this.xindexe = Math.ceil(this.swidth / pellet_width);
		this.yindexe = Math.ceil(this.sheight / pellet_width );
	},
	finalize(){
		global.log( "PelletPlane - finalize() called" );
		global.stage.disconnect( this._sigid_screen_change_width );
		global.stage.disconnect( this._sigid_screen_change_height );
	}
}
