import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';

import StepNavigation from '@/modules/core/client/components/StepNavigation';

describe('Step Navigation through 3 steps', () => {
  const f = () => {}; // dummy handler function

  const handlers = {
    onBack: f,
    onNext: f,
    onSubmit: f,
  };

  /**
   * Given current step and amount of steps, test that specific buttons are present
   */
  [
    { currentStep: 0, numberOfSteps: 3, buttons: ['Next'] },
    { currentStep: 1, numberOfSteps: 3, buttons: ['Back', 'Next'] },
    { currentStep: 2, numberOfSteps: 3, buttons: ['Back', 'Finish'] },
  ].forEach(({ currentStep, numberOfSteps, buttons }) => {
    it(`when currentStep=${currentStep} and numberOfSteps=${3} there is only ${buttons.join(
      ' and ',
    )} button`, () => {
      const { getAllByRole } = render(
        <StepNavigation
          currentStep={currentStep}
          numberOfSteps={numberOfSteps}
          disabled={false}
          {...handlers}
        />,
      );
      const foundButtons = getAllByRole('button');
      // we have navigation for large and for small screen
      // so we have all buttons twice
      expect(foundButtons).toHaveLength(buttons.length * 2);
      buttons.forEach((button, index) => {
        expect(foundButtons[index]).toHaveTextContent(button);
      });
    });
  });

  /**
   * Test whether buttons are disabled and enabled in different contexts
   */
  [
    {
      currentStep: 1,
      numberOfSteps: 3,
      disabled: true,
      buttons: [
        { name: 'Back', disabled: false },
        { name: 'Next', disabled: true },
      ],
    },
    {
      currentStep: 1,
      numberOfSteps: 3,
      disabled: false,
      buttons: [
        { name: 'Back', disabled: false },
        { name: 'Next', disabled: false },
      ],
    },
    {
      currentStep: 2,
      numberOfSteps: 3,
      disabled: true,
      buttons: [
        { name: 'Back', disabled: false },
        { name: 'Finish', disabled: true },
      ],
    },
    {
      currentStep: 2,
      numberOfSteps: 3,
      disabled: false,
      buttons: [
        { name: 'Back', disabled: false },
        { name: 'Finish', disabled: false },
      ],
    },
  ].forEach(({ currentStep, numberOfSteps, disabled, buttons }) => {
    const expectations = buttons.map(
      ({ name, disabled: shouldBeDisabled }) =>
        `the ${name} button should be ${
          shouldBeDisabled ? 'disabled' : 'enabled'
        }`,
    );

    it(`when currentStep=${currentStep}, numberOfSteps=${numberOfSteps} and disabled=${JSON.stringify(
      disabled,
    )}, ${expectations.join(' and ')}`, () => {
      const { getAllByRole } = render(
        <StepNavigation
          currentStep={currentStep}
          disabled={disabled}
          numberOfSteps={numberOfSteps}
          {...handlers}
        />,
      );
      const foundButtons = getAllByRole('button');
      // we have navigation for large and for small screen
      // so we have all buttons twice
      expect(foundButtons).toHaveLength(buttons.length * 2);
      buttons.forEach(({ name, disabled }, index) => {
        const testedButton = foundButtons[index];
        expect(testedButton).toHaveTextContent(name);
        if (disabled) {
          expect(testedButton).toBeDisabled();
        } else {
          expect(testedButton).toBeEnabled();
        }
      });
    });
  });

  /**
   * Test that clicking a button triggers an event handler provided in props
   */
  [
    {
      currentStep: 1,
      numberOfSteps: 3,
      disabled: true,
      button: 'Back',
      buttonIndex: 0,
      testTrigger: 'onBack',
    },
    {
      currentStep: 1,
      numberOfSteps: 3,
      disabled: false,
      button: 'Next',
      buttonIndex: 1,
      testTrigger: 'onNext',
    },
    {
      currentStep: 2,
      numberOfSteps: 3,
      disabled: false,
      button: 'Finish',
      buttonIndex: 1,
      testTrigger: 'onSubmit',
    },
  ].forEach(
    ({
      currentStep,
      numberOfSteps,
      disabled,
      button,
      buttonIndex,
      testTrigger,
    }) => {
      it(`when ${button} button is clicked, the ${testTrigger} should be triggered`, () => {
        const handler = jest.fn();
        const { getAllByRole } = render(
          <StepNavigation
            currentStep={currentStep}
            disabled={disabled}
            numberOfSteps={numberOfSteps}
            {...handlers}
            {...{ [testTrigger]: handler }}
          />,
        );
        const testedButton = getAllByRole('button')[buttonIndex];
        expect(testedButton).toHaveTextContent(button);
        expect(handler).not.toHaveBeenCalled();
        fireEvent.click(testedButton);
        expect(handler).toHaveBeenCalledTimes(1);
      });
    },
  );
});
