/**
 * Welcome to infinite messages component.
 *
 * It's a bit complex, sorry for that. I did look at all the
 * infinite scroll react libraries, but they didn't work so well
 * for this use case.
 *
 * The main things that happen are:
 * - first loaded
 *    - scroll to bottom to show latest message
 * - user scrolls to top
 *    - needs to trigger "onFetchMore"
 * - older messages are inserted at the top
 *    - needs to retain scroll position
 * - newer messages are inserted at the bottom
 *    - jump to bottom to view them
 * - user resizes the windows
 *    - should maintain scroll position (approx, at least work when scroll to the bottom)
 */

import React, {
  useEffect,
  useState,
  type ElementType,
  type ReactNode,
  type Ref,
} from 'react';
import PropTypes from 'prop-types';
import last from 'lodash/last';
import debounce from 'lodash/debounce';

const debounceWait = 20;

type InfiniteMessagesProps = {
  component: ElementType<{
    ref?: Ref<HTMLDivElement>;
    onScroll: React.UIEventHandler<HTMLDivElement>;
  }>;
  onFetchMore: () => void;
  children: ReactNode;
};

export default function InfiniteMessages({
  component: Component,
  onFetchMore,
  children,
}: InfiniteMessagesProps) {
  const [initialScroll, setInitialScroll] = useState(true);
  const [scrollHeight, setScrollHeight] = useState<number | null>(null);
  const [scrollFromBottom, setScrollFromBottom] = useState<number | null>(null);
  const [lastChildKey, setLastChildKey] = useState(
    () =>
      (last(React.Children.toArray(children)) as React.ReactElement | undefined)
        ?.key,
  );

  const ref = React.createRef<HTMLDivElement>();

  function scrollToEnd() {
    const scrollContainer = ref.current as HTMLDivElement;
    scrollContainer.scrollTop =
      scrollContainer.scrollHeight - scrollContainer.offsetHeight;
  }

  // preserve scroll position when resizing
  // this is not really precise as it doesn't take into account the changing
  // height of the messages, but it at least keeps us at the bottom if we were there.
  // to do it better we could keep track of the key of the child item we have in view).
  useEffect(() => {
    const onResize = debounce(() => {
      if (!ref.current) return;
      // preserve scroll position
      const { scrollHeight, offsetHeight } = ref.current;
      ref.current.scrollTop =
        scrollHeight - offsetHeight - (scrollFromBottom as number);
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
    } else if (
      scrollHeight !== null &&
      scrollHeight !== ref.current.scrollHeight
    ) {
      // the height as changed, we must have added a message
      // might be at the top or the bottom, let's find out...

      const newScrollHeight = ref.current.scrollHeight;

      const key = (
        last(React.Children.toArray(children)) as React.ReactElement | undefined
      )?.key;
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

  // trigger fetching more messages when we scroll to the top
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
