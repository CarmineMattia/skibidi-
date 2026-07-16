import { ScrollViewStyleReset } from 'expo-router/html';
import { BRAND } from '../lib/data/brand';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  const siteUrl = process.env.EXPO_PUBLIC_WEB_URL || BRAND.website;
  const supabaseOrigin = (() => {
    try {
      return new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').origin;
    } catch {
      return null;
    }
  })();
  const socialImage = `${BRAND.website}/img/logo-pizzeria-ambrosia-removebg-preview.png`;
  const restaurantSchema = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: BRAND.name,
    description: BRAND.description,
    image: socialImage,
    url: siteUrl,
    telephone: '+39 0522 171 7681',
    priceRange: '€€',
    servesCuisine: ['Pizza', 'Cucina italiana'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Via E. Franchini, 51',
      postalCode: '42027',
      addressLocality: 'Montecchio Emilia',
      addressRegion: 'RE',
      addressCountry: 'IT',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '12:00',
        closes: '14:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '18:00',
        closes: '22:30',
      },
    ],
  };

  return (
    <html lang="it">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>{`${BRAND.name} | Pizza e consegna a Montecchio Emilia`}</title>
        <meta name="description" content={BRAND.description} />
        <meta name="theme-color" content="#8d171e" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={siteUrl} />

        {/* Warm up the two cross-origin hosts on the critical path:
            Supabase (menu data + product images) and flagcdn (checkout flags).
            Everything else is same-origin. */}
        {supabaseOrigin && <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />}
        {supabaseOrigin && <link rel="dns-prefetch" href={supabaseOrigin} />}
        <link rel="dns-prefetch" href="https://flagcdn.com" />

        <meta property="og:type" content="restaurant" />
        <meta property="og:locale" content="it_IT" />
        <meta property="og:title" content={`${BRAND.name} — ${BRAND.tagline}`} />
        <meta property="og:description" content={BRAND.description} />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:alt" content={`Logo ${BRAND.name}`} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${BRAND.name} — ${BRAND.tagline}`} />
        <meta name="twitter:description" content={BRAND.description} />
        <meta name="twitter:image" content={socialImage} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantSchema) }}
        />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #f9ecdd;
}

/* Users who ask the OS for less motion get static skeletons and instant
   transitions instead of pulse/spin/slide effects. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}`;
