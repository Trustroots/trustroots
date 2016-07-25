'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    config = require(path.resolve('./config/config')),
    should = require('should'),
    mongoose = require('mongoose'),
    validator = require('validator'),
    Tag = mongoose.model('Tag');

/**
 * Globals
 */
var tag,
    tag2,
    tag3;

/**
 * Unit tests
 */
describe('Tag Model Unit Tests:', function() {

  before(function() {
    tag = new Tag({
      'label': 'Tag label'
    });
    tag2 = new Tag({
      'label': 'Tag label'
    });
    tag3 = new Tag({
      'label': 'Different tag label'
    });
  });

  describe('Method Save', function() {
    it('should begin with no tags', function (done) {
      Tag.find({}, function (err, tags) {
        tags.should.have.length(0);
        done();
      });
    });

    it('should be able to save without problems', function (done) {
      var _tag = new Tag(tag);

      _tag.save(function (err) {
        should.not.exist(err);
        _tag.remove(function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('should be able to save without problems and have correct default values', function (done) {
      var _tag = new Tag(tag);

      _tag.save(function (err) {
        should.not.exist(err);
        _tag.tribe.should.equal(false);
        _tag.synonyms.should.be.an.Array();
        _tag.synonyms.should.be.empty();
        _tag.labelHistory.should.be.an.Array();
        _tag.labelHistory.should.be.empty();
        _tag.slugHistory.should.be.an.Array();
        _tag.slugHistory.should.be.empty();
        _tag.slug.should.equal('tag-label');
        _tag.count.should.eql(0);
        should.exist(_tag.color);
        _tag.color.should.not.containEql('#');
        validator.isHexadecimal(_tag.color).should.equal(true);
        should.exist(_tag.created);

        _tag.remove(function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('should fail to save an existing tag again', function (done) {
      var _tag = new Tag(tag);
      var _tag2 = new Tag(tag2);

      _tag.save(function () {
        _tag2.save(function (err) {
          should.exist(err);
          _tag.remove(function (err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('should confirm that saving tag model doesnt change the color', function (done) {
      var _tag = new Tag(tag);

      _tag.save(function (err) {
        should.not.exist(err);
        var colorBefore = _tag.color;
        _tag.label = 'test';
        _tag.save(function (err) {
          var colorAfter = _tag.color;
          colorBefore.should.equal(colorAfter);
          _tag.remove(function (err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('should be able to save 2 different tags', function(done) {
      var _tag = new Tag(tag);
      var _tag3 = new Tag(tag3);

      _tag.save(function(err) {
        should.not.exist(err);
        _tag3.save(function(err) {
          should.not.exist(err);
          _tag3.remove(function(err) {
            should.not.exist(err);
            _tag.remove(function(err) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('should show error when trying to save tag with invalid attribution URL', function(done) {
      var _tag = new Tag(tag);

      _tag.attribution_url = 'this-is-not-URL';
      _tag.save(function(err) {
        should.exist(err);
        done();
      });
    });

  });

  describe('Slug generator', function() {

    it('should generate slug for label with accents and special symbols', function (done) {
      var _tag = new Tag(tag);

      _tag.label = 'Hyvää päivää, herra Hüü!';
      _tag.save(function (err) {
        should.not.exist(err);
        _tag.slug.should.equal('hyvaa-paivaa-herra-huu');
        _tag.remove(function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('should generate slug from unicode label', function (done) {
      var _tag = new Tag(tag);

      _tag.label = 'unicode ♥';
      _tag.save(function (err) {
        should.not.exist(err);
        _tag.slug.should.equal('unicode-love');
        _tag.remove(function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

  });
  describe('Label Validation', function() {

    it('should be able to show an error when try to save without label', function (done) {
      var _tag = new Tag(tag);

      _tag.label = '';
      _tag.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when try to save with not allowed label', function (done) {
      var _tag = new Tag(tag);

      _tag.label = config.illegalStrings[0];
      _tag.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save tag label beginning with .', function(done) {
      var _tag = new Tag(tag);

      _tag.label = '.label';
      _tag.save(function(err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save tag label end with .', function(done) {
      var _tag = new Tag(tag);

      _tag.label = 'label.';
      _tag.save(function(err) {
        should.exist(err);
        done();
      });
    });

    it('should save label with dot', function(done) {
      var _tag = new Tag(tag);

      _tag.label = 'lab.el';
      _tag.save(function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save label shorter than 2 character', function(done) {
      var _tag = new Tag(tag);

      _tag.label = 's';
      _tag.save(function(err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save a label without at least one alpha character', function(done) {
      var _tag = new Tag(tag);

      _tag.label = '1234567890';
      _tag.save(function(err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save a label longer than 255 characters', function(done) {
      var _tag = new Tag(tag);

      _tag.label = 'l'.repeat(256);
      _tag.save(function(err) {
        should.exist(err);
        done();
      });
    });

  });

  afterEach(function(done) {
    Tag.remove().exec(done);
  });
});
