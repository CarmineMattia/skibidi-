import { useCallback } from 'react';
import { Platform } from 'react-native';
import Head from 'expo-router/head';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { BRAND } from '@/lib/data/brand';
import { titleWhenFocused, type PageTitleKey } from '@/lib/utils/pageTitle';

/**
 * Sets the document title (web; no-op on native) only while the screen is focused.
 * Tab screens stay mounted, so an always-rendered <Head> would keep the title of the
 * last mounted tab after navigating away. On focus the title is also written to
 * document.title so going back to a tab restores its own title immediately.
 */
export function PageTitle({ page }: { page: PageTitleKey }) {
  const focused = useIsFocused();
  const title = titleWhenFocused(page, BRAND.name, focused);

  useFocusEffect(
    useCallback(() => {
      const t = titleWhenFocused(page, BRAND.name, true);
      if (Platform.OS === 'web' && typeof document !== 'undefined' && t) document.title = t;
    }, [page])
  );

  if (!title) return null;
  return (
    <Head>
      <title>{title}</title>
    </Head>
  );
}
