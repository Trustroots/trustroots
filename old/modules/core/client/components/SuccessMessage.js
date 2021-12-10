// External dependencies
import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';

// Internal dependencies
import sparklesSvg from '../img/sparkles.svg';

const Container = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  max-width: 500px;
  padding: 30px;
  text-align: center;
`;

const Sparkles = styled.img`
  margin-bottom: -50px;
`;

const Spacer = styled.div`
  margin: 15px 0;
`;

export default function SuccessMessage({ children, cta, title }) {
  return (
    <Container>
      <Sparkles src={sparklesSvg} alt="" aria-hidden />
      <h2 className="font-brand-light">{title}</h2>
      {children && <Spacer>{children}</Spacer>}
      {cta && <Spacer>{cta}</Spacer>}
    </Container>
  );
}

SuccessMessage.propTypes = {
  children: PropTypes.node,
  cta: PropTypes.node,
  title: PropTypes.string,
};
