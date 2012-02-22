/* actorwrap.js
 *
 * Contains function to wrap some actor on screen but keep it under any window.
 *
 * You may take out it and use it with your extensions. And you'll want to write
 * this.
 * 	const ActorWrap = imports.ui.extensionSystem['yourextension@yoursite.com'].actorwrap;
 *
 * section index :
 *	1. Core functions
 *	2. Public functions to add or remove actor to wrap.
 */

const Lang = imports.lang;
const Signals = imports.signals;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;

const Ext = imports.ui.extensionSystem.extensions['nexus@wsidre.egloos.com'];

// Module state
var is_setup;

// Arrays of ubplane that wrapped
var subplanes;

// Wrapping actor, one for normal state, one for overview.
var wrap_plane;
var wrap_plane_clone;

// Landmark from gnome shell
var background_plane;
var overview_plane;

// Event filter ( Receives event and Emits other event as response )
var maximized_detector;
var workspace_indexer;

// Signal Handlers to Main.wm, global.screen...
var shandler_screensize_change;
var shandler_kill_switch_workspace;
var shandler_restacked;
var shandler_showing;
var shandler_hidden;

// Signal Handlers to maximized_detector
var shandler_maximized;
var shandler_unmaximized;

var shandler_workspace_count_change;
var shandler_switch_workspace;

// Module state
var paused;
var paused_preserve;
var in_overview;

// Screen size
var swidth;
var sheight;
var soffset;

var size_incremental_per_workspace = 100;

var slide_duration = 0.5;


var shellwm = Main.wm._shellwm;

/* **** 1. Core functions. ****************************************************/

	/* setup: void
	 * Initialize actor wrapper */
function setup( ){
	
	/* Initializes subplanes and actors */
	subplanes = new Array();
	
	wrap_plane = new Clutter.Group();
	wrap_plane_clone = new Clutter.Clone( {source:wrap_plane } );
	
	background_plane = global.background_actor;
	overview_plane = Main.overview._background;
	
	background_plane.get_parent().add_actor(wrap_plane);
	wrap_plane.raise( background_plane );
	
	overview_plane.get_parent().add_actor( wrap_plane_clone );
	wrap_plane_clone.raise( overview_plane );
	wrap_plane_clone.visible = false;
	
	/* Initializes detectors */
	maximized_detector = new MaximizeDetector( Main.wm._shellwm );
	workspace_indexer = new WorkspaceIndexer()
	
	in_overview = false;
	
	calculate_ssize();
	
	/* Connects signals */
		/* When we pick or maximize window, wrap_plane goes over windows.
		 * Therefore, we should take measure to put it under windows. */
	shandler_restacked = global.screen.connect("restacked", shand_wrap_plane_lower );
		
		/* Monkey Patching Main.wm._switchWorkspaceDone() to add some statement,
		 * as wrap_plane tends to raise above windows after switching work-
		 * spaces (and after restacking windows).
		 * Chaining up original function to fit any version of shell.	*/
	Main.wm._switchWorkspaceDone_orig__nexus = Main.wm._switchWorkspaceDone;
	Main.wm._switchWorkspaceDone = function( shellwm ){
		this._switchWorkspaceDone_orig__nexus( shellwm );
		shand_wrap_plane_lower();
	}
	
	
		/* Connect Signal handlers for wrap_plane_clone to show and
		 * hide at right timing.
		 */
	shandler_showing = Main.overview.connect("showing", shand_overview_showing );
	shandler_hidden = Main.overview.connect("hidden", shand_overview_hidden );
	
	maximized_detector.connect_signals_to( Main.wm._shellwm );
	shandler_maximized = maximized_detector.connect( 'maximized', shand_maximized );
	shandler_unmaximized = maximized_detector.connect( 'unmaximized', shand_unmaximized );
	
	workspace_indexer.connect_signals();
	shandler_workspace_count_change = workspace_indexer.connect('count-changed', shand_workspace_count_changed );
	shandler_switch_workspace = workspace_indexer.connect('index-changed', shand_switch_workspace );
	
	shandler_screensize_change = global.stage.connect('notify::allocation', shand_screensize_changed );
	
	maximized_detector.set_from_workspace(
		global.screen.get_workspace_by_index(
			global.screen.get_active_workspace_index() ) );
	is_setup = true;
}

