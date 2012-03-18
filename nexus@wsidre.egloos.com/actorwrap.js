/* actorwrap.js
 *
 * Contains function to wrap some actor on screen but keep it under any window.
 *
 * You may take out it and use it with your extensions. And you'll want to write
 * this.
 * 	const ActorWrap = imports.ui.extensionSystem['yourextension@yoursite.com'].actorwrap;
 *
 * section index :
 * 1. setup, unsetup functions.
 * 2. Public functions to add or remove actor to wrap.
 * 3. Setter Functions.
 * 4. Signal Handlers.
 * 5. Classes.
 */

const Lang = imports.lang;
const Signals = imports.signals;

const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;

const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const WindowManager = imports.ui.windowManager;

const Ext = imports.ui.extensionSystem.extensions['nexus@wsidre.egloos.com'];

// Module state
var is_setup;

// Arrays of ubplane that wrapped
var subplanes;

// Wrapping actor, one for normal state, one for overview.
var wrap_plane;
var wrap_plane_clone;

// Important actors from gnome shell
var background_plane;
var overview_plane;

// Event filter ( Receives event and Emits other event as response )
var maximized_detector;
var workspace_indexer;

// Signal Handlers to Main.wm, global.screen...
var _shid_screensize_change;
var _shid_restacked;
var _shid_showing;
var _shid_hidden;

// Signal Handlers to maximized_detector and workspace_indexer
var _shid_maximized;
var _shid_unmaximized;

var _shid_workspace_count_change;
var _shid_switch_workspace;

// Signal Handlers to settings.
var _shid_settings_changed;

// Module state
var paused;
var paused_preserve;
var in_overview;

// Plane size
var plane_width;
var plane_height;
var plane_offset;

// Setting values
var sliding_height;
var sliding_duration;

/* **** 1. setup, unsetup functions. ******************************************/

	/* setup: void
	 * Initialize actor wrapper */
function setup( settings ){
	// Initializes subplanes and actors.
	subplanes = new Array();
	
	wrap_plane = new Clutter.Group();
	wrap_plane_clone = new Clutter.Clone( {source:wrap_plane } );
	
	// locate background and overview actor in UI hierarchy.
	background_plane = global.background_actor;
	overview_plane = Main.overview._background;
	
	// Add plane actor in UI hierarchy.
	background_plane.get_parent().add_actor(wrap_plane);
	wrap_plane.raise( background_plane );
	
	overview_plane.get_parent().add_actor( wrap_plane_clone );
	wrap_plane_clone.raise( overview_plane );
	wrap_plane_clone.visible = false;
	
	// Initializes detectors.
	maximized_detector = new MaximizeDetector();
	workspace_indexer = new WorkspaceIndexer()
	
	
	/* Monkey Patch function and Connects signals */
		
		/* Monkey Patching Main.wm._switchWorkspaceDone() to add some statement,
		 * as wrap_plane tends to raise above windows after switching work-
		 * spaces.
		 * Chaining up original function to fit any version of shell.	*/
	Main.wm._switchWorkspaceDone_orig__nexus = Main.wm._switchWorkspaceDone;
	Main.wm._switchWorkspaceDone = function( shellwm ){
		this._switchWorkspaceDone_orig__nexus( shellwm );
		_sh_wrap_plane_lower();
	}
	
		/* When we pick or maximize window, wrap_plane goes over windows.
		 * Therefore, we should take measure to put it under windows. */
	_shid_restacked = global.screen.connect("restacked", _sh_wrap_plane_lower );
	
	_shid_showing = Main.overview.connect("showing", _sh_overview_showing );
	_shid_hidden = Main.overview.connect("hidden", _sh_overview_hidden );
	
	maximized_detector.connect_signals();
	_shid_maximized = maximized_detector.connect( 'maximized', _sh_maximized );
	_shid_unmaximized = maximized_detector.connect( 'unmaximized', _sh_unmaximized );
	
	workspace_indexer.connect_signals();
	_shid_workspace_count_change = workspace_indexer.connect('count-changed', _sh_workspace_count_changed );
	_shid_switch_workspace = workspace_indexer.connect('index-changed', _sh_switch_workspace );
	
	_shid_screensize_change = global.stage.connect('notify::allocation', _sh_screensize_changed );
	
	_shid_settings_changed = settings.connect('changed', _sh_settings_changed );
	
	// ready maximized_detector for current workspace.
	maximized_detector.set_from_workspace(
		global.screen.get_workspace_by_index(
			global.screen.get_active_workspace_index() ) );
	
	// retrive setting value from settings object.
	set_sliding_height( settings.get_double('sliding-height') );
	set_sliding_duration( settings.get_int('sliding-duration') / 1000.0 );
	
	in_overview = false;
	configure_plane_size();
	is_setup = true;
}

