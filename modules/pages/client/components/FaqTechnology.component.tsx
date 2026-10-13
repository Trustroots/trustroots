import React from 'react';
import Faq from './Faq.component';
import Questions from './FaqTechnologyQuestions';

export default function FaqTechnology() {
  return (
    <Faq category="technology">
      <Questions />
    </Faq>
  );
}