function unsetup( ){
	if( is_setup ){
		
		Main.wm._switchWorkspaceDone = Main.wm._switchWorkspaceDone_orig__nexus;
		delete Main.wm._switchWorkspaceDone_orig__nexus;
		
		workspace_indexer.disconnect( shandler_workspace_count_change );
		workspace_indexer.disconnect( shandler_switch_workspace );
		workspace_indexer.disconnect_signals();
		
		maximized_detector.disconnect( shandler_maximized );
		maximized_detector.disconnect( shandler_unmaximized );
		maximized_detector.disconnect_signals();
		
		global.stage.disconnect( shandler_screensize_change );
	
		Main.overview.disconnect( shandler_showing );
		Main.overview.disconnect( shandler_hidden );
		Main.wm._shellwm.disconnect( shandler_kill_switch_workspace );
		global.screen.disconnect( shandler_restacked );

		wrap_plane.get_parent().remove_actor( wrap_plane );
		wrap_plane_clone.get_parent().remove_actor( wrap_plane_clone );

		for( let a = 0; a < wrap_plane.get_children().length; a++ ){
			wrap_plane.remove_actor( wrap_plane.get_children()[a] );
		}
		wrap_plane = null;
		wrap_plane_clone = null;

		//Releasing external ref
		overview_plane = null;
		background_plane = null;
		is_setup = false;
	}
}

	/** shand_wrap_plane_lower: bool
	 * When windows are restacked and wrap_plane goes on top of them, this
	 * will move it below of them.
	 */
function shand_wrap_plane_lower(){
	wrap_plane.raise( background_plane );
	return false;
}

	/** shand_overview_showing: void
	 * When overview screen is becoming visible, show wrap_plane_clone as if
	 * it was part of overview screen.
	 */
function shand_overview_showing(){
	in_overview = true;
	wrap_plane_clone.visible = true;
	paused_preserve = (paused == undefined) ? false : paused;
	resume();
}

	/** shand_overview_hidden: void
	 * Just like shand_overview_showing() - but it hides wrap_plane_clone and
	 * it is activated when overview screen is gone.
	 */
function shand_overview_hidden(){
	in_overview = false;
	wrap_plane_clone.visible = false;
	if( paused_preserve ) pause();
}


	/** shand_maximized: void
	 * When Maximized state detected.
	 */
function shand_maximized(){
	if( in_overview ) paused_preserve = true;
	else pause();
}
	/** shand_unmaximized: void
	 * When Unmaximized state detected.
	 */
function shand_unmaximized(){
	if( in_overview ) paused_preserve = false;
	else resume();
}

	/** shand_screensize_changed: void
	 * When screen resolution is changed, it updates screen size it kepts.
	 *
	 * screen: Meta.Screen:			signal source.
	 * pspec: GObject.ParamSpec:	property spec.
	 */
function shand_screensize_changed( screen, pspec ){

	calculate_ssize();
	for( var i = 0; i < subplanes.length; i++ )
		subplanes[i].set_size( swidth, sheight );
}

	/** shand_workspace_count_changed: void
	 * When workspaces are increased or decreased, it updates plane heights to
	 * provide constant shifting amount when switching workspaces.
	 *
	 * windexer: WorkspaceIndexer:	signal source.
	 * count: int:					workspace count.
	 */
function shand_workspace_count_changed( windexer, count ){
	sheight = global.stage.height +
		( (count - 1) * size_incremental_per_workspace );
	for( var i = 0; i < subplanes.length; i++ )
		subplanes[i].set_size( swidth, sheight );
}

	/** shand_switch_workspace: void
	 * When switching workspace, put sliding animation to planes.
	 *
	 * shellwm: Shell.WM:	signal source.
	 * to: int:				index of destination workspace.
	 */
function shand_switch_workspace( shellwm, to ){
	let anim_param = { time:		slide_duration,
					   transition:	'easeOutQuad',
					   onComplete:	shand_switch_workspace_tween_completed,
					   y: -(size_incremental_per_workspace * to) };
	
	Tweener.addTween( wrap_plane, anim_param );
	Tweener.addTween( wrap_plane_clone, anim_param );
}

	/** shand_switch_workspace_tween_completed: void
	 * When animation during switching workspace done, removes tweens from it.
	 */
function shand_switch_workspace_tween_completed( ){
	Tweener.removeTweens( this );
}

	/** calculate_ssize: void
	 * Updates screen size and offset according to global.stage size and current
	 * index of workspace.
	 */
function calculate_ssize(){
	swidth = global.stage.width;
	sheight = global.stage.height +
		((global.screen.get_n_workspaces() - 1) *
			size_incremental_per_workspace );
	soffset = global.screen.get_active_workspace_index() *
		size_incremental_per_workspace;
	
	wrap_plane.y =  -soffset;
	wrap_plane_clone.y = -soffset;
}

/* **** 2. Public functions to add or remove actor to wrap. *******************/
	/** add_actor: void
	 * Adds actor to wrap.
	 * Added actor will be resized according to screen size, count of workspaces.
	 *
	 * actor: Clutter.Actor:	Actor to be managed.
	 */
