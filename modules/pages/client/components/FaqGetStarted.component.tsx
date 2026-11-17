import React from 'react';
import Faq from './Faq.component';
import Questions from './FaqGetStartedQuestions';

export default function FaqGetStarted() {
  return (
    <Faq category="get-started">
      <Questions />
    </Faq>
  );
}
