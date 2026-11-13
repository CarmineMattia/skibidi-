import { externalLinkProps } from '@/components/features/landing/linkProps';
import { BRAND } from '@/lib/data/brand';
import { orderQuestionNumber, orderWhatsAppUrl } from '@/lib/utils/orderWhatsApp';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

/** Stessa misura e stile del pulsante Chiama (h-11, flex-1, bordeaux). */
export const ORDER_CONTACT_BUTTON_CLASS =
  'flex-1 h-11 rounded-xl bg-[#8d171e] items-center justify-center active:opacity-90 flex-row gap-1.5';

export function OrderTrackingContactActions({ displayCode }: { displayCode: string | null }) {
  const orderNumber = displayCode ? orderQuestionNumber(displayCode) : '';
  const whatsappUrl = BRAND.whatsapp ? orderWhatsAppUrl(BRAND.whatsapp, orderNumber) : null;
  const whatsappLabel = orderNumber
    ? `Scrivi su WhatsApp per l'ordine ${orderNumber}`
    : 'Scrivi su WhatsApp per questo ordine';

  return (
    <View className="flex-row gap-2">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Chiama ${BRAND.phone}`}
        {...externalLinkProps(BRAND.phoneHref)}
        className={ORDER_CONTACT_BUTTON_CLASS}
      >
        <FontAwesome name="phone" size={13} color="#ffffff" />
        <Text className="text-white font-bold">Chiama</Text>
      </Pressable>
      {whatsappUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={whatsappLabel}
          {...externalLinkProps(whatsappUrl)}
          className={ORDER_CONTACT_BUTTON_CLASS}
        >
          <FontAwesome5 name="whatsapp" size={13} color="#ffffff" />
          <Text className="text-white font-bold">WhatsApp</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
