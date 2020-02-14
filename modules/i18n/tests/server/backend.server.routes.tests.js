const should = require('should');
const request = require('supertest');
const fs = require('fs-extra');
const path = require('path');
const mongoose = require('mongoose');
const sinon = require('sinon');
const config = require(path.resolve('./config/config'));

describe('Save a missing translation', () => {
  const fileFoo = path.resolve('./public/locales/foo/bar.json');
  const dirFoo = path.resolve('./public/locales/foo/');
  const fileEn = path.resolve('./public/locales/en/bar.json');

  const text = 'Send us suggestions!';

  const body = { [text]: text };

  afterEach(async () => {
    await fs.remove(dirFoo);
    await fs.remove(fileEn);
  });

  after(() => {
    sinon.restore();
  });

  context('activated in config', () => {
    let agent;

    before(async () => {
      sinon.stub(config, 'i18nBackend').value(true);
      const express = require(path.resolve('./config/lib/express'));
      const app = express.init(mongoose.connection);
      agent = request.agent(app);
    });

    context('different languages', () => {
      it('[en] save key and value', async () => {
        await agent
          .post('/api/locales/en/bar')
          .send(body)
          .expect(200);
        const output = await fs.readJSON(fileEn);

        should(output).deepEqual({ [text]: text });
      });

      it('[not en] save key, but value will be an empty string', async () => {
        await agent
          .post('/api/locales/foo/bar')
          .send(body)
          .expect(200);
        const output = await fs.readJSON(fileFoo);

        should(output).deepEqual({ [text]: '' });
      });
    });

    context("file doesn't exist", () => {
      it('create a new translation file', async () => {
        await fs.access(fileFoo).should.be.rejected();

        await agent
          .post('/api/locales/foo/bar')
          .send(body)
          .expect(200);

        await fs.access(fileFoo).should.not.be.rejected();
      });
    });

    context('file exists', () => {
      it("[translation doesn't exist] save it", async () => {
        await agent
          .post('/api/locales/en/bar')
          .send(body)
          .expect(200);
        const output = await fs.readJSON(fileEn);

        should(output).deepEqual({ [text]: text });
      });

      it("[translation exists] don't save it", async () => {
        // create the file with a different translation
        await fs.outputJson(fileEn, { [text]: 'gggggg' });

        await agent
          .post('/api/locales/en/bar')
          .send(body)
          .expect(200);

        const output = await fs.readJSON(fileEn);
        should(output).deepEqual({ [text]: 'gggggg' });
      });

      it('[other translation exists] save the new one, keep the old one', async () => {
        // create the file with a different translation
        await fs.outputJson(fileFoo, { foo: 'bar' });

        await agent
          .post('/api/locales/foo/bar')
          .send(body)
          .expect(200);

        const output = await fs.readJSON(fileFoo);
        should(output).deepEqual({ [text]: '', foo: 'bar' });
      });
    });
  });

  context('desactivated in config', () => {
    let agent;

    before(async () => {
      sinon.stub(config, 'i18nBackend').value(false);
      const express = require(path.resolve('./config/lib/express'));
      const app = express.init(mongoose.connection);
      agent = request.agent(app);
    });

    it('404', async () => {
      await agent
        .post('/api/locales/en/bar')
        .send(body)
        .expect(404);
    });
  });
});
