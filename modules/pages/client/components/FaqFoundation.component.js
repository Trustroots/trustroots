import React from 'react';
import Faq from '@/modules/pages/client/components/Faq.component.js';
import { Trans, useTranslation } from 'react-i18next';

export default function FaqFoundation() {
  const { t } = useTranslation('pages');

  return (
    <Faq category="foundation">
      <div className="faq-question" id="what-is-your-legal-status">
        <h3>{t("What's your legal status?")}</h3>
        <Trans t={t} ns="pages">
          The website is owned and operated by{' '}
          <a href="/faq/foundation">Trustroots Foundation</a>, a non-profit
          Limited by Guarantee (LBG) under section 60 exemption, registered in
          the United Kingdom in March 2015.
        </Trans>
      </div>

      <div className="faq-question" id="why-limited-by-guarantee">
        <h3>{t('Why Limited by Guarantee under section 60 exemption?')}</h3>
        <ul>
          <li>{t('It’s fast and relatively affordable to set up.')}</li>
          <li>
            {t(
              'It’s possible to apply for CIC status, which is a special form recently created for social enterprises',
            )}
            <del></del>.
          </li>
          <li>
            {t(
              'It is very flexible, this is why many NGOs and charities choose the LBG form.',
            )}
          </li>
          <li>
            <Trans t={t} ns="pages">
              Additionally, section 60 exemption from the obligation to have
              name ending with “limited”{' '}
              <a href="https://www.legislation.gov.uk/ukpga/2006/46/section/62">
                requires
              </a>{' '}
              that:
              <ul>
                <li>The company purposes are for the public benefit.</li>
                <li>It is a non for profit.</li>
                <li>Assets are to be specially protected on winding up.</li>
              </ul>
            </Trans>
          </li>
          <li>
            {t(
              'Using the word Foundation in the name also requires that any profits should be used to further the objects of the company and not paid to the members as dividends.',
            )}
          </li>
        </ul>
        <Trans t={t} ns="pages">
          Some typical LBGs in the UK would be clubs and membership
          organisations such as workers’ co-operatives, non-governmental
          organizations (NGOs) and charities. For example the{' '}
          <a href="https://www.osmfoundation.org/">OpenStreetMap Foundation</a>,{' '}
          the
          <a href="https://okfn.org/">Open Knowledge Foundation</a> and the{' '}
          <a href="https://www.hackspace.org.uk/">UK Hackspace Foundation</a>{' '}
          are LGBs.
        </Trans>
        <h4>{t('More reading:')}</h4>
        <ul>
          <li>
            <a href="https://www.companylawclub.co.uk/companies-limited-by-guarantee">
              {t('CompanyLawClub.co.uk: limited by guarantee')}
            </a>
          </li>
          <li>
            <a href="https://en.wikipedia.org/wiki/Community_interest_company">
              {t('CIC on Wikipedia')}
            </a>
          </li>
          <li>
            <a href="https://www.theguardian.com/social-enterprise-network/graphic/2013/aug/14/summary-of-common-forms-for-social-enterprises">
              {t('The Guardian: Do you know your CICs from your CIOs?')}
            </a>
          </li>
          <li>
            <a
              title="Section 60 exemption requirements"
              href="https://www.legislation.gov.uk/ukpga/2006/46/section/62"
            >
              {t('Section 60 exemption requirements')}
            </a>
          </li>
          <li>
            <a href="https://www.gov.uk/government/uploads/system/uploads/attachment_data/file/400693/GP1_Incorporation_Feb_2015.pdf">
              {t('UK Companies House: incorporation and names (pdf)')}
            </a>
          </li>
        </ul>
      </div>

      <div className="faq-question" id="are-you-going-to-sell-out">
        <h3>{t('Could Trustroots assets be sold?')}</h3>
        {t(
          'The guarantee of LBG under section 60 requires a clause where in case of Trustroots Foundation ceasing to exist, assets could be moved only to another non-profit entity where transferring assets is limited in the same way. CIC status would make this even more specific, but isn’t required for this.',
        )}
        <br />
        <br />
        <Trans t={t} ns="pages">
          Additionally our by-laws (articles of association) specifically
          prohibit selling the users database and specify that the company code
          will be licensed under an
          <a href="https://github.com/trustroots/trustroots/#license">
            open source license
          </a>
        </Trans>
        .
      </div>

      <div className="faq-question" id="who-are-the-board">
        <h3>{t('Who are the board?')}</h3>
        <Trans t={t} ns="pages">
          <a href="/foundation#board">We</a>: Mikael, Kasper, and Natalia.
        </Trans>
      </div>

      <div
        className="faq-question"
        id="how-do-you-want-to-make-the-project-financially-sustainable"
      >
        <h3>
          {t('How do you want to make the project financially sustainable?')}
        </h3>
        <Trans t={t} ns="pages">
          <a href="/contribute">Donations</a> and grants are the most likely
          ways. There are many inspiring organisations out there serving as
          great examples:{' '}
          <a href="https://www.warmshowers.org/">Warmshowers Foundation</a>,{' '}
          <a href="http://www.abgefahren-ev.de/">Abgefahren e.V.</a>{' '}
          (Hitchwiki), <a href="https://www.bevolunteer.org/">BeVolunteer</a>,{' '}
          <a href="https://servas.org/">Servas</a>,{' '}
          <a href="https://wwoof.net/">WWOOF</a> and many more. Again, if you
          have experience with this it would be great if you{' '}
          <a href="/support">contact us</a>.
        </Trans>
      </div>

      <div className="faq-question" id="who-decides-what-gets-done">
        <h3>{t('Who decides what gets done?')}</h3>
        <Trans t={t} ns="pages">
          Anyone can join us as a <a href="/volunteering">volunteer</a>.
          We&apos;re huge fans of do-cracy and getting things done attitude. We
          have <a href="/team">a core team</a> which is formed from the most
          active volunteers. There isn&apos;t voting or other buraucratic
          processes involved, but you get more responsibility by simply becoming
          active contributor and showing your communication skills. Great
          community values simple translation jobs just as much as highly
          skilled development. We&apos;ll aim to keep the entry level for
          volunteers as low as possible. No bureaucracy. Pragmatic approach.
          Trust.
        </Trans>
        <br />
        <br />
        <Trans t={t} ns="pages">
          That said, any well organized project needs efficient teams working on
          specific issues (such as <i>safety</i> or site&apos;s{' '}
          <i>features/UX</i>). Rather than building complicated voting
          mechanisms or other structures, we&apos;ll try to concentrate in
          fostering volunteers into responsible, skilled teams. It&apos;s also
          important to make sure everyone has the same goal and vision.
        </Trans>
      </div>
    </Faq>
  );
}

FaqFoundation.propTypes = {};
