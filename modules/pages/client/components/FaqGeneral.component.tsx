import React from 'react';
import Faq from './Faq.component';
import Questions from './FaqGeneralQuestions';

export default function FaqGeneral() {
  return (
    <Faq category="general">
      <Questions />
    </Faq>
  );
}
