import React from 'react';
import PropTypes from 'prop-types';
import { withNamespaces } from 'react-i18next';
import Reference from './Reference';

export function ReferencesReadPresentational({ t, publicReferences, nonpublicReferences }) {

  function hasAny(references) {
    return references && references.length > 0;
  }

  const positiveCount = publicReferences.filter(({ recommend }) => recommend === 'yes').length;
  const unknownCount = publicReferences.filter(({ recommend }) => recommend === 'unknown').length;
  const negativeCount = publicReferences.filter(({ recommend }) => recommend === 'no').length;

  const referenceCount = (
    <div className="col-xs-12">
      <h4 className="text-muted">
        References:
        {' '}
        <span style={{ color: 'green' }}>{positiveCount} recommend</span>
        {' '}
        <span style={{ color: 'grey' }}>{unknownCount} unknown</span>
        {' '}
        <span style={{ color: 'red' }}>{negativeCount} not recommend</span>
      </h4>
    </div>
  );

  const noReferences = <div>No references yet.</div>;

  return (<>
    <section className="row">
      {referenceCount}
    </section>
    {[nonpublicReferences, publicReferences]
      .map((references, index) => hasAny(references) && (<section key={index}>
        <div className="row">
          <div className="col-xs-12 col-sm-6">
            <h4 className="text-muted">{index === 0 ? t('Pending') : t('Public')}</h4>
          </div>
        </div>
        <div className="row">
          {references.map(reference => (
            <div key={reference._id} className="col-xs-12 col-sm-6">
              <div id={reference._id} className="contacts-contact panel panel-default">
                <Reference reference={reference} />
              </div>
            </div>
          ))}
        </div>
      </section>))
    }

    {!hasAny(nonpublicReferences) && !hasAny(publicReferences) && noReferences}
  </>);
};

ReferencesReadPresentational.propTypes = {
  t: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  publicReferences: PropTypes.array.isRequired,
  nonpublicReferences: PropTypes.array
};

export default withNamespaces('reference')(ReferencesReadPresentational);
