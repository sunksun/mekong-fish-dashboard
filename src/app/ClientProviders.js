'use client';

import { AppProvider } from '@/components/AppProvider';

export default function ClientProviders({ children }) {
  return (
    <AppProvider>
      {children}
    </AppProvider>
  );
}