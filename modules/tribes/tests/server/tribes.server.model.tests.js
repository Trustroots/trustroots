/**
 * Module dependencies.
 */
const path = require('path');
const should = require('should');
const mongoose = require('mongoose');
const validator = require('validator');
const config = require(path.resolve('./config/config'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const Tribe = mongoose.model('Tribe');

/**
 * Globals
 */
let tribe1;
// let tribe2;
let tribe3;

/**
 * Unit tests
 */
describe('Tribe Model Unit Tests:', function () {
  before(function () {
    tribe1 = new Tribe({
      label: 'Tribe label',
    });
    /*
    tribe2 = new Tribe({
      label: 'Tribe label',
    });
    */
    tribe3 = new Tribe({
      label: 'Different tribe label',
    });
  });

  after(utils.clearDatabase);

  describe('Method Save', function () {
    it('should begin with no tribes', function (done) {
      Tribe.find({}, function (err, tribes) {
        tribes.should.have.length(0);
        done();
      });
    });

    it('should be able to save without problems', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.save(function (err) {
        should.not.exist(err);
        _tribe.remove(function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('should be able to save without problems and have correct default values', function (done) {
      const _tribe = new Tribe(tribe1);
      _tribe.save(function (err) {
        should.not.exist(err);
        _tribe.synonyms.should.be.an.Array();
        _tribe.synonyms.length.should.eql(0);
        _tribe.labelHistory.should.be.an.Array();
        _tribe.labelHistory.length.should.eql(0);
        _tribe.slugHistory.should.be.an.Array();
        _tribe.slugHistory.length.should.eql(0);
        _tribe.slug.should.equal('tribe-label');
        _tribe.count.should.eql(0);
        should.exist(_tribe.color);
        _tribe.color.should.not.containEql('#');
        validator.isHexadecimal(_tribe.color).should.equal(true);
        should.exist(_tribe.created);

        done();
      });
    });

    /*
    // Disabled reason: flaky test
    it('should fail to save an existing tribe again', function (done) {
      const _tribe = new Tribe(tribe1);
      const _tribe2 = new Tribe(tribe2);

      _tribe.save(function () {
        _tribe2.save(function (err) {
          should.exist(err);
          done();
        });
      });
    });
    */

    it('should confirm that saving tribe model doesnt change the color', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.save(function (err) {
        should.not.exist(err);
        const colorBefore = _tribe.color;
        _tribe.label = 'test';
        _tribe.save(function (err) {
          should.not.exist(err);
          const colorAfter = _tribe.color;
          colorBefore.should.equal(colorAfter);
          done();
        });
      });
    });

    it('should be able to save 2 different tribes', function (done) {
      const _tribe = new Tribe(tribe1);
      const _tribe3 = new Tribe(tribe3);

      _tribe.save(function (err) {
        should.not.exist(err);
        _tribe3.save(function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('should show error when trying to save tribe with invalid attribution URL', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.attribution_url = 'this-is-not-URL';
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });
  });

  describe('Slug generator', function () {
    it('should generate slug for label with accents and special symbols', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'Hyvää päivää, herra Hüü!';
      _tribe.save(function (err) {
        should.not.exist(err);
        _tribe.slug.should.equal('hyvaa-paivaa-herra-huu');
        done();
      });
    });

    it('should generate slug from unicode label', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'unicode ♥';
      _tribe.save(function (err) {
        should.not.exist(err);
        _tribe.slug.should.equal('unicode-love');
        done();
      });
    });
  });
  describe('Label Validation', function () {
    it('should be able to show an error when try to save without label', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.label = '';
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when try to save with not allowed label', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.label = config.illegalStrings[0];
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save tribe label beginning with .', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.label = '.label';
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save tribe label end with .', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'label.';
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should save label with dot', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'lab.el';
      _tribe.save(function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save label shorter than 2 character', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 's';
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should save label with all capital letters', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'LABEL';
      _tribe.save(function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save a label without at least one alpha character', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.label = '1234567890';
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save a label longer than 255 characters', function (done) {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'l'.repeat(256);
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });
  });
});
