import './../../../users/server/models/user.server.model.mts';
import './../../../offers/server/models/offer.server.model.mts';
import { Readable } from 'stream';
import sinon from 'sinon';
import mongoose from 'mongoose';
import config from './../../../../config/config.mts';
import userRolesService from './../../../users/server/services/user-roles.server.service.mts';
import errorService from './../../../core/server/services/error.server.service.mts';
import controller from './../../server/controllers/admin.newsletter.server.controller.mts';
import type { Readable as ReadableStream } from 'node:stream';

import 'should';

interface NewsletterResponseBody {
  message?: string;
  totalEmailCount?: number;
  subscribedCount?: number;
  unsubscribedCount?: number;
  outputFormat?: string;
  unsubscribedContent?: string;
}

interface NewsletterMockResponse {
  statusCode: number;
  body: NewsletterResponseBody;
  status(code: number): NewsletterMockResponse;
  set(name: string, value: string): NewsletterMockResponse;
  send(body: NewsletterResponseBody): NewsletterMockResponse;
  done: Promise<NewsletterMockResponse>;
}

interface NewsletterUser {
  email: string | null;
  firstName: string;
  lastName: string;
  public: boolean;
  newsletter: boolean;
  roles?: string[];
  removeProfileToken?: string;
  removeProfileExpires?: string;
}

function mockResponse(): NewsletterMockResponse {
  let resolveResponse!: (response: NewsletterMockResponse) => void;
  const done = new Promise<NewsletterMockResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: NewsletterMockResponse = {
    statusCode: 200,
    body: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    set() {
      return this;
    },
    send(body) {
      this.body = body;
      resolveResponse(this);
      return this;
    },
    done,
  };
  return res;
}

let roleReset: { roles: string[]; rolesLength: number } | undefined;

async function loadController({
  findResults = [],
}: { findResults?: NewsletterUser[] } = {}) {
  const User = mongoose.model('User');
  const findStub = (
    sinon.stub(User, 'find') as unknown as sinon.SinonStub
  ).returns({
    exec: async () => findResults,
  });
  const roles = userRolesService.restrictedMessagingRoles;
  const rolesLength = roles.length;
  roleReset = { roles, rolesLength };
  roles.push('custom-restricted');

  return { controller, findStub };
}

function multipartRequest(field: string, filename: string, content: string) {
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
  const request = Readable.from([Buffer.from(body)]) as unknown as Readable & {
    method: string;
    headers: Record<string, string>;
  };
  request.method = 'POST';
  request.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(Buffer.byteLength(body)),
  };
  return request as never;
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
      // Multer reads the limit once, when the controller first loads.
      const limit: number = config.maxUploadSize;
      const { controller } = await loadController();
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
      res.body.message!.should.equal(
        `File too big. Please maximum ${(limit / 1048576).toFixed(2)} Mb files.`,
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
      res.body.message!.should.equal(
        'Missing "newsletterCsv" field from the API call.',
      );
    });

    it('returns default 400 message for unknown upload errors', async () => {
      const { controller } = await loadController();
      const res = mockResponse();

      const malformedRequest = Readable.from([
        Buffer.from('not a multipart body'),
      ]) as ReadableStream & {
        method: string;
        headers: Record<string, string>;
      };
      malformedRequest.method = 'POST';
      malformedRequest.headers = {
        'content-type': 'multipart/form-data; boundary=broken-boundary',
        'content-length': '19',
      };
      controller.uploadSubscribersCsv(malformedRequest as never, res, () => {});
      await res.done;

      res.statusCode.should.equal(400);
      res.body.message!.should.equal(
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
        } as never,
        res,
      );

      res.statusCode.should.equal(400);
      res.body.message!.should.equal(
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
        } as never,
        res,
      );

      findStub.calledOnce.should.equal(true);
      res.statusCode.should.equal(200);
      res.body.totalEmailCount!.should.equal(1);
      res.body.subscribedCount!.should.equal(1);
      res.body.unsubscribedCount!.should.equal(0);
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
        } as never,
        res,
      );

      findStub.calledOnce.should.equal(true);
      res.statusCode.should.equal(200);
      res.body.subscribedCount!.should.equal(0);
      res.body.unsubscribedCount!.should.equal(5);
      res.body.outputFormat!.should.equal('csv');
      res.body.unsubscribedContent!.should.equal(
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
