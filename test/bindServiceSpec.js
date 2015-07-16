var app;
var expect = chai.expect;

describe('the angular Dexie bind service', function() {
  this.timeout(10000);
  //Setup our database
  before(function(done) {
    db.on('ready', function() {
      done();
    })
  });
  
  after(function(done) {
    Dexie.delete('test').then(function() {
      done();
    });
  });

  beforeEach(function () {
    app = angular.module("testApp", ['ngDexieBind']);
    module('testApp')
    inject(function (_$dexieBind_) { 
      $dexieBind = _$dexieBind_;
    });
    inject(function (_$rootScope_) {
      $rootScope = _$rootScope_;
    });
    inject(function ($injector) {
      $timeout = $injector.get('$timeout');
    });
    inject(function (_$q_) {
      $q = _$q_;
    });
  });

  it('should have a bind function', function() {
    expect(angular.isFunction($dexieBind.bind)).to.be.true;
  });

  describe('a single table', function() {
    beforeEach(function(done) {
      db.transaction('rw', db.test, function() {
        db.test.add({name: 'person1', age: 5, nickname: "bob"});
        db.test.add({name: 'person2', age: 9, nickname: "jimmie"});
        db.test.add({name: 'person3', age: 12, nickname: "timmy"});
      }).then(function() {
        //$timeout.flush();
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    afterEach(function(done) {
      db.test.clear().then(function() {
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    describe('a simple where bound variable', function() {

      beforeEach(function(done) {
        $dexieBind.bind(db, db.test.where('age').equals(5), $rootScope).then(function(test) {
          $rootScope.test = test;
          done();
        }).catch(function(err) { 
          done(err);
        });
      });

      it('should have the right record', function() { 
        expect($rootScope.test[0].name).to.equal('person1');
      });

      it('should have a $join function we can use', function() { 
        expect(angular.isFunction($rootScope.test.$join)).to.be.true;
      });
      
      it('should update when a new record is added', function(done) {
        db.test.add({person: 'person4', age: 5, nickname: 'joey'}).catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          expect($rootScope.test.length).to.equal(2);
          done();
        }, 100);
      });

      it('should remove the oject when a record is deleted', function(done) {
        db.test.where('nickname').equals('bob').delete().catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          expect($rootScope.test.length).to.equal(0);
          done();
        }, 100);
      });

      it('should update the oject when the record is updated', function(done) {
        db.test.where('nickname').equals('bob').first().then(function(rec) {
          return db.test.update(rec.id, {name: 'person6'});
        }).catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          expect($rootScope.test[0].name).to.equal('person6');
          done();
        }, 100);
      });
      
      it('should update database object when modified in angular', function(done) {
        $rootScope.test[0].name = "person6";
        $rootScope.test[0].save();
        setTimeout(function() {
          db.test.where('nickname').equals('bob').first().then(function(rec) {
            expect(rec.name).to.equal("person6");
            done();
          }).catch(function(err) {
            done(err);
          });
        }, 100);
      });
      
      it('should not update the angular binding when the record doesn\'t apply', function(done) {
        db.test.add({person: 'person4', age: 13, nickname: 'mickey'}).catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          expect($rootScope.test.length).to.equal(1);
          done();
        }, 100);
      });
      
      it('should have the right mapped class for any objects added with the binding', function(done) {
       db.test.add({person: 'person4', age: 5, nickname: 'joey'}).catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          expect($rootScope.test[0]).to.be.an.instanceof(Friend);
          expect($rootScope.test[1]).to.be.an.instanceof(Friend);
          done();
        }, 100); 
      });
    
    });
    describe('multiple bound variables', function() {

      beforeEach(function(done) {
        $dexieBind.bind(db, db.test.where('age').equals(5), $rootScope).then(function(test) {
          $rootScope.first = test;
          return $dexieBind.bind(db, db.test.where('age').equals(9), $rootScope);
        }).then(function(test) {
          $rootScope.second = test;
          done();
        }).catch(function(err) { 
          done(err);
        });
        
      });
    
      it('should only have the bound records for each binding', function(done) {
        expect($rootScope.first[0].name).to.equal('person1');
        expect($rootScope.second[0].name).to.equal('person2');
        done();
      });
          
      it('should only update the respective bindings when a record is added', function(done) {
        db.test.add({person: 'person4', age: 5, nickname: 'joey'}).catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          expect($rootScope.first.length).to.equal(2);
          expect($rootScope.second.length).to.equal(1);
          done();
        }, 100);
      });
      
      it('should only update the respective bindings when a record is removed', function(done) {
        db.test.where('nickname').equals('jimmie').delete().catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          expect($rootScope.first.length).to.equal(1);
          expect($rootScope.second.length).to.equal(0);
          done();
        }, 100);
      });
      
    });
    
    describe('a bound variable using the distinct function', function() {

      beforeEach(function(done) {
        $dexieBind.bind(db, db.test.where('age').equals(5).distinct(), $rootScope).then(function(test) {
          $rootScope.test = test;
          done();
        }).catch(function(err) { 
          done(err);
        });
      });

      it('should only have records as enumerable properties', function() { 
        expect(Object.keys($rootScope.test).length).to.equal(1);
        var cnt = 0;
        angular.forEach($rootScope.test, function() {
          cnt++;
        });
        expect(cnt).to.equal(1);
      });
      
      it('should have the right record in an object', function() { 
        expect($rootScope.test[Object.keys($rootScope.test)[0]].name).to.equal('person1');
      });

      it('should update when a new record is added', function(done) {
        db.test.add({person: 'person4', age: 5, nickname: 'joey'}).catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          expect(Object.keys($rootScope.test).length).to.equal(2);
          done();
        }, 100);
      });

      it('should remove the oject when a record is deleted', function(done) {
        db.test.where('nickname').equals('bob').delete().catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          expect(Object.keys($rootScope.test).length).to.equal(0);
          done();
        }, 100);
      });

      it('should update the oject when the record is updated', function(done) {
        db.test.where('nickname').equals('bob').first().then(function(rec) {
          return db.test.update(rec.id, {name: 'person6'});
        }).catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          expect($rootScope.test[Object.keys($rootScope.test)[0]].name).to.equal('person6');
          done();
        }, 100);
      });
      
      it('should update database object when modified in angular', function(done) {
        $rootScope.test[Object.keys($rootScope.test)[0]].name = "person6";
        $rootScope.test[Object.keys($rootScope.test)[0]].save();
        setTimeout(function() {
          db.test.where('nickname').equals('bob').first().then(function(rec) {
            expect(rec.name).to.equal("person6");
            done();
          }).catch(function(err) {
            done(err);
          });
        }, 100);
      });
      
      it('should not update the angular binding when the record doesn\'t apply', function(done) {
        db.test.add({person: 'person4', age: 13, nickname: 'mickey'}).catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          expect(Object.keys($rootScope.test).length).to.equal(1);
          done();
        }, 100);
      });
      
      it('should have the right mapped class for any objects added with the binding', function(done) {
       db.test.add({person: 'person4', age: 5, nickname: 'joey'}).catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          expect($rootScope.test[Object.keys($rootScope.test)[0]]).to.be.an.instanceof(Friend);
          expect($rootScope.test[Object.keys($rootScope.test)[1]]).to.be.an.instanceof(Friend);
          done();
        }, 100); 
      });
    
    });
    
  });
  
  describe('a group of tables', function() {
    beforeEach(function(done) {
      db.transaction('rw', db.test, function() {
        db.test.add({name: 'person1', age: 5, nickname: "bob"});
        db.test.add({name: 'person2', age: 9, nickname: "jimmie"});
        db.test.add({name: 'person3', age: 12, nickname: "timmy"});
        return db.test.where('nickname').equals('jimmie').first()
      }).then(function(rec) {
        return db.transaction('rw', db.shoe, db.test, function() {
          db.shoe.add({friend: rec.id, brand: 'Nike', size: 7});
          db.shoe.add({friend: rec.id, brand: 'Kenneth Cole', size: 8});
          return db.test.where('nickname').equals('timmy').first()
        })
      }).then(function(rec) {
        return db.transaction('rw', db.shoe, db.test, function() {
          db.shoe.add({friend: rec.id, brand: 'Rebock', size: 9});
          db.shoe.add({friend: rec.id, brand: 'Vans', size: 8});
        })        
      }).then(function() {
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    afterEach(function(done) {
      db.test.clear().then(function() {
        return db.shoe.clear();
      }).then(function() {
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    describe('a joined set of tables', function() {

      beforeEach(function(done) {
        $dexieBind.bind(db, db.test.where('age').equals(9), $rootScope).then(function(test) {
          $rootScope.test = test;
          return $rootScope.test.$join(db.shoe, 'id', 'friend');
        }).then(function(shoes) {
          $rootScope.shoes = shoes;
          done();
        }).catch(function(err) { 
          done(err);
        });
      });
     
      it('should have the right records bound', function(done) { 
        expect($rootScope.test[0].name).to.equal('person2');
        db.test.where('nickname').equals('jimmie').first().then(function(friend) {
          return db.shoe.where('friend').equals(friend.id).toArray();
        }).then(function(shoes) {
          shoes = shoes.map(function(item) { return item.id });
          expect($rootScope.shoes).to.have.all.keys(shoes);
          done();
        }).catch(function(err) { 
          done(err);
        });
      });
      
      it('should update the joined records if they are modified', function(done) {
        var id = ''
        db.shoe.where('brand').equals('Nike').first().then(function (shoe){
          id = shoe.id;
          return db.shoe.update(shoe.id, {size: 10});
        }).catch(function(err) {
          done(err);
        });
        
        setTimeout(function() {
          expect($rootScope.shoes[id].size).to.equal(10);
          done();
        }, 100); 
      });
      
      it('should add a record to the joined table if it is added', function(done) {
        db.test.where('nickname').equals('jimmie').first().then(function (rec){
          return db.shoe.add({friend: rec.id, brand: 'Rebock', size: 6});
        }).catch(function(err) {
          done(err);
        });
        
        setTimeout(function() {
          expect(Object.keys($rootScope.shoes).length).to.equal(3);
          done();
        }, 100); 
      });
          
      it('should remove a record from the joined table if it is removed', function(done) {
        db.shoe.where('brand').equals('Kenneth Cole').delete().catch(function(err) {
          done(err);
        });
        setTimeout(function() {
          var brand = [];
          expect(Object.keys($rootScope.shoes).length).to.equal(1);
          angular.forEach($rootScope.shoes, function(val, key) {
            brand.push(val.brand);
          });
          expect(brand).to.include('Nike');
          done();
        }, 100); 
      });
      
      it('should populate any additional joined records for any records added to the initial query', function(done) {
        db.test.add({name: 'person4', age: 9, nickname: "james"}).then(function (rec){
          return db.shoe.add({friend: rec, brand: 'Rebock', size: 11});
        }).then(function(rec) {
          setTimeout(function() {
            expect($rootScope.test.length).to.equal(2);
            expect(Object.keys($rootScope.shoes).length).to.equal(3);
            expect($rootScope.shoes[rec].brand).to.equal('Rebock');
            done();
          }, 100);
        }).catch(function(err) {
          done(err);
        });
      });
      
      
      
    }); 
  }); 
});
