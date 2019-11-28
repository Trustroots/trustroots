import { createStore, applyMiddleware } from 'redux';
import { combineReducers } from 'redux';
import thunk from 'redux-thunk';
import { composeWithDevTools } from 'redux-devtools-extension';
import auth from 'reducers/auth';

export function configureStore() {
  const composedEnhancers = composeWithDevTools(applyMiddleware(thunk));
  const store = createStore(combineReducers({
    auth,
  }), composedEnhancers);
  return store;
}
