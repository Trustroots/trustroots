import React from 'react';
import PropTypes from 'prop-types';
import { withNamespaces } from 'react-i18next';
import Reference from './Reference';
import NonpublicReference from './NonpublicReference';

export function ReferencesReadPresentational({ t, publicReferences, nonpublicReferences }) {

  // only self can see that they received nonpublic references
  const hasNonpublicReferences = nonpublicReferences && nonpublicReferences.length > 0;
  const hasPublicReferences = publicReferences && publicReferences.length > 0;

  const positiveCount = publicReferences.filter(({ recommend }) => recommend === 'yes').length;
  const unknownCount = publicReferences.filter(({ recommend }) => recommend === 'unknown').length;
  const negativeCount = publicReferences.filter(({ recommend }) => recommend === 'no').length;

  const referenceCount = (
    <div>
      References:
      <span style={{ color: 'green' }}>{positiveCount}</span>
      <span style={{ color: 'red' }}>{negativeCount}</span>
      <span style={{ color: 'grey' }}>{unknownCount}</span>
    </div>
  );

  const noReferences = <div>No references yet.</div>;

  return (<>
    {referenceCount}
    {hasNonpublicReferences && (<section>
      <div>{t('Pending')}</div>
      <ul>
        {nonpublicReferences.map(reference => (
          <li key={reference._id} id={reference._id}>
            <NonpublicReference reference={reference} />
          </li>
        ))}
      </ul>
    </section>)}

    {hasPublicReferences && (<section>
      <div>{t('Public')}</div>
      <ul>
        {publicReferences.map(reference => (
          <li key={reference._id} id={reference._id}>
            <Reference reference={reference} />
          </li>
        ))}
      </ul>
    </section>)}

    {!hasNonpublicReferences && !hasPublicReferences && noReferences}
  </>);
};

const ReferencesReadPresentationalHOC = withNamespaces('reference')(ReferencesReadPresentational);

ReferencesReadPresentationalHOC.propTypes = {
  user: PropTypes.object.isRequired,
  publicReferences: PropTypes.array.isRequired,
  nonpublicReferences: PropTypes.array
};

export default ReferencesReadPresentationalHOC;
