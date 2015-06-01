/*! angular-dexie-bind - v0. - 2014-05-20
 * https://github.com/diegopamio/angular-sails-bind
 * Copyright (c) 2014 Diego Pamio; Licensed MIT */
/*global angular:false */
/*global io:false */
/**
 * Angular service to handle SailsJs resources.
 *
 * @author Nathan Hahn - Github: nhahn
 * @return {object} Object of methods
 */

(function() {
  var app = angular.module("ngDexieBind", []);
  app.factory('$dexieBind', [
    '$q', "$rootScope", "$timeout", "$log",
    function ($q, $rootScope, $timeout, $log) {
      var bind = function(db, query, $scope) {
        // First complete the binding
        var defer_bind = new $q.defer();
        var table = query._ctx.table
        var unbind_watch = function() {};
        var unbind_item_watches = []
        var changes_data = [];
        
        var queryDB = function () {
          query.toArray().then(function(data) {
            unbind_watch();
            angular.forEach(unbind_item_watches, function(item) {
              item.unbind();
            });
            changes_data.length = 0;
            for (var i = 0; i < data.length; i++){changes_data.push(data[i]);}
            unbind_item_watches = [];
            angular.forEach(changes_data, function(item) {
              unbind_item_watches.push({id: item[table.schema.primKey.name], unbind: watchSubItem(item, $scope, table)})
            });
            unbind_watch = watch(changes_data);
            defer_bind.resolve(changes_data);
          });
        }
        
        queryDB();
        
        db.on('changes', function(changes) {
          $scope.$apply(function () {
            for (var j = 0; j < changes.length; j++) {
              var change = changes[j]
              if (change.table != table.name)
                continue; //Ignore any updates not for the table we care about
              if(change.type == 1) {
                queryDB(); //Requery (and ignore any other changes -- we will get them on a requery)
                break;
              } else if (change.type == 2) { //Updated
                for(var i = 0; i < changes_data.length; i++) {
                  if(changes_data[i][table.schema.primKey.name] == change.key) {
                    changes_data[i] = change.obj 
                  }
                }
              } else if (change.type == 3) { //Deleted
                if (query._ctx.limit == Infinity) {
                  for(var i = 0; i < changes_data.length; i++) {
                    if(changes_data[i][table.schema.primKey.name] == change.key) {
                      changes_data.splice(i, 1);
                      unbind_item_watches[i].unbind();
                      unbind_item_watches.splice(i,1);
                    }
                  }
                } else { //Do a requery
                  queryDB();
                  break;
                }
              }
            }
          });
        });
        var addItem = function (item) {
          table.put(angular.copy(item)).then(function(data) {
            angular.extend(item, data);
            $rootScope.$broadcast(table.name, { id: item.id, verb: 'created', scope: $scope.$id, data: angular.copy(item) });
            watchSubItem(item, $scope, table);
          }).catch(function(err) {
            $rootScope.$broadcast(table.name, { verb: 'createError', scope: $scope.$id, errors: err, item: angular.copy(item) });
            //Don't add the item to the collection -- there was an error with it
            newValues.splice(idx, 1);
          });
        }
        
        var watch = function (data) {
          return $scope.$watchCollection(function() { return data }, function (newValues, oldValues) {
            var addedElements, removedElements;
            newValues = newValues || [];
            oldValues = oldValues || [];
            addedElements =  diff(newValues, oldValues);
            removedElements = diff(oldValues, newValues);

            removedElements.forEach(function (item) {
              table.get(item[table.schema.primKey.name]).then(function (itemIsOnBackend) {
                if (itemIsOnBackend) {
                  $rootScope.$broadcast(table.name, { id: item.id, verb: 'destroyed', scope: $scope.$id });
                  table.delete(item[table.schema.primKey.name]).then(function(dele) {
                    if (query._ctx.limit == Infinity) { queryDB(); }
                  })
                }
              }).catch(function(err) { 
                console.log(err);
              });
            });

            addedElements.forEach(function (item, idx) {
              if(item[table.schema.primKey.name]) {
                table.get(item[table.schema.primKey.name]).then(function (itemIsOnBackend) {
                  if (!itemIsOnBackend) {
                    addItem(item, idx) 
                  }
                });
              } else {
                
              }
            });
          });
        };
        
        return defer_bind.promise;
      }
                       
      var watchSubItem = function (item, scope, table) {
        return scope.$watchCollection(
          function(curScope) { return item },
          function (newValue, oldValue) {
            if (oldValue && newValue) {
              if (!angular.equals(oldValue, newValue) && // is in the database and is not new
                  oldValue.id == newValue.id) { //is not an update FROM backend

                  table.put(angular.copy(newValue), oldValue.id).then(function(item) {
                    angular.extend(newValue, item);
                    $rootScope.$broadcast(table.name, { id: oldValue.id, verb: 'updated', scope: $scope.$id, data: angular.copy(newValue) });
                  }).catch(function(err) { 
                    newValue = angular.copy(oldValue);
                    $rootScope.$broadcast(table.name, { id: oldValue.id, verb: 'updateError', scope: $scope.$id, error: angular.copy(data), item: angular.copy(newValue)});
                  });
              }
            }
          }
        );
      };
      return {
        bind: bind
      }
    }
  ]);
})();