function unsetup( ){
	if( is_setup ){
		
		// revert monkey patched function.
		Main.wm._switchWorkspaceDone = Main.wm._switchWorkspaceDone_orig__nexus;
		delete Main.wm._switchWorkspaceDone_orig__nexus;
		
		// disconnect signals.
		settings.disconnect( _shid_settings_changed );
		
		global.stage.disconnect( _shid_screensize_change );
		
		workspace_indexer.disconnect( _shid_workspace_count_change );
		workspace_indexer.disconnect( _shid_switch_workspace );
		workspace_indexer.disconnect_signals();
		
		maximized_detector.disconnect( _shid_maximized );
		maximized_detector.disconnect( _shid_unmaximized );
		maximized_detector.disconnect_signals();
		
		Main.overview.disconnect( _shid_showing );
		Main.overview.disconnect( _shid_hidden );
		global.screen.disconnect( _shid_restacked );
		
		// remove UI hierarchy.
		wrap_plane.get_parent().remove_actor( wrap_plane );
		wrap_plane_clone.get_parent().remove_actor( wrap_plane_clone );
		
		// remove all planes and actors.
		for( let a in wrap_plane.get_children() )
			wrap_plane.remove_actor( wrap_plane.get_children()[a] );
		wrap_plane = null;
		wrap_plane_clone = null;

		// Releasing external ref
		overview_plane = null;
		background_plane = null;
		is_setup = false;
	}
}

/* **** 2. Public functions to add or remove actor to wrap. *******************/
	/* add_actor: void
	 * Adds actor to wrap.
	 * Added actor will be resized according to screen size, count of workspaces.
	 *
	 * actor: Clutter.Actor:	Actor to be managed.
	 */
function add_actor( actor ){
	wrap_plane.add_actor( actor );
}

	/* remove_actor: void
	 * Removes actor being wrapped.
	 *
	 * actor: Clutter.Actor:	Actor to be removed.
	 */
function remove_actor( actor ){
	wrap_plane.remove_actor( actor );
}

	/* add_plane: void
	 * Adds plane to wrap.
	 *
	 * plane: PelletPlane:	Plane to be managed.
	 */
function add_plane( plane ){
	subplanes.push( plane );
	wrap_plane.add_actor( plane.actor );
	plane.set_size( plane_width, plane_height );
}

	/* remove_plane: void
	 * Removes plane to wrap.
	 *
	 * plane: PelletPlane: Plane to be removed.
	 */
function remove_plane( plane ){
	subplanes.pop( plane );
	wrap_plane.remove_actor( plane.actor );
}

	/* pause: void
	 * Pauses all animation of subplanes.
	 */
function pause(){
	for( let i = 0; i < subplanes.length ; i++ ){
		subplanes[i].pause();
	}
	paused = true;
}

	/* resume: void
	 * Resumes all animation of subplanes.
	 */
function resume(){
	for( let i = 0; i < subplanes.length ; i++ ){
		subplanes[i].resume();
	}
	paused = false;
}

