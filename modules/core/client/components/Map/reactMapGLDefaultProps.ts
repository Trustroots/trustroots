import ReactMapGL from 'react-map-gl';

// React 19 ignores defaultProps on function components, which react-map-gl 5 relies on
export const reactMapGLDefaultProps = (
  ReactMapGL as unknown as { defaultProps: Record<string, unknown> }
).defaultProps;
