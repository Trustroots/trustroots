'use strict';

import ReferencesNew from '../../client/components/ReferencesNew.component';
import { Self, Loading, Duplicate, Submitted } from '../../client/components/Info';
import Interaction from '../../client/components/Interaction';
import Navigation from '../../client/components/Navigation';
import Enzyme from 'enzyme';
import { shallow } from 'enzyme';
import React from 'react';
import sinon from 'sinon';
import Adapter from 'enzyme-adapter-react-16';
import jasmineEnzyme from 'jasmine-enzyme';
import * as api from '../../client/api/references.api';

Enzyme.configure({ adapter: new Adapter() });

/**
 * This is a first React test suite with enzyme.
 * The enzyme configuration can be moved elsewhere (before all tests ever).
 */

(function () {

  describe('<ReferencesNew />', () => {
    beforeEach(() => {
      jasmineEnzyme();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should not be possible to leave a reference to self', () => {
      const me = {
        _id: '123456',
        username: 'username'
      };

      const wrapper = shallow(<ReferencesNew userFrom={me} userTo={me} />);
      expect(wrapper.find(Self)).toExist();
    });

    it('check whether the reference exists at the beginning', () => {
      const userFrom = { _id: '111111', username: 'userfrom' };
      const userTo = { _id: '222222', username: 'userto' };
      const stub = sinon.stub(api, 'read');
      stub.withArgs({ userFrom: userFrom._id, userTo: userTo._id }).returns(new Promise(() => {}));

      expect(stub.callCount).toBe(0);
      const wrapper = shallow(<ReferencesNew userFrom={userFrom} userTo={userTo} />);
      expect(stub.callCount).toBe(1);
      expect(wrapper.find(Loading)).toExist();
    });

    it('can not leave a second reference', async () => {
      const userFrom = { _id: '111111', username: 'userfrom' };
      const userTo = { _id: '222222', username: 'userto' };
      const stub = sinon.stub(api, 'read');
      stub.withArgs({ userFrom: userFrom._id, userTo: userTo._id }).resolves([{
        userFrom, userTo, public: false
      }]);

      const wrapper = shallow(<ReferencesNew userFrom={userFrom} userTo={userTo} />);

      expect(wrapper.find(Duplicate)).not.toExist();
      await null;
      expect(wrapper.find(Duplicate)).toExist();
      expect(wrapper.find(Interaction)).not.toExist();
    });

    it('can leave a reference (reference form is available)', async () => {
      const userFrom = { _id: '111111', username: 'userfrom' };
      const userTo = { _id: '222222', username: 'userto' };
      const stub = sinon.stub(api, 'read');
      stub.withArgs({ userFrom: userFrom._id, userTo: userTo._id }).resolves([]);

      const wrapper = shallow(<ReferencesNew userFrom={userFrom} userTo={userTo} />);
      expect(wrapper.find(Interaction)).not.toExist();
      await null;
      expect(wrapper.find(Interaction)).toExist();
    });

    it('submit a reference', async () => {
      const userFrom = { _id: '111111', username: 'userfrom' };
      const userTo = { _id: '222222', username: 'userto' };
      const spyCreate = sinon.spy(api, 'create');
      const stubRead = sinon.stub(api, 'read');
      stubRead.withArgs({ userFrom: userFrom._id, userTo: userTo._id }).resolves([]);

      const wrapper = shallow(<ReferencesNew userFrom={userFrom} userTo={userTo} />);

      await null;

      expect(spyCreate.callCount).toBe(0);
      wrapper.setState({
        reference: {
          interactions: {
            met: false,
            hostedMe: true,
            hostedThem: false
          },
          recommend: 'yes'
        }
      });

      const nav = wrapper.find(Navigation);
      nav.props().onSubmit();

      expect(spyCreate.callCount).toBe(1);

      expect(spyCreate.calledOnceWith({
        interactions: {
          met: false,
          hostedMe: true,
          hostedThem: false
        },
        recommend: 'yes',
        userTo: userTo._id
      })).toBe(true);
    });

    it('submit a report when recommend is no and user wants to send a report', async () => {
      const userFrom = { _id: '111111', username: 'userfrom' };
      const userTo = { _id: '222222', username: 'userto' };
      const spyReport = sinon.spy(api, 'report');
      const stubRead = sinon.stub(api, 'read');
      const stubCreate = sinon.stub(api, 'create');
      stubRead.withArgs({ userFrom: userFrom._id, userTo: userTo._id }).resolves([]);
      stubCreate.resolves();

      const wrapper = shallow(<ReferencesNew userFrom={userFrom} userTo={userTo} />);

      await null;

      expect(spyReport.callCount).toBe(0);
      wrapper.setState({
        reference: {
          interactions: {
            met: false,
            hostedMe: true,
            hostedThem: false
          },
          recommend: 'unknown'
        },
        report: true,
        reportMessage: 'asdf'
      });

      const nav = wrapper.find(Navigation);

      nav.props().onSubmit();

      await null;

      expect(spyReport.callCount).toBe(0);

      wrapper.setState({
        reference: {
          interactions: {
            met: true,
            hostedMe: true,
            hostedThem: true
          },
          recommend: 'no'
        }
      });

      nav.props().onSubmit();

      await null;

      expect(spyReport.callCount).toBe(1);
      expect(spyReport.calledOnceWith(userTo, 'asdf')).toBe(true);
    });

    it('give the information that the reference was submitted', async () => {
      const userFrom = { _id: '111111', username: 'userfrom' };
      const userTo = { _id: '222222', username: 'userto' };

      const wrapper = shallow(<ReferencesNew userFrom={userFrom} userTo={userTo} />);

      wrapper.setState({
        isLoading: false,
        isSubmitted: true
      });

      wrapper.update();

      expect(wrapper.find(Submitted)).toExist();
    });
  });
}());
