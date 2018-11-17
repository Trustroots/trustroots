import Navigation from '../../client/components/Navigation';
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
  'use strict';

  describe('Save a new reference', () => {
    beforeEach(() => {
      jasmineEnzyme();
    });

    describe('Navigation through 3 tabs', () => {
      xit('test', () => {
        const wrapper = shallow(<Navigation tab={1} tabDone={0} tabs={3} onBack={() => {}} />);
        console.log(wrapper);
        console.log(<Navigation tab={0} />);
        console.log(wrapper.find('button'), wrapper.exists(), wrapper.name());
        expect(wrapper.find('button')).toBeDefined();
        expect(wrapper.props().tab).toBe(0);
      });

      it('when tab is 0, there is no Back button and there is Next button', () => {
        const wrapper = shallow(<Navigation tab={0} tabs={3} />);

        const buttons = wrapper.find('button');
        expect(buttons.length).toBe(1);
        expect(buttons.at(0).text()).toBe('Next');
      });

      it('when tab is 1, there is Back button and Next button', () => {
        const wrapper = shallow(<Navigation tab={1} tabs={3} />);

        const buttons = wrapper.find('button');
        expect(buttons.length).toBe(2);
        expect(buttons.at(0).text()).toBe('Back');
        expect(buttons.at(1).text()).toBe('Next');
      });

      it('when tab is 2, there is Back and Submit button and no Next button', () => {
        const wrapper = shallow(<Navigation tab={2} tabs={3} />);

        const buttons = wrapper.find('button');
        expect(buttons.length).toBe(2);
        expect(buttons.at(0).text()).toBe('Back');
        expect(buttons.at(1).text()).toBe('Submit');
      });

      it('when tab is 1 and tabDone is 0, the Next button should be disabled', () => {
        const wrapper = shallow(<Navigation tab={1} tabDone={0} tabs={3} />);

        const buttons = wrapper.find('button');
        expect(buttons.length).toBe(2);
        const next = buttons.at(1);
        expect(next.text()).toBe('Next');
        expect(next).toBeDisabled();
      });

      it('when tab is 1 and tabDone is 1, the Next button should be enabled', () => {
        const wrapper = shallow(<Navigation tab={1} tabDone={1} tabs={3} />);

        const buttons = wrapper.find('button');
        expect(buttons.length).toBe(2);
        const next = buttons.at(1);
        expect(next.text()).toBe('Next');
        expect(next).not.toBeDisabled();
      });

      it('when tab is 2 and tabDone is less, the Submit button should be disabled', () => {
        const wrapper = shallow(<Navigation tab={2} tabDone={1} tabs={3} />);

        const buttons = wrapper.find('button');
        expect(buttons.length).toBe(2);
        const submit = buttons.at(1);
        expect(submit.text()).toBe('Submit');
        expect(submit).toBeDisabled();

        /* this is how to set props and test again
        wrapper.setProps({ tabDone: 2 });
        const submitAfter = wrapper.find('button').at(1);
        expect(submitAfter).not.toBeDisabled();
        */
      });

      it('when tab is 2 and tabDone is 2, the Submit button should be enabled', () => {
        const wrapper = shallow(<Navigation tab={2} tabDone={2} tabs={3} />);

        const buttons = wrapper.find('button');
        expect(buttons.length).toBe(2);
        const submit = buttons.at(1);
        expect(submit.text()).toBe('Submit');
        expect(submit).not.toBeDisabled();
      });

      it('when Back button is clicked, the onBack should be triggered', () => {
        const onBack = sinon.spy();

        const wrapper = shallow(<Navigation tab={1} tabDone={0} tabs={3} onBack={onBack} />);
        const back = wrapper.find('button').at(0);
        expect(onBack.callCount).toBe(0);
        back.simulate('click');
        expect(onBack.callCount).toBe(1);
      });

      it('when Next button is clicked, the onNext should be triggered', () => {
        const onNext = sinon.spy();

        const wrapper = shallow(<Navigation tab={1} tabDone={1} tabs={3} onNext={onNext} />);
        const next = wrapper.find('button').at(1);
        expect(onNext.callCount).toBe(0);
        next.simulate('click');
        expect(onNext.callCount).toBe(1);
      });

      it('when Submit button is clicked, the onSubmit should be triggered', () => {
        const onSubmit = sinon.spy();

        const wrapper = shallow(<Navigation tab={2} tabDone={2} tabs={3} onSubmit={onSubmit} />);
        const submit = wrapper.find('button').at(1);
        expect(onSubmit.callCount).toBe(0);
        submit.simulate('click');
        expect(onSubmit.callCount).toBe(1);
      });
    });
  });
}());
