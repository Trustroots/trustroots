import React from 'react';
import Board from '@/modules/core/client/components/Board.js';
import { useTranslation } from 'react-i18next';

export default function Safety() {
  const { t } = useTranslation('pages');

  return (
    <>
      <Board names="forestpath">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <br />
              <br />
              <h2>{t('Safety Tips for Trustroots')}</h2>
            </div>
          </div>
        </div>
      </Board>

      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8">
            <p className="lead">
              {t(
                'Trustroots is built on trust, kindness, and mutual respect. It helps people connect with fellow travellers and hosts, but cannot guarantee the identity, intentions, or behaviour of any member.',
              )}
            </p>
            <p>
              {t(
                'Profiles, references, and conversations can help you make informed decisions, but they are not a substitute for your own judgement. Every hosting or travel arrangement involves trust, and each member remains responsible for deciding whom they meet, host, or stay with.',
              )}
            </p>
            <p>
              {t(
                'Meeting strangers always involves some level of risk. Taking reasonable precautions before and during a stay can reduce risks and contribute to positive experiences for everyone.',
              )}
            </p>

            <nav aria-label={t('Safety page contents')}>
              <h2>{t('On this page')}</h2>
              <ul>
                <li>
                  <a href="#before-you-meet">{t('Before You Meet')}</a>
                </li>
                <li>
                  <a href="#first-meeting">
                    {t('When Meeting for the First Time')}
                  </a>
                </li>
                <li>
                  <a href="#during-a-stay">{t('During a Stay')}</a>
                </li>
                <li>
                  <a href="#women-and-gender-minorities">
                    {t('Women Travellers and Gender Minorities')}
                  </a>
                </li>
                <li>
                  <a href="#community-safety">{t('Community Safety')}</a>
                </li>
                <li>
                  <a href="#emergencies">{t('Emergencies')}</a>
                </li>
                <li>
                  <a href="#showing-accountability">
                    {t('Showing Accountability')}
                  </a>
                </li>
                <li>
                  <a href="#help-build-a-safer-community">
                    {t('Help Us Build a Safer Community')}
                  </a>
                </li>
              </ul>
            </nav>

            <h2 id="before-you-meet">{t('Before You Meet')}</h2>
            <h3>{t('Read Profiles Carefully')}</h3>
            <p>
              {t(
                'Take time to read profiles thoroughly before agreeing to host someone or stay with them.',
              )}
            </p>
            <p>{t('Look for:')}</p>
            <ul>
              <li>
                {t(
                  'A complete profile with information about the person and their travel or hosting style',
                )}
              </li>
              <li>{t('References written by other members')}</li>
              <li>{t('Consistency between their profile and messages')}</li>
              <li>{t('Clear communication about expectations')}</li>
            </ul>
            <p>
              {t(
                'If something feels unclear, ask more questions before making arrangements.',
              )}
            </p>

            <h3>{t('Communicate Openly')}</h3>
            <p>{t('Discuss important details in advance:')}</p>
            <ul>
              <li>{t('Arrival and departure times')}</li>
              <li>{t('Sleeping arrangements')}</li>
              <li>{t('House rules')}</li>
              <li>{t('Who else lives in or may visit the home')}</li>
              <li>{t('Expectations around meals, socialising, or privacy')}</li>
            </ul>
            <p>{t('Good communication helps prevent misunderstandings.')}</p>

            <h3>{t('Keep a Backup Plan')}</h3>
            <p>
              {t(
                'Travellers should always have a backup option in case plans change unexpectedly.',
              )}
            </p>
            <p>{t('Consider:')}</p>
            <ul>
              <li>
                {t(
                  'Knowing where nearby hostels, campsites, or hotels are located',
                )}
              </li>
              <li>
                {t('Having enough funds available for emergency accommodation')}
              </li>
              <li>{t('Keeping your phone charged and usable in the area')}</li>
            </ul>

            <h2 id="first-meeting">{t('When Meeting for the First Time')}</h2>
            <h3>{t('Consider Meeting in a Public Place')}</h3>
            <p>
              {t(
                "If possible, meet in a public location such as a café, train station, or park before going to someone's home.",
              )}
            </p>
            <p>
              {t(
                'This gives everyone an opportunity to get comfortable and confirm that expectations match reality.',
              )}
            </p>

            <h3>{t('Trust Your Instincts')}</h3>
            <p>
              {t(
                'If something feels wrong, you do not have to continue the interaction. You can leave, decline a stay, or change your plans at any time.',
              )}
            </p>
            <p>{t('Your safety is more important than being polite.')}</p>

            <h2 id="during-a-stay">{t('During a Stay')}</h2>
            <h3>{t('Respect Boundaries')}</h3>
            <p>
              {t(
                'Hosts and guests should clearly communicate their boundaries and respect those of others.',
              )}
            </p>
            <p>{t('Everyone has different comfort levels regarding:')}</p>
            <ul>
              <li>{t('Personal space')}</li>
              <li>{t('Privacy')}</li>
              <li>{t('Social activities')}</li>
              <li>{t('Alcohol or other substances')}</li>
              <li>{t('Photography and sharing information online')}</li>
            </ul>
            <p>{t('Consent and respect are essential.')}</p>

            <h3>{t('Stay in Contact with Someone You Trust')}</h3>
            <p>
              {t(
                'Especially when travelling alone, consider sharing your plans with a friend or family member.',
              )}
            </p>
            <p>{t('Let someone know:')}</p>
            <ul>
              <li>{t('Where you are staying')}</li>
              <li>{t('Who you are staying with')}</li>
              <li>{t('How to reach you')}</li>
            </ul>

            <h3>{t('Protect Your Valuables')}</h3>
            <p>
              {t(
                'Hosts and guests alike should take reasonable precautions with important belongings, documents, money, and electronics. Trust and caution can coexist.',
              )}
            </p>

            <h2 id="women-and-gender-minorities">
              {t('Women Travellers and Gender Minorities')}
            </h2>
            <p>
              {t(
                'Women and gender minorities often face additional safety concerns while travelling or staying with strangers.',
              )}
            </p>
            <p>
              {t(
                'When arranging a stay, consider choosing hosts and guests whose profiles, references, and communication make you feel comfortable and respected. Do not hesitate to ask questions, clarify expectations, or decline invitations that do not feel right.',
              )}
            </p>
            <p>
              {t(
                'You never owe anyone your time, attention, accommodation, or company. If a situation makes you uncomfortable, you are free to leave, change your plans, or end the interaction.',
              )}
            </p>
            <p>
              {t(
                'Trustroots is committed to fostering a community where everyone is treated with dignity and respect, regardless of gender identity, sexual orientation, background, or experience.',
              )}
            </p>

            <h2 id="community-safety">{t('Community Safety')}</h2>
            <h3>{t('Leave Honest References')}</h3>
            <p>
              {t('References help future members make informed decisions.')}
            </p>
            <p>{t('When leaving a reference:')}</p>
            <ul>
              <li>{t('Be honest')}</li>
              <li>{t('Be fair')}</li>
              <li>{t('Focus on your actual experience')}</li>
              <li>{t('Include information that may be useful to others')}</li>
            </ul>
            <p>
              {t(
                'A healthy reference system helps strengthen trust throughout the community.',
              )}
            </p>

            <h3>{t('Report Concerning Behaviour')}</h3>
            <p>
              {t(
                'If a member behaves inappropriately, violates boundaries, harasses others, engages in discrimination, or makes you feel unsafe, please let us know.',
              )}
            </p>
            <p>
              <a href="/support">{t('Contact the Trustroots team')}</a>
              {t(
                '. Reports help us investigate concerns and protect the wider community.',
              )}
            </p>

            <h2 id="emergencies">{t('Emergencies')}</h2>
            <p className="lead">
              {t(
                'If you are in immediate danger, contact local emergency services first. Trustroots cannot provide emergency assistance.',
              )}
            </p>

            <h2 id="showing-accountability">{t('Showing Accountability')}</h2>
            <p>
              {t(
                'We all make mistakes, misread signals, miscommunicate, or hurt someone unintentionally.',
              )}
            </p>
            <p>
              {t(
                'If you feel that you have violated someone’s boundaries and caused harm, this resource can help you ',
              )}
              <a
                href="https://docs.google.com/document/d/1WiMevd1_zxWF63sdElbkPsNC3aNbcMdJCrO6p5JfQbM/edit?tab=t.0"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('show accountability and make amends')}
              </a>
              {t('.')}
            </p>

            <h2 id="help-build-a-safer-community">
              {t('Help Us Build a Safer Community')}
            </h2>
            <p>
              {t(
                'Trustroots is community-driven, and we want to improve how conflicts and safety concerns are handled. Reports are currently handled by the core team, which is not sustainable in the long term.',
              )}
            </p>
            <p>
              {t(
                'We are looking for volunteers with experience in mediation, community moderation, conflict resolution, or safeguarding, as well as anyone who cares about building a welcoming community.',
              )}
            </p>
            <p>
              {t('You can also ')}
              <a href="/support">{t('send us')}</a>
              {t(
                ' best practices and tips for more safety from your own experience, and we can add them to this resource.',
              )}
            </p>
            <p>
              {t(
                'Together, we can help make Trustroots safer, more welcoming, and more resilient for everyone.',
              )}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

Safety.propTypes = {};