/* **** 3. Setter Functions **********************************************
	/* set_sliding_duration: void
	 * sets sliding duration, which is time sliding takes to completely done.
	 * If negative value came in, WindowManager.WINDOW_ANIMATION_TIME is used.
	 *
	 * duration: double	: sliding duration.
	 */
function set_sliding_duration( duration ){
	if( duration < 0 )
		sliding_duration = WindowManager.WINDOW_ANIMATION_TIME;
	else
		sliding_duration = duration;
}

	/* configure_plane_size: void
	 * Updates screen size and offset according to global.stage size and current
	 * index of workspace.
	 */
function configure_plane_size(){
	plane_width = global.stage.width;
	configure_plane_height();
	configure_plane_offset();
}

	/* configure_plane_height: void
	 * updates plane height, according to workspace count and sliding height.
	 */
function configure_plane_height(){
	plane_height =	((workspace_indexer.workspace_count - 1)	*
					 sliding_height )							+
					global.stage.height;
	for( let i in subplanes )
		subplanes[i].set_size( plane_width, plane_height );
}

	/* configure_plane_offset: void
	 * Animates plane to slide up or down, according to current workspace index
	 * and sliding height.
	 */
function configure_plane_offset(){
	plane_offset = 	workspace_indexer.workspace_index * sliding_height;
	
	if( wrap_plane != null ){
		let anim_param = { time:		sliding_duration,
						   transition:	'easeOutQuad',
						   onComplete:	_sh_switch_workspace_tween_completed,
						   y: -(plane_offset) };
	
		Tweener.addTween( wrap_plane, anim_param );
		Tweener.addTween( wrap_plane_clone, anim_param );
	}
}

/* **** 4. Signal handlers. ***************************************************/

	/* _sh_settings_changed: void
	 * When setting has changed, it will update actorwrap.
	 *
	 * settings: Gio.Settings:	settings.
	 * key: string:				changed setting key.
	 */
function _sh_settings_changed( settings, key ){
	switch( key ){
	case 'sliding-height':
		set_sliding_height( settings.get_double( key ) );
		break;
	case 'sliding-duration':
		set_sliding_duration( settings.get_int( key ) );
		break;
	}
}

	/* _sh_wrap_plane_lower: bool
	 * When windows are restacked and wrap_plane goes on top of them, this
	 * will move it below of them.
	 */
function _sh_wrap_plane_lower(){
	wrap_plane.raise( background_plane );
	return false;
}

	/* _sh_overview_showing: void
	 * When overview screen is becoming visible, show wrap_plane_clone as if
	 * it was part of overview screen.
	 */
function _sh_overview_showing(){
	in_overview = true;
	wrap_plane_clone.visible = true;
	paused_preserve = (paused == undefined) ? false : paused;
	resume();
}

	/* _sh_overview_hidden: void
	 * Just like _sh_overview_showing() - but it hides wrap_plane_clone and
	 * it is activated when overview screen is gone.
	 */
function _sh_overview_hidden(){
	in_overview = false;
	wrap_plane_clone.visible = false;
	if( paused_preserve ) pause();
}


	/* _sh_maximized: void
	 * When Maximized state detected.
	 */
function _sh_maximized(){
	if( in_overview ) paused_preserve = true;
	else pause();
}
	/* _sh_unmaximized: void
	 * When Unmaximized state detected.
	 */
function _sh_unmaximized(){
	if( in_overview ) paused_preserve = false;
	else resume();
}

	/* _sh_screensize_changed: void
	 * When screen resolution is changed, it updates screen size it kepts.
	 *
	 * screen: Meta.Screen:			signal source.
	 * pspec: GObject.ParamSpec:	property spec.
	 */
function _sh_screensize_changed( screen, pspec ){
	configure_plane_size();
}

	/* _sh_workspace_count_changed: void
	 * When workspaces are increased or decreased, it updates plane heights to
	 * provide constant shifting amount when switching workspaces.
	 *
	 * windexer: WorkspaceIndexer:	signal source.
	 * count: int:					workspace count.
	 */
