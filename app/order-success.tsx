import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring
} from 'react-native-reanimated';
import { DigitalReceipt } from '@/components/features/DigitalReceipt';
import { FontAwesome } from '@expo/vector-icons';
import { useOrder } from '@/lib/hooks/useOrders';
import { formatCustomerOrderCode } from '@/lib/utils/orderDisplayCode';
import { getOrderConfirmation } from '@/lib/utils/orderTracking';

export default function OrderSuccessScreen() {
    const router = useRouter();
    const { orderId, orderType, displayCode } = useLocalSearchParams<{
        orderId: string;
        orderType?: string;
        displayCode?: string;
    }>();
    const { data: orderData, isError, refetch } = useOrder(orderId || '');
    const confirmation = getOrderConfirmation(orderData?.status);
    const orderLabel = displayCode
        ? `🍕 ${displayCode}`
        : orderData
          ? formatCustomerOrderCode(orderData)
          : orderId
            ? formatCustomerOrderCode({ id: orderId, display_code: null })
            : 'N/A';
    const [showReceipt, setShowReceipt] = useState(false);
    // With reduced motion the confirmation renders fully visible right away.
    // Otherwise keep the entrance short: this is the page's primary content,
    // so it must not sit invisible behind a long animation delay.
    const reducedMotion = useReducedMotion();
    const scale = useSharedValue(reducedMotion ? 1 : 0);
    const opacity = useSharedValue(reducedMotion ? 1 : 0);

    useEffect(() => {
        if (reducedMotion) return;
        scale.value = withSequence(
            withSpring(1.2),
            withSpring(1)
        );
        opacity.value = withDelay(150, withSpring(1));
    }, []);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const animatedTextStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <View className="flex-1 bg-primary items-center justify-center px-4 sm:px-8">
            <View className="bg-card p-6 sm:p-8 md:p-12 rounded-3xl items-center shadow-2xl w-full max-w-md">
                <Animated.View style={[animatedIconStyle]} className="mb-6">
                    <View className={`${confirmation.accepted ? 'bg-green-500' : orderData?.status === 'cancelled' || isError ? 'bg-red-500' : 'bg-amber-500'} h-24 w-24 sm:h-32 sm:w-32 md:h-40 md:w-40 rounded-full items-center justify-center shadow-lg`}>
                        <Text className="text-white text-5xl sm:text-6xl md:text-8xl">{confirmation.accepted ? '✓' : '!'}</Text>
                    </View>
                </Animated.View>

                <Animated.View style={[animatedTextStyle]} className="items-center w-full">
                    <Text className="text-foreground font-extrabold text-2xl sm:text-3xl md:text-4xl mb-3 text-center">
                        {confirmation.title}
                    </Text>
                    <Text className="text-muted-foreground text-base sm:text-lg md:text-xl text-center mb-8 leading-relaxed">
                        {orderLabel}{'\n'}{confirmation.message}
                    </Text>

                    <View className="w-full gap-3 mb-6">
                        <Pressable
                            className="bg-[#8d171e] w-full py-4 sm:py-5 rounded-xl items-center active:opacity-90 min-h-[56px]"
                            onPress={() =>
                                router.push(
                                    `/order-tracking?orderType=${encodeURIComponent(orderType || 'delivery')}&orderId=${encodeURIComponent(orderId || '')}`
                                )
                            }
                        >
                            <Text className="text-white font-bold text-base sm:text-lg">
                                Segui l’ordine
                            </Text>
                        </Pressable>
                        <Pressable
                            className="bg-blue-600 w-full py-4 sm:py-5 rounded-xl items-center active:opacity-90 flex-row justify-center min-h-[56px]"
                            onPress={() => setShowReceipt(true)}
                        >
                            <FontAwesome name="file-text-o" size={20} color="white" style={{ marginRight: 8 }} />
                            <Text className="text-background font-bold text-base sm:text-lg">
                                Riepilogo ordine
                            </Text>
                        </Pressable>

                        <Pressable
                            className="bg-foreground w-full py-5 sm:py-6 rounded-xl items-center active:opacity-90 min-h-[56px]"
                            onPress={() => router.replace('/(tabs)/menu')}
                        >
                            <Text className="text-background font-bold text-lg sm:text-xl">
                                Torna al menu
                            </Text>
                        </Pressable>
                    </View>
                    {isError ? <Pressable accessibilityRole="button" onPress={() => void refetch()}><Text className="text-primary font-bold">Riprova verifica</Text></Pressable> : null}
                </Animated.View>
            </View>

            <DigitalReceipt
                visible={showReceipt}
                orderId={orderId || ''}
                onClose={() => setShowReceipt(false)}
            />
        </View>
    );
}
