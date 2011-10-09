
// Include Statements.
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;

const Lang = imports.lang;
const Main = imports.ui.main;

const Ext = imports.ui.extensionSystem.extensions['nexus@wsidre.egloos.com'];
	const Pool = Ext.pool;
	const PelletModule = Ext.pellet;

/* **** 3. PelletPlane.		***** */
function PelletPlane( ){
	this._init( );
}

PelletPlane.prototype = {
	//Basic Information
	//	swidth:							int
	//	sheight:						int
	//	actor:							Clutter.Group
	//Plane Parameters
	//	pool_capacity:					int
	//	offset_x:						double
	//	offset_y:						double
	//	step_duration:					int ( millisecond )
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
	//State
	//	_started:						bool
	//Signal Handlers' IDs
	//	_sigid_screen_change_width:		uint
	//	_sigid_screen_change_height:	uint
	//	_srcid_spawning:				uint
	//	_srcid_stepping:				uint
	_init: function( settings ){
		//Initialize actor
		this.actor = new Clutter.Group();

		//Initialize _pellet_pool and _pellet_srcs		
		this.pool_capacity = settings.get_int('pool-capacity');
		this._pellet_pool = new Pool.Pool( pool_capacity, PelletModule.Pellet );
		this._pellet_srcs = new Array(0);
		
		//Initialize pellet parameters
		this.set_pellet_speed_min( settings.get_double('pellet-speed-min') );
		this.set_pellet_speed_max( settings.get_double('pellet-speed-max') );
		
		this.set_pellet_dimension(	settings.get_double('pellet-width'),
									settings.get_double('pellet-trail-length'),
									settings.get_double('pellet-glow-radius') );
		this.set_pellet_default_alpha( settings.get_double('pellet-default-alpha') );
		this.set_pellet_colors(	settings.get_strv('pellet-colors') );
		this.set_pellet_directions(	settings.get_strv('pellet-directions') );
		
		//Initialize plane paramters
		this.set_offset(	settings.get_double('pellet-offset-x'),
							settings.get_double('pellet-offset-y') );
		this.set_step_duration( settings.get_int('proceed-timeout') );
		this.set_spawn_timeout( settings.get_int('spawn-timeout') );
		this.set_spawn_probability( settings.get_double('spawn-probability') );
		
		this.config_screen_size();
	},
	finalize: function(){
		global.log( "PelletPlane - finalize() called" );
		this.stop();
	},
	start: function(){
		this._sigid_screen_change_width =
			global.stage.connect('notify::width', this.config_screen_size );
		this._sigid_screen_change_height =
			global.stage.connect('notify::height', this.config_screen_size );
		
		this._srcid_spawning =
			Mainloop.add_timeout( this.spawn_timeout, this.pellet_spawn );
		this._srcid_stepping =
			Mainloop.add_timeout( this.step_duration, this.do_step );
		this.actor.visible = true;
		this._started = true;
	},
	stop: function(){
		this.actor.visible = false;
		Mainloop.source_remove( this._srcid_spawning );
		Mainloop.source_remove( this._srcid_stepping );
		global.stage.disconnect( this._sigid_screen_change_width );
		global.stage.disconnect( this._sigid_screen_change_height );
		this._started = false;
	},
	set_offset: function( offset_x, offset_y ){
		let half_width = this.pellet_width / 2;
		this.offset_x = ( ( offset_x + half_width ) % this.width ) - half_width;
		this.offset_y = ( ( offset_y + half_width ) % this.width ) - half_width;
		this.actor.set_anchor_point( -half_width + this.offset_x,
									 -half_width + this.offset_y );
	},
	
	set_step_duration: function( duration ){
		this.step_duration = duration;
		this.config_step();
	},
	
	set_spawn_timeout: function( timeout ){
		Mainloop.source_remove( this._srcid_spawning );
		this.spawn_timeout = timeout;
		this._srcid_spawning = Mainloop.add_timeout( this.do_step );
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
		while( colors.length < this._pellet_srcs ){
			this._pellet_srcs.pop();
		}
		for( i = 0; i < this._pellet_srcs.length ; i++ ){
			this._pellet_srcs[i].set_color( colors[i] );
		}
		for(; i < colors.length; i++ ){
			this._pellet_srcs.push( new PelletSource( this.pellet_width,
													  this.pellet_trail_length,
													  this.pellet_glow_radius,
													  colors[i],
													  this.default_alpha ) );
		}
	},
	
	set_pellet_default_alpha: function( alpha ){
		this.pellet_default_alpha;
		for( let psrc in this._pellet_srcs ){
			psrc.set_default_alpha( alpha );
		}
	},
	
	set_pellet_directions: function( directions ){
		this.pellet_directions = this.direction_map( directions );
	},
	
	set_pellet_width: function( width ){
		this.pellet_width = width;
		for( let psrc in this._pellet_srcs ){
			psrc.set_width( width );
		}
		this.config_step();
	},
	
	set_pellet_trail_length: function( trail_length ){
		this.pellet_trail_length = trail_length;
		for( let psrc in this._pellet_srcs ){
			psrc.set_trail_length( trail_length );
		}
	},
	
	set_pellet_glow_radius: function( glow_radius ){
		this.pellet_glow_radius = glow_radius;
		for( let psrc in this._pellet_srcs ){
			psrc.set_glow_radius( glow_radius );
		}
	},
	
	set_pellet_dimension: function( width, trail_length, glow_radius ){
		this.pellet_width = width;
		this.pellet_trail_length = trail_length;
		this.pellet_glow_radius = glow_radius;
		for( let psrc in this._pellet_srcs ){
			psrc.set_dimension( width, trail_length, glow_radius );
		}
		this.config_step();
	}
	
	config_screen_size: function( ){
		this.swidth = global.stage.width;
		this.sheight = global.stage.height;
		
		if( this.pellet_width != undefined ){
			this.xindexe = Math.ceil(this.swidth / this.pellet_width);
			this.yindexe = Math.ceil(this.sheight / this.pellet_width );
		}
	},
	
	config_step: function( ){
		if( (this.pellet_speed_min != undefined ) &&
			(this.pellet_speed_max != undefined ) &&
			(this.step_duration != undefined ) ){
			
			this._pellet_step_min =
				this.pellet_speed_min * this.step_duration / 1000;
			this._pellet_step_max =
				this.pellet_speed_max * this.step_duration / 1000;
		}
	},
	
	
	set_pellet_step: function( _min, _max ){
		this._pellet_step_min = _min;
		this._pellet_step_max = _max;
	},
	
	do_step: function(){
		_pellet_pool.foreach( function( obj ){
			obj.move_step( );
		} );
	
		_pellet_pool.recycle_if( function( obj ){
			return this.is_out( obj );
		} );
		return true;
	},
		/** pellet_spawn: void
		 * Spawn a pellet at edge of screen from pool. If no pellet is idle, It doesn't
		 * spawn any pellet.
		 */
	pellet_spawn: function( ){
		let spawnee = _pellet_pool.retrive( );
	
		if( spawnee != null ){

			let rand_pick = GLib.random_int_range( 0, this.pellet_direction.length );
			let rand_dir = this.pellet_direction[ rand_pick ];
			let rand_col = GLib.random_int_range( 0, src_pellets.length );
		
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
	},
	
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
