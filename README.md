Angular Dexie Bind
==================

** A special thanks to [angular-sails-bind](https://github.com/diegopamio/angular-sails-bind) for giving me this idea and as a starting point for this module **

This module provides an Angular JS service that allows you to bind a Dexie.js query to an angular variable. This is accomplished (and maintained) in one line

```javascript
var query = $dexieBind.bind(db.TableName.where('key').equals('some_val'), $scope);
```

This *magic* command performs the folling functions:
- Watches for any changes in your Dexie.js flavored IndexDB database using [Dexie Observable]()
- Checks and automatically updates the Dexie db whenever the array the query is bound to is updated
- Watches the individual items in the array, and updates their corresponding record whenever they are changed

Installation
------------


