import { Linking, Platform, type PressableProps } from 'react-native';

/**
 * Props per un Pressable che apre un link esterno (wa.me, tel:).
 *
 * Su web: react-native-web rende un vero <a href> (con target/rel per i link
 * http), così funzionano Invio/Spazio da tastiera, pressione lunga, "copia link"
 * e clic centrale. Niente onPress su web, altrimenti il link si aprirebbe due
 * volte (navigazione del browser + Linking.openURL).
 * Su native: onPress → Linking.openURL.
 */
export function externalLinkProps(url: string): PressableProps {
  if (Platform.OS === 'web') {
    const isHttp = /^https?:\/\//i.test(url);
    return {
      href: url,
      ...(isHttp ? { hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {}),
    } as unknown as PressableProps;
  }
  return { onPress: () => void Linking.openURL(url) };
}
