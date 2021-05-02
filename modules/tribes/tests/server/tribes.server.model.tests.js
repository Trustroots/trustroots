/**
 * Module dependencies.
 */
const path = require('path');
const should = require('should');
const mongoose = require('mongoose');
const validator = require('validator');
<<<<<<< Updated upstream
const config = require(path.resolve('./config/config'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const Tribe = mongoose.model('Tribe');

/**
 * Globals
 */
let tribe1;
// let tribe2;
let tribe3;
=======

// const config = require(path.resolve('./config/config'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const Tribe = mongoose.model('Tribe');
>>>>>>> Stashed changes

/**
 * Unit tests
 */
<<<<<<< Updated upstream
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
=======
describe('Tribe Model Unit Tests:', () => {
  afterEach(utils.clearDatabase);

  describe('Method Save', () => {
    it('should be able to save without problems and have correct default values', async () => {
      const _circle = new Tribe({ label: 'Example circle' });
      const circle = await _circle.save();

      circle.synonyms.should.be.an.Array();
      circle.synonyms.length.should.eql(0);
      circle.labelHistory.should.be.an.Array();
      circle.labelHistory.length.should.eql(0);
      circle.slugHistory.should.be.an.Array();
      circle.slugHistory.length.should.eql(0);
      circle.slug.should.equal('example-circle');
      circle.count.should.eql(0);
      should.exist(circle.color);
      circle.color.should.not.containEql('#');
      validator.isHexadecimal(circle.color).should.equal(true);
      should.exist(circle.created);
    });

    it('show error when saving duplicate circles (label exists)', async () => {
      const circle1 = new Tribe({ label: 'Example circle' });
      const circle2 = new Tribe({ label: 'Example circle' });

      // the first circle should be successfully saved
      await should(circle1.save()).be.resolved();

      // the second circle should fail with unique error
      const err = await should(circle2.save()).be.rejected();
      should(err)
        .have.property('errors')
        .match({
          label: { kind: 'unique' },
>>>>>>> Stashed changes
        });
    });

    it('should confirm that saving circle again does not change the color', async () => {
      const _circle = new Tribe({ label: 'Example' });
      const circle = await _circle.save();
      const colorBefore = circle.color;

      circle.label = 'Example 2';

<<<<<<< Updated upstream
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
=======
      const circle2ndSave = await circle.save();
      circle2ndSave.color.should.equal(colorBefore);
>>>>>>> Stashed changes
    });
    */

    it('shoul error when trying to save circle with invalid attribution URL', async () => {
      const circle = new Tribe({
        label: 'Exaomple',
        attribution_url: 'this-is-not-URL',
      });

      await should(circle.save()).be.rejected();
    });
  });

  /*
  describe('Slug generator', () => {
    it('should generate slug for label with accents and special symbols', async () => {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'Hyvää päivää, herra Hüü!';
      _tribe.save(function (err) {
        should.not.exist(err);
        _tribe.slug.should.equal('hyvaa-paivaa-herra-huu');
        done();
      });
    });

    it('should generate slug from unicode label', async () => {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'unicode ♥';
      _tribe.save(function (err) {
        should.not.exist(err);
        _tribe.slug.should.equal('unicode-love');
        done();
      });
    });
  });
  describe('Label Validation', () => {
    it('should be able to show an error when try to save without label', async () => {
      const _tribe = new Tribe(tribe1);

      _tribe.label = '';
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when try to save with not allowed label', async () => {
      const _tribe = new Tribe(tribe1);

      _tribe.label = config.illegalStrings[0];
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save tribe label beginning with .', async () => {
      const _tribe = new Tribe(tribe1);

      _tribe.label = '.label';
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save tribe label end with .', async () => {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'label.';
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should save label with dot', async () => {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'lab.el';
      _tribe.save(function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save label shorter than 2 character', async () => {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 's';
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should save label with all capital letters', async () => {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'LABEL';
      _tribe.save(function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save a label without at least one alpha character', async () => {
      const _tribe = new Tribe(tribe1);

      _tribe.label = '1234567890';
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when trying to save a label longer than 255 characters', async () => {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'l'.repeat(256);
      _tribe.save(function (err) {
        should.exist(err);
        done();
      });
    });
  });
<<<<<<< Updated upstream
=======
  */
>>>>>>> Stashed changes
});
