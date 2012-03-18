/* InlineSettings
 * Hardcoded settings that can be edited by editing this js file.
 * This is used when schema wasn't found.
 *
 * If schema is installed properly, this will not be used. If you installed
 * schema, set option with 'gsettings' or 'dconf-editor'.
 *
 * This mimicks a GSettings object, so this can be dropped without lots of code
 * modification.
 *
 * For users to modify this file:
 *		Edit PLANE_SETTINGS_VALUE, PELLET_SETTINGS_VALUE.
 */

//Include Statements.
const GLib = imports.gi.GLib;

/* **** Modify this section. **************************************************/

//Settings values
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

/* **** DO NOT MODIFY FROM HERE!! *********************************************/

//Settings Formats
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
		this.dict = dict;
		this.variant_dict = new Object();
		
		for( key in format ){
			this.variant_dict[key] = GLib.Variant.new( this.format[key],
													   this.dict[key] );
		}
	},
	
		/* get_int: int
		 * gets int value from given key.
		 * To mimick GSettings' behavior, result is converted into int.
		 *
		 * Return: value from key.
		 */
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
	
		/* get_double: double
		 * gets double value from given key.
		 * To mimick GSettings' behavior, result is converted into double.
		 *
		 * Return: value from key.
		 */
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
	
		/* get_strv: Array
		 * gets Array value from given key.
		 * For convenience, it only checks result is Array.
		 *
		 * Return: value from key.
		 */
	get_strv: function( key ){
		var value = this.dict[key];
		
		if( value instanceof Array )
			return value;
		else
			return null;
	},
	
		/* get_value: GLib.Variant
		 * gets Variant value from given key.
		 *
		 * Return: value from key.
		 */
	get_value: function( key ){
		return this.variant_dict[key];
	},
	
		/* connect: int
		 * just mimicks GObject signal connection. Doing nothing.
		 *
		 * Return: always 0, which is originally supposed to be signal handler
		 *		   id.
		 */
	connect: function(){
		return 0;
	},
	
		/* disconnect: void
		 * just mimicks GObject signal disconnection. Doing nothing.
		 */
	disconnect: function(){
		return;
	},
	
		/* set_children: void
		 * sets child InlineSettings with name. for mimicking child schema in
		 * GSettings.
		 *
		 * map: object	: name:string -> child:InlineSettings mapping.
		 */
	set_children: function( map ){
		this.children = map;
	},
	
		/* get_child: InlineSettings
		 * get child with name.
		 *
		 * key: string	: child name.
		 * Return: child InlineSettings.
		 */
	get_child: function( key ){
		if( 'children' in this ){
			return this.children[key];
		}
		return null;
	}
}

// Constant settings.
const PLANE_SETTINGS = new InlineSettings( PLANE_SETTINGS_FORMAT,
										   PLANE_SETTINGS_VALUE );
const PELLET_SETTINGS = new InlineSettings( PELLET_SETTINGS_FORMAT,
											PELLET_SETTINGS_VALUE );

PLANE_SETTINGS.set_children( {'pellet': PELLET_SETTINGS} );
