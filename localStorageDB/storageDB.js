/*
 storageDB v 0.1
 adapted from: http://nadh.in/code/localstoragedb/

 === Initialization ===

 storageDB(); default engine it's localStorage

 var db = new storageDB(database, localStorage);
 var db = new storageDB(database, sessionStorage);

 === Commands ===

 db.drop();  #Deletes a database, and purges it from localStorage
 db.tableCount();  #Returns the number of tables in a database
 db.commit();  #Commits the database to localStorage. Returns true if successful, and false otherwise
 db.serialize();  #Returns the entire database as serialized JSON
 db.isNew();  #Returns true if a database was created at the time of initialisation with the constructor
 db.tableFields(); param table_name  #Returns the list of fields of a table
 db.tableExists(); param table_name  #Checks whether a table exists in the database
 db.tableExistsWarn(); param table_name  #Checks whether a table exists in the database and return error message
 db.columnExists(); params table_name,column_name  #Checks whether a column exists in database table
 db.createTable(); params table_name, fields_name  #Creates a table / fields is an array of string fieldnames. 'ID' is a reserved fieldname.
 db.dropTable(); param table_name  #Deletes a table from the database
 db.alterTable(); params table_name, new_fields, default_values  #Alter a table / new_fields can be a array of columns OR a string of single column / default_values (optional) can be a object of column's default values OR a default value string for single column for existing rows.
 db.rowCount(); param table_name  #Returns the number of rows in a table
 db.insert(); param table_name  #Inserts a row into a table and returns its numerical ID / data is an object literal with field-values / Every row is assigned an auto-incremented numerical ID automatically
 db.select(); params table_name, data
 db.sort_results(); params filed_name, order (order ASC/DESC)
 db.queryByValues(); params table_name, data
 db.queryByFunction(); params table_name, query_function
 db.getIDs(); param table_name
 db.deleteRows(); params table_name, ids  # Deletes rows from a table matching query, and returns the number of rows deleted / query is either an object literal or a function. If query is not supplied, all rows are deleted
 db.update(); params table_name, ids, update_function  # Updates existing records in a table matching query, and returns the number of rows affected / query is an object literal or a function. If query is not supplied, all rows are updated / update_function is a function that returns an object literal with the updated values
 db.error(); param msg;
 db.clone(); param object
 db.validateName(); param name
 db.validFields(); params table_name, data
 db.validateData(); params table_name, data
 db.query(); params table_name, query, limit, start, sort, distinct
 db.queryAll(); params table_name, params

 */

