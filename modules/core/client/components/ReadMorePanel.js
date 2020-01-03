// External dependencies
import { withTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { Component } from 'react';

// Internal dependencies
import '@/config/client/i18n';
import { plainText, plainTextLength } from '../utils/filters';

const LIMIT = 2000;

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

  render() {
    const { showMore } = this.state;
    const { content, id, t } = this.props;

    if (content.length === 0) {
      return;
    }

    if (showMore || plainTextLength(content) <= LIMIT) {
      return <div dangerouslySetInnerHTML={{ __html: content }} />;
    }

    return (
      <div className="panel-more-wrap">
        <div
          className="panel-more-wrap"
          dangerouslySetInnerHTML={{ __html: `${plainText(content).substr(0, LIMIT)} …` }}
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
          {t('Read more…')}
        </div>
      </div>
    );
  }
}

ReadMorePanel.propTypes = {
  content: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  t: PropTypes.func.isRequired
};

export default withTranslation('core')(ReadMorePanel);