function add_actor( actor ){
	wrap_plane.add_actor( actor );
}

	/** remove_actor: void
	 * Removes actor being wrapped.
	 *
	 * actor: Clutter.Actor:	Actor to be removed.
	 */
function remove_actor( actor ){
	wrap_plane.remove_actor( actor );
}

	/** add_plane: void
	 * Adds plane to wrap.
	 *
	 * plane: PelletPlane:	Plane to be managed.
	 */
function add_plane( plane ){
	subplanes.push( plane );
	wrap_plane.add_actor( plane.actor );
	plane.set_size( swidth, sheight );
}

	/** remove_plane: void
	 * Removes plane to wrap.
	 *
	 * plane: PelletPlane: Plane to be removed.
	 */
function remove_plane( plane ){
	subplanes.pop( plane );
	wrap_plane.remove_actor( plane.actor );
}

function pause(){
	for( let i = 0; i < subplanes.length ; i++ ){
		subplanes[i].pause();
	}
	paused = true;
}

function resume(){
	for( let i = 0; i < subplanes.length ; i++ ){
		subplanes[i].resume();
	}
	paused = false;
}


/* **** 3. Classes ************************************************************/

	/* MaximizeDetector: object
	 * Detects if the windows has been maximized and emits signals.
	 *
	 * Tiled windows are treated specially - if two ( or more ) windows are
	 * tiled and placed both of side, they are considered to be maximized.
	 *
	 * Signals:
	 *	maximized() : void		: emitted when one of windows wrap screen.
	 *	unmaximized() : void	: emitted when all maximized windows
	 *							 unmaximized.
	 */
function MaximizeDetector( workspace ){
	this._init( workspace );
}

