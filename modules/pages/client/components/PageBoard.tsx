import React from 'react';
import BoardImplementation from '@/modules/core/client/components/Board.js';

export interface PageBoardProps {
  children?: React.ReactNode;
  className?: string;
  id?: string;
  ignoreBackgroundOnSmallScreen?: boolean;
  names?: string | string[];
  style?: React.CSSProperties | null;
}

const PageBoard = BoardImplementation as React.ComponentType<PageBoardProps>;

export default PageBoard;