function _sh_workspace_count_changed( windexer, count ){
	plane_height = global.stage.height +
		( (count - 1) * sliding_height );
	for( let i in subplanes )
		subplanes[i].set_size( plane_width, plane_height );
}

	/* _sh_switch_workspace: void
	 * When switching workspace, put sliding animation to planes.
	 *
	 * shellwm: Shell.WM:	signal source.
	 * to: int:				index of destination workspace.
	 */
function _sh_switch_workspace( shellwm, to ){
	let anim_param = { time:		sliding_duration,
					   transition:	'easeOutQuad',
					   onComplete:	_sh_switch_workspace_tween_completed,
					   y: -(sliding_height * to) };
	
	Tweener.addTween( wrap_plane, anim_param );
	Tweener.addTween( wrap_plane_clone, anim_param );
}

	/* _sh_switch_workspace_tween_completed: void
	 * When animation during switching workspace done, removes tweens from it.
	 */
function _sh_switch_workspace_tween_completed( ){
	Tweener.removeTweens( this );
}

	/* set_sliding_height: void
	 * sets sliding height, which is amount of sliding distance per one
	 * workspace when switching workspace.
	 * Non-negative values are allowed.
	 *
	 * height: double	: sliding height.
	 */
function set_sliding_height( height ){
	if( height >= 0 ){
		sliding_height = height;
		configure_plane_offset();
		configure_plane_height();
	}
}

/* **** 5. Classes ************************************************************/

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
	// Instance variable list
	//	bool maximized			: state of detector.
	//	Array maximized_list	: list of maximized windows.
	//	Array lefttiled_list	: list of left-tiled windows.
	//	Array righttiled_list	: list of right-tiled windows.
	
	_init: function( workspace ){
		this.maximized_list = new Array();
		this.lefttiled_list = new Array();
		this.righttiled_list = new Array();
		
		this.maximized = false;
		
		if( workspace == undefined )
			workspace = global.screen.get_workspace_by_index( 0 );
	},
	
		/* connect_signals_to: void
		 * Connects handlers to necessary signals in order to detect maximized
		 * state.
		 */
	connect_signals: function(){
		this._shid_minimize = Main.wm._shellwm.connect(
			'minimize', Lang.bind( this, this._sh_minimize ) );
		
		this._shid_maximize = Main.wm._shellwm.connect(
			'maximize', Lang.bind( this, this._sh_maximize ) );
		
		this._shid_unmaximize = Main.wm._shellwm.connect(
			'unmaximize', Lang.bind( this, this._sh_unmaximize ) );
		
		this._shid_map = Main.wm._shellwm.connect(
			'map', Lang.bind( this, this._sh_map ) );
		
		this._shid_destroy = Main.wm._shellwm.connect(
			'destroy', Lang.bind( this, this._sh_destroy ) );
		
		this._shid_switch_workspace = Main.wm._shellwm.connect(
			'switch-workspace', Lang.bind( this, this._sh_switch_workspace ) );
	},
	
		/* disconnect_signals: void
		 * Disconnects handlers from signals.
		 */
	disconnect_signals: function( ){
		Main.wm._shellwm.disconnect( this._shid_minimize );
		Main.wm._shellwm.disconnect( this._shid_maximize );
		Main.wm._shellwm.disconnect( this._shid_unmaximize );
		Main.wm._shellwm.disconnect( this._shid_map );
		Main.wm._shellwm.disconnect( this._shid_destroy );
		Main.wm._shellwm.disconnect( this._shid_switch_workspace );
	},
	
		/* add_window: void
		 * (Try to) add maximized list.
		 * NOTE: maximized windows and tiled windows are added in different lists.
		 *
		 * mwin: Meta.Window	: window to add to.
		 */
	add_window: function( mwin ){
		
		// Phase 1 : Determine list to add window.
		let list_to_add = this._window_determine_list( mwin );
		if( list_to_add == null ) return;
		
		// Phase 2 : Adding mwin ( and remove )
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
		for( let i in wlist ){
			let list_to_add = this._window_determine_list( wlist[i] );
			if( list_to_add == null ) continue;
			
			list_to_add.push( wlist[i] );
		}
		
		this._check_and_emit_signal();
	},
	
		/* _window_determine_list: Array
		 * Determine which list the window should added.
		 *
		 * mwin: Meta.Window	: window to check.
		 *
		 * Return: list to add window.
		 */
	_window_determine_list: function( mwin ){
		if( mwin.is_fullscreen() ){
			return this.maximized_list;
		}
		else if( mwin.get_maximized() & Meta.MaximizeFlags.VERTICAL ){
			if( mwin.get_maximized() & Meta.MaximizeFlags.HORIZONTAL ){
				return this.maximized_list;
			}
			//If mwin is lefttiled so x is 0
			else if( mwin.get_outer_rect().x == 0 ){
				return this.lefttiled_list;
			}
			//Otherwise ( =righttiled )
			else{
				return this.righttiled_list;
			}
		}
		return null;
	},
	/* **** State changes and notification ************************************/
	
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
	
	/* **** Signal handlers ***************************************************/
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
	
	/* **** Private array operations ******************************************/
	
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


	/* WorkspaceIndexer: object
	 * Detects workspace counts and index of current workspace.
	 *
	 * Signals:
	 *	count-changed( count ) : void	: emitted when a workspace is added or
	 *									 removed.
	 *		count : int					: count of workspaces.
	 *	index-changed( index ) : void	: emitted when user switches workspace
	 *									 or one of previous workspaces
	 *									 removed.
	 *		index : int					: index of current workspace.
	 */
