/* Pellet Plane
 * Where pellets are moving around!
 * For convenience, it manages pellet's color and dimensions.
 *
 * Section outlines.
 * 1. Starting and Stopping plane
 * 2. Setters for adjustable options
 * 3. Internal value adjust and applying
 * 4. Signal Handlers
 * 5. Internal Operations
 * 6. Internal Utility Functions
 */

// Include Statements.
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const Lang = imports.lang;
const Main = imports.ui.main;

const Ext = imports.ui.extensionSystem.extensions['nexus@wsidre.egloos.com'];
	const Pool = Ext.pool;
	const Pellet = Ext.pellet;

const Direction = Pellet.Direction

//Constant
const PELLET_MIN_SPEED = 10;

function PelletPlane( settings ){
	this._init( settings );
}

PelletPlane.prototype = {
	//Basic Information
	//	swidth: int	:	 screen width.
	//	sheight: int	: screen height.
	//	actor: Clutter.Group	: real actor of it.
	//Plane Parameters
	//	pool_capacity: int
	//	offset_x: double
	//	offset_y: double
	//	stepping_timeout: int ( millisecond )
	//	spawn_timeout: int ( millisecond )
	//	spawn_probability: double ( 0 ~ 1 )
	//Pellet Parameters
	//	pellet_speed_min: double
	//	pellet_speed_max: double
	//	pellet_colors: Something means color[]
	//	pellet_default_alpha: double
	//	pellet_width: double
	//	pellet_trail_length: double
	//	pellet_glow_radius: double
	//	pellet_directions: (int from Direction)[]
	//Internal Processing variable
	//	_pellet_pool: Pool
	//	_pellet_srcs: PelletSource[]
	//	_xindexe: int
	//	_yindexe: int
	//	_pellet_step_min: double
	//	_pellet_step_max: double
	//	_is_postponed_color_init: bool
	//	_settings: Gio.Settings
	//	_pellet_settings: Gio.Settings
	//	_sxend:
	//	_syend:
	//State
	//	_started: bool
	//	_paused: bool
	//Signal Handlers' IDs
	//	_srcid_spawning: uint
	//	_srcid_stepping: uint
	//	_shid_settings: uint
	//	_shid_pellet_settings: uint
	
	_init: function( settings ){
		// Initialize actors
		this.actor = new Clutter.Group();
		
		// Initialize _settings
		this._settings = settings;
		this._pellet_settings = settings.get_child( 'pellet' );
		
		// Initialize _pellet_pool and _pellet_srcs
		this.pool_capacity = settings.get_int('pool-capacity');
		this._pellet_pool = new Pool.Pool( this.pool_capacity, Pellet.Pellet );
		this._pellet_pool.foreach_full( Lang.bind(this, function( obj ){
			obj.actor.visible = false;
			this.actor.add_actor( obj.actor );
		} ) );
		this._pellet_srcs = new Array();
		
		// Connect signal to _settings
		this._shid_settings =
			this._settings.connect('changed',
				this._sh_plane_settings_changed.bind( this ) );
		
		this._shid_pellet_settings =
			this._pellet_settings.connect('changed',
				this._sh_pellet_settings_changed.bind( this ) );
		
		// Set pellet parameters from settings
		this.set_pellet_speed.apply( this,
			settings.get_value('speed').deep_unpack() );
		
		this.set_pellet_dimension(
			this._pellet_settings.get_double('width'),
			this._pellet_settings.get_double('trail-length'),
			this._pellet_settings.get_double('glow-radius') );
		this.set_pellet_default_alpha(
			this._pellet_settings.get_double('default-alpha') );
		this.set_pellet_colors( this._pellet_settings.get_strv('colors') );
		this.set_pellet_directions(
			this._settings.get_strv('pellet-directions') );
		
		//Set plane paramters from settings
		this.set_offset.apply( this,
							   settings.get_value( 'offset' ).deep_unpack() );
		this.set_stepping_timeout( this._settings.get_int('stepping-timeout') );
		this.set_spawn_timeout( this._settings.get_int('spawn-timeout') );
		this.set_spawn_probability(
			this._settings.get_double('spawn-probability') );

	},
	
	/* **** 1. Starting and Stopping plane ************************************/
		/* start: void
		 * starts spawning and moving pellets.
		 * This can be stopped by stop() function or paused by pause() function.
		 */
	start: function(){
		if( !this._started ){
		
			if( ! this._paused ){
				this._srcid_spawning =
					Mainloop.timeout_add( this.spawn_timeout,
										  Lang.bind(this, this.pellet_spawn) );
				this._srcid_stepping =
					Mainloop.timeout_add( this.stepping_timeout,
										  Lang.bind(this, this.do_step) );
			}
			this.actor.visible = true;
			
			//When actor has parent actor, set color here.
			if( this._is_postponed_color_init )
				this.set_pellet_colors(this.pellet_colors);
			
			this._started = true;
		}
	},
		/* stop: void
		 * stops spawning and moving pellets.
		 * For pausing this for moment, use pause() instead.
		 */
	stop: function(){
		if( this._started ){
			this.actor.visible = false;
			Mainloop.source_remove( this._srcid_spawning );
			Mainloop.source_remove( this._srcid_stepping );
		
			this._started = false;
		}
	},
		/* resume: void
		 * continues pellet-spawning and moving behavior paused by pause().
		 */
	resume: function(){
		if( this._paused ){
			this._srcid_spawning =
				Mainloop.timeout_add( this.spawn_timeout,
									  Lang.bind(this, this.pellet_spawn) );
			this._srcid_stepping =
				Mainloop.timeout_add( this.stepping_timeout,
									  Lang.bind(this, this.do_step) );
			this._paused = false;
		}
	},
		/* pause: void
		 * pauses pellet-spawning and moving behavior.
		 */
	pause: function(){
		if( ! this._paused ){
			Mainloop.source_remove( this._srcid_spawning );
			Mainloop.source_remove( this._srcid_stepping );
			this._paused = true;
		}
	},
	
	/* **** 2. Setters for adjustable options *********************************/
		/* set_offset: void
		 * Translate and apply offset.
		 */
		 
	set_offset: function( offset_x, offset_y ){
		let half_width = this.pellet_width / 2;
		this.offset_x = ( ( offset_x + half_width ) % this.pellet_width );
		this.offset_y = ( ( offset_y + half_width ) % this.pellet_width );
		this.offset_x = this.offset_x < 0 ?
							this.offset_x + this.pellet_width :
							this.offset_x;
		this.offset_y = this.offset_y < 0 ?
							this.offset_y + this.pellet_width :
							this.offset_y;
		this.actor.set_anchor_point( this.offset_x,
									 this.offset_y );
	},
	
		/* set_stepping_timeout: void
		 * sets stepping interval. Pellet moves on each step.
		 *
		 * duration: int	: stepping interval in millisecond.
		 */
	set_stepping_timeout: function( duration ){
		this.stepping_timeout = duration;
		
		if( this._started ){
			Mainloop.source_remove( this._srcid_stepping );
			this._srcid_stepping =
				Mainloop.timeout_add( this.stepping_timeout,
									  Lang.bind(this, this.do_step) );
		}
		this.config_step();
	},
	
		/* set_spawn_timeout: void
		 * sets stawning timeout. Pellets are spawned on each spawning timeout,
		 * with some probability.
		 *
		 * timeout: int	: spawning timeout in millisecond.
		 */
	set_spawn_timeout: function( timeout ){
		this.spawn_timeout = timeout;
		
		if( this._started ){
			Mainloop.source_remove( this._srcid_spawning );
			this._srcid_spawning =
				Mainloop.timeout_add( this.spawn_timeout,
									  Lang.bind(this, this.pellet_spawn) );
		}
	},
	
		/* set_spawn_probability: void
		 * sets spawning probability on each spawning timeout.
		 * 0 means pellet never spawn, 1 means pellets always spawn on each
		 * timeout.
		 *
		 * probability: double	: spawning probability.
		 */
	set_spawn_probability: function( probability ){
		this.spawn_probability = probability;
	},
	
		/* set_pellet_speed: void
		 * sets pellet's speed range.
		 * If speed_min is greater than speed_max, they will be swapped.
		 * If speed is less than PELLET_MIN_SPEED, they will be re-adjusted.
		 *
		 * speed_min: double	: minimum speed of pellet.
		 * speed_max: double	: maximum speed of pellet.
		 */
	set_pellet_speed: function( speed_min, speed_max ){
		if( speed_min > speed_max ){
			var temp = speed_max;
			speed_max = speed_min;
			speed_min = temp;
		}
		
		if( speed_min < PELLET_MIN_SPEED ){
			speed_min = PELLET_MIN_SPEED;
			if( speed_max < PELLET_MIN_SPEED ){
				speed_max = PELLET_MIN_SPEED;
			}
		}
		
		this.pellet_speed_min = speed_min;
		this.pellet_speed_max = speed_max;
		this.config_step();
	},
	
		/* set_pellet_speed_min: void
		 * sets minimum speed of pellets.
		 *
		 * speed: double	: minimum speed of pellet.
		 */
	set_pellet_speed_min: function( speed ){
		this.pellet_speed_min = speed;
		this.config_step();
	},
	
		/* set_pellet_speed_max: void
		 * sets maximum speed of pellets.
		 *
		 * speed: double	: maximum speed of pellet.
		 */
	set_pellet_speed_max: function( speed ){
		this.pellet_speed_max = speed;
		this.config_step();
	},
	
		/* set_pellet_colors: void
		 * sets color set to be used.
		 *
		 * colors: Array	: array of color representations. ( either string or
		 *					  color object )
		*/
	set_pellet_colors: function( colors ){
	
		this.pellet_colors = colors;
		//When actor has no parent, setting color would cause crush.
		if( this.actor.get_parent() == null ){
			this._is_postponed_color_init = true;
			return;
		}
		
		//If count of the color is decreased,
		// drop some of pellet sources to have same count of it.
		if( colors.length < this._pellet_srcs.length )
			this._pellet_srcs.splice( colors.length,
									  this._pellet_srcs.length - colors.length);

		//Setting color of pellet sources.
		for( let i in this._pellet_srcs )
			this._pellet_srcs[i].set_color( colors[i] );
		
		//If count of the color is increased,
		// add new pellet sources to have same count of it.
		for( let i = this._pellet_srcs.length ; i < colors.length; i++ ){
			let pellet_src =
				new Pellet.PelletSource(this.pellet_width,
										this.pellet_trail_length,
										this.pellet_glow_radius,
										colors[i],
										this.pellet_default_alpha );
			this._pellet_srcs.push( pellet_src );
			
			//Add pellet source to realize it.
			this.actor.add_actor( pellet_src.actor );
			pellet_src.queue_repaint();
			pellet_src.actor.visible = false;
		}
		this._is_postponed_color_init = false;
	},
	
		/* set_pellet_default_alpha: void
		 * sets default transparency to be used when alpha was not given from
		 * color.
		 *
		 * alpha: double	: default alpha value.
		 */
	set_pellet_default_alpha: function( alpha ){
		this.pellet_default_alpha = alpha;
		for( let i in this._pellet_srcs )
			this._pellet_srcs[i].set_default_alpha( alpha );
	},
	
		/* set_pellet_directions: void
		 * sets set of pellet moving directions.
		 *
		 * directions: Array	: array of direction representations. ( either
		 *						   string or int )
		 */
	set_pellet_directions: function( directions ){
		this.pellet_directions = this.direction_map( directions );
	},
	
		/* set_pellet_width: void
		 * sets pellet width.
		 *
		 * width: double	: pellet width.
		 */
	set_pellet_width: function( width ){
		this.pellet_width = width;
		for( let i in this._pellet_srcs )
			this._pellet_srcs[i].set_width( width );
		this.config_step();
		this.config_pellet_position();
	},
	
		/* set_pellet_trail_length: void
		 * sets pellet trailing length.
		 *
		 * trail_length: double	: trailing length.
		 */
	set_pellet_trail_length: function( trail_length ){
		this.pellet_trail_length = trail_length;
		for( let i in this._pellet_srcs )
			this._pellet_srcs[i].set_trail_length( trail_length );
		this.config_pellet_center_x();
	},
	
		/* set_pellet_glow_radius: void
		 * set pellet glowing radius.
		 *
		 * glow_radius: double	: glowing radius.
		 */
	set_pellet_glow_radius: function( glow_radius ){
		this.pellet_glow_radius = glow_radius;
		for( let i in this._pellet_srcs )
			this._pellet_srcs[i].set_glow_radius( glow_radius );
		this.config_pellet_center_x();
	},
	
		/* set_pellet_dimension: void
		 * sets pellet's width, trailing length, glowing radius at once.
		 *
		 * width: double		: pellet width.
		 * trail_length: double	: pellet trailing length.
		 * glow_radius: double	: pellet glowing radius.
		 */
	set_pellet_dimension: function( width, trail_length, glow_radius ){
		this.pellet_width = width;
		this.pellet_trail_length = trail_length;
		this.pellet_glow_radius = glow_radius;
		for( let i in this._pellet_srcs )
			this._pellet_srcs[i].set_dimension( width,
												trail_length,
												glow_radius );
		this.config_step();
		this.config_pellet_center_x();
	},
	
		/* set_size: void
		 * sets pellet plane's size. Used by Actorwrap.
		 *
		 * swidth: int	: width of plane's size
		 * sheight:	int	: height of plane's size
		 */
	set_size: function( swidth, sheight ){
		this.swidth = swidth;
		this.sheight = sheight;
		
		this.config_pellet_position();
		this.config_screen_end();
	},
	
	/* **** 3. Internal value adjust and applying *****************************/
		/* config_pellet_position: void
		 * Applying new size on position setting part.
		 */
	config_pellet_position: function(){
		if( (this.swidth != undefined) &&
			(this.sheight != undefined) &&
			(this.pellet_width != undefined) ){
			
			this._xindexe = Math.ceil(this.swidth / this.pellet_width );
			this._yindexe = Math.ceil(this.sheight / this.pellet_width );
		}
	},
	
		/* config_screen_end: void
		 * Applying new size on pellet recycling part. ( pellets are recycled at
		 * the end of plane. )
		 */
	config_screen_end: function( ){
		if( this.swidth != undefined &&
			this.sheight != undefined &&
			this._pellet_center_x != undefined ){
			
			this._sxend = this.swidth + this._pellet_center_x;
			this._syend = this.sheight + this._pellet_center_x;
		}
	},
	
		/* config_step: void
		 * Applying new speed on step parameters.
		 */
	config_step: function( ){
		if( (this.pellet_speed_min != undefined ) &&
			(this.pellet_speed_max != undefined ) &&
			(this.stepping_timeout != undefined ) ){
			
			this._pellet_step_min =
				this.pellet_speed_min * this.stepping_timeout / 1000;
			this._pellet_step_max =
				this.pellet_speed_max * this.stepping_timeout / 1000;
		}
	},
	
		/* config_pellet_center_x: void
		 * Updates pellet center.
		 */
	config_pellet_center_x: function( ){
		if( (this.pellet_trail_length != undefined ) &&
			(this.pellet_glow_radius != undefined ) ){
			
			this._pellet_center_x = Math.max(this.pellet_trail_length,
											this.pellet_glow_radius);
			this.config_screen_end();
		}
	},
	
	/* **** 4. Signal Handlers ************************************************/
	_sh_plane_settings_changed: function( settings, key ){
		switch( key ){
		case 'offset':
			this.set_offset.apply( this,
								   settings.get_value( key ).deep_unpack() );
			break;
		case 'stepping-timeout':
			this.set_stepping_timeout( settings.get_int( key ) );
			break;
		case 'spawn-timeout':
			this.set_spawn_timeout( settings.get_int( key ) );
			break;
		case 'spawn-probability':
			this.set_spawn_probability( settings.get_double( key ) );
			break;
		case 'speed':
			this.set_pellet_speed.apply( this,
				settings.get_value( key ).deep_unpack() );
			break;
		case 'pellet-directions':
			this.set_pellet_directions( settings.get_strv( key ) );
			break;
		}
		this._settings.sync();
		this._pellet_settings.sync();
	},
	
	_sh_pellet_settings_changed: function( settings, key ){
		switch( key ){
		case 'colors':
			this.set_pellet_colors( settings.get_strv( key ) );
			break;
		case 'default-alpha':
			this.set_pellet_default_alpha( settings.get_double( key ) );
			break;
		case 'width':
			this.set_pellet_width( settings.get_double( key ) );
			break;
		case 'trail-length':
			this.set_pellet_trail_length( settings.get_double( key ) );
			break;
		case 'glow-radius':
			this.set_pellet_glow_radius( settings.get_double( key ) );
			break;
		}
		this._settings.sync();
	},
	
	/* **** 5. Internal Operations ********************************************/
		/* set_pellet_step: void
		 * sets pellet stepping size. Pellets move a step every stepping
		 * timeout.
		 * If you need to adjust pellet speed, use set_pellet_speed() instead of
		 * this, as step is automatic adjusted by speed and stepping timeout.
		 *
		 * _min: double	: minimum step size.
		 * _max: double	: maximum step size.
		 */
	set_pellet_step: function( _min, _max ){
		this._pellet_step_min = _min;
		this._pellet_step_max = _max;
	},
	
		/* do_step: void
		 * moves pellets a step.
		 * This function is callback function for timeout source.
		 */
	do_step: function(){
		this._pellet_pool.foreach( function( obj ){
			obj.move_step( );
		} );
		this._pellet_pool.recycle_if( this.is_out.bind( this ) );
		return true;
	},
		/** pellet_spawn: void
		 * Spawn a pellet at edge of screen from pool. If no pellet is idle, It
		 * doesn't spawn any pellet.
		 * This function is callback function for timeout source.
		 */
	pellet_spawn: function( ){
		var spawnee = this._pellet_pool.retrive( );
		
		if( spawnee != null ){

			if( Math.random() > this.spawn_probability ) return true;
			let rand_dir_pick =
				GLib.random_int_range( 0, this.pellet_directions.length );
			let rand_dir = this.pellet_directions[ rand_dir_pick ];
			
			let rand_col = GLib.random_int_range( 0, this._pellet_srcs.length );
		
			let rand_spd = GLib.random_double_range(this._pellet_step_min,
													this._pellet_step_max);
			let rand_pos;


			// Setting basic property
	
			spawnee.actor.rotation_angle_z = rand_dir*90 ;
	
			// Put on starting place.
			switch( rand_dir ){
			case Direction.LEFT:
				rand_pos = this.index_2_pos(
					GLib.random_int_range(0, this._xindexe) );
				spawnee._step_x = -rand_spd;
				spawnee._step_y = 0;
				spawnee.actor.x = this.swidth + this.pellet_glow_radius;
				spawnee.actor.y = rand_pos;
				break;
			case Direction.RIGHT:
				rand_pos = this.index_2_pos(
					GLib.random_int_range(0, this._xindexe) );
				spawnee._step_x = rand_spd;
				spawnee._step_y = 0;
				spawnee.actor.x = -this.pellet_glow_radius;
				spawnee.actor.y = rand_pos;
				break;
			case Direction.UP:
				rand_pos = this.index_2_pos(
					GLib.random_int_range(0, this._yindexe) );
				spawnee._step_x = 0;
				spawnee._step_y = -rand_spd;
				spawnee.actor.x = rand_pos;
				spawnee.actor.y = this.sheight + this.pellet_glow_radius;
				break;
			case Direction.DOWN:
				rand_pos = this.index_2_pos(
					GLib.random_int_range(0, this._yindexe) );
				spawnee._step_x = 0;
				spawnee._step_y = rand_spd;
				spawnee.actor.x = rand_pos;
				spawnee.actor.y = -this.pellet_glow_radius;
				break;
			}
			
			// Set pellet source
			spawnee.set_source( this._pellet_srcs[ rand_col ] );
			spawnee.actor.visible = true;
		}
		return true;
	},
	
	/* **** 6. Internal Utility Functions *************************************/
		/* index_2_pos: int
		 * convert indexed position to pixel-based position.
		 *
		 * index: int		: index of place.
		 * Return: double	: position of index.
		 */
	index_2_pos : function( index ) {
		return index * this.pellet_width;
	},
	
		/* is_out: bool
		 * checks whether pellet is out of plane.
		 * Returns: bool	: Whether it is out of screen and getting more farther
		 *					  the plane.
		 */
	is_out: function( child ) {
		let x = child.actor.x;
		let y = child.actor.y;
	
		let res;
		
		//TODO: remove_out this code
		res = ( x <= -(this._pellet_center_x) ) || ( (this._sxend ) <= x ) ||
			  ( y <= -(this._pellet_center_x) ) || ( (this._syend ) <= y );
		return res;
	},
	
		/* direction_map: Array
		 * constructs Array for direction from setting value to use in callback
		 * functions.
		 *
		 * directions: Array	: Array of int or string representations.
		 * Returns: Array		: Array of int value.
		 */
	direction_map: function( directions ){
		let result = new Array();

		for( let i in directions ){
			let dirstr =  directions[i].toUpperCase();
			if( dirstr in Direction ){
				let dirnum = Direction[ dirstr ];
					//If dirnum isn't exist in result, add it
				if( result.indexOf( dirnum ) == -1 ) result.push(dirnum);
			}
		}
		if( result.length == 0 ){
			return [Direction.LEFT, Direction.DOWN,
					Direction.RIGHT, Direction.UP];
		}
		return result;
	}
}
