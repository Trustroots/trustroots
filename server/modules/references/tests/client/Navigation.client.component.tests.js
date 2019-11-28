import { Navigation } from '../../client/components/create-reference/Navigation';
import Enzyme from 'enzyme';
import { shallow } from 'enzyme';
import React from 'react';
import sinon from 'sinon';
import Adapter from 'enzyme-adapter-react-16';
import jasmineEnzyme from 'jasmine-enzyme';

Enzyme.configure({ adapter: new Adapter() });

/**
 * This is a first React test suite with enzyme.
 * The enzyme configuration can be moved elsewhere (before all tests ever).
 */

(function () {
  describe('Navigation through 3 tabs', () => {

    const t = key => key; // dummy translation function
    const f = () => {}; // dummy handler function

    beforeEach(() => {
      jasmineEnzyme();
    });

    /**
     * Given tab number and amount of tabs, test that specific buttons are present
     */
    [
      { tab: 0, tabs: 3, buttons: ['Next'] },
      { tab: 1, tabs: 3, buttons: ['Back', 'Next'] },
      { tab: 2, tabs: 3, buttons: ['Back', 'Submit'] }
    ].forEach(({ tab, tabs, buttons }) => {
      it(`when tab=${tab} and tabs=${3} there is only ${buttons.join(' and ')} button`, () => {
        const wrapper = shallow(<Navigation
          tab={tab}
          tabs={tabs}
          tabDone={0}
          onBack={f}
          onNext={f}
          onSubmit={f}
          t={t}
        />);

        const foundButtons = wrapper.find('button');
        expect(foundButtons.length).toBe(buttons.length);
        buttons.forEach((button, index) => {
          expect(foundButtons.at(index).text()).toBe(button);
        });
      });
    });

    /**
     * Test whether buttons are disabled and enabled in different contexts
     */
    [
      { tab: 1, tabs: 3, tabDone: 0, buttons: [{ name: 'Back', disabled: false }, { name: 'Next', disabled: true }] },
      { tab: 1, tabs: 3, tabDone: 1, buttons: [{ name: 'Back', disabled: false }, { name: 'Next', disabled: false }] },
      { tab: 2, tabs: 3, tabDone: 1, buttons: [{ name: 'Back', disabled: false }, { name: 'Submit', disabled: true }] },
      { tab: 2, tabs: 3, tabDone: 2, buttons: [{ name: 'Back', disabled: false }, { name: 'Submit', disabled: false }] }
    ].forEach(({ tab, tabs, tabDone, buttons }) => {

      const expectations = buttons.map(({ name, disabled }) => `the ${name} button should be ${(disabled) ? 'disabled' : 'enabled'}`);

      it(`when tab=${tab}, tabs=${tabs} and tabDone=${tabDone}, ${expectations.join(' and ')}`, () => {
        const wrapper = shallow(<Navigation tab={tab} tabDone={tabDone} tabs={tabs} t={t} />);

        const foundButtons = wrapper.find('button');
        expect(foundButtons.length).toBe(buttons.length);
        buttons.forEach(({ name, disabled }, index) => {
          const testedButton = foundButtons.at(index);
          expect(testedButton.text()).toBe(name);
          if (disabled) {
            expect(testedButton).toBeDisabled();
          } else {
            expect(testedButton).not.toBeDisabled();
          }
        });
      });
    });

    /**
     * Test that clicking a button triggers an event handler provided in props
     */
    [
      { tab: 1, tabDone: 0, tabs: 3, button: 'Back', buttonIndex: 0, testTrigger: 'onBack' },
      { tab: 1, tabDone: 1, tabs: 3, button: 'Next', buttonIndex: 1, testTrigger: 'onNext' },
      { tab: 2, tabDone: 2, tabs: 3, button: 'Submit', buttonIndex: 1, testTrigger: 'onSubmit' }
    ].forEach(({ tab, tabs, tabDone, button, buttonIndex, testTrigger }) => {
      it(`when ${button} button is clicked, the ${testTrigger} should be triggered`, () => {
        const spy = sinon.spy();
        const wrapper = shallow(<Navigation
          tab={tab}
          tabDone={tabDone}
          tabs={tabs}
          t={t}
          {...{ [testTrigger]: spy }}
        />);

        const testedButton = wrapper.find('button').at(buttonIndex);
        expect(testedButton.text()).toBe(button);
        expect(spy.callCount).toBe(0);
        testedButton.simulate('click');
        expect(spy.callCount).toBe(1);
      });
    });
  });
}());
