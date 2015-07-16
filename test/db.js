db = new Dexie('test');
db.version(1).stores({
  test: '$$id,age,&nickname',
  shoe: '$$id,friend,brand'
});
Friend = db.test.defineClass({
  age: Number,
  nickname: String,
  name: String
});

Friend.prototype.save = function() {
  db.test.put(this);
}

Shoe = db.shoe.defineClass({
  friend: String,
  brand: String,
  size: Number
});

Shoe.prototype.save = function() {
  db.shoe.put(this);
}

Dexie.delete('test').then(function() {
  return db.open()
})
