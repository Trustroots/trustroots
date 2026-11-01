import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PageTranslator } from '../types';

export default function PrivacyRevisionHistory() {
  const { t: rawT } = useTranslation('pages');
  const t = rawT as unknown as PageTranslator;

  // Keep substantive policy changes here; omit formatting and framework migrations.
  const revisions = [
    {
      date: '2026-11-01',
      href: 'https://github.com/Trustroots/trustroots/commits/main/modules/pages/client/components/Privacy.component.tsx?since=2026-10-31&until=2026-11-02',
      summary: [
        t(
          'Added the service overview, policy change notices, revision history and evolving-risk statement; confirmed Sparkpost EU and optional, very limited Gravatar use; removed outdated Zendesk and research disclosures.',
        ),
        t(
          'Changed account IP storage to keyed hashes while preserving administrator matching and temporary map location lookup.',
        ),
      ].join(' '),
    },
    {
      date: '2026-10-21',
      href: 'https://github.com/Trustroots/trustroots/commit/db3d3090ddf5564243afb0e1462fe3d1affad371',
      summary: t(
        'Added the requirement that members must be at least 18 years old.',
      ),
    },
    {
      date: '2026-10-13',
      href: 'https://github.com/Trustroots/trustroots/commit/fcf3e0288d490a2828b7628f83a7a04335db445f',
      summary: t(
        'Clarified that Facebook is no longer used for profile images.',
      ),
    },
    {
      date: '2026-09-24',
      href: 'https://github.com/Trustroots/trustroots/commit/693becbb64dde5e7ffc47341a8eee2e752b15888',
      summary: t(
        'Fixed the account settings links for downloading data and requesting account deletion.',
      ),
    },
    {
      date: '2026-08-03',
      href: 'https://github.com/Trustroots/trustroots/commit/2ed20f5a3bf9282c1e721957ba8f4b16e69b152d',
      summary: t(
        'Explained why the latest authenticated IP address is stored, who can access it, and when it is replaced or deleted.',
      ),
    },
    {
      date: '2026-07-16',
      href: 'https://github.com/Trustroots/trustroots/commit/823a6ec6e7a39923ca6aa31e81da4a99b805aeaf',
      summary: t(
        'Clarified that only previously stored Facebook profile images could still be used.',
      ),
    },
    {
      date: '2026-07-15',
      href: 'https://github.com/Trustroots/trustroots/commit/c31ae10145e24e57c571bac9cb439f9f62ac8ad6',
      summary: t(
        'Described self-hosted, cookie-free Umami analytics and optional Nostr publishing, and removed outdated Firebase references.',
      ),
    },
    {
      date: '2026-07-15',
      href: 'https://github.com/Trustroots/trustroots/commit/0fa2bc3173311d1e91e2f7c579cc1db471fb43ed',
      summary: t(
        'Removed Twitter from the examples of connected social networks.',
      ),
    },
    {
      date: '2024-11-21',
      href: 'https://github.com/Trustroots/trustroots/commit/963f6316c58b0bbc6a4277b744faedfac5c26ec6',
      summary: t(
        'Removed Google Analytics references, updated hosting to Hetzner in Germany, and simplified the research wording.',
      ),
    },
    {
      date: '2021-05-10',
      href: 'https://github.com/Trustroots/trustroots/commit/a5dbb9c68e87ffdb19a56580d8db32c196b147e0',
      summary: t(
        'Disclosed that support messages are managed and stored through Zendesk.',
      ),
    },
    {
      date: '2018-12-05',
      href: 'https://github.com/Trustroots/trustroots/commit/9234c8e55d6b58894428c77891176430c36da664',
      summary: t(
        'Expanded disclosures about Google Analytics, profile image providers and Firebase push notifications, and plans to reduce reliance on external services.',
      ),
    },
    {
      date: '2017-07-20',
      href: 'https://github.com/Trustroots/trustroots/commit/dc74cbb395fbf00496abf848c5583ddb46d4c187',
      summary: t(
        'Expanded the list of collected data, described consent for mobile device data and anonymised research, and updated deletion and hosting information.',
      ),
    },
    {
      date: '2016-09-02',
      href: 'https://github.com/Trustroots/trustroots/commit/fc621893eaec77e0f5eff0b8df4518050a5bc37c',
      summary: t('Updated the account settings link for downloading data.'),
    },
    {
      date: '2016-03-04',
      href: 'https://github.com/Trustroots/trustroots/commit/087b059e99c5662550bd3efab49304fd362dfe72',
      summary: t(
        'Updated email delivery to SparkPost and removed the Mandrill and MailChimp descriptions.',
      ),
    },
    {
      date: '2016-03-03',
      href: 'https://github.com/Trustroots/trustroots/commit/bdc28ea88219e09163bbfc47a45ae61034dd006f',
      summary: t('Added a direct account settings link for downloading data.'),
    },
    {
      date: '2016-02-25',
      href: 'https://github.com/Trustroots/trustroots/commit/eff0222af87f83b89fa9f04d942e171dd83a08cf',
      summary: t(
        'Removed Piwik analytics and its embedded opt-out form from the policy.',
      ),
    },
    {
      date: '2015-09-29',
      href: 'https://github.com/Trustroots/trustroots/commit/e20210c68f28cf8db9a9ddbf3986fa684937e158',
      summary: t(
        'Updated performance monitoring from New Relic to Union Station.',
      ),
    },
    {
      date: '2015-09-09',
      href: 'https://github.com/Trustroots/trustroots/commit/67c12872fac2c8266fbc648d7d0a10e70b43f843',
      summary: t(
        'Confirmed that profile, contact and hosting data could be downloaded through account settings.',
      ),
    },
    {
      date: '2015-04-18',
      href: 'https://github.com/Trustroots/trustroots/commit/0220267e439c33e9cbd5ac323db42cae755135a5',
      summary: t(
        'Added Piwik analytics hosted by IndieHosters, an opt-out form, and GitHub to the social network examples.',
      ),
    },
    {
      date: '2014-12-22',
      href: 'https://github.com/Trustroots/trustroots/commit/d7bdb10afffbb078a06ff7e372fe87178e6f3e27',
      summary: t('Added disclosure of hourly backups to AWS.'),
    },
    {
      date: '2014-11-25',
      href: 'https://github.com/Trustroots/trustroots/commit/01f68430100676271fbfe2145545c05baf84cec7',
      summary: t(
        'Expanded the policy to cover data ownership, deletion requests, the promise not to sell profile data, social networks, email providers and hosting.',
      ),
    },
    {
      date: '2014-11-20',
      href: 'https://github.com/Trustroots/trustroots/commit/ab9d6109d22c8b68a53e9a121752090fb87eddb7',
      summary: t(
        'Created the privacy page with Google Analytics information and tracking opt-out guidance.',
      ),
    },
  ];

  return (
    <section aria-labelledby="privacy-revision-history">
      <h2 id="privacy-revision-history">{t('Revision history')}</h2>
      <p>
        {t(
          'A brief summary of substantive changes to this policy. Dates refer to revisions recorded on GitHub, which may differ from when changes appeared on the site. Select a date to view the changes.',
        )}
      </p>
      <div className="table-responsive">
        <table className="table">
          <caption className="sr-only">
            {t('Privacy policy revisions, newest first')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('Date')}</th>
              <th scope="col">{t('What changed')}</th>
            </tr>
          </thead>
          <tbody>
            {revisions.map(({ date, href, summary }) => (
              <tr key={href}>
                <th scope="row" className="text-nowrap">
                  <a href={href}>
                    <time dateTime={date}>{date}</time>
                  </a>
                </th>
                <td>{summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {t('Full revision history, including wording and technical changes:')}
      </p>
      <ul>
        <li>
          <a href="https://github.com/Trustroots/trustroots/commits/main/modules/pages/client/components/Privacy.component.tsx">
            {t('September 2026 onwards')}
          </a>
        </li>
        <li>
          <a href="https://github.com/Trustroots/trustroots/commits/main/modules/pages/client/components/Privacy.component.js">
            {t('May 2020 to September 2026')}
          </a>
        </li>
        <li>
          <a href="https://github.com/Trustroots/trustroots/commits/main/modules/pages/client/views/privacy.client.view.html">
            {t('April 2015 to May 2020')}
          </a>
        </li>
        <li>
          <a href="https://github.com/Trustroots/trustroots/commits/main/public/modules/pages/views/privacy.client.view.html">
            {t('November 2014 to April 2015')}
          </a>
        </li>
      </ul>
    </section>
  );
}
