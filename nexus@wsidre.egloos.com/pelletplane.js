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

function PelletPlane( settings ){
	this._init( settings );
}

PelletPlane.prototype = {
	//Basic Information
	//	swidth:							int				: screen width.
	//	sheight:						int				: screen height.
	//	actor:							Clutter.Group	: real actor of it.
	//Plane Parameters
	//	pool_capacity:					int
	//	offset_x:						double
	//	offset_y:						double
	//	stepping_timeout:					int ( millisecond )
	//	spawn_timeout:					int ( millisecond )
	//	spawn_probability:				double ( 0 ~ 1 )
	//Pellet Parameters
	//	pellet_speed_min:				double
	//	pellet_speed_max:				double
	//	pellet_colors:					Something means color[]
	//	pellet_default_alpha			double
	//	pellet_width:					double
	//	pellet_trail_length:			double
	//	pellet_glow_radius:				double
	//	pellet_directions:				(int from Direction)[]
	//Internal Processing variable
	//	_pellet_pool:					Pool<Pellet>
	//	_pellet_srcs:					PelletSource[]
	//	_xindexe:						int
	//	_yindexe:						int
	//	_pellet_step_min:				double
	//	_pellet_step_max:				double
	//	_is_postponed_color_init:		bool
	//	_settings:						Gio.Settings
	//	_pellet_settings:				Gio.Settings
	//	_sxend:
	//	_syend:
	//State
	//	_started:						bool
	//	_paused:						bool
	//Signal Handlers' IDs
	//	_sigid_screen_change_width:		uint
	//	_sigid_screen_change_height:	uint
	//	_srcid_spawning:				uint
	//	_srcid_stepping:				uint
	//	_sigid_settings:				uint
	//	_sigid_pellet_settings:			uint
	
	_init: function( settings ){
		//Initialize actors
		this.actor = new Clutter.Group();
		
		//Initialize _settings
		this._settings = settings;
		this._pellet_settings = settings.get_child( 'pellet' );
		this._sigid_settings =
			this._settings.connect('changed',
				this.sigh_plane_settings_changed.bind( this ) );
		this._sigid_pellet_settings =
			this._pellet_settings.connect('changed',
				this.sigh_pellet_settings_changed.bind( this ) );
		
		//Initialize _pellet_pool and _pellet_srcs
		this.pool_capacity = settings.get_int('pool-capacity');
		this._pellet_pool = new Pool.Pool( this.pool_capacity, Pellet.Pellet );
		this._pellet_pool.foreach_full( Lang.bind(this, function( obj ){
			obj.actor.visible = false;
			this.actor.add_actor( obj.actor );
		} ) );
		this._pellet_srcs = new Array(0);
		
		//Set pellet parameters from settings
		this.set_pellet_speed_min(	this._settings.get_double('speed-min') );
		this.set_pellet_speed_max(	this._settings.get_double('speed-max') );
		
		this.set_pellet_dimension(	this._settings.get_double('pellet-width'),
									this._settings.get_double('pellet-trail-length'),
									this._settings.get_double('pellet-glow-radius') );
		this.set_pellet_default_alpha(	this._settings.get_double('pellet-default-alpha') );
		this.set_pellet_colors(	this._settings.get_strv('pellet-colors') );
		this.set_pellet_directions(	this._settings.get_strv('pellet-directions') );
		
		//Set plane paramters from settings
		this.set_offset(	this._settings.get_double('pellet-offset-x'),
							this._settings.get_double('pellet-offset-y') );
		this.set_stepping_timeout(	this._settings.get_int('proceed-timeout') );
		this.set_spawn_timeout(	this._settings.get_int('spawn-timeout') );
		this.set_spawn_probability(	this._settings.get_double('spawn-probability') );

	},
	start: function(){
		if( !this._started ){
		
			if( ! this._paused ){
				this._srcid_spawning =
					Mainloop.timeout_add( this.spawn_timeout, Lang.bind(this, this.pellet_spawn) );
				this._srcid_stepping =
					Mainloop.timeout_add( this.stepping_timeout, Lang.bind(this, this.do_step) );
			}
			this.actor.visible = true;
			
			if( this._is_postponed_color_init )
				this.set_pellet_colors(this.pellet_colors);
			
			this._started = true;
		}
	},
	stop: function(){
		if( this._started ){
			this.actor.visible = false;
			Mainloop.source_remove( this._srcid_spawning );
			Mainloop.source_remove( this._srcid_stepping );
		
			this._started = false;
		}
	},
	resume: function(){
		if( this._paused ){
			this._srcid_spawning =
				Mainloop.timeout_add( this.spawn_timeout, Lang.bind(this, this.pellet_spawn) );
			this._srcid_stepping =
				Mainloop.timeout_add( this.stepping_timeout, Lang.bind(this, this.do_step) );
			this._paused = false;
		}
	},
	pause: function(){
		if( ! this._paused ){
			Mainloop.source_remove( this._srcid_spawning );
			Mainloop.source_remove( this._srcid_stepping );
			this._paused = true;
		}
	},
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

	set_stepping_timeout: function( duration ){
		this.stepping_timeout = duration;
		
		if( this._started ){
			Mainloop.source_remove( this._srcid_stepping );
			this._srcid_stepping =
				Mainloop.timeout_add( this.stepping_timeout, Lang.bind(this, this.do_step) );
		}
		this.config_step();
	},
	
	set_spawn_timeout: function( timeout ){
		this.spawn_timeout = timeout;
		
		if( this._started ){
			Mainloop.source_remove( this._srcid_spawning );
			this._srcid_spawning =
				Mainloop.timeout_add( this.spawn_timeout, Lang.bind(this, this.pellet_spawn) );
		}
	},
	set_spawn_probability: function( probability ){
		this.spawn_probability = probability;
	},
	
	set_pellet_speed_min: function( speed ){
		this.pellet_speed_min = speed;
		this.config_step();
	},
	
	set_pellet_speed_max: function( speed ){
		this.pellet_speed_max = speed;
		this.config_step();
	},
	
	set_pellet_colors: function( colors ){
		let i;
		
		this.pellet_colors = colors;
		if( this.actor.get_parent() == null ){
			this._is_postponed_color_init = true;
			return;
		}
			//If count of the color is decreased,
			// drop some of pellet sources to have same count of it.
		while( colors.length < this._pellet_srcs ){
			this._pellet_srcs.pop();
		}
			//Setting color of pellet sources.
		for( i = 0; i < this._pellet_srcs.length ; i++ ){
			this._pellet_srcs[i].set_color( colors[i] );
		}
			//If count of the color is increased,
			// add new pellet sources to have same count of it.
		for(; i < colors.length; i++ ){
			let pellet_src =
				new Pellet.PelletSource(this.pellet_width,
										this.pellet_trail_length,
										this.pellet_glow_radius,
										colors[i],
										this.pellet_default_alpha );
			this._pellet_srcs.push( pellet_src );
			
				//Add pellet source to realize it.
			this.actor.add_actor( pellet_src.actor );
			pellet_src._paint();
			pellet_src.actor.visible = false;
		}
		this._is_postponed_color_init = false;
	},
	
	set_pellet_default_alpha: function( alpha ){
		this.pellet_default_alpha = alpha;
		for( let i = 0; i < this._pellet_srcs.length ; i++ ){
			this._pellet_srcs[i].set_default_alpha( alpha );
		}
	},
	
	set_pellet_directions: function( directions ){
		this.pellet_directions = this.direction_map( directions );
	},
	
	set_pellet_width: function( width ){
		this.pellet_width = width;
		for( let i = 0; i < this._pellet_srcs.length ; i++ ){
			this._pellet_srcs[i].set_width( width );
		}
		this.config_step();
		this.config_pellet_position();
	},
	
	set_pellet_trail_length: function( trail_length ){
		this.pellet_trail_length = trail_length;
		for( let i = 0; i < this._pellet_srcs.length ; i++ ){
			this._pellet_srcs[i].set_trail_length( trail_length );
		}
		this.config_pellet_center_x();
	},
	
	set_pellet_glow_radius: function( glow_radius ){
		this.pellet_glow_radius = glow_radius;
		for( let i = 0; i < this._pellet_srcs.length ; i++ ){
			this._pellet_srcs[i].set_glow_radius( glow_radius );
		}
		this.config_pellet_center_x();
	},
	
	set_pellet_dimension: function( width, trail_length, glow_radius ){
		this.pellet_width = width;
		this.pellet_trail_length = trail_length;
		this.pellet_glow_radius = glow_radius;
		for( let i = 0; i < this._pellet_srcs.length ; i++ ){
			this._pellet_srcs[i].set_dimension( width, trail_length, glow_radius );
		}
		this.config_step();
		this.config_pellet_center_x();
	},
	
	set_size: function( swidth, sheight ){
		this.swidth = swidth;
		this.sheight = sheight;
		
		this.config_pellet_position();
		this.config_screen_end();
	},
	
	config_pellet_position: function(){
		if( this.swidth != undefined &&
			this.sheight != undefined &&
			this.pellet_width != undefined ){
			
			this.xindexe = Math.ceil(this.swidth / this.pellet_width);
			this.yindexe = Math.ceil(this.sheight / this.pellet_width );
		}
	},
	
	config_screen_end: function( ){
		if( this.swidth != undefined &&
			this.sheight != undefined &&
			this._pellet_center_x != undefined ){
			
			this._sxend = this.swidth + this._pellet_center_x;
			this._syend = this.sheight + this._pellet_center_x;
		}
	},
	
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
	
	config_pellet_center_x: function( ){
		if( (this.pellet_trail_length != undefined ) &&
			(this.pellet_glow_radius != undefined ) ){
			
			this._pellet_center_x = Math.max(this.pellet_trail_length,
											this.pellet_glow_radius);
			this.config_screen_end();
		}
	},
	
	sigh_plane_settings_changed: function( settings, key ){
			if( ! settings ) global.log( "Is there settings had been null?" );
		switch( key ){
		case 'offset':
			this.set_offset.apply( this, settings.get_value( key ).deep_unpack() );
			 
			settings.disconnect( this._sigid_settings );
			settings.set_double( 'pellet-offset-x', this.offset_x );
			settings.set_double( 'pellet-offset-y', this.offset_y );
			this._sigid_settings = settings.connect( 'changed', this.sigh_plane_settings_changed.bind( this ) );
			break;
		case 'stepping-timeout':
			this.set_stepping_timeout( settings.get_int( key ) );
			
			settings.disconnect( this._sigid_settings );
			settings.set_int( 'proceed-timeout', this.stepping_timeout );
			this._sigid_settings = settings.connect( 'changed', this.sigh_plane_settings_changed.bind( this ) );
			break;
		case 'spawn-timeout':
			this.set_spawn_timeout( settings.get_int( key ) );
			break;
		case 'spawn-probability':
			this.set_spawn_probability( settings.get_double( key ) );
			break;
		case 'speed':
			let speed = settings.get_value( key ).deep_unpack();
			global.log( "a: " + speed[0] + ", b: " + speed[1] );
			this.set_pellet_speed_min( speed[0] );
			this.set_pellet_speed_max( speed[1] );
			
			settings.disconnect( this._sigid_settings );
			settings.set_double( 'speed-min', this.pellet_speed_min );
			settings.set_double( 'speed-max', this.pellet_speed_max );
			this._sigid_settings = settings.connect( 'changed', this.sigh_plane_settings_changed.bind( this ) );
			break;
		case 'pellet-directions':
			this.set_pellet_directions( settings.get_strv( key ) );
			break;

		//Obsolete setting keys.
		case 'pellet-offset-x':
			this.set_offset( settings.get_double( key ), this.offset_y );
			
			settings.disconnect( this._sigid_settings );
			settings.set_value( 'offset',
				new GLib.Variant.new( '(dd)', [this.offset_x, this.offset_y] ) );
			this._sigid_settings = settings.connect( 'changed', this.sigh_plane_settings_changed.bind( this ) );
			break;
		case 'pellet-offset-y':
			this.set_offset( this.offset_x, settings.get_double( key ) );
			
			settings.disconnect( this._sigid_settings );
			settings.set_value( 'offset',
				new GLib.Variant.new( '(dd)', [this.offset_x, this.offset_y] ) );
			this._sigid_settings = settings.connect( 'changed', this.sigh_plane_settings_changed.bind( this ) );
			break;
		case 'speed-min':
			this.set_pellet_speed_min( settings.get_double( key ) );
			
			settings.disconnect( this._sigid_settings );
			settings.set_value( 'speed',
				new GLib.Variant.new( '(dd)', [this.pellet_speed_min, this.pellet_speed_max] ) );
			this._sigid_settings = settings.connect( 'changed', this.sigh_plane_settings_changed.bind( this ) );
			break;
		case 'speed-max':
			this.set_pellet_speed_max( settings.get_double( key ) );
			
			settings.disconnect( this._sigid_settings );
			settings.set_value( 'speed',
				new GLib.Variant.new( '(dd)', [this.pellet_speed_min, this.pellet_speed_max] ) );
			this._sigid_settings = settings.connect( 'changed', this.sigh_plane_settings_changed.bind( this ) );
			break;
		case 'proceed-timeout':
			this.set_stepping_timeout( settings.get_int( key ) );
			
			settings.disconnect( this._sigid_settings );
			settings.set_int( 'stepping-timeout', this.stepping_timeout );
			this._sigid_settings = settings.connect( 'changed', this.sigh_plane_settings_changed.bind( this ) );
			break;
		//Relocated setting keys from up-level settings.
		case 'pellet-colors':
			this.set_pellet_colors( settings.get_strv( key ) );
			
			this._pellet_settings.disconnect( this._sigid_pellet_settings );
			this._pellet_settings.set_strv( 'colors', this.pellet_colors );
			this._sigid_pellet_settings = this._pellet_settings.connect( 'changed', this.sigh_pellet_settings_changed.bind( this )  );
			break;
		case 'pellet-default-alpha':
			this.set_pellet_default_alpha( settings.get_double( key ) );
			
			this._pellet_settings.disconnect( this._sigid_pellet_settings );
			this._pellet_settings.set_double( 'default-alpha', this.pellet_default_alpha );
			this._sigid_pellet_settings = this._pellet_settings.connect( 'changed', this.sigh_pellet_settings_changed.bind( this )  );
			break;
		case 'pellet-width':
			this.set_pellet_width( settings.get_double( key ) );
			
			this._pellet_settings.disconnect( this._sigid_pellet_settings );
			this._pellet_settings.set_double( 'width', this.pellet_width );
			this._sigid_pellet_settings = this._pellet_settings.connect( 'changed', this.sigh_pellet_settings_changed.bind( this )  );
			break;
		case 'pellet-trail-length':
			this.set_pellet_trail_length( settings.get_double( key ) );
			
			this._pellet_settings.disconnect( this._sigid_pellet_settings );
			this._pellet_settings.set_double( 'trail-length', this.pellet_trail_length );
			this._sigid_pellet_settings = this._pellet_settings.connect( 'changed', this.sigh_pellet_settings_changed.bind( this )  );
			break;
		case 'pellet-glow-radius':
			this.set_pellet_glow_radius( settings.get_double( key ) );
			
			this._pellet_settings.disconnect( this._sigid_pellet_settings );
			this._pellet_settings.set_double( 'glow-radius', this.pellet_glow_radius );
			this._sigid_pellet_settings = this._pellet_settings.connect( 'changed', this.sigh_pellet_settings_changed.bind( this )  );
			break;
		}
		this._settings.sync();
		this._pellet_settings.sync();
	},
	
	sigh_pellet_settings_changed: function( settings, key ){
		switch( key ){
		case 'colors':
			this.set_pellet_colors( settings.get_strv( key ) );
			
			this._settings.disconnect( this._sigid_settings );
			this._settings.set_strv( 'pellet-colors', this.pellet_colors );
			this._sigid_settings = this._settings.connect( 'changed' , this.sigh_plane_settings_changed.bind( this ) );
			break;
		case 'default-alpha':
			this.set_pellet_default_alpha( settings.get_double( key ) );
			
			this._settings.disconnect( this._sigid_settings );
			this._settings.set_double( 'pellet-default-colors', this.pellet_default_alpha );
			this._sigid_settings = this._settings.connect( 'changed' , this.sigh_plane_settings_changed.bind( this ) );
			break;
		case 'width':
			this.set_pellet_width( settings.get_double( key ) );
			
			this._settings.disconnect( this._sigid_settings );
			this._settings.set_double( 'pellet-width', this.pellet_width );
			this._sigid_settings = this._settings.connect( 'changed' , this.sigh_plane_settings_changed.bind( this ) );
			break;
		case 'trail-length':
			this.set_pellet_trail_length( settings.get_double( key ) );
			
			this._settings.disconnect( this._sigid_settings );
			this._settings.set_double( 'pellet-trail-length', this.pellet_trail_length );
			this._sigid_settings = this._settings.connect( 'changed' , this.sigh_plane_settings_changed.bind( this ) );
			break;
		case 'glow-radius':
			this.set_pellet_glow_radius( settings.get_double( key ) );
			
			this._settings.disconnect( this._sigid_settings );
			this._settings.set_double( 'pellet-glow-radius', this.pellet_glow_radius );
			this._sigid_settings = this._settings.connect( 'changed' , this.sigh_plane_settings_changed.bind( this ) );
			break;
		}
		this._settings.sync();
	},
	
	set_pellet_step: function( _min, _max ){
		this._pellet_step_min = _min;
		this._pellet_step_max = _max;
	},
	
	do_step: function(){
		this._pellet_pool.foreach( function( obj ){
			obj.move_step( );
		} );
		this._pellet_pool.recycle_if( this.is_out.bind( this ) );
		return true;
	},
		/** pellet_spawn: void
		 * Spawn a pellet at edge of screen from pool. If no pellet is idle, It doesn't
		 * spawn any pellet.
		 */
	pellet_spawn: function( ){
		var spawnee = this._pellet_pool.retrive( );
		
		if( spawnee != null ){

			if( Math.random() > this.spawn_probability ) return true;
			let rand_pick = GLib.random_int_range( 0, this.pellet_directions.length );
			let rand_dir = this.pellet_directions[ rand_pick ];
			let rand_col = GLib.random_int_range( 0, this._pellet_srcs.length );
		
			let rand_spd = GLib.random_double_range(this._pellet_step_min, this._pellet_step_max);
			let rand_pos;


			// Setting basic property
	
			spawnee.actor.rotation_angle_z = rand_dir*90 ;
	
			// Put on starting place.
			switch( rand_dir ){
			case Direction.LEFT:
				rand_pos = this.index_2_pos( GLib.random_int_range(0, this.xindexe) );
				spawnee._step_x = -rand_spd;
				spawnee._step_y = 0;
				spawnee.actor.x = this.swidth + this.pellet_glow_radius;
				spawnee.actor.y = rand_pos;
				break;
			case Direction.RIGHT:
				rand_pos = this.index_2_pos( GLib.random_int_range(0, this.xindexe) );
				spawnee._step_x = rand_spd;
				spawnee._step_y = 0;
				spawnee.actor.x = -this.pellet_glow_radius;
				spawnee.actor.y = rand_pos;
				break;
			case Direction.UP:
				rand_pos = this.index_2_pos( GLib.random_int_range(0, this.yindexe) );
				spawnee._step_x = 0;
				spawnee._step_y = -rand_spd;
				spawnee.actor.x = rand_pos;
				spawnee.actor.y = this.sheight + this.pellet_glow_radius;
				break;
			case Direction.DOWN:
				rand_pos = this.index_2_pos( GLib.random_int_range(0, this.yindexe) );
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
		/** index_2_pos: int
		 * index:	int:	index of place.
		 * Return:	double:	position of index.
		 */
	index_2_pos : function( index ) {
		return index * this.pellet_width;
	},
	
		/** is_out: bool
		 * Returns:	bool:	Whether it is out of screen and getting more farther
		 *					the screen.
		 */
	is_out: function( child ) {
		let x = child.actor.x;
		let y = child.actor.y;
	
		let res;
		
		//TODO: remove_out this code
		res = ( x <= -(this._pellet_center_x) ) || ( (this._sxend ) <= x ) ||
			  ( y <= -(this._pellet_center_x) ) || ( (this._syend ) <= y);
		return res;
	},
	
	direction_map: function( directions ){
		let result = new Array();

		for( let i = 0; i < directions.length ; i++ ){
			let dirstr =  directions[i].toUpperCase();
			if( dirstr in Direction ){
				let dirnum = Direction[ dirstr ];
					//If dirnum isn't exist in result, add it
				if( result.indexOf( dirnum ) == -1 ) result.push(dirnum);
			}
		}
		if( result.length == 0 ){
			return [Direction.LEFT, Direction.DOWN, Direction.RIGHT, Direction.UP];
		}
		return result;
	}
}
