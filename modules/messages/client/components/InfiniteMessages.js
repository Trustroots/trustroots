import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import last from 'lodash/last';
import debounce from 'lodash/debounce';

const debounceWait = 20;

export default function InfiniteMessages({ component: Component, onFetchMore, children }) {
  const [initialScroll, setInitialScroll] = useState(true);
  const [scrollHeight, setScrollHeight] = useState(null);
  const [scrollFromBottom, setScrollFromBottom] = useState(null);
  const [lastChildKey, setLastChildKey] = useState(() => last(React.Children.toArray(children))?.key);

  const ref = React.createRef();

  function scrollToEnd() {
    ref.current.scrollTop = ref.current.scrollHeight - ref.current.offsetHeight;
  }

  useEffect(() => {
    const onResize = debounce(() => {
      if (!ref.current) return;
      // preserve scroll position
      const { scrollHeight, offsetHeight } = ref.current;
      ref.current.scrollTop = scrollHeight - offsetHeight - scrollFromBottom;
    }, debounceWait);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [scrollFromBottom]);

  useEffect(() => {
    if (!ref.current) return;

    if (initialScroll && ref.current.scrollHeight > 0) {
      // initially we want go and look at the most recent message at the bottom
      setInitialScroll(false);
      setScrollHeight(ref.current.scrollHeight);
      scrollToEnd();
    } else if (scrollHeight !== null && scrollHeight !== ref.current.scrollHeight) {
      // the height as changed, we must have added a message

      const newScrollHeight = ref.current.scrollHeight;

      const key = last(React.Children.toArray(children))?.key;
      if (key !== lastChildKey) {
        // last child is different
        // we added a message to the bottom, go and look at it!
        setLastChildKey(key);
        scrollToEnd();
      } else {
        // we added a message to the top, maintain scroll position
        ref.current.scrollTop = newScrollHeight - scrollHeight;
      }
      setScrollHeight(newScrollHeight);
    }
  });

  function onScroll() {
    if (!ref.current) return;

    const { scrollHeight, scrollTop, offsetHeight } = ref.current;
    if (scrollTop === 0) {
      onFetchMore();
    }
    setScrollFromBottom(scrollHeight - scrollTop - offsetHeight);
  }

  return (
    <Component ref={ref} onScroll={debounce(() => onScroll(), debounceWait)}>
      {children}
    </Component>
  );
}

InfiniteMessages.propTypes = {
  component: PropTypes.elementType.isRequired,
  onFetchMore: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};