function WorkspaceIndexer(){
	this._init();
}

WorkspaceIndexer.prototype = {
	
	// Instance variables
	//	int workspace_count			: Count of workspaces.
	//	int workspace_index			: Index of current workspace.
	//
	//	int _shid_count_changed	: signal handler for notify::n-workspaces.
	//	int _shid_switched		: signal handler for switch-workspace.
	
	_init: function(){
		this.workspace_count = global.screen.get_n_workspaces();
		this.workspace_index = global.screen.get_active_workspace_index();
	},
	
		/* connect_signals_to: void
		 * Connects handlers to necessary signals in order to detect maximized
		 * state.
		 */
	connect_signals: function(){
		this._shid_count_changed = global.screen.connect(
			'notify::n-workspaces',
			Lang.bind( this, this._sh_workspace_count_changed ) );
		
		this._shid_switched = Main.wm._shellwm.connect(
			'switch-workspace',
			Lang.bind( this, this._sh_workspace_switched ) );
	},
	
		/* disconnect_signals: void
		 * Disconnects handlers from signals.
		 */
	disconnect_signals: function(){
		global.screen.disconnect( this._shid_count_changed );
		Main.wm._shellwm.disconnect( this._shid_switched );
		delete this._shid_count_changed;
		delete this._shid_switched;
	},
	
	/* **** Signal handlers ***************************************************/
	
		// Connected to global.screen - notify::n-workspaces.
	_sh_workspace_count_changed: function( screen, pspec ){
		this.emit_with_count_index(
			global.screen.get_n_workspaces(),
			global.screen.get_active_workspace_index() );
	},
	
		// Connected to Main.wm._shellwm - switch-workspace.
	_sh_workspace_switched: function( wm, from, to, direction ){
		this.emit_with_count_index(
			global.screen.get_n_workspaces(),
			global.screen.get_active_workspace_index() );
	},
	
	/* **** Private functions *************************************************/
	
		/* emit_with_count_index: void
		 * Update and check current states and emit signals if necessary.
		 *
		 * new_wcount: int	: new workspace count.
		 * new_windex: int	: new workspace index.
		 */
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

