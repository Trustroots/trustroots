import React from 'react';
import Faq from './Faq.component';
import Questions from './FaqFoundationQuestions';

export default function FaqFoundation() {
  return (
    <Faq category="foundation">
      <Questions />
    </Faq>
  );
}
