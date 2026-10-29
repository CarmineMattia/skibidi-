import Head from 'expo-router/head';
import { BRAND } from '@/lib/data/brand';
import { pageTitle, type PageTitleKey } from '@/lib/utils/pageTitle';

/** Sets the document title (web; no-op on native). One per screen, next to the screen content. */
export function PageTitle({ page }: { page: PageTitleKey }) {
  return (
    <Head>
      <title>{pageTitle(page, BRAND.name)}</title>
    </Head>
  );
}
