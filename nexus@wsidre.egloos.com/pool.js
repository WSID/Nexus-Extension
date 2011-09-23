/* pool.js
 *
 * Contains pool's function interface.
 *
 * section index :
 *		1. Pool initialization
 *		2. Retriving and recycling objects
 *		3. Pool object iteration
 */

//As it uses core operations, functions, objects,  no import.

var is_setup

var pool_array;				/* object[]:Array of managed objects in pool.	*/
var pool_capacity;			/* int:		Pool capacity 						*/
var pool_item_count = 0;	/* int:		Current count of objects in use.	*/

/* **** 1. Pool Initialization	***** */

	/** init: void
	 * Initialize object pool to use.
	 *
	 * capacity:		int:					Capacity of pool.
	 * obj_construct:	constructor( void ):	Constructor of objects in pool.
	 */
function setup( capacity, obj_construct ){
	
	pool_array = new Array( capacity );
	pool_capacity = capacity;
	pool_item_count = 0;
	
	for( var i = 0; i < capacity ; i++ ){
		pool_array[i] = new obj_construct( );	//<- construct pool objects.
		pool_array[i]._pool_index = i;			//<- record pool index on obj.
	}
	is_setup = true;
}

function unsetup( ){
	if( is_setup ){
		pool_array = null;
		is_setup = false;
	}
}

/* **** 2. Retriving and recycling objects	***** */

	/** retrive: object?
	 * Retrive an object from pool. If no object is idle, null will be returned.
	 *
	 * Returns:	object{
	 *				_pool_index:	int:	Index of object given from
	 *										pool_initialize(). Don't modify.
	 *			}
	 *								:		(If some object is availiable)
	 *										an object from pool.
	 *			null:						(None of them is abailiable)
	 */
function retrive( ){
	
	var res;
	
	if( pool_item_count < pool_capacity ){
		res = pool_array[ pool_item_count++ ];
	}
	else res =  null;
	
	return res;
}

	/** retrive_more: object[]?
	 * Retrive more than an object from pool. Returned objects will be contained
	 * in an array. If not enough objects are availiable, null will be returned.
	 *
	 * n:		int:						Number of required objects.
	 * Returns:	object{
	 *				_pool_index:	int:	Index of object given from
	 *										pool_initialize(). Don't modify.
	 *			} []
	 *								:		(If enough objects are availiable)
	 *										an object from pool.
	 *			null:						(None of them is abailiable)
	 */
function retrive_more( n ){

	var res;
	
	if( pool_item_count + n <= pool_capacity ){
		res = pool_array.slice( pool_item_count, pool_item_count + n );
		pool_item_count += n;
		//global.log('  pool_item_count increased.');
	}
	else res =  null;
	
	return res;
}

	/** recycle: void
	 * Recycle the object into pool. Object should be retrived from the pool.
	 *
	 * obj:	object{
	 *			_pool_index:	int:	Index of object given from
	 *									pool_initialize().
	 *		}
	 *							:		Object from pool.
	 */
function recycle( obj ){
	
	pool_item_count--;
	if( obj._pool_index != pool_item_count ){
		pool_array[ pool_item_count ]._pool_index = obj._pool_index;
	
		pool_array[ obj._pool_index ] = pool_array[ pool_item_count ];
		pool_array[ pool_item_count ] = obj;
		
		obj._pool_index = pool_item_count;
	}
	
}

/* **** 3. Pool Object iteration	***** */

	/** foreach: void
	 * do callback() on using objects. - not on idle objects.
	 *
	 * callback:	function( object{
	 *							_pool_index:	Index of object given from
	 *											pool_initialize(). Don't modify.
	 *				} )
	 *				:							Callback to do on every object.
	 */
function foreach( callback ){
	
	for( let i = 0; i < pool_item_count ; i++ ){
		callback( pool_array[i] );
	}
}

	/** foreach_full: void
	 * do callback() on every objects in the pool. - callback will be applied on
	 * idle objects.
	 *
	 * callback:	function( object{
	 *							_pool_index:	Index of object given from
	 *											pool_initialize(). Don't modify.
	 *				} )
	 *				:							Callback to do on every object.
	 */
function foreach_full( callback ){

	for( let obj in pool_array ){
		callback( obj );
	}
	
}

	/** recycle_if: void
	 * do callback() on every objects in the pool and recycle objects with result
	 * of false.
	 *
	 * callback:	function( object{
	 *							_pool_index:	Index of object given from
	 *											pool_initialize(). Don't modify.
	 *				} ): bool:
	 *				:							Callback to do on every object.
	 */
function recycle_if( callback ){
	
	var i = 0;
	while( i < pool_item_count ){
		if( callback( pool_array[i] ) ){
			recycle( pool_array[i] );
			continue;
		}
		i++;
	}
}
