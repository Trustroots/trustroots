const path = require('path');
const should = require('should');
const sinon = require('sinon');
const { convertFile, isConflict } = require(path.resolve('./bin/i18n/convert'));
const fs = require('fs-extra');
const i18nextConv = require('i18next-conv');

describe('Convert files from .json to .po and vice-versa', () => {
  const locale = 'el';
  const base = '/home/user/public/locales';
  const filename = 'translation';
  const filename2 = 'translation2';
  const jsonPath = path.join(base, locale, filename + '.json');
  const jsonPath2 = path.join(base, locale, filename2 + '.json');
  const poPath = path.join(base, locale, filename + '.po');
  const poPath2 = path.join(base, locale, filename2 + '.po');
  const testStringOriginal = 'a test string';
  const testStringConverted = 'a converted test string';

  beforeEach(() => {
    sinon.stub(fs, 'readFile').returns(testStringOriginal);
    sinon.stub(fs, 'writeFile');
    sinon.stub(i18nextConv, 'i18nextToPo').returns(testStringConverted);
    sinon.stub(i18nextConv, 'gettextToI18next').returns(testStringConverted);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('convert from .json to .po', async () => {
    const output = await convertFile(jsonPath);

    // returns the path to the saved file
    should(output).eql(poPath);
    // convert is called with the correct parameters
    should(i18nextConv.i18nextToPo.callCount).eql(1);
    should(i18nextConv.i18nextToPo.getCall(0).args).eql([
      locale,
      testStringOriginal,
    ]);
    // file is saved with the correct parameters
    should(fs.writeFile.callCount).eql(1);
    should(fs.writeFile.getCall(0).args).eql([poPath, testStringConverted]);
  });

  it('convert from .po to .json', async () => {
    const output = await convertFile(poPath);

    // returns the path to the saved file
    should(output).eql(jsonPath);
    // convert is called with the correct parameters
    should(i18nextConv.gettextToI18next.callCount).eql(1);
    should(i18nextConv.gettextToI18next.getCall(0).args).eql([
      locale,
      testStringOriginal,
    ]);
    // file is saved with the correct parameters
    should(fs.writeFile.callCount).eql(1);
    should(fs.writeFile.getCall(0).args).eql([jsonPath, testStringConverted]);
  });

  it('test that isConflict works', () => {
    should(isConflict([poPath, jsonPath2])).eql(false);
    should(isConflict([poPath, jsonPath, poPath2])).eql(true);
  });
});
