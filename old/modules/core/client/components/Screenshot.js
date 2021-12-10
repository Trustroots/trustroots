// External dependencies
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

const Browser = styled.div`
  border-radius: 10px;
  border: 1px solid #999;
  margin: 10px auto;
  max-width: 620px;
  padding: 10px;
  width: 100%;
  @media (max-width: 991px) {
    border-radius: 6px;
    padding: 5px;
  }
`;

const BrowserCircle = styled.div`
  border-radius: 50%;
  border: 1px solid #999;
  float: left;
  height: 10px;
  margin: 0 5px 10px 0;
  width: 10px;
  @media (max-width: 991px) {
    height: 5px;
    width: 5px;
    margin: 0 3px 5px 0;
  }
`;

const BrowserScreenshot = styled.picture`
  background-repeat: no-repeat;
  border-radius: 5px;
  clear: both;
  display: block;
  margin: 0 auto;
  max-width: 600px;
  overflow: hidden;
  width: 100%;
  @media (max-width: 991px) {
    border-radius: 3px;
  }
`;

export default function Screenshot({ png, png2x, webp, webp2x }) {
  return (
    <Browser>
      <BrowserCircle />
      <BrowserCircle />
      <BrowserCircle />
      <BrowserScreenshot>
        <source srcSet={`${webp}, ${webp2x} 2x,`} type="image/webp" />
        <source srcSet={`${png}, ${png2x} 2x`} type="image/png" />
        <img alt="" src={png} />
      </BrowserScreenshot>
    </Browser>
  );
}

Screenshot.propTypes = {
  png: PropTypes.string.isRequired,
  png2x: PropTypes.string.isRequired,
  webp: PropTypes.string.isRequired,
  webp2x: PropTypes.string.isRequired,
};
