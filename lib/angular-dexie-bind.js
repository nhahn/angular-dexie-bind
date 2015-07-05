/*! angular-dexie-bind - v0.0.2 - 2015-07-01
 * https://github.com/nhahn/angular-dexie-bind
 * Nathan Hahn; Licensed MIT */
/*global angular:false */
/*global io:false */
/**
 * Angular service to manage integration with Dexie.js 
 *
 * @author Nathan Hahn - Github: nhahn
 * @return {object} Object of methods
 */

(function () {
  var changeListeners = {};
  //Have one listener for all of our changes, and inform the appropritate binds
  db.on('ready', function () {
    db.on('changes', function (changes) {
      for (var j = 0; j < changes.length; j++) {
        var change = changes[j];
        var listeners = changeListeners[change.table];
        if (listeners) {
          for(var i = 0; i < listeners.length; i++) {
            listeners[i](change);
          }
        }
      }
    });
  });

  window.DexieSet = (function(){ 
    function DexieSet(query, $scope, arr){
      // When creating the collection, we are going to work off
      // the core array. In order to maintain all of the native
      // array features, we need to build off a native array.
      var collection = Object.create( Array.prototype );

      // Initialize the array. This line is more complicated than
      // it needs to be, but I'm trying to keep the approach
      // generic for learning purposes.
      collection = (Array.apply( collection, arr ) || collection);
      collection["query"] = query;
      collection["context"] = query._ctx;
      collection["$scope"] = $scope;
      collection["$listener"] = function (change) {
        $scope.$apply(function() {
          if(change.type == 1) {
            for(var i = 0; i < collection.length; i++) {
              if (change.obj[collection.context.table.schema.primKey.name] == collection[i][collection.context.table.schema.primKey.name])
                return;
            }
            if (collection.context.or || collection.context.offset != 0) {
              collection.$requery(); //Requery (and ignore any other changes -- we will get them on a requery)
              return;
            } else {
              if(collection.$filter(change)) {
                for (var i = 0; i < collection.length; i++) {
                  if (collection.context.dir == "prev") {
                    if (collection[i][collection.context.index] <= change.obj[collection.context.index]) {
                      collection.splice(i, 0, new DexieRecord(collection.context, collection.$scope, change.obj));
                      return;
                    }
                  } else {
                    if (collection[i][collection.context.index] >= change.obj[collection.context.index]) {
                      collection.splice(i, 0, new DexieRecord(collection.context, collection.$scope, change.obj));
                      return;
                    }
                  }
                }
              }
            }
          } else if (change.type == 2) { //Updated
            for(var i = 0; i < collection.length; i++) {
              if(collection[i][collection.context.table.schema.primKey.name] == change.key) {
                if(collection.$filter(change)) {
                  collection[i] = new DexieRecord(collection.context, collection.$scope, change.obj);
                }
                return;
              }
            }
          } else if (change.type == 3) { //Deleted
            if (collection.context.limit == Infinity) {
              for(var i = 0; i < collection.length; i++) {
                if(collection[i][collection.context.table.schema.primKey.name] == change.key) {
                  collection.splice(i, 1);
                }
              }
            } else { //Do a requery
              collection.$requery();
              return;
            }
          }
        });
      }
      // Add all the class methods to the collection.
      DexieSet.injectClassMethods( collection );
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
          collection[ method ] = DexieSet.prototype[ method ];
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
      $add: function(obj) {
        //Adds the object to the database
        return this.context.table.add(obj)/*.then(function(ret) {
          $scope.$apply(function() {
            if (filter(ret)){
              this.push(ret);
            }
          });
        });*/
      },

      $update: function(id, updates) {
        return this.context.table.update(id, updates)
      },

      $delete: function(id) {
        return this.context.table.delete(id)
      },

      //Join the table to this one
      //arg val: 
      //arg table: 
      //arg remote: if val is in remote table or not
  //    $join: function(val, table, remote) {
  //      for(var i = 0; i < this.length, i++){
  //        if (remote) {
  //          table.where(val).equals(this[i].id).then(function(res) {
  //            this[i][this[i].table.name+"s"] = 
  //          });
  //        } else {
  //          if (this.val[i])
  //        }
  //      }
  //    },

      $requery: function() {
        this.length = 0;
        return this.query.toArray().then(function(data) {
          this.$scope.$apply(function() {
            for(var i = 0; i < data.length; i++) {
              this[i] = new DexieRecord(this.context, this.$scope, data[i]);
            }
          });
        });
      },
      
      $bind: function() {
        changeListeners[this.context.table.name] = changeListeners[this.context.table.name] || [];
        changeListeners[this.context.table.name].push(this.$listener);
      },

      $unbind: function() {
        for (var i = 0; i < changeListeners[this.$listener.table.name].length; i++){
          if (this.$listener == changeListeners[this.$listener.table.name][i]) 
            changeListeners[this.$listener.table.name].splice(i, 1);
        }
      },

      $filter: function(change) {
        if (this.context.range) {
          if (this.context.range.lower){
            if (this.context.range.lowerOpen) {
              if (change.obj[this.context.index] <= this.context.range.lower)
                return false;
            } else {
              if (change.obj[this.context.index] < this.context.range.lower)
                return false;
            }
          }
          if (this.context.range.upper){
            if (this.context.range.upperOpen) {
              if (change.obj[this.context.index] >= this.context.range.upper)
                return false;
            } else {
              if (change.obj[this.context.index] > this.context.range.upper)
                return false;
            }
          }
        }
        if (this.context.isMatch) {
          if (!this.context.isMatch(change.obj))
            return false;
        }
        return true; 
      }

    };

    // Return the collection constructor.
    return( DexieSet );
  }).call( {} );

  window.DexieRecord = (function() {
    function DexieRecord(context, $scope, obj) {
       for (var method in DexieRecord.prototype){
        if (DexieRecord.prototype.hasOwnProperty( method )){
          obj[ method ] = DexieRecord.prototype[ method ];
        }
      }
      obj.$context = context;
      obj.$scope = $scope;
      return( obj );
    }

    DexieRecord.prototype = {

      $copy: function() {
        var clone = {}
        for (var property in this) {
          if (this.hasOwnProperty(property) && !property.match(/^\$/)) {
             clone[property] = this[property];
          }
        }
        return clone;
      },

      $save: function() {
        return this.$context.table.put(this.$copy());
      }
    }

    return( DexieRecord );
  }).call( {} );
  
  //TODO update factory requirements
  
  //Finally, define our angular module
  var app = angular.module("ngDexieBind", []);
  app.factory('$dexieBind', [
    '$q', "$rootScope", "$timeout", "$log",
    function ($q, $rootScope, $timeout, $log) {
      var bind = function(db, query, $scope) {
        // First complete the binding
        var defer_bind = new $q.defer();
        var table = query._ctx.table
        var changes_data = [];
        var clas = table.schema.mappedClass;
        
        query.toArray().then(function(data) {
          $scope.$apply(function() {
            for(var i = 0; i < data.length; i++) {
              data[i] = new DexieRecord(query._ctx, $scope, data[i]);
            }
            changes_data = DexieSet.fromArray(query,$scope,data);
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

