import React, { useEffect } from 'react';
import * as ui from 'actions/ui';
import { connect } from 'react-redux';

const without = (What, mapDispatchToProps) => Component => {
  function Without({ onMount, onUnmount, dispatch, ...props }) {
    onMount();
    useEffect(() => {
      return onUnmount;
    });

    return (
      <Component {...props} />
    );
  }

  Without.displayName = `Without${What}(${getDisplayName(Component)})`

  return connect(null, mapDispatchToProps)(Without);
}

function getDisplayName(Component) {
  return Component.displayName || Component.name || 'Component';
}

export const withoutHeader = without('Header', dispatch => ({
  onMount: () => dispatch(ui.update({ header: false })),
  onUnmount: () => dispatch(ui.update({ header: true }))
}));

export const withoutFooter = without('Footer', dispatch => ({
  onMount: () => dispatch(ui.update({ footer: false })),
  onUnmount: () => dispatch(ui.update({ footer: true }))
}));
