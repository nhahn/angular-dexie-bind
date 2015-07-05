db = new Dexie('test');
db.version(1).stores({
  test: '$$id,age,&nickname'
});
Dexie.delete('test').then(function() {
  return db.open()
}).then(function() {
  done();
}).catch(function(err) {
  done(err);
});