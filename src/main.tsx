import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      // A 503 means MFL failed and the Worker had no saved copy to fall back
      // on. Retrying right away only adds to MFL's rate limiting, so leave it
      // to the next refresh.
      retry: (failureCount, error) =>
        failureCount < 2 &&
        !(isAxiosError(error) && error.response?.status === 503),
    },
  },
});

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
