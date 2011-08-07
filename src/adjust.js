ExtensionAdjust.prototype = {
	_init: function(settings) {
		this.settings = settings;
	},
	
	createNotificationIcon: function() {
		return new Clutter.Texture( {filename: extension_path + '/' + 'icon.png' } );
	},
	
	
