import React from 'react';

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
  const { title, content } = getRandomCard();
  return (
    <a href="/guide" className="tr-flashcards text-center font-brand-regular">
      <small className="tr-flashcards-tip text-uppercase">Tip</small>
      <p className="tr-flashcards-title">{title}</p>
      <p className="tr-flashcards-content">{content}</p>
    </a>
  );
}
