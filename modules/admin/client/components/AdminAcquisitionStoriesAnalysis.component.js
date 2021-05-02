// External dependencies
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

// Internal dependencies
import { getAcquisitionStoriesAnalysis } from '../api/acquisition-stories.api';
import AdminHeader from './AdminHeader.component';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import AdminAcquisitionStoriesMenu from './AdminAcquisitionStoriesMenu';

const Table = styled.table`
  max-width: 600px;
`;

export default function AdminAcquisitionStoriesAnalysis() {
  const [analysis, setAnalysis] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(async () => {
    const data = await getAcquisitionStoriesAnalysis();
    setAnalysis(data);
  }, []);

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Acquisition stories</h2>
        <p>Based on latest 3000 stories</p>

        <AdminAcquisitionStoriesMenu active="analysis" />

        {analysis ? (
          <>
            <ul className="list-unstyled">
              <li>Degree of freedom: {analysis.df}</li>
              <li>Entropy: {analysis.entropy}</li>
              <li>Table size: {analysis.size}</li>
              <li>Sum of frequencies: {analysis.sum}</li>
              <li>x2 - chi-squared statistic: {analysis.x2}</li>
            </ul>
            <Table className="table table-condensed">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Term</th>
                  <th>Count</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              {analysis.table.map(
                ({ category, observed, percentage }, i) =>
                  (observed > 2 || showAll) && (
                    <tr key={category}>
                      <td>{i + 1}</td>
                      <td>{category}</td>
                      <td>{observed}</td>
                      <td>{percentage}</td>
                    </tr>
                  ),
              )}
            </Table>
            {!showAll && (
              <button
                className="btn btn-default"
                onClick={() => setShowAll(true)}
              >
                Show all {analysis.table.length} terms
              </button>
            )}
          </>
        ) : (
          <LoadingIndicator />
        )}
      </div>
    </>
  );
}

AdminAcquisitionStoriesAnalysis.propTypes = {};
