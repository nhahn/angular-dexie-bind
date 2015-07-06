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

  describe('the bind function', function() {
    beforeEach(function(done) {
      db.transaction('rw', db.test, function() {
        db.test.add({name: 'person1', age: 5, nickname: "bob"})
        db.test.add({name: 'person2', age: 9, nickname: "jimmie"})
        db.test.add({name: 'person3', age: 12, nickname: "timmy"})
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
    })

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
        $rootScope.test[0].name = "person6"
        $rootScope.test[0].$save()
        setTimeout(function() {
          db.test.where('nickname').equals('bob').first().then(function(rec) {
            expect(rec.name).to.equal("person6")
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
  });
});
