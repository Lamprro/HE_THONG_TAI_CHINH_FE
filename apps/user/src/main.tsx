import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './app/App';
import './styles.css';

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300_000,
      gcTime: 1_800_000,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        const err = error as { kind?: string; status?: number } | null;
        if (err?.kind === 'NETWORK' || err?.kind === 'TIMEOUT') return true;
        if (err?.status && err.status >= 500) return true;
        return false;
      },
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={client}><App /></QueryClientProvider></React.StrictMode>,
);
