// External dependencies
import React from 'react'; //eslint-disable-line

import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const rotate = keyframes`
  transform: rotate(360deg);
`;

const dash = keyframes`
  0% {
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 89, 200;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 89, 200;
    stroke-dashoffset: -124;
  }
`;

const Container = styled.div`
  opacity: 0;
  display: inline-block;
  position: relative;
  width: 36px;
  height: 36px;
  top: 90px;
  left: 10px;
  z-index: 1000;
  animation-delay: 1s;
  animation: ${fadeIn} 1s forwards;
`;

const SVG = styled.svg`
  animation: ${rotate} 2s linear infinite;
  height: 100%;
  transform-origin: center center;
  width: 100%;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  margin: auto;
`;

const Circle = styled.circle`
  stroke-dasharray: 1, 200;
  stroke-dashoffset: 0;
  animation: ${dash} 1.5s ease-in-out infinite;
  stroke-linecap: round;
  stroke: #fff;
`;

export default function SearchMapLoading() {
  return (
    <Container>
      <SVG viewBox="25 25 50 50">
        <Circle
          cx="50"
          cy="50"
          r="20"
          fill="none"
          strokeWidth="4"
          strokeMiterlimit="10"
        />
      </SVG>
    </Container>
  );
}

SearchMapLoading.propTypes = {};
