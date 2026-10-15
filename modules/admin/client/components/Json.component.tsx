// External dependencies
import React from 'react';

export default function Json({ content }: { content: object }) {
  return <pre>{JSON.stringify(content, null, 2)}</pre>;
}
