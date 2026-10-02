import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Flashcard() {
  const { t } = useTranslation('messages');

  const flashcards = [
    {
      title: t<string>('Make sure your profile is complete'),
      content: t<string>(
        "You're much more likely to get a positive response if you have written a bit about yourself.",
      ),
    },
    {
      title: t<string>('Tell a little bit about yourself'),
      content: t<string>(
        "You're much more likely to get a positive response if you have written a bit about yourself.",
      ),
    },
    {
      title: t<string>('Explain to them why you are choosing them'),
      content: t<string>(
        '...explaining that you are interested in meeting them, not just looking for free accommodation.',
      ),
    },
    {
      title: t<string>("Tell your host why you're on a trip"),
      content: t<string>(
        'What are your expectations in regards with going through their town?',
      ),
    },
    {
      title: t<string>('Trustroots is very much about spontaneous travel'),
      content: t<string>("Don't write to people 2 months ahead."),
    },
  ];

  function getRandomCard() {
    return flashcards[Math.floor(Math.random() * flashcards.length)];
  }

  const { title, content } = getRandomCard();
  return (
    <a href="/guide" className="tr-flashcards text-center font-brand-regular">
      <small className="tr-flashcards-tip text-uppercase">
        {t<string>('Tip')}
      </small>
      <p className="tr-flashcards-title">{title}</p>
      <p className="tr-flashcards-content">{content}</p>
    </a>
  );
}
