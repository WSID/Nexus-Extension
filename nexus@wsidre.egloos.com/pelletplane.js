
// Include Statements.
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;

const Lang = imports.lang;
const Main = imports.ui.main;

const Ext = imports.ui.extensionSystem.extensions['nexus@wsidre.egloos.com'];
	const Pool = Ext.pool;

/* **** 3. PelletPlane.		***** */
function PelletPlane( ){
	this._init( );
}

PelletPlane.prototype = {
	//TODO: add add_pellet_source()


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
		this.set_pellet_offset( offset_x, offset_y );
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
		this.pellet_directions = this.direction_map( directions );
		
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
	
	set_pellet_width: function( width ){
		this.pellet_width = width;
		for( let psrc in this._pellet_srcs ){
			psrc.set_width( width );
		}
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
													  colors[i] ) );
		}
	},
	
	config_screen_size: function( ){
		this.swidth = global.stage.width;
		this.sheight = global.stage.height;
	
		this.xindexe = Math.ceil(this.swidth / pellet_width);
		this.yindexe = Math.ceil(this.sheight / pellet_width );
	},
	
	do_step: function(){
		pellet_pool.foreach( function( obj ){
			obj.move_step( );
		} );
	
		pellet_pool.recycle_if( function( obj ){
			return this.is_out( obj );
		} );
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
