import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';

import Navigation from '@/modules/core/client/components/Navigation';

describe('Navigation through 3 tabs', () => {
  const f = () => {}; // dummy handler function

  const handlers = {
    onBack: f,
    onNext: f,
    onSubmit: f,
  };

  /**
   * Given tab number and amount of tabs, test that specific buttons are present
   */
  [
    { tab: 0, tabs: 3, buttons: ['Next'] },
    { tab: 1, tabs: 3, buttons: ['Back', 'Next'] },
    { tab: 2, tabs: 3, buttons: ['Back', 'Finish'] },
  ].forEach(({ tab, tabs, buttons }) => {
    it(`when tab=${tab} and tabs=${3} there is only ${buttons.join(
      ' and ',
    )} button`, () => {
      const { getAllByRole } = render(
        <Navigation
          tab={tab}
          tabs={tabs}
          errors={[[], [], []]}
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
      tab: 1,
      tabs: 3,
      errors: [[], ['error'], []],
      buttons: [
        { name: 'Back', disabled: false },
        { name: 'Next', disabled: true },
      ],
    },
    {
      tab: 1,
      tabs: 3,
      errors: [[], [], ['error']],
      buttons: [
        { name: 'Back', disabled: false },
        { name: 'Next', disabled: false },
      ],
    },
    {
      tab: 2,
      tabs: 3,
      errors: [[], [], ['error']],
      buttons: [
        { name: 'Back', disabled: false },
        { name: 'Finish', disabled: true },
      ],
    },
    {
      tab: 2,
      tabs: 3,
      errors: [[], [], []],
      buttons: [
        { name: 'Back', disabled: false },
        { name: 'Finish', disabled: false },
      ],
    },
  ].forEach(({ tab, tabs, errors, buttons }) => {
    const expectations = buttons.map(
      ({ name, disabled }) =>
        `the ${name} button should be ${disabled ? 'disabled' : 'enabled'}`,
    );

    it(`when tab=${tab}, tabs=${tabs} and errors=${JSON.stringify(
      errors,
    )}, ${expectations.join(' and ')}`, () => {
      const { getAllByRole } = render(
        <Navigation tab={tab} errors={errors} tabs={tabs} {...handlers} />,
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
      tab: 1,
      tabs: 3,
      errors: [[], ['error'], []],
      button: 'Back',
      buttonIndex: 0,
      testTrigger: 'onBack',
    },
    {
      tab: 1,
      tabs: 3,
      errors: [[], [], ['error']],
      button: 'Next',
      buttonIndex: 1,
      testTrigger: 'onNext',
    },
    {
      tab: 2,
      tabs: 3,
      errors: [[], [], []],
      button: 'Finish',
      buttonIndex: 1,
      testTrigger: 'onSubmit',
    },
  ].forEach(({ tab, tabs, errors, button, buttonIndex, testTrigger }) => {
    it(`when ${button} button is clicked, the ${testTrigger} should be triggered`, () => {
      const handler = jest.fn();
      const { getAllByRole } = render(
        <Navigation
          tab={tab}
          errors={errors}
          tabs={tabs}
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
  });
});
