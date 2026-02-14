/**
 * Toast Feedback Component
 * Visual feedback for boomer-friendly UX
 * Shows brief, non-intrusive confirmation messages
 */

import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    visible: boolean;
    message: string;
    type?: ToastType;
    duration?: number;
    onHide?: () => void;
}

export function Toast({ 
    visible, 
    message, 
    type = 'success', 
    duration = 2000,
    onHide 
}: ToastProps) {
    const [opacity] = useState(new Animated.Value(0));
    const [translateY] = useState(new Animated.Value(-50));

    useEffect(() => {
        if (visible) {
            // Show animation
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-hide after duration
            const timer = setTimeout(() => {
                hideToast();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [visible]);

    const hideToast = () => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: -50,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onHide?.();
        });
    };

    if (!visible) return null;

    const getColors = () => {
        switch (type) {
            case 'success': 
                return { bg: 'bg-green-500', icon: 'check' };
            case 'error': 
                return { bg: 'bg-red-500', icon: 'times' };
            case 'info': 
                return { bg: 'bg-blue-500', icon: 'info' };
        }
    };

    const colors = getColors();

    return (
        <Animated.View
            style={{
                opacity,
                transform: [{ translateY }],
                position: 'absolute',
                top: 60,
                left: 20,
                right: 20,
                zIndex: 9999,
            }}
        >
            <View className={`${colors.bg} rounded-2xl p-4 flex-row items-center shadow-lg`}>
                <FontAwesome 
                    name={colors.icon as any} 
                    size={20} 
                    color="white" 
                    style={{ marginRight: 12 }}
                />
                <Text className="text-white font-semibold text-lg flex-1">
                    {message}
                </Text>
                <Pressable onPress={hideToast}>
                    <FontAwesome name="times" size={18} color="white" />
                </Pressable>
            </View>
        </Animated.View>
    );
}
