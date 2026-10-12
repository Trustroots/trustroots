/**
 * Module dependencies.
 */
const should = require('should');
const sinon = require('sinon');
const mongoose = require('mongoose');
const validator = require('validator');
const config = require('./../../../../config/config.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');

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
    tribe1 = {
      label: 'Tribe label',
    };
    /*
    tribe2 = new Tribe({
      label: 'Tribe label',
    });
    */
    tribe3 = {
      label: 'Different tribe label',
    };
  });

  afterEach(utils.clearDatabase);

  it('accepts whole member counts and rejects fractional or negative counts', async () => {
    for (const count of [0, 1, 100]) {
      await new Tribe({ label: 'Fictional circle', count }).validate();
    }
    for (const count of [1.5, -1]) {
      await new Tribe({ label: 'Fictional circle', count }).validate().then(
        () => {
          throw new Error('Expected count validation to fail');
        },
        error => {
          should.exist(error.errors.count);
          if (count === 1.5) {
            error.errors.count.message.should.equal(
              'Error, expected `count` to be an integer. Value: `1.5`',
            );
          }
        },
      );
    }
  });

  it('should give new circles varied dark colours readable with white text', function () {
    const random = sinon.stub(Math, 'random');
    const colours = new Set();

    try {
      for (let index = 0; index < 100; index += 1) {
        random.returns(index / 100);
        const colour = new Tribe({ label: `Circle ${index}` }).color;
        colour.should.match(/^[0-9a-f]{6}$/);
        colours.add(colour);

        const channels = [0, 2, 4].map(offset => {
          const value = parseInt(colour.slice(offset, offset + 2), 16) / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
        const luminance =
          0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        const contrastWithWhite = 1.05 / (luminance + 0.05);
        contrastWithWhite.should.be.above(4.5);
      }
    } finally {
      random.restore();
    }

    colours.size.should.be.above(7);
  });

  it('should preserve an explicitly supplied circle colour', async function () {
    const tribe = new Tribe({ label: 'Existing circle', color: 'abcdef' });
    await tribe.save();
    const savedTribe = await Tribe.findById(tribe._id);
    savedTribe.color.should.equal('abcdef');
  });

  describe('Method Save', function () {
    it('should begin with no tribes', async function () {
      const tribes = await Tribe.find({});
      tribes.should.have.length(0);
    });

    it('should be able to save without problems', async function () {
      const _tribe = new Tribe(tribe1);

      await _tribe.save();
      await _tribe.deleteOne();
    });

    it('should be able to save without problems and have correct default values', async function () {
      const _tribe = new Tribe(tribe1);
      await _tribe.save();
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

    it('should confirm that saving tribe model doesnt change the color', async function () {
      const _tribe = new Tribe(tribe1);

      await _tribe.save();
      const colorBefore = _tribe.color;
      _tribe.label = 'test';
      await _tribe.save();
      const colorAfter = _tribe.color;
      colorBefore.should.equal(colorAfter);
    });

    it('should be able to save 2 different tribes', async function () {
      const _tribe = new Tribe(tribe1);
      const _tribe3 = new Tribe(tribe3);

      await _tribe.save();
      await _tribe3.save();
    });

    it('should show error when trying to save tribe with invalid attribution URL', async function () {
      const _tribe = new Tribe(tribe1);

      _tribe.attribution_url = 'this-is-not-URL';
      await _tribe.save().should.be.rejected();
    });
  });

  describe('Slug generator', function () {
    it('should generate slug for label with accents and special symbols', async function () {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'Hyvää päivää, herra Hüü!';
      await _tribe.save();
      _tribe.slug.should.equal('hyvaa-paivaa-herra-huu');
    });

    it('should generate slug from unicode label', async function () {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'unicode ♥';
      await _tribe.save();
      _tribe.slug.should.equal('unicode-love');
    });
  });
  describe('Label Validation', function () {
    it('should be able to show an error when try to save without label', async function () {
      const _tribe = new Tribe(tribe1);

      _tribe.label = '';
      await _tribe.save().should.be.rejected();
    });

    it('should be able to show an error when try to save with not allowed label', async function () {
      const _tribe = new Tribe(tribe1);

      _tribe.label = config.illegalStrings[0];
      await _tribe.save().should.be.rejected();
    });

    it('should be able to show an error when trying to save tribe label beginning with .', async function () {
      const _tribe = new Tribe(tribe1);

      _tribe.label = '.label';
      await _tribe.save().should.be.rejected();
    });

    it('should be able to show an error when trying to save tribe label end with .', async function () {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'label.';
      await _tribe.save().should.be.rejected();
    });

    it('should save label with dot', async function () {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'lab.el';
      await _tribe.save();
    });

    it('should be able to show an error when trying to save label shorter than 2 character', async function () {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 's';
      await _tribe.save().should.be.rejected();
    });

    it('should save label with all capital letters', async function () {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'LABEL';
      await _tribe.save();
    });

    it('should be able to show an error when trying to save a label without at least one alpha character', async function () {
      const _tribe = new Tribe(tribe1);

      _tribe.label = '1234567890';
      await _tribe.save().should.be.rejected();
    });

    it('should be able to show an error when trying to save a label longer than 255 characters', async function () {
      const _tribe = new Tribe(tribe1);

      _tribe.label = 'l'.repeat(256);
      await _tribe.save().should.be.rejected();
    });
  });
});
