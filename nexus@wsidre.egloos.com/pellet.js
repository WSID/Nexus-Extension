
// Include Statements.
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;
const Gdk = imports.gi.Gdk;

const St = imports.gi.St;
const Lang = imports.lang;

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

function is_have_alpha_part( color ){
	if( typeof(color) == 'string' ){
		return 	(color.charAt(0) != '#') && //#rrggbb has no alpha param
				(color.charAt(3) == 'a') ;  //rgba has alpha param
	}
	else{
		return color.alpha != null;
	}
}

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
	},
	
		/** move_step: void
		 * move this pellet one step.
		 */
	move_step: function( ) {
		this.actor.move_by( this._step_x, this._step_y );

	},
	set_source: function( psrc ) {
		this.actor.source = psrc.actor;
		this.sync_anchor();
	},
	sync_anchor: function() {
		this.actor.set_anchor_point( this.actor.source.anchor_x,
									 this.actor.source.anchor_y );
	}
};


/* **** 2. PelletSource.	***** */

	/** PelletSource:
	 * visual source of pellet.
	 */
function PelletSource( width, trail_length, glow_radius, color, default_alpha ) {
	this._init( width, trail_length, glow_radius, color, default_alpha );
}

PelletSource.prototype = {
	//TODO(0.6): drop using Clutter.CairoTexture.create() 
	//			 Instead use draw signal
	
	//Dimension Information
	//	width:				double
	//	trail_length:		double
	//	glow_radius:		double
	//Color Information
	//	cstruct:			object{
	//							red:	double
	//							green:	double
	//							blue:	double
	//							alpha:	double
	//						}
	//	default_alpha:		double
	//	use_defalut_alpha:	bool
	//Misc
	//	actor: 				Clutter.CairoTexture

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
	
	set_width: function( width ){
		this.set_dimension( width, this.trail_length, this.glow_radius );
	},
	
	set_trail_length: function( trail_length ){
		this.set_dimension( this.width, trail_length, this.glow_radius );
	},
	
	set_glow_radius: function( glow_radius ){
		this.set_dimension( this.width, this.trail_length, glow_radius );
	},
	
	set_dimension: function( width, trail_length, glow_radius ){
		this.width = width;
		this.trail_length = trail_length;
		this.glow_radius = glow_radius;
		this.queue_repaint();
		this.actor.set_anchor_point( Math.max(glow_radius, trail_length), glow_radius );
	},
	
	set_color: function( color ){
		if( this.color == color ) return;
		this.cstruct = make_cstruct( color );
		this.use_defalut_alpha = ! is_have_alpha_part( color );
		if( this.use_defalut_alpha ){
			this.cstruct.alpha = this.default_alpha;
		}
		this.queue_repaint();
	},
	
	set_default_alpha: function( alpha ){
		this.default_alpha = alpha;
		if( this.use_default_alpha ){
			this.cstruct.alpha = alpha;
			this.queue_repaint();
		}
	},
	
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
