import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

export default function InfiniteMessages({ component: Component, onFetchMore, children }) {
  const [scrollToEnd, setScrollToEnd] = useState(true);
  const [scrollHeight, setScrollHeight] = useState(null);
  const ref = React.createRef();
  const endRef = React.createRef();

  useEffect(() => {
    if (!ref.current || !endRef.current) return; // wait until both are rendered
    if (scrollToEnd && ref.current.scrollHeight > 0) {
      // Initial scroll to bottom
      endRef.current.scrollIntoView();
      setScrollToEnd(false);
    } else if (scrollHeight !== null) {
      // Scroll down because new content was loaded at the top
      const newScrollHeight = ref.current.scrollHeight;
      const diff = newScrollHeight - scrollHeight;
      if (diff > 0) {
        ref.current.scrollTop = diff;
      }
      setScrollHeight(newScrollHeight);
    }
  });

  function onScroll() {
    if (ref.current.scrollTop === 0) {
      setScrollHeight(ref.current.scrollHeight);
      onFetchMore();
    }
  }

  return (
    <Component ref={ref} onScroll={onScroll}>
      {children}
      <div ref={endRef}/>
    </Component>
  );
}

InfiniteMessages.propTypes = {
  component: PropTypes.elementType.isRequired,
  onFetchMore: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};
