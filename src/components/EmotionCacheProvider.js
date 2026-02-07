'use client';

import * as React from 'react';
import { CacheProvider } from '@emotion/react';
import createEmotionCache from '@/lib/emotionCache';

const clientSideEmotionCache = createEmotionCache();

export default function EmotionCacheProvider({ children }) {
  return (
    <CacheProvider value={clientSideEmotionCache}>
      {children}
    </CacheProvider>
  );
}
