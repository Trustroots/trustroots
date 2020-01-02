// External dependencies
import PropTypes from 'prop-types';
import React, { Component } from 'react';

// Internal dependencies
import { plainText, plainTextLength } from '../utils/filters';

export class ReadMorePanel extends Component {
  constructor(props) {
    super(props);
    this.toggleMore = this.toggleMore.bind(this);
    this.state = {
      showMore: false
    };
  }

  toggleMore() {
    this.setState({ showMore: true });
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error(error, errorInfo); //eslint-disable-line
  }

  render() {
    const { showMore } = this.state;
    const { content, id, limit } = this.props;

    if (content.length === 0) {
      return;
    }

    if (showMore || plainTextLength(content) <= limit) {
      return <div dangerouslySetInnerHTML={{ __html: content }} />;
    }

    return (
      <div className="panel-more-wrap">
        <div
          className="panel-more-wrap"
          dangerouslySetInnerHTML={{ __html: plainText(content).substr(0, limit) }}
          id={id}
          onClick={this.toggleMore}
        />
        <div
          aria-controls={id}
          aria-expanded="false"
          className="panel-more-fade"
          onClick={this.toggleMore}
          type="button"
        >
          {/* TODO: translate */}
          Read more…
        </div>
      </div>
    );
  }
}

ReadMorePanel.defaultProps = {
  limit: 2000
};

ReadMorePanel.propTypes = {
  content: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  limit: PropTypes.number
};

export default ReadMorePanel;
