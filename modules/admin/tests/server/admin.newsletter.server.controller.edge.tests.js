const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

const errorService = require('../../../core/server/services/error.server.service');
require('should');

function mockResponse() {
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
    return res;
  };

  return res;
}

function loadController({
  findResults = [],
  uploadError = null,
  maxUploadSize = 2 * 1024 * 1024,
} = {}) {
  const findStub = sinon.stub().returns({
    exec: async () => findResults,
  });
  const userModelStub = {
    find: findStub,
  };
  const userRolesStub = {
    restrictedMessagingRoles: ['suspended', 'shadowban'],
    hasRestrictedMessagingRole: sinon.stub().callsFake(user => {
      const roles = user?.roles || [];
      return (
        roles.includes('suspended') ||
        roles.includes('shadowban') ||
        roles.includes('custom-restricted')
      );
    }),
    hasRole: sinon
      .stub()
      .callsFake((user, role) => (user?.roles || []).includes(role)),
  };
  const uploadSingleStub = sinon.stub().callsFake((req, res, callback) => {
    callback(uploadError);
  });
  const multerStub = sinon.stub().returns({
    single: () => uploadSingleStub,
  });
  multerStub.memoryStorage = sinon.stub().returns({});

  const controller = proxyquire(
    '../../server/controllers/admin.newsletter.server.controller',
    {
      multer: multerStub,
      mongoose: {
        model: sinon.stub().withArgs('User').returns(userModelStub),
        Types: {
          ObjectId: {
            isValid: sinon.stub().returns(true),
          },
        },
      },
      '../../../../config/config': {
        maxUploadSize,
      },
      '../../../users/server/services/user-roles.server.service': userRolesStub,
    },
  );

  return { controller, findStub };
}

describe('Admin newsletter controller edge-case unit tests', () => {
  describe('uploadSubscribersCsv', () => {
    it('returns 413 for files larger than upload limit', () => {
      const { controller } = loadController({
        uploadError: { code: 'LIMIT_FILE_SIZE' },
      });
      const res = mockResponse();

      controller.uploadSubscribersCsv({}, res, () => {});

      res.statusCode.should.equal(413);
      res.body.message.should.equal(
        'File too big. Please maximum 2.00 Mb files.',
      );
    });

    it('returns 400 when multipart field name is unexpected', () => {
      const { controller } = loadController({
        uploadError: { code: 'LIMIT_UNEXPECTED_FILE' },
      });
      const res = mockResponse();

      controller.uploadSubscribersCsv({}, res, () => {});

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Missing "newsletterCsv" field from the API call.',
      );
    });

    it('returns default 400 message for unknown upload errors', () => {
      const { controller } = loadController({
        uploadError: { code: 'SOME_OTHER_UPLOAD_ERROR' },
      });
      const res = mockResponse();

      controller.uploadSubscribersCsv({}, res, () => {});

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('default'),
      );
    });
  });

  describe('splitSubscribers', () => {
    it('returns 400 when uploaded CSV is empty', async () => {
      const { controller } = loadController();
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
        'Could not find any email addresses in the uploaded CSV file.',
      );
    });

    it('skips rows where the first CSV field is missing', async () => {
      const { controller, findStub } = loadController({
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
      const { controller, findStub } = loadController({
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
      res.body.unsubscribedCsv.should.equal(
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
