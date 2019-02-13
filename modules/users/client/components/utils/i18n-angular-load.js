import '@/config/lib/i18n';
import { withNamespaces as withNamespacesOriginal } from 'react-i18next';

/**
 * This wires up react component with i18n.
 * It sets up withNamespaces, propTypes and Component.name for React component.
 * So it can be used in Angular.
 *
 * When we move everything to react, this won't be needed and should be removed.
 * This helper should be used only with react components which need to be imported to angular.
 */
export function withNamespaces(namespaces) {
  return (Component) => {
    // add namespaces to Component
    const ComponentHOC = withNamespacesOriginal(namespaces)(Component);

    // clone propTypes and delete t function
    const hocPropTypes = { ...Component.propTypes };
    delete hocPropTypes.t;
    // set propTypes for HOC
    ComponentHOC.propTypes = hocPropTypes;

    // change the name of the ComponentHOC
    Object.defineProperty(ComponentHOC, 'name', { value: Component.name });

    return ComponentHOC;
  };
}