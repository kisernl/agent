// src/components/Loading.tsx
import { Text } from 'ink';
import Spinner from 'ink-spinner';
import React from 'react';

interface LoadingProps {
  message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message = 'Working on it...' }) => (
  <Text>
    <Text color="green">
      <Spinner type="dots" />
    </Text>
    {' '}
    <Text color="gray" italic>
      {message}
    </Text>
  </Text>
);