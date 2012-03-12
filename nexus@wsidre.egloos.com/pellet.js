/* pellet.js
 * This module contains object prototype represents each energy-beam-shaped
 * pellet.
 * As we just uses few colors of pellets with same size, We have 2 object
 * prototypes. One is real representation: PelletSource, and the other is clone:
 * Pellet.
 * Pellet contains movement functions and PelletSource contains color and size
 * adjustment functions.
 *
 * In real, this is done. ( simplified... )
 *	pellet_source = new PelletSource( ... ); //color, size infos...
 *	pellet = new Pellet();
 *	pellet.set_source( pellet_source );
 */

// Include Statements.
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;
const Gdk = imports.gi.Gdk;

const St = imports.gi.St;
const Lang = imports.lang;

/* **** 1. Definition and Utility Functions. **********************************/

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

	/* is_have_alpha_part: bool
	 * Checks if given representation has alpha part and return result.
	 * Used to determine which alpha to use, default alpha value or color's own
	 * alpha value.
	 *
	 * color: string	: Color representation which Gdk.RGBA.parse() understand.
	 *		  or object	: Color object.
	 */
function is_have_alpha_part( color ){
	if( typeof(color) == 'string' ){
		return 	(color.charAt(0) != '#') && //#rrggbb has no alpha param
				(color.charAt(3) == 'a') ;  //rgba() has alpha param
	}
	else{
		return 'alpha' in color;
	}
}

	/* make_cstruct: object
	 * Constructs color object with given object.
	 *
	 * color: string or object	: Color representation.
	 *
	 * Return: Paresd color object.
	 */
function make_cstruct( color ){
	let result;
	if( typeof(color) == 'string' ){
		result = new Gdk.RGBA();
		
		if( ! result.parse( color ) )
			throw new TypeError('Given string ' + result + ' cannot be parsed.' );

		return result;
	}
	else return color;
}

/* **** 2. Pellet *********************************************************** */

	/** Pellet:
	 * Representation of pellet
	 * It has one of 4 directions(#_direction) and speed.
	 * Pellets are managed central in a pool and recycled after use.
	 */
function Pellet( ) {
	this._init( );
}


Pellet.prototype = {
	// Instance variables
	//	_step_x: double	: stepping length in x axis
	//	_step_y: double	: stepping length in y axis
	
	_init: function( ) {
		this.actor = new Clutter.Clone({});
	},
	
		/** move_step: void
		 * move this pellet one step.
		 */
	move_step: function( ) {
		this.actor.move_by( this._step_x, this._step_y );

	},
		/* set_source: void
		 * Sets pellet source.
		 *
		 * psrc: PelletSource	: Pellet source.
		 */
	set_source: function( psrc ) {
		this.actor.source = psrc.actor;
		this.sync_anchor();
	},
		/* sync_anchor: void
		 * Synchronize anchor between this and pellet source.
		 */
	sync_anchor: function() {
		this.actor.set_anchor_point( this.actor.source.anchor_x,
									 this.actor.source.anchor_y );
	}
};


/* **** 3. PelletSource. **************************************************** */

	/** PelletSource:
	 * visual source of pellet.
	 */
function PelletSource( width, trail_length, glow_radius, color, default_alpha ) {
	this._init( width, trail_length, glow_radius, color, default_alpha );
}

PelletSource.prototype = {
	// Instance variables
	//	width: double			: Pellet source's width
	//	trail_length: double	: Pellet source's trail length
	//	glow_radius: double		: Pellet source's glowing radius
	//
	//	cstruct: double			: Pellet source's color
	//		red: double			: red component
	//		green: double		: green component
	//		blue: double		: blue component
	//		alpha: double		: alpha component - if don't exist,
	//								default_alpha will be used instead
	//	default_alpha: double	: Alpha value when alpha component is missing.
	//	use_defalut_alpha: bool	: Is alpha is missing
	//
	//	actor: St.DrawingArea	: actor.
	
	_init: function ( width, trail_length, glow_radius, color, default_alpha ){
		this.default_alpha = default_alpha;
		this.color = color;
		this.cstruct = make_cstruct( color );
		this.use_default_alpha = !is_have_alpha_part( color );
		if( this.use_default_alpha ){
			this.cstruct.alpha = default_alpha;
		}
		this.actor = new St.DrawingArea();
		this.actor.connect( 'repaint', Lang.bind(this, this._paint) );
		
		this.set_dimension( width, trail_length, glow_radius );
		this.actor.visible = false;
		
	},
	
		/* set_width: void
		 * set pellet source's width ( Not size in x axis )
		 *
		 * width: double	: pellet source's width
		 */
	set_width: function( width ){
		this.set_dimension( width, this.trail_length, this.glow_radius );
	},
	
		/* set_trail_length: void
		 * set pellet source's trail length.
		 *
		 * trail_length: double	: pellet source's trail length.
		 */
	set_trail_length: function( trail_length ){
		this.set_dimension( this.width, trail_length, this.glow_radius );
	},
	
		/* set_glow_radius: void
		 * set pellet source's glow radius.
		 *
		 * glow_radius: double	: pellet source's glowing radius.
		 */
	set_glow_radius: function( glow_radius ){
		this.set_dimension( this.width, this.trail_length, glow_radius );
	},
	
		/* set_dimension: void
		 * set pellet source's size at once.
		 *
		 * width: double		: pellet source's width
		 * trail_length: double	: pellet source's trail length.
		 * glow_radius: double	: pellet source's glowing radius.
		 */
	set_dimension: function( width, trail_length, glow_radius ){
		this.width = width;
		this.trail_length = trail_length;
		this.glow_radius = glow_radius;
		this.queue_repaint();
		this.actor.set_anchor_point( Math.max(glow_radius, trail_length), glow_radius );
	},
	
		/* set_color: void
		 * set pellet source's color.
		 *
		 * color: object or string	: color representation.
		 */
	set_color: function( color ){
		if( this.color == color ) return;
		this.cstruct = make_cstruct( color );
		this.use_defalut_alpha = ! is_have_alpha_part( color );
		if( this.use_defalut_alpha ){
			this.cstruct.alpha = this.default_alpha;
		}
		this.queue_repaint();
	},
	
		/* set_default_alpha: void
		 * set default alpha of pellet source.
		 * When transparency is not given by color, this value will be used
		 * instead of it.
		 *
		 * alpha: double	: alpha value ( transparency )
		 */
	set_default_alpha: function( alpha ){
		this.default_alpha = alpha;
		if( this.use_default_alpha ){
			this.cstruct.alpha = alpha;
			this.queue_repaint();
		}
	},
	
		/* queue_repaint: void
		 * invokes actor's queue_repaint() method, preparing size of parts.
		 */
	queue_repaint: function(){
		this._center_x = Math.max(this.glow_radius, this.trail_length);
		this._half_width = this.width / 2;
	
		this._trail_start	= this._center_x - this.trail_length;
		this._trail_end	= this._center_x + this._half_width;
	
		this._glow_start = this._center_x - this.glow_radius;
		this._glow_end = this._center_x + this.glow_radius;
	
		this._surface_width = this._center_x + this.glow_radius;
		this._surface_height = this.glow_radius * 2;
		
		this.actor.width = this._surface_width;
		this.actor.height = this._surface_height;
		
		this.actor.queue_repaint();
	},
		/** paint: void
		 * Paints colorized energy pellet. It uses cairo rather than images.
		 *
		 * width: float				: width of pellet
		 * trail_length: float		: length of trailing
		 * glow_radius: float		: radius of glowing
		 * color: object or string	: String representation that read by
		 *							  Gdk.RGBA.parse
		 */
	_paint: function ( actor ){
		let context = actor.get_context();
	
		/* Draw Trailing with Linear Gradient */
		let trailing_pat = new Cairo.LinearGradient(0,
													this._trail_start,
													this._trail_end,
													0 );
		trailing_pat.addColorStopRGBA( 0,	this.cstruct.red,
											this.cstruct.green,
											this.cstruct.blue,
											0 );
		trailing_pat.addColorStopRGBA( 1,	this.cstruct.red,
											this.cstruct.green,
											this.cstruct.blue,
											this.cstruct.alpha );

			context.setSource( trailing_pat );
			context.rectangle( this._trail_start,
							   this.glow_radius - this._half_width,
							   this._trail_end - this._trail_start,
							   this.width );
			context.fill( );

		/* Draw glowing with Radial Gradient */
		let glow_pat = new Cairo.RadialGradient( this._center_x,
												 this.glow_radius,
												 this._half_width,
												 
												 this._center_x,
												 this.glow_radius,
												 this.glow_radius );
		
		glow_pat.addColorStopRGBA( 0,	this.cstruct.red,
										this.cstruct.green,
										this.cstruct.blue,
										this.cstruct.alpha );
		glow_pat.addColorStopRGBA( 1,	this.cstruct.red,
										this.cstruct.green,
										this.cstruct.blue, 0 );

			context.setSource( glow_pat );
			context.rectangle( this._glow_start,
							   0,
							   this._glow_end - this._glow_start,
							   this._surface_height );
			context.fill( );
	}
}
