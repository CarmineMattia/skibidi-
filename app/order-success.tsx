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
    const { orderId } = useLocalSearchParams<{ orderId: string }>();
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
        <View className="flex-1 bg-primary items-center justify-center p-8">
            <View className="bg-card p-12 rounded-[3rem] items-center shadow-2xl w-full max-w-2xl">
                <Animated.View style={[animatedIconStyle]} className="mb-8">
                    <View className="bg-green-500 h-40 w-40 rounded-full items-center justify-center shadow-lg">
                        <Text className="text-white text-8xl">✓</Text>
                    </View>
                </Animated.View>

                <Animated.View style={[animatedTextStyle]} className="items-center w-full">
                    <Text className="text-foreground font-extrabold text-4xl mb-4 text-center">
                        Ordine Confermato!
                    </Text>
                    <Text className="text-muted-foreground text-xl text-center mb-12">
                        Il tuo ordine #{orderId ? orderId.slice(0, 8).toUpperCase() : 'N/A'} è in preparazione.
                        Ritira lo scontrino.
                    </Text>

                    <View className="w-full gap-4 mb-8">
                        <Pressable
                            className="bg-blue-600 w-full py-4 rounded-2xl items-center active:opacity-90 flex-row justify-center"
                            onPress={() => setShowReceipt(true)}
                        >
                            <FontAwesome name="receipt" size={24} color="white" style={{ marginRight: 8 }} />
                            <Text className="text-background font-bold text-xl">
                                Visualizza Scontrino
                            </Text>
                        </Pressable>

                        <Pressable
                            className="bg-foreground w-full py-6 rounded-2xl items-center active:opacity-90"
                            onPress={() => router.replace('/(tabs)/menu')}
                        >
                            <Text className="text-background font-bold text-2xl">
                                Torna al Menu
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
