/**
 * Creates a pair of functions to support subscribing/notifying about something.
 *
 * Usage:
 *
 *   const { subscribe, notify } = createSubscribable();
 *
 *   // add a subscriber, keeping hold of the unsubscribe function
 *   const unsubscribe = subscribe(value => console.log('received value', value));
 *
 *   // notify all subscribers with a value
 *   notify('some value');
 *
 *   // unsubscribe our subscriber
 *   unsubscribe();
 *
 * @returns a function that creates a pair of subscribe/notify functions
 */
export default function createSubscribable() {
  const subscribers = [];
  return {
    subscribe(fn) {
      subscribers.push(fn);
      return () => {
        const idx = subscribers.indexOf(fn);
        if (idx !== -1) subscribers.splice(idx, 1);
      };
    },
    notify(payload) {
      const errors = [];
      for (const fn of subscribers) {
        try {
          fn(payload);
        } catch (err) {
          errors.push(err);
        }
      }
      if (errors.length > 0) {
        throw new Error('Errors! ' + errors.join(', '));
      }
    },
  };
}
