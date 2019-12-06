import { UPDATE_UI } from 'actions/ui';

const defaultState = {
  header: true,
  footer: true
};

export default (state=defaultState, action) => {
  switch (action.type) {
    case UPDATE_UI:
      return { ...state, ...action.payload };
    default:
      return state;
  }
};
