'use client';

import * as React from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { CacheProvider } from '@emotion/react';
import createEmotionCache from '@/lib/emotionCache';

/**
 * Emotion cache provider for the Next.js App Router.
 *
 * The key piece is useServerInsertedHTML: during SSR, emotion inserts style
 * rules into the cache but they aren't part of the streamed HTML unless we
 * flush them ourselves. Without this flush the server and client emit their
 * <style data-emotion> tags in a different order, which triggers a hydration
 * mismatch (the error users saw between mui-style-global and mui-style-0).
 *
 * Pattern adapted from the official MUI + emotion App Router guide.
 */
export default function EmotionCacheProvider({ children }) {
  const [{ cache, flush }] = React.useState(() => {
    const cache = createEmotionCache();
    cache.compat = true;
    const prevInsert = cache.insert;
    let inserted = [];
    cache.insert = (...args) => {
      const serialized = args[1];
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    const flush = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    let styles = '';
    for (const name of names) {
      styles += cache.inserted[name];
    }
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
