import React from 'react';
import { useTranslation } from 'react-i18next';

const flashcards = [
  {
    title: 'Make sure your profile is complete',
    content:
      "You're much more likely to get a positive response if you have written a bit about yourself.",
  },
  {
    title: 'Tell a little bit about yourself',
    content:
      "You're much more likely to get a positive response if you have written a bit about yourself.",
  },
  {
    title: 'Explain to them why you are choosing them',
    content:
      '...explaining that you are interested in meeting them, not just looking for free accommodation.',
  },
  {
    title: "Tell your host why you're on a trip",
    content:
      'What are your expectations in regards with going through their town?',
  },
  {
    title: 'Trustroots is very much about spontaneous travel',
    content: "Don't write to people 2 months ahead.",
  },
];

function getRandomCard() {
  return flashcards[Math.floor(Math.random() * flashcards.length)];
}

export default function Flashcard() {
  const { t } = useTranslation('messages');
  const { title, content } = getRandomCard();
  return (
    <a href="/guide" className="tr-flashcards text-center font-brand-regular">
      <small className="tr-flashcards-tip text-uppercase">{t('Tip')}</small>
      <p className="tr-flashcards-title">{t(title)}</p>
      <p className="tr-flashcards-content">{t(content)}</p>
    </a>
  );
}
