import type { PageTranslator } from '../types';
import React from 'react';
import { useTranslation } from 'react-i18next';

export function getStartedQuestions(t: PageTranslator) {
  return [
    {
      id: 'how-does-trustroots-work',
      title: t('How does Trustroots work?', { ns: 'pages' }),
      answer: t(
        'If you’re new to Trustroots or hospitality exchange, our starter guide explains how to set up your profile, find members and share your experiences with them.',
        { ns: 'pages' },
      ),
      linkLabel: t('Read the Trustroots starter guide', { ns: 'pages' }),
      href: 'https://wiki.trustroots.org/en/Start_Rooting',
    },
    {
      id: 'what-do-i-write-on-my-profile',
      title: t('What do I write on my profile?', { ns: 'pages' }),
      answer: t(
        'Your profile introduces you to other members. Think about what you want to share and how you’d like people to get to know you.',
        { ns: 'pages' },
      ),
      linkLabel: t('Read how to create a good profile', { ns: 'pages' }),
      href: 'https://wiki.trustroots.org/en/How_To_Create_A_Good_Profile',
    },
    {
      id: 'how-can-i-stay-safe',
      title: t('How can I stay safe?', { ns: 'pages' }),
      answer: t(
        'Trustroots is open to anyone aged 18 or older. Our support and safety team can help if something goes wrong. The safety guide covers how to prepare for hosting or staying with another member.',
        { ns: 'pages' },
      ),
      linkLabel: t('Read the safety guide', { ns: 'pages' }),
      href: 'https://wiki.trustroots.org/en/Safety',
    },
    {
      id: 'what-is-hospex',
      title: t('What is Hospex?', { ns: 'pages' }),
      answer: t(
        'Hospex is short for hospitality exchange. Its history covers how people have organised ways to host travellers and stay with locals over time.',
        { ns: 'pages' },
      ),
      linkLabel: t('Read a brief history of hospitality exchange networks', {
        ns: 'pages',
      }),
      href: 'https://wiki.trustroots.org/en/A_brief_history_of_hospitality_exchange_networks',
    },
  ];
}

export default function FaqGetStartedQuestions() {
  const { t: rawT } = useTranslation('pages');
  const t = rawT as unknown as PageTranslator;

  return (
    <>
      {getStartedQuestions(t).map(({ id, title, answer, linkLabel, href }) => (
        <div className="faq-question" id={id} key={id}>
          <h3>{title}</h3>
          <p>{answer}</p>
          <a href={href}>{linkLabel}</a>
        </div>
      ))}
    </>
  );
}
