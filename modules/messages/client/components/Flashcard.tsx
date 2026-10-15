import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Flashcard() {
  const { t } = useTranslation('messages');

  const flashcards = [
    {
      title: t('Make sure your profile is complete'),
      content: t(
        "You're much more likely to get a positive response if you have written a bit about yourself.",
      ),
    },
    {
      title: t('Tell a little bit about yourself'),
      content: t(
        "You're much more likely to get a positive response if you have written a bit about yourself.",
      ),
    },
    {
      title: t('Explain to them why you are choosing them'),
      content: t(
        '...explaining that you are interested in meeting them, not just looking for free accommodation.',
      ),
    },
    {
      title: t("Tell your host why you're on a trip"),
      content: t(
        'What are your expectations in regards with going through their town?',
      ),
    },
    {
      title: t('Trustroots is very much about spontaneous travel'),
      content: t("Don't write to people 2 months ahead."),
    },
  ];

  function getRandomCard() {
    return flashcards[Math.floor(Math.random() * flashcards.length)];
  }

  const { title, content } = getRandomCard();
  return (
    <a href="/guide" className="tr-flashcards text-center font-brand-regular">
      <small className="tr-flashcards-tip text-uppercase">{t('Tip')}</small>
      <p className="tr-flashcards-title">{title}</p>
      <p className="tr-flashcards-content">{content}</p>
    </a>
  );
}