MaximizeDetector.prototype = {
	// In Class Constants
	CONNECT_LIST: new Array('minimize', 'maximize', 'unmaximize', 'map',
							'destroy', 'switch-workspace' ),
	
	
	_init: function( workspace ){
		this.maximized_list = new Array();
		this.lefttiled_list = new Array();
		this.righttiled_list = new Array();
		
		this.maximized = false;
		
		//If it is initialized without workspaces, starts with 0th workspace.
		if( workspace == undefined )
			workspace = global.screen.get_workspace_by_index( 0 );
	},
	
		/* connect_signals_to: void
		 * Connects handlers to necessary signals in order to detect maximized
		 * state.
		 */
	connect_signals_to: function( shellwm ){
		if( '_shandlers' in this ) return;
		
		this._shellwm = shellwm;
		this._shandlers = new Array();
		
		for( let i in this.CONNECT_LIST ){
			let con = this.CONNECT_LIST[i].replace( '-', '_' );
			this._shandlers.push(
				shellwm.connect( this.CONNECT_LIST[i],
								 Lang.bind( this, this[ '_sh_' + con ] ) ) );
		}
	},
	
		/* disconnect_signals: void
		 * Disconnects handlers from signals.
		 */
	disconnect_signals: function( ){
		if( '_shandlers' in this ){
			for( let i in this._shandlers ){
				this._shellwm.disconnect( this._shandlers[i] );
			}
		}
		delete this._shellwm;
		delete this._shandlers;
	},
	
		/* add_window: void
		 * (Try to) add maximized list.
		 * NOTE: maximized windows and tiled windows are added in different lists.
		 *
		 * mwin: Meta.Window	: window to add to.
		 */
	add_window: function( mwin ){
		let list_to_add = null;
		
		if( mwin.is_fullscreen() ){
			list_to_add = this.maximized_list;
		}
		else if( mwin.get_maximized() & Meta.MaximizeFlags.VERTICAL ){
			
			if( mwin.get_maximized() & Meta.MaximizeFlags.HORIZONTAL )
				list_to_add = this.maximized_list;
			
			//If mwin is lefttiled so x is 0
			else if( mwin.get_outer_rect().x == 0 )
				list_to_add = this.lefttiled_list;
			
			//Otherwise ( =righttiled )
			else
				list_to_add = this.righttiled_list;
		}
		else return;
		
		this._ensure_nonexist( mwin, this.maximized_list,
									 this.lefttiled_list,
									 this.righttiled_list )
		if( list_to_add != null )
			list_to_add.push( mwin );
		
		this._check_and_emit_signal();
	},
	
		/* remove_window: void
		 * (Try to) remove from maximized list.
		 *
		 * mwin : Meta.Window	: window to remove from.
		 */
	remove_window: function( mwin ){
		this._ensure_nonexist( mwin, this.maximized_list,
									 this.lefttiled_list,
									 this.righttiled_list )
		
		this._check_and_emit_signal();
	},
	
		/* clean_list: void
		 * Clean out maximized window list.
		 */
	clean_list: function(){
		this._clean_array( this.maximized_list,
						   this.lefttiled_list,
						   this.righttiled_list );
		
		this._check_and_emit_signal();
	},
	
		/* set_from_workspace: void
		 * Adds all maximized windows from workspace to list.
		 * Before adding windows, lists are cleaned.
		 *
		 * workspace: Meta.Workspace	: Workspace to get windows.
		 */
	set_from_workspace: function( workspace ){
		let wlist = workspace.list_windows();
		this.clean_list();
		for( var i = 0; i < wlist.length ; i++ )
			this.add_window( wlist[i] );
		
		this._check_and_emit_signal();
	},
	
	// State changes and notification
	
		/* _check_and_emit_signal: void
		 * checks maximized states and emits signals when needed.
		 */
	_check_and_emit_signal: function( ){
		let old_maximized = this.maximized;
		this.maximized = ( this.maximized_list.length != 0 ) ||
						 ( ( this.lefttiled_list.length != 0 ) &&
						   ( this.righttiled_list.length != 0 ) );
		
		if( ( !old_maximized ) && ( this.maximized ) )
			this.emit("maximized")
		else if( ( old_maximized ) && ( ! this.maximized ) )
			this.emit("unmaximized")
	},
	
	// Signal handlers
	
	_sh_minimize: function( shellwm, actor ){
		this.remove_window( actor.meta_window );
	},
	
	_sh_maximize: function( shellwm, actor ){
		this.add_window( actor.meta_window );
	},
	
	_sh_unmaximize: function( shellwm, actor ){
		this.remove_window( actor.meta_window );
	},
	
	_sh_map: function( shellwm, actor ){
		this.add_window( actor.meta_window );
	},
	
	_sh_destroy: function( shellwm, actor ){
		this.remove_window( actor.meta_window );
	},
	
	_sh_switch_workspace: function( shellwm, from, to, direction ){
		this.set_from_workspace( global.screen.get_workspace_by_index( to ) );
	},
	
	// Private array operations
	
		/* _ensure_nonexist: bool
		 * Checks if element is in arrays and removes it from array.
		 *
		 * element: (anything)	: element to check.
		 * ...: Array...		: arrays to check.
		 *
		 * Return: Whether elemet is in any of arrays.
		 */
	_ensure_nonexist: function( element ){
		for( let i in arguments ){
			for( let j in arguments[i] ){
				if( arguments[i][j] === element ){
					arguments[i].splice( j, 1 );
					return true;
				}
			}
		}
		return false;
	},
	
		/* _clean_array: void
		 * Cleans given arrays.
		 */
	_clean_array: function(){
		for( let i in arguments ){
			arguments[i].splice( 0, arguments[i].length );
		}
	}
};
Signals.addSignalMethods( MaximizeDetector.prototype );



function WorkspaceIndexer(){
	this._init();
}

WorkspaceIndexer.prototype = {
	//Signals
	//
	// for convenience, count-changed is emitted first, and index-changed is
	// emitted when both of them are emitted.
	//count-changed()
	//index-changed()
	
	_init: function(){
		
	},
	
	connect_signals: function(){
		this.shandler_count_changed = global.screen.connect(
			'notify::n-workspaces',
			Lang.bind( this, this._sh_workspace_count_changed ) );
		
		this.shandler_switched = Main.wm._shellwm.connect(
			'switch-workspace',
			Lang.bind( this, this._sh_workspace_switched ) );
	},
	
	disconnect_signals: function(){
		global.screen.disconnect( this.shandler_count_changed );
		Main.wm._shellwm.disconnect( this.shandler_switched );
		delete this.shandler_count_changed;
		delete this.shandler_switched;
	},
	
	_sh_workspace_count_changed: function( screen, pspec ){
		this.emit_with_count_index(
			global.screen.get_n_workspaces(),
			global.screen.get_active_workspace_index() );
	},
	
	_sh_workspace_switched: function( wm, from, to, direction ){
		this.emit_with_count_index(
			global.screen.get_n_workspaces(),
			global.screen.get_active_workspace_index() );
	},
	
	emit_with_count_index: function( new_wcount, new_windex ){
		
		if( this.workspace_count != new_wcount )
			this.emit('count-changed', new_wcount );
		if( this.workspace_index != new_windex )
			this.emit('index-changed', new_windex );
		
		this.workspace_count = new_wcount;
		this.workspace_index = new_windex;
	}
};
Signals.addSignalMethods( WorkspaceIndexer.prototype );

