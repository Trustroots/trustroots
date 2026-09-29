const sinon = require('sinon');
const mongoose = require('mongoose');
const config = require('../../../../config/config');
const userRolesService = require('../../../users/server/services/user-roles.server.service');
require('../../../users/server/models/user.server.model');
require('../../../offers/server/models/offer.server.model');

const errorService = require('../../../core/server/services/error.server.service');
require('should');

function mockResponse() {
  let resolveResponse;
  const done = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = {
    statusCode: 200,
    body: null,
  };

  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.send = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.done = done;

  return res;
}

let roleReset;

async function loadController({
  findResults = [],
  maxUploadSize = 2 * 1024 * 1024,
} = {}) {
  const User = mongoose.model('User');
  const findStub = sinon.stub(User, 'find').returns({
    exec: async () => findResults,
  });
  sinon.stub(config, 'maxUploadSize').value(maxUploadSize);
  const roles = userRolesService.restrictedMessagingRoles;
  const rolesLength = roles.length;
  roleReset = { roles, rolesLength };
  roles.push('custom-restricted');
  const controller = require('../../server/controllers/admin.newsletter.server.controller');

  return { controller, findStub };
}

function multipartRequest(field, filename, content) {
  const { Readable } = require('stream');
  const boundary = '----trustroots-boundary';
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="${field}"; filename="${filename}"`,
    'Content-Type: text/csv',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n');
  const request = Readable.from([body]);
  request.method = 'POST';
  request.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(Buffer.byteLength(body)),
  };
  return request;
}

describe('Admin newsletter controller edge-case unit tests', () => {
  afterEach(() => {
    sinon.restore();
    if (roleReset) {
      roleReset.roles.length = roleReset.rolesLength;
      roleReset = undefined;
    }
  });
  describe('uploadSubscribersCsv', () => {
    it('returns 413 for files larger than upload limit', async () => {
      const limit = 2 * 1024 * 1024;
      const { controller } = await loadController({ maxUploadSize: limit });
      const res = mockResponse();

      controller.uploadSubscribersCsv(
        multipartRequest(
          'newsletterCsv',
          'subscribers.csv',
          'x'.repeat(limit + 1),
        ),
        res,
        () => {},
      );
      await res.done;

      res.statusCode.should.equal(413);
      res.body.message.should.equal(
        'File too big. Please maximum 2.00 Mb files.',
      );
    });

    it('returns 400 when multipart field name is unexpected', async () => {
      const { controller } = await loadController();
      const res = mockResponse();

      controller.uploadSubscribersCsv(
        multipartRequest(
          'unexpectedField',
          'subscribers.csv',
          'email@example.test',
        ),
        res,
        () => {},
      );
      await res.done;

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Missing "newsletterCsv" field from the API call.',
      );
    });

    it('returns default 400 message for unknown upload errors', async () => {
      const { controller } = await loadController();
      const res = mockResponse();

      const { Readable } = require('stream');
      const malformedRequest = Readable.from(['not a multipart body']);
      malformedRequest.method = 'POST';
      malformedRequest.headers = {
        'content-type': 'multipart/form-data; boundary=broken-boundary',
        'content-length': '19',
      };
      controller.uploadSubscribersCsv(malformedRequest, res, () => {});
      await res.done;

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('default'),
      );
    });
  });

  describe('splitSubscribers', () => {
    it('returns 400 when uploaded CSV is empty', async () => {
      const { controller } = await loadController();
      const res = mockResponse();

      await controller.splitSubscribers(
        {
          file: {
            buffer: Buffer.from(''),
          },
        },
        res,
      );

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Could not find any email addresses in the uploaded file.',
      );
    });

    it('skips rows where the first CSV field is missing', async () => {
      const { controller, findStub } = await loadController({
        findResults: [
          {
            email: 'valid@example.com',
            firstName: 'Valid',
            lastName: 'Subscriber',
            public: true,
            newsletter: true,
            roles: [],
          },
        ],
      });
      const res = mockResponse();

      await controller.splitSubscribers(
        {
          file: {
            buffer: Buffer.from(
              ['Email Address', ',just-a-name', 'valid@example.com'].join('\n'),
            ),
          },
        },
        res,
      );

      findStub.calledOnce.should.equal(true);
      res.statusCode.should.equal(200);
      res.body.totalEmailCount.should.equal(1);
      res.body.subscribedCount.should.equal(1);
      res.body.unsubscribedCount.should.equal(0);
    });

    it('covers quoted CSV parsing and reason fallbacks', async () => {
      const { controller, findStub } = await loadController({
        findResults: [
          {
            email: 'shadow@example.com',
            firstName: 'Shadow',
            lastName: 'User',
            public: true,
            newsletter: true,
            roles: ['shadowban'],
          },
          {
            email: 'no-expiry@example.com',
            firstName: 'No',
            lastName: 'Expiry',
            public: true,
            newsletter: true,
            removeProfileToken: 'remove-token',
          },
          {
            email: 'invalid-expiry@example.com',
            firstName: 'Invalid',
            lastName: 'Expiry',
            public: true,
            newsletter: true,
            removeProfileToken: 'remove-token',
            removeProfileExpires: 'not-a-date',
          },
          {
            email: 'fallback@example.com',
            firstName: 'Fallback',
            lastName: 'Reason',
            public: true,
            newsletter: true,
            roles: ['custom-restricted'],
          },
          {
            email: null,
            firstName: 'Null',
            lastName: 'Email',
            public: true,
            newsletter: true,
          },
        ],
      });
      const res = mockResponse();

      await controller.splitSubscribers(
        {
          file: {
            buffer: Buffer.from(
              [
                'Email Address',
                '',
                '"shadow@example.com",Shadow User',
                '"no-expiry@example.com",No Expiry',
                '"invalid-expiry@example.com",Invalid Expiry',
                '"fallback@example.com",Fallback Reason',
                '"escaped""quote@example.com",Escaped Quote',
              ].join('\n'),
            ),
          },
        },
        res,
      );

      findStub.calledOnce.should.equal(true);
      res.statusCode.should.equal(200);
      res.body.subscribedCount.should.equal(0);
      res.body.unsubscribedCount.should.equal(5);
      res.body.outputFormat.should.equal('csv');
      res.body.unsubscribedContent.should.equal(
        [
          'Email Address,First Name,Last Name,Reason',
          'shadow@example.com,Shadow,User,Account shadowbanned',
          'no-expiry@example.com,No,Expiry,Profile deletion pending',
          'invalid-expiry@example.com,Invalid,Expiry,Profile deletion pending',
          'fallback@example.com,Fallback,Reason,Not eligible for newsletter emails',
          'escapedquote@example.com,,,Email not found',
        ].join('\n'),
      );
    });
  });
});
