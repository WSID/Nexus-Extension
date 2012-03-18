/* pool.js
 *
 * Contains pool's function interface.
 *
 * section index :
 *		1. Pool initialization
 *		2. Retriving and recycling objects
 *		3. Pool object iteration
 */

//As it uses only builtin operations, functions, objects,  no import.

function Pool( capacity, obj_constructor ){
	this._init( capacity, obj_constructor );
}

Pool.prototype = {
	// Instance Variables
	//	_capacity: int
	//	_array: Array
	//	_item_count: int
	_init: function( capacity, obj_constructor ){
		this._array = new Array( capacity );
		this._capacity = capacity;
		this._item_count = 0;
	
		for( let i in this._array ){
			this._array[i] = new obj_constructor( );// construct pool objects.
			this._array[i]._pool_index = i;			// record pool index on obj.
		}
	},
	/* **** 2. Retriving and recycling objects	***** */

		/** retrive: object
		 * Retrive an object from pool. If no object is idle, null will be
		 * returned.
		 *
		 * Returns: object	: one of usable object. If no object is availiable,
		 *					  null.
		 */
	retrive: function( ){
		var res;
	
		if( this._item_count < this._capacity )
			res = this._array[ this._item_count++ ];
		else
			res =  null;
	
		return res;
	},

		/** retrive_more: Array
		 * Retrive more than an object from pool. Returned objects will be
		 * contained in an array. If not enough objects are availiable, null
		 * will be returned.
		 *
		 * n: int: Number of required objects.
		 *
		 * Returns: objects from pool, if they are availiable. Otherwise, null.
		 */
	retrive_more: function( n ){

		var res;
	
		if( this._item_count + n <= this._capacity ){
			res = this._array.slice( this._item_count, this._item_count + n );
			this._item_count += n;
		}
		else res =  null;
	
		return res;
	},

		/** recycle: void
		 * Recycle the object into pool. Object should be retrived from the pool
		 *
		 * obj: object	: Object from pool.
		 */
	recycle: function( obj ){
		
		this._item_count--;
		if( obj._pool_index != this._item_count ){
			this._array[ this._item_count ]._pool_index = obj._pool_index;
			
			this._array[ obj._pool_index ] = this._array[ this._item_count ];
			this._array[ this._item_count ] = obj;
			
			obj._pool_index = this._item_count;
		}
	
	},

	/* **** 3. Pool Object iteration	***** */

		/** foreach: void
		 * do callback() on using objects. - not on idle objects.
		 *
		 * callback: void function( object )	: Callback to do on every object
		 */
	foreach: function( callback ){
		for( let i = 0; i < this._item_count ; i++ ){
			callback( this._array[i] );
		}
	},

		/** foreach_full: void
		 * do callback() on every objects in the pool. - callback will be
		 * applied on idle objects.
		 *
		 * callback: void function( object )	: Callback to do on every object
		 */
	foreach_full: function( callback ){
		for( let i in this._array ){
			callback( this._array[i] );
		}
	},

		/** recycle_if: void
		 * do callback() on every objects in the pool and recycle objects with
		 * result of false.
		 *
		 * callback: bool function( object )	: Callback to do on every object
		 */
	recycle_if: function( callback ){
		var i = 0;
		while( i < this._item_count ){
			if( callback( this._array[i] ) ){
				this.recycle( this._array[i] );
				continue;
			}
			i++;
		}
	}
}
