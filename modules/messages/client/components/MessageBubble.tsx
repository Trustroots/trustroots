import styled from 'styled-components';

export default styled.div.attrs({ className: 'message' })`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 16px;

  .message-main {
    flex: 0 1 auto;
    min-width: 0;
    max-width: min(72%, 640px);
  }

  .message-author {
    flex: 0 0 32px;
    order: -1;
    margin: 0 0 2px;

    .avatar {
      margin: 0;
    }
  }

  .panel {
    margin-bottom: 0;
    border-radius: 16px;
    box-shadow: none;

    &::before,
    &::after {
      display: none;
    }
  }

  .panel-body {
    padding: 12px 16px;
    overflow-wrap: anywhere;
  }

  .message-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    margin: 0 4px 4px;
    text-align: left;
  }

  &.message-sender-me {
    justify-content: flex-end;

    .message-meta {
      justify-content: flex-end;
    }

    .panel {
      background: #e1f5ed;
      border-bottom-right-radius: 4px;
    }

    &:not([data-hosting]) .panel {
      border-color: #c5e7da;
    }

    .message-author {
      display: none;
    }
  }

  &.message-sender-other .panel {
    border-bottom-left-radius: 4px;
  }

  @media (max-width: 767px) {
    gap: 6px;
    margin-bottom: 12px;

    .message-main {
      max-width: 85%;
    }

    .panel-body {
      padding: 10px 12px;
    }
  }
`;
