/* InlineSettings
 * Hardcoded settings that can be edited by editing this js file.
 * This is used when schema wasn't found.
 *
 * This mimicks a GSettings object, so this can be dropped without lots of code
 * modification.
 *
 * For users to modify this file:
 *		Edit PLANE_SETTINGS_VALUE, PELLET_SETTINGS_VALUE.
 */

//Include Statements.
const GLib = imports.gi.GLib;

//Settings values [ Modify here 'u' ]
const PLANE_SETTINGS_VALUE = {
	'pool-capacity': 64,
	'spawn-timeout': 150,
	'spawn-probability': 0.3,
	'stepping-timeout': 30,
	'speed': [360, 500],
	'offset': [0, 0],
	'sliding-height': 140,
	'sliding-duration': -1,
	'pellet-directions': ['UP', 'LEFT', 'DOWN', 'RIGHT'] };

const PELLET_SETTINGS_VALUE = {
	'colors': ['#FF2020', '#20FF20', '#2020FF', '#FFFF00'],
	'default-alpha': 0.3,
	'trail-length': 393,
	'width': 14,
	'glow-radius': 21 };

//Settings Formats [ DO NOT MODIFY THIS ARRAYS ]
const PLANE_SETTINGS_FORMAT = {
	'pool-capacity': 'i',
	'spawn-timeout': 'i',
	'spawn-probability': 'd',
	'stepping-timeout': 'i',
	'speed': '(dd)',
	'offset': '(dd)',
	'sliding-height': 'd',
	'sliding-duration': 'i',
	'pellet-directions': 'as' };

const PELLET_SETTINGS_FORMAT = {
	'colors': 'as',
	'default-alpha': 'd',
	'trail-length': 'd',
	'width': 'd',
	'glow-radius': 'd'};

	/* InlineSettings
	 * Constructs InlineSettings with given format and object.
	 *
	 * format: Object	: key to format dictionary.
	 * dict: Object		: key to value dictionary.
	 */
function InlineSettings( format, dict ){
	this._init( format, dict );
}

InlineSettings.prototype = {
	_init: function( format, dict ){
		this.format = format;
		this.dict = object;
		this.variant_dict = new Object();
		
		for( key in format ){
			this.variant_dict[key] = GLib.Variant.new( this.format[key],
													   this.dict[key] );
		}
	},
	
		/* get_int: int
		 * 
	get_int: function( key ){
		var value = this.dict[key];
		var type = typeof( value );
		
		switch( type ){
		case 'number':
			return Math.floor( value );
			break;
		case 'string':
			return parseInt( value );
			break;
		}
		return null;
	},
	
	get_double: function( key ){
		var value = this.dict[key];
		var type = typeof( value );
		
		switch( type ){
		case 'number':
			return value;
			break;
		case 'string':
			return parseFloat( value );
			break;
		}
		return null;
	},
	
	get_strv: function( key ){
		var value = this.dict[key];
		
		if( value instanceof Array )
			return value;
		else
			return null;
	},
	
	get_value: function( key ){
		return this.variant_dict[key];
	},
	
	connect: function(){
		//Dummy Function, doing nothing.
		return 0;
	},
	
	disconnect: function(){
		//Dummy function, doing nothing.
		return;
	},
	
	set_children: function( map ){
		this.children = map;
	},
	
	get_child: function( key ){
		if( 'children' in this ){
			return this.children[key];
		}
		return null;
	}
}

const PLANE_SETTINGS = new InlineSettings( PLANE_SETTINGS_FORMAT,
										   PLANE_SETTINGS_VALUE );
const PELLET_SETTINGS = new InlineSettings( PELLET_SETTINGS_FORMAT,
											PELLET_SETTINGS_VALUE );

PLANE_SETTINGS.set_children( {'pellet': PELLET_SETTINGS} );
