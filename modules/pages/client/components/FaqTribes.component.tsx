import React from 'react';
import Faq from './Faq.component';
import Questions from './FaqTribesQuestions';

export default function FaqTribes() {
  return (
    <Faq category="circles">
      <Questions />
    </Faq>
  );
}
