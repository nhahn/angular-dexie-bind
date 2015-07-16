/*! angular-dexie-bind - v0.0.2 - 2015-07-01
 * https://github.com/nhahn/angular-dexie-bind
 * Nathan Hahn; Licensed MIT */
/*global angular:false */
/*global io:false */
/**
 * Angular that binds Dexie queries to objects 
 *
 * @author Nathan Hahn - Github: nhahn
 * @return {object} Object of methods
 */

(function () {
  
  
  function bindAddons (db) {
    var getSetArgs = function (args) {
      return Array.prototype.slice.call(args.length === 1 && Array.isArray(args[0]) ? args[0] : args);
    }
    
    db.WhereClause.prototype.anyOf = Dexie.override (db.WhereClause.prototype.anyOf, function(origFunc) {
      return function() {
        var retVal = origFunc.apply(this, arguments);
        retVal._ctx.anyOf = getSetArgs(arguments);
        return retVal;
      }
    });
    
    db.WhereClause.prototype.startsWithIgnoreCase = Dexie.override (db.WhereClause.prototype.startsWithIgnoreCase , function(origFunc) {
      return function() {
        var retVal = origFunc.apply(this, arguments);
        retVal._ctx.ignoreCase = true;
        return retVal;
      }
    });
    
    db.WhereClause.prototype.equalsIgnoreCase = Dexie.override (db.WhereClause.prototype.equalsIgnoreCase , function(origFunc) {
      return function() {
        var retVal = origFunc.apply(this, arguments);
        retVal._ctx.ignoreCase = true;
        return retVal;
      }
    });
    
    db.Collection.prototype.distinct  = Dexie.override (db.Collection.prototype.distinct  , function(origFunc) {
      return function() {
        var retVal = origFunc.apply(this, arguments);
        this._ctx.distinct = true;
        return retVal;
      }
    });
  }
  
  Dexie.addons.push(bindAddons);
    
  //Finally, define our angular module
  var app = angular.module("ngDexieBind", []);
  app.factory('$dexieBind', [
    '$q', "$rootScope", "$timeout", "$log",
    function ($q, $rootScope, $timeout, $log) {
      
      var DexieSet = (function(){ 
        function DexieSet(query, $scope, arr){
          // When creating the collection, we are going to work off
          // the core array. In order to maintain all of the native
          // array features, we need to build off a native array.
          var collection = {}
          if (!query._ctx.distinct) {
            collection = Object.create( Array.prototype );
            collection = (Array.apply( collection, arr ) || collection);
            DexieSet.injectClassMethods( collection );
          } else {
            collection = Object.create( DexieSet.prototype );
          }
          
          //Create our non-enumerable properties (so forEach doesnt screw us)
          Object.defineProperties(collection, {
            "$query": {
              value: query,
              writable: true
            },
            "$context": {
              value: query._ctx,
              writable: true
            },
            "$scope": {
              value: $scope,
              writable: false
            },
            "$joinListeners": {
              value: [],
              writable: true
            },
            "$listener": {
              value: function() {},
              writable: true
            }
          });
          
          if (query._ctx.distinct) {
            for (var i = 0; i < arr.length; i++) {
              collection[arr[i][query._ctx.table.schema.primKey.name]] = arr[i];
            }
          }

          //Bind the set to a referable listener function
          collection.$bind();
          collection.$scope.$on("$destroy", function() {
            collection.$unbind();
          });
          return( collection );
        }

        // ------------------------------------------------------ //
        // ------------------------------------------------------ //


        // Define the static methods.
        DexieSet.injectClassMethods = function( collection ){
          // Loop over all the prototype methods and add them
          // to the new collection.
          for (var method in DexieSet.prototype){
            if (DexieSet.prototype.hasOwnProperty( method )){
              Object.defineProperty(collection, method, {
                enumberable: false,
                configurable: false,
                writable: false,
                value: DexieSet.prototype[method]
              });
            }
          }
          return( collection );
        };

        // I create a new collection from the given array.
        DexieSet.fromArray = function( context, $scope, array ){
          var collection = DexieSet.apply( null, [context, $scope, array] );

          return( collection );
        };

        // I determine if the given object is an array.
        DexieSet.isArray = function( value ){
          // Get it's stringified version.
          var stringValue = Object.prototype.toString.call( value ); 
          return( stringValue.toLowerCase() === "[object array]" );
        };

        


        // ------------------------------------------------------ //
        // ------------------------------------------------------ //

        // Define the class methods.
        DexieSet.prototype = {
          //Adder helper function
          $add: function(obj) {
            return this.$context.table.add(obj);
          },
          //Update helper function
          $update: function(id, updates) {
            return this.$context.table.update(id, updates)
          },
          //Joins this query with another table on a field from this table to a field in that table
          //table - Table to join to
          //thisField - the field we want to use as the existing query's part of the join
          //thatField - the field in the table we provided as an argument we want to join to
          //filterFunc - optional filter function we want to use to limit the item in the joins table
          $join: function(table, thisField, thatField, filterFunc) {
            var self = this;
            var promises = [];
            var q = new $q.defer();
            var ids = {}
            if (!self.$context.distinct) {
              for(var i = 0; i < this.length; i++) {
                ids[this[i][thisField]] = 1;
              }
            } else {
              for (var prop in self) { 
                if (self.hasOwnProperty(prop) && prop.charAt(0) !== '$') {
                  ids[prop] = 1; 
                }
              }  
            }
            var query = table.where(thatField).anyOf(Object.keys(ids)).distinct();
            if (filterFunc instanceof Function) {
              query = query.and(filterFunc); 
            }
            query.toArray().then(function(res) {
              var res = DexieSet.fromArray(query,self.$scope,res);
              self.$joinListeners.push({set: res, thisField: thisField, thatField: thatField, filter: filterFunc});
              q.resolve(res);
            }).catch(function(err) {
              q.reject(err);    
            });
            return q.promise;
          },

          //Function to reperform the initial query
          $requery: function() {
            this.length = 0;
            var self = this;
            return this.$context.toArray().then(function(data) {
              self.$scope.$apply(function() {
                if (!self.$context.distinct) {
                  self.length = 0;
                  for(var i = 0; i < data.length; i++) {
                    self[i] = data[i];
                  }
                } else {
                  Object.keys(self).each(function(key) {
                    if (key.charAt(0) !== '$') {
                      delete self[key];
                    }
                  });
                  for (var i = 0; i < data.length; i++) {
                    self[data[i][self.$context.table.schema.primKey.name]] = data[i];
                  }
                }
                for(var i = 0; i < self.$joinListeners.length; i++) {
                  var set = self.$joinListeners[i].set
                  var ids = {}
                  if (!self.$context.distinct) {
                    for(var i = 0; i < this.length; i++) {
                      ids[self[i][self.$joinListeners[i].thisField]] = 1;
                    }
                  } else {
                    for (var prop in self) { 
                      if (self.hasOwnProperty(prop) && prop.charAt(0) !== '$') {
                        ids[prop] = 1; 
                      }
                    }                    
                  }
                  var query = set.$context.table.where(self.$joinListeners[i].thatField).anyOf(ids).distinct();
                  if (self.$joinListeners[i].filter instanceof Function) {
                    query = query.and(self.$joinListeners[i].filter);
                  }
                  set.$query = query;
                  set.$context = query._ctx;
                  set.$requery();
                }
              });
            });
          },

          $bind: function() {
            this.$listener = this.$listener_func();
          },

          //Binds this collection to the database 
          $bind_to: function(db) {
            var self = this;
            db.on('changes', function (changes) {
              self.$listener(changes);
            });
          },

          $listener_func: function() {
            var self = this;
            var checkjoinListeners = function(obj) {
              for (var i = 0; i < self.$joinListeners.length; i++) {
                var set = self.$joinListeners[i].set
                if (!set[obj[set.$context.table.schema.primKey.name]]) {
                  var ids = set.$context.anyOf
                  ids.push(obj[self.$joinListeners[i].thisField])
                  var query = set.$context.table.where(self.$joinListeners[i].thatField).anyOf(ids).distinct();
                  var cur_query = set.$context.table.where(self.$joinListeners[i].thatField).equals(obj[self.$joinListeners[i].thisField]).distinct();
                  if (self.$joinListeners[i].filter instanceof Function) {
                    query = query.and(self.$joinListeners[i].filter);
                    cur_query = cur_query.and(self.$joinListeners[i].filter);
                  }
                  set.$query = query;
                  set.$context = query._ctx;
                  (function(set) {
                    cur_query.toArray().then(function(res) {
                      self.$scope.$apply(function() {
                        for (var j = 0; j < res.length; j++) {
                          if (!set[res[j][set.$context.table.schema.primKey.name]])
                            set[res[j][set.$context.table.schema.primKey.name]] = res[j];
                        }
                      });
                    });
                  })(set);
                }
              }
            }
            return function (changes) {
              for (var j = 0; j < changes.length; j++) {
                var change = changes[j];
                for (var i = 0; i < self.$joinListeners.length; i++) {
                  self.$joinListeners[i].set.$listener(changes);
                }
                if (change.table != self.$context.table.name)
                  return;
                self.$scope.$apply(function() {
                  if(change.type == 1) {
                    if (!self.$context.distinct) {
                      for(var i = 0; i < self.length; i++) {
                        if (change.key == self[i][self.$context.table.schema.primKey.name])
                          return;
                      }
                    } else {
                      if (self[change.key])
                        return;
                    }
                    if (self.$context.or || self.$context.offset != 0) {
                      self.$requery(); //Requery (and ignore any other changes -- we will get them on a requery)
                      return;
                    } else {
                      if(self.$filter(change)) {
                        if (!self.$context.distinct) {
                          for (var i = 0; i < self.length; i++) {
                            if (self.$context.dir == "prev") {
                              if (self[i][self.$context.index] <= change.obj[self.$context.index]) {
                                self.splice(i, 0, change.obj);
                                checkjoinListeners(change.obj);
                                return;
                              }
                            } else {
                              if (self[i][self.$context.index] >= change.obj[self.$context.index]) {
                                self.splice(i, 0, change.obj);
                                checkjoinListeners(change.obj);
                                return;
                              }
                            }
                          }
                        } else {
                          self[change.key] = change.obj;
                        }
                      }
                    }
                  } else if (change.type == 2) { //Updated
                    if (!self.$context.distinct) {
                      for(var i = 0; i < self.length; i++) {
                        if(self[i][self.$context.table.schema.primKey.name] == change.key) {
                          if(self.$filter(change)) {
                            self[i] = change.obj;
                            checkjoinListeners(change.obj);
                          }
                          return;
                        }
                      } 
                    }
                    else {
                      if (self[change.key] && self.$filter(change)) {
                        self[change.key] = change.obj;
                        checkjoinListeners(change.obj);
                      }
                    }
                  } else if (change.type == 3) { //Deleted
                    if (self.$context.limit == Infinity) {
                      if (!self.$context.distinct) {
                        for(var i = 0; i < self.length; i++) {
                          if(self[i][self.$context.table.schema.primKey.name] == change.key) {
                            self.splice(i, 1);
                          }
                        }
                      } else {
                        delete self[change.key];
                      }
                    } else { //Do a requery
                      self.$requery();
                      return;
                    }
                  }
                });
              }
            }
          },

          //Unbinds this collection from the database
          $unbind: function() {
            this.$listener = function() {};
          },
          //Filters the change in $context of this collection
          $filter: function(change) {
            if (this.$context.range) {
              if (this.$context.range.lower){
                if (this.$context.range.lowerOpen) {
                  if (change.obj[this.$context.index] <= this.$context.range.lower)
                    return false;
                } else {
                  if (change.obj[this.$context.index] < this.$context.range.lower)
                    return false;
                }
              }
              if (this.$context.range.upper){
                if (this.$context.range.upperOpen) {
                  if (change.obj[this.$context.index] >= this.$context.range.upper)
                    return false;
                } else {
                  if (change.obj[this.$context.index] > this.$context.range.upper)
                    return false;
                }
              }
            }
            if (this.$context.anyOf) {
              for (var i = 0; i < this.$context.anyOf.length; i++) {
                 if (change.obj[this.$context.index] == this.$context.anyOf[i])
                   return true;
              }
              return false;
            }
            if (this.$context.isMatch) {
              if (!this.$context.isMatch(change.obj))
                return false;
            }
            return true; 
          }

        };

        // Return the collection constructor.
        return( DexieSet );
      }).call( {} );      
      
      var bind = function(db, query, $scope) {
        // First complete the binding
        var defer_bind = new $q.defer();
        var table = query._ctx.table
        var changes_data = [];
        var clas = table.schema.mappedClass;

        query.toArray().then(function(data) {
          $scope.$apply(function() {
            changes_data = DexieSet.fromArray(query,$scope,data);
            changes_data.$bind_to(db);
            defer_bind.resolve(changes_data);
          })
        }).catch(function(err) {
          $scope.$apply(function() {
            defer_bind.reject(err);
          });
        });
        return defer_bind.promise;
      }
                       
      return {
        bind: bind
      }
      
    }
  ]);
})();

