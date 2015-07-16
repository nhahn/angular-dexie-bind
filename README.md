[![devDependency Status](https://david-dm.org/nhahn/angular-dexie-bind/dev-status.svg)](https://david-dm.org/nhahn/angular-dexie-bind#info=devDependencies)

Angular Dexie Bind
==================

** A special thanks to [angular-sails-bind](https://github.com/diegopamio/angular-sails-bind) for giving me this idea and as a starting point for this module **

This module provides an Angular JS service that allows you to bind a Dexie.js query to an angular variable. This is accomplished (and maintained) in one line

```javascript
$dexieBind.bind(db, db.TableName.where('key').equals('some_val'), $scope);
```

The `bind` command performs the folling functions:
- Returns a $q promise that will resolve once the query is complete
- Watches for any changes in your Dexie.js flavored IndexDB database using [Dexie Observable]()
- Filters the results returned from the Dexie.js db so that it follows the parameters provided by your query
- Allows you to join other tables to this query by calling `$join` on the set returned from the promise
- If the *distinct* option was used in Dexie, instead of an `Array` being returned, the result is an `Object` with the primary key of the table as the key for each record in the object.
- If the scope is destroyed, the binding is removed from Dexie Observable. 

NOTE: You have to bind to a query that returns a collection, so binding on something like first() doesn't work. 

Installation
------------

First, make sure you have included the Dexie.js and Dexie.Observable.js files before this one. Finally, include this javascript file, and in your angular app, include the `ngDexieBind` service. This will provide you with the `$dexieBind` variable you can create new bindings from. 

Testing
------------
There are some unit tests written and included for this library. It's not a fully featured suite yet, but I hope to eventually get it there. Any contributions to this extension are most welcome!
