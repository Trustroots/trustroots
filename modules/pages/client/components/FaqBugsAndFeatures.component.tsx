import React from 'react';
import Faq from './Faq.component';
import Questions from './FaqBugsAndFeaturesQuestions';

export default function FaqBugsAndFeatures() {
  return (
    <Faq category="bugs-and-features">
      <Questions />
    </Faq>
  );
}