!(function (_global, undefined) {
	function storageDB(db_name, engine) {
		var prefix = 'db_',
			db_id = prefix + db_name,
			db_new = false,	// this flag determines whether a new database was created during an object initialisation
			db = null;

		try {
			var storage = (engine == sessionStorage ? sessionStorage: localStorage);
		} catch(e) { // ie8 hack
			var storage = engine;
		}

		// if the database doesn't exist, create it
		db = storage[ db_id ];
		if( !( db && (db = JSON.parse(db)) && db.tables && db.data ) ) {
			if(!validateName(db_name)) {
				error("The name '" + db_name + "' contains invalid characters");
			} else {
				db = {tables: {}, data: {}};
				commit();
				db_new = true;
			}
		}


		// ______________________ private methods

		// _________ database functions
		// drop the database
		function drop() {
			if(storage.hasOwnProperty(db_id)) {
				delete storage[db_id];
			}
			db = null;
		}

		// number of tables in the database
		function tableCount() {
			var count = 0;
			for(var table in db.tables) {
				if( db.tables.hasOwnProperty(table) ) {
					count++;
				}
			}
			return count;
		}

		// _________ table functions

		// returns all fields in a table.
		function tableFields(table_name) {
			return db.tables[table_name].fields;
		}

		// check whether a table exists
		function tableExists(table_name) {
			return db.tables[table_name] ? true : false;
		}

		// check whether a table exists, and if not, throw an error
		function tableExistsWarn(table_name) {
			if(!tableExists(table_name)) {
				error("The table '" + table_name + "' does not exist");
			}
		}

		// check whether a table column exists
		function columnExists(table_name, field_name) {
			var exists = false;
			var table_fields = db.tables[table_name].fields;
			for(var field in table_fields){
				if(table_fields[field] == field_name)
				{
					exists = true;
					break;
				}
			}
			return exists;
		}

		// create a table
		function createTable(table_name, fields) {
			db.tables[table_name] = {fields: fields, auto_increment: 1};
			db.data[table_name] = {};
		}

		// drop a table
		function dropTable(table_name) {
			delete db.tables[table_name];
			delete db.data[table_name];
		}

		// empty a table
		function truncate(table_name) {
			db.tables[table_name].auto_increment = 1;
			db.data[table_name] = {};
		}

		//alter a table
		function alterTable(table_name, new_fields, default_values){
			db.tables[table_name].fields = db.tables[table_name].fields.concat(new_fields);

			// insert default values in existing table
			if(typeof default_values != "undefined") {
				// loop through all the records in the table
				for(var ID in db.data[table_name]) {
					if( !db.data[table_name].hasOwnProperty(ID) ) {
						continue;
					}
					for(var field in new_fields) {
						if(typeof default_values == "object") {
							db.data[table_name][ID][new_fields[field]] = default_values[new_fields[field]];
						} else {
							db.data[table_name][ID][new_fields[field]] = default_values;
						}
					}
				}
			}
		}

		// number of rows in a table
		function rowCount(table_name) {
			var count = 0;
			for(var ID in db.data[table_name]) {
				if( db.data[table_name].hasOwnProperty(ID) ) {
					count++;
				}
			}
			return count;
		}

		// insert a new row
		function insert(table_name, data) {
			data.ID = db.tables[table_name].auto_increment;
			db.data[table_name][ db.tables[table_name].auto_increment ] = data;
			db.tables[table_name].auto_increment++;
			return data.ID;
		}

		// select rows, given a list of IDs of rows in a table
		function select(table_name, ids, start, limit, sort, distinct) {
			var ID = null, results = [], row = null;

			for(var i=0; i<ids.length; i++) {
				ID = ids[i];
				row = db.data[table_name][ID];
				results.push( clone(row) );
			}

			// there are sorting params
			if(sort && sort instanceof Array) {
				for(var i=0; i<sort.length; i++) {
					results.sort(sort_results(sort[i][0], sort[i].length > 1 ? sort[i][1] : null));
				}
			}

			// distinct params
			if(distinct && distinct instanceof Array) {
				for(var j=0; j<distinct.length; j++) {
					var seen = {}, d = distinct[j];

					for(var i=0; i<results.length; i++) {
						if(results[i] === undefined) {
							continue;
						}

						if(results[i].hasOwnProperty(d) && seen.hasOwnProperty(results[i][d])) {
							delete(results[i]);
						} else {
							seen[results[i][d]] = 1;
						}
					}
				}

				// can't use .filter(ie8)
				var new_results = [];
				for(var i=0; i<results.length; i++) {
					if(results[i] !== undefined) {
						new_results.push(results[i]);
					}
				}

				results = new_results;
			}

			// limit and offset
			start = start && typeof start === "number" ? start : null;
			limit = limit && typeof limit === "number" ? limit : null;

			if(start && limit) {
				results = results.slice(start, start+limit);
			} else if(start) {
				results = results.slice(start);
			} else if(limit) {
				results = results.slice(start, limit);
			}

			return results;
		}

		// sort a result set
		function sort_results(field, order) {
			return function(x, y) {
				// case insensitive comparison for string values
				var v1 = typeof(x[field]) === "string" ? x[field].toLowerCase() : x[field],
					v2 = typeof(y[field]) === "string" ? y[field].toLowerCase() : y[field];

				if(order === "DESC") {
					return v1 == v2 ? 0 : (v1 < v2 ? 1 : -1);
				} else {
					return v1 == v2 ? 0 : (v1 > v2 ? 1 : -1);
				}
			};
		}

		// select rows in a table by field-value pairs, returns the IDs of matches
		function queryByValues(table_name, data) {
			var result_ids = [],
				exists = false,
				row = null;

			// loop through all the records in the table, looking for matches
			for(var ID in db.data[table_name]) {
				if( !db.data[table_name].hasOwnProperty(ID) ) {
					continue;
				}

				row = db.data[table_name][ID];
				exists = true;

				for(var field in data) {
					if( !data.hasOwnProperty(field) ) {
						continue;
					}

					if(typeof data[field] == 'string') {	// if the field is a string, do a case insensitive comparison
						if( row[field].toString().toLowerCase() != data[field].toString().toLowerCase() ) {
							exists = false;
							break;
						}
					} else {
						if(row[field] != data[field]) {
							exists = false;
							break;
						}
					}
				}
				if(exists) {
					result_ids.push(ID);
				}
			}

			return result_ids;
		}

		// select rows in a table by a function, returns the IDs of matches
		function queryByFunction(table_name, query_function) {
			var result_ids = [],
				exists = false,
				row = null;

			// loop through all the records in the table, looking for matches
			for(var ID in db.data[table_name]) {
				if( !db.data[table_name].hasOwnProperty(ID) ) {
					continue;
				}

				row = db.data[table_name][ID];

				if( query_function( clone(row) ) == true ) {	// it's a match if the supplied conditional function is satisfied
					result_ids.push(ID);
				}
			}

			return result_ids;
		}

		// return all the IDs in a table
		function getIDs(table_name) {
			var result_ids = [];

			for(var ID in db.data[table_name]) {
				if( db.data[table_name].hasOwnProperty(ID) ) {
					result_ids.push(ID);
				}
			}
			return result_ids;
		}

		// delete rows, given a list of their IDs in a table
		function deleteRows(table_name, ids) {
			for(var i=0; i<ids.length; i++) {
				if( db.data[table_name].hasOwnProperty(ids[i]) ) {
					delete db.data[table_name][ ids[i] ];
				}
			}
			return ids.length;
		}

		// update rows
		function update(table_name, ids, update_function) {
			var ID = '', num = 0;

			for(var i=0; i<ids.length; i++) {
				ID = ids[i];

				var updated_data = update_function( clone(db.data[table_name][ID]) );

				if(updated_data) {
					delete updated_data['ID']; // no updates possible to ID

					var new_data = db.data[table_name][ID];
					// merge updated data with existing data
					for(var field in updated_data) {
						if( updated_data.hasOwnProperty(field) ) {
							new_data[field] = updated_data[field];
						}
					}

					db.data[table_name][ID] = validFields(table_name, new_data);
					num++;
				}
			}
			return num;
		}

		// commit the database to localStorage
		function commit() {
			try {
				storage.setItem(db_id, JSON.stringify(db));
				return true;
			} catch(e) {
				return false;
			}
		}

		// serialize the database
		function serialize() {
			return JSON.stringify(db);
		}

		// throw an error
		function error(msg) {
			throw new Error(msg);
		}

		// clone an object
		function clone(obj) {
			var new_obj = {};
			for(var key in obj) {
				if( obj.hasOwnProperty(key) ) {
					new_obj[key] = obj[key];
				}
			}
			return new_obj;
		}

		// validate db, table, field names (alpha-numeric only)
		function validateName(name) {
			return name.toString().match(/[^a-z_0-9]/ig) ? false : true;
		}

		// given a data list, only retain valid fields in a table
		function validFields(table_name, data) {
			var field = '', new_data = {};

			for(var i=0; i<db.tables[table_name].fields.length; i++) {
				field = db.tables[table_name].fields[i];

				if (data[field] !== undefined) {
					new_data[field] = data[field];
				}
			}
			return new_data;
		}

		// given a data list, populate with valid field names of a table
		function validateData(table_name, data) {
			var field = '', new_data = {};
			for(var i=0; i<db.tables[table_name].fields.length; i++) {
				field = db.tables[table_name].fields[i];
				new_data[field] = (data[field] === null || data[field] === undefined) ? null : data[field];
			}
			return new_data;
		}

		// ______________________ public methods

		return {
			// commit the database to localStorage
			commit: function() {
				return commit();
			},

			// is this instance a newly created database?
			isNew: function() {
				return db_new;
			},

			// delete the database
			drop: function() {
				drop();
			},

			// serialize the database
			serialize: function() {
				return serialize();
			},

			// check whether a table exists
			tableExists: function(table_name) {
				return tableExists(table_name);
			},

			// list of keys in a table
			tableFields: function(table_name) {
				return tableFields(table_name);
			},

			// number of tables in the database
			tableCount: function() {
				return tableCount();
			},

			columnExists: function(table_name, field_name){
				return columnExists(table_name, field_name);
			},

			// create a table
			createTable: function(table_name, fields) {
				var result = false;
				if(!validateName(table_name)) {
					error("The database name '" + table_name + "' contains invalid characters.");
				} else if(this.tableExists(table_name)) {
					error("The table name '" + table_name + "' already exists.");
				} else {
					// make sure field names are valid
					var is_valid = true;
					for(var i=0; i<fields.length; i++) {
						if(!validateName(fields[i])) {
							is_valid = false;
							break;
						}
					}

					if(is_valid) {
						// cannot use indexOf due to <IE9 incompatibility
						// de-duplicate the field list
						var fields_literal = {};
						for(var i=0; i<fields.length; i++) {
							fields_literal[ fields[i] ] = true;
						}
						delete fields_literal['ID']; // ID is a reserved field name

						fields = ['ID'];
						for(var field in fields_literal) {
							if( fields_literal.hasOwnProperty(field) ) {
								fields.push(field);
							}
						}

						createTable(table_name, fields);
						result = true;
					} else {
						error("One or more field names in the table definition contains invalid characters");
					}
				}

				return result;
			},

			// Create a table using array of Objects @ [{k:v,k:v},{k:v,k:v},etc]
			createTableWithData: function(table_name, data) {
				if(typeof data !== 'object' || !data.length || data.length < 1) {
					error("Data supplied isn't in object form. Example: [{k:v,k:v},{k:v,k:v} ..]");
				}

				var fields = Object.keys(data[0]);

				// create the table
				if( this.createTable(table_name, fields) ) {
					this.commit();

					// populate
					for (var i=0; i<data.length; i++) {
						if( !insert(table_name, data[i]) ) {
							error("Failed to insert record: [" + JSON.stringify(data[i]) + "]");
						}
					}
					this.commit();
				}
				return true;
			},

			// drop a table
			dropTable: function(table_name) {
				tableExistsWarn(table_name);
				dropTable(table_name);
			},

			// empty a table
			truncate: function(table_name) {
				tableExistsWarn(table_name);
				truncate(table_name);
			},

			// alter a table
			alterTable: function(table_name, new_fields, default_values) {
				var result = false;
				if(!validateName(table_name)) {
					error("The database name '" + table_name + "' contains invalid characters");
				} else {
					if(typeof new_fields == "object") {
						// make sure field names are valid
						var is_valid = true;
						for(var i=0; i<new_fields.length; i++) {
							if(!validateName(new_fields[i])) {
								is_valid = false;
								break;
							}
						}

						if(is_valid) {
							// cannot use indexOf due to <IE9 incompatibility
							// de-duplicate the field list
							var fields_literal = {};
							for(var i=0; i<new_fields.length; i++) {
								fields_literal[ new_fields[i] ] = true;
							}
							delete fields_literal['ID']; // ID is a reserved field name

							new_fields = [];
							for(var field in fields_literal) {
								if( fields_literal.hasOwnProperty(field) ) {
									new_fields.push(field);
								}
							}

							alterTable(table_name, new_fields, default_values);
							result = true;
						} else {
							error("One or more field names in the table definition contains invalid characters");
						}
					} else if(typeof new_fields == "string") {
						if(validateName(new_fields)) {
							var new_fields_array = [];
							new_fields_array.push(new_fields);
							alterTable(table_name, new_fields_array, default_values);
							result = true;
						} else {
							error("One or more field names in the table definition contains invalid characters");
						}
					}
				}

				return result;
			},

			// number of rows in a table
			rowCount: function(table_name) {
				tableExistsWarn(table_name);
				return rowCount(table_name);
			},

			// insert a row
			insert: function(table_name, data) {
				tableExistsWarn(table_name);
				return insert(table_name, validateData(table_name, data) );
			},

			// insert or update based on a given condition
			insertOrUpdate: function(table_name, query, data) {
				tableExistsWarn(table_name);

				var result_ids = [];
				if(!query) {
					result_ids = getIDs(table_name);				// there is no query. applies to all records
				} else if(typeof query == 'object') {				// the query has key-value pairs provided
					result_ids = queryByValues(table_name, validFields(table_name, query));
				} else if(typeof query == 'function') {				// the query has a conditional map function provided
					result_ids = queryByFunction(table_name, query);
				}

				// no existing records matched, so insert a new row
				if(result_ids.length == 0) {
					return insert(table_name, validateData(table_name, data) );
				} else {
					var ids = [];
					for(var n=0; n<result_ids.length; n++) {
						update(table_name, result_ids, function(o) {
							ids.push(o.ID);
							return data;
						});
					}

					return ids;
				}
			},

			// update rows
			update: function(table_name, query, update_function) {
				tableExistsWarn(table_name);

				var result_ids = [];
				if(!query) {
					result_ids = getIDs(table_name);				// there is no query. applies to all records
				} else if(typeof query == 'object') {				// the query has key-value pairs provided
					result_ids = queryByValues(table_name, validFields(table_name, query));
				} else if(typeof query == 'function') {				// the query has a conditional map function provided
					result_ids = queryByFunction(table_name, query);
				}
				return update(table_name, result_ids, update_function);
			},

			// select rows
			query: function(table_name, query, limit, start, sort, distinct) {
				tableExistsWarn(table_name);

				var result_ids = [];
				if(!query) {
					result_ids = getIDs(table_name, limit, start); // no conditions given, return all records
				} else if(typeof query == 'object') {			// the query has key-value pairs provided
					result_ids = queryByValues(table_name, validFields(table_name, query), limit, start);
				} else if(typeof query == 'function') {		// the query has a conditional map function provided
					result_ids = queryByFunction(table_name, query, limit, start);
				}

				return select(table_name, result_ids, start, limit, sort, distinct);
			},

			// alias for query() that takes a dict of params instead of positional arrguments
			queryAll: function(table_name, params) {
				if(!params) {
					return this.query(table_name)
				} else {
					return this.query(table_name,
						params.hasOwnProperty('query') ? params.query : null,
						params.hasOwnProperty('limit') ? params.limit : null,
						params.hasOwnProperty('start') ? params.start : null,
						params.hasOwnProperty('sort') ? params.sort : null,
						params.hasOwnProperty('distinct') ? params.distinct : null
					);
				}
			},

			// delete rows
			deleteRows: function(table_name, query) {
				tableExistsWarn(table_name);

				var result_ids = [];
				if(!query) {
					result_ids = getIDs(table_name);
				} else if(typeof query == 'object') {
					result_ids = queryByValues(table_name, validFields(table_name, query));
				} else if(typeof query == 'function') {
					result_ids = queryByFunction(table_name, query);
				}
				return deleteRows(table_name, result_ids);
			}
		}
	}

	// make amd compatible
	if(typeof define === 'function' && define.amd) {
		define(function() {
			return storageDB;
		});
	} else {
		_global['storageDB'] = storageDB;
	}

}(window));

