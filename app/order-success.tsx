import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring
} from 'react-native-reanimated';
import { DigitalReceipt } from '@/components/features/DigitalReceipt';
import { FontAwesome } from '@expo/vector-icons';

export default function OrderSuccessScreen() {
    const router = useRouter();
    const { orderId, orderType } = useLocalSearchParams<{ orderId: string; orderType?: string }>();
    const [showReceipt, setShowReceipt] = useState(false);
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withSequence(
            withSpring(1.2),
            withSpring(1)
        );
        opacity.value = withDelay(500, withSpring(1));
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
                    <View className="bg-green-500 h-24 w-24 sm:h-32 sm:w-32 md:h-40 md:w-40 rounded-full items-center justify-center shadow-lg">
                        <Text className="text-white text-5xl sm:text-6xl md:text-8xl">✓</Text>
                    </View>
                </Animated.View>

                <Animated.View style={[animatedTextStyle]} className="items-center w-full">
                    <Text className="text-foreground font-extrabold text-2xl sm:text-3xl md:text-4xl mb-3 text-center">
                        Order Confirmed!
                    </Text>
                    <Text className="text-muted-foreground text-base sm:text-lg md:text-xl text-center mb-8 leading-relaxed">
                        Your order #{orderId ? orderId.slice(0, 8).toUpperCase() : 'N/A'} is now in preparation.
                        View your digital receipt below.
                    </Text>

                    <View className="w-full gap-3 mb-6">
                        <Pressable
                            className="bg-[#d4451a] w-full py-4 sm:py-5 rounded-xl items-center active:opacity-90 min-h-[56px]"
                            onPress={() =>
                                router.push(
                                    `/order-tracking?orderType=${encodeURIComponent(orderType || 'delivery')}&orderId=${encodeURIComponent(orderId || '')}`
                                )
                            }
                        >
                            <Text className="text-white font-bold text-base sm:text-lg">
                                Track Order
                            </Text>
                        </Pressable>
                        <Pressable
                            className="bg-blue-600 w-full py-4 sm:py-5 rounded-xl items-center active:opacity-90 flex-row justify-center min-h-[56px]"
                            onPress={() => setShowReceipt(true)}
                        >
                            <FontAwesome name="file-text-o" size={20} color="white" style={{ marginRight: 8 }} />
                            <Text className="text-background font-bold text-base sm:text-lg">
                                View Receipt
                            </Text>
                        </Pressable>

                        <Pressable
                            className="bg-foreground w-full py-5 sm:py-6 rounded-xl items-center active:opacity-90 min-h-[56px]"
                            onPress={() => router.replace('/(tabs)/menu')}
                        >
                            <Text className="text-background font-bold text-lg sm:text-xl">
                                Back to Menu
                            </Text>
                        </Pressable>
                    </View>
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
