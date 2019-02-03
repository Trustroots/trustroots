import React from 'react';
import PropTypes from 'prop-types';
import OfferLocationPresentational from './OfferLocationPresentational';

export default class OfferLocation extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      zoom: 13,
      windowWidth: 0
    };

    this.handleChangeZoom = this.handleChangeZoom.bind(this);
    this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
  }

  /* updating windows size with https://stackoverflow.com/a/42141641 */
  componentDidMount() {
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateWindowDimensions);
  }

  updateWindowDimensions() {
    this.setState(() => ({ windowWidth: window.innerWidth }));
  }

  handleChangeZoom(zoom) {
    this.setState(() => ({ zoom }));
  }

  render() {

    const marker = getOfferMarkerType(this.props.offer);

    return <OfferLocationPresentational
      zoom={this.state.zoom}
      location={this.props.offer.location}
      marker={marker}
      onChangeZoom={this.handleChangeZoom}
      windowWidth={this.state.windowWidth}
    />;
  }
};

OfferLocation.propTypes = {
  offer: PropTypes.object.isRequired
};

function getOfferMarkerType(offer) {
  const { type='other', status='yes' } = offer;

  if (type === 'host' && status === 'yes') return 'yes';
  if (type === 'host' && status === 'maybe') return 'maybe';
  if (type === 'host' && status === 'no') return 'no';
  if (type === 'meet') return 'meet';
  return '';
}
