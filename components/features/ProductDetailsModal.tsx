import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/stores/CartContext';
import type { Product } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

interface ProductDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    product: Product;
}

// Mock ingredients removed - using product.ingredients from DB

export function ProductDetailsModal({ visible, onClose, product }: ProductDetailsModalProps) {
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');

    // Map of ingredient modifications: 'no' | 'standard' | 'extra'
    const [modifications, setModifications] = useState<Record<string, 'no' | 'standard' | 'extra'>>({});

    const { addItem } = useCart();

    const handleAddToCart = () => {
        // Convert modifications map to string array for cart
        const modifiers: string[] = [];

        Object.entries(modifications).forEach(([ingredient, status]) => {
            if (status === 'no') {
                modifiers.push(`No ${ingredient}`);
            } else if (status === 'extra') {
                modifiers.push(`Extra ${ingredient}`);
            }
        });

        addItem(product, quantity, notes, modifiers);
        onClose();

        // Reset state
        setQuantity(1);
        setNotes('');
        setModifications({});
    };

    const updateModification = (ingredient: string, change: -1 | 1) => {
        setModifications(current => {
            const currentStatus = current[ingredient] || 'standard';
            let newStatus = currentStatus;

            if (change === -1) {
                // Decrease: Extra -> Standard -> No
                if (currentStatus === 'extra') newStatus = 'standard';
                else if (currentStatus === 'standard') newStatus = 'no';
            } else {
                // Increase: No -> Standard -> Extra
                if (currentStatus === 'no') newStatus = 'standard';
                else if (currentStatus === 'standard') newStatus = 'extra';
            }

            return { ...current, [ingredient]: newStatus };
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'no': return 'text-destructive';
            case 'extra': return 'text-primary';
            default: return 'text-foreground';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'no': return '🚫';
            case 'extra': return '➕';
            default: return '✅';
        }
    };

    const incrementQuantity = () => setQuantity(q => q + 1);
    const decrementQuantity = () => setQuantity(q => Math.max(1, q - 1));

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end sm:justify-center sm:items-center">
                <Pressable className="absolute inset-0" onPress={onClose} />

                <View className="bg-card w-full sm:w-[500px] sm:rounded-2xl rounded-t-3xl shadow-2xl border border-border max-h-[90%] flex flex-col">

                    {/* Header Image */}
                    <View className="h-48 bg-muted relative sm:rounded-t-2xl overflow-hidden">
                        {product.image_url ? (
                            <Image
                                source={{ uri: product.image_url }}
                                className="w-full h-full"
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="w-full h-full items-center justify-center bg-secondary/30">
                                <Text className="text-6xl">🍔</Text>
                            </View>
                        )}
                        <Pressable
                            className="absolute top-4 right-4 bg-black/50 p-2 rounded-full"
                            onPress={onClose}
                        >
                            <FontAwesome name="times" size={20} color="white" />
                        </Pressable>
                    </View>

                    <ScrollView className="flex-1 p-6">
                        {/* Title & Price */}
                        <View className="flex-row justify-between items-start mb-2">
                            <Text className="text-2xl font-bold text-foreground flex-1 mr-4">
                                {product.name}
                            </Text>
                            <Text className="text-2xl font-bold text-primary">
                                €{product.price.toFixed(2)}
                            </Text>
                        </View>

                        {product.description && (
                            <Text className="text-muted-foreground mb-6">
                                {product.description}
                            </Text>
                        )}

                        {/* Quantity Selector */}
                        <View className="flex-row items-center justify-center gap-6 mb-8 bg-secondary/20 p-5 rounded-xl">
                            <Pressable
                                onPress={decrementQuantity}
                                className="w-16 h-16 rounded-full bg-card border-2 border-border items-center justify-center active:scale-95 active:bg-destructive/10"
                                accessibilityRole="button"
                                accessibilityLabel="Diminuisci quantità"
                            >
                                <FontAwesome name="minus" size={24} color="#000" />
                            </Pressable>

                            <Text className="text-4xl font-bold text-foreground w-16 text-center">
                                {quantity}
                            </Text>

                            <Pressable
                                onPress={incrementQuantity}
                                className="w-16 h-16 rounded-full bg-primary items-center justify-center active:scale-95 shadow-md"
                                accessibilityRole="button"
                                accessibilityLabel="Aumenta quantità"
                            >
                                <FontAwesome name="plus" size={24} color="white" />
                            </Pressable>
                        </View>

                        {/* Ingredients / Modifiers */}
                        {product.ingredients && product.ingredients.length > 0 && (
                            <View className="mb-6">
                                <Text className="font-bold text-lg mb-3">Ingredienti</Text>
                                <View className="gap-3">
                                    {product.ingredients.map((ingredient) => {
                                        const status = modifications[ingredient] || 'standard';
                                        return (
                                            <View key={ingredient} className="flex-row items-center justify-between bg-card border border-border rounded-xl p-3">
                                                <View className="flex-row items-center flex-1 mr-2">
                                                    <Text className="text-primary mr-2">•</Text>
                                                    <Text className={`font-medium text-lg flex-1 ${getStatusColor(status)}`}>
                                                        {ingredient}
                                                    </Text>
                                                </View>

                                                <View className="flex-row items-center gap-3 bg-secondary/30 rounded-lg p-2">
                                                    <Pressable
                                                        onPress={() => updateModification(ingredient, -1)}
                                                        className={`w-12 h-12 items-center justify-center rounded-lg ${status === 'no' ? 'opacity-30' : 'bg-card shadow-sm active:scale-95'}`}
                                                        disabled={status === 'no'}
                                                        accessibilityRole="button"
                                                        accessibilityLabel="Rimuovi ingrediente"
                                                    >
                                                        <FontAwesome name="minus" size={16} color="#000" />
                                                    </Pressable>

                                                    <View className="w-24 items-center">
                                                        {status !== 'standard' && (
                                                            <Text className="text-base font-bold">
                                                                {getStatusIcon(status)} {status === 'no' ? 'No' : 'Extra'}
                                                            </Text>
                                                        )}
                                                    </View>

                                                    <Pressable
                                                        onPress={() => updateModification(ingredient, 1)}
                                                        className={`w-12 h-12 items-center justify-center rounded-lg ${status === 'extra' ? 'opacity-30' : 'bg-card shadow-sm active:scale-95'}`}
                                                        disabled={status === 'extra'}
                                                        accessibilityRole="button"
                                                        accessibilityLabel="Aggiungi ingrediente extra"
                                                    >
                                                        <FontAwesome name="plus" size={16} color="#000" />
                                                    </Pressable>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Notes */}
                        <Text className="font-bold text-lg mb-3">Note per la cucina</Text>
                        <TextInput
                            className="bg-background border border-border rounded-xl p-4 min-h-[100px] text-foreground mb-6"
                            placeholder="Es. Allergie, cottura, ecc..."
                            placeholderTextColor="#9ca3af"
                            multiline
                            textAlignVertical="top"
                            value={notes}
                            onChangeText={setNotes}
                        />
                    </ScrollView>

                    {/* Footer Action */}
                    <View className="p-4 border-t border-border bg-card sm:rounded-b-2xl">
                        <Button
                            title={`Aggiungi al carrello • €${(product.price * quantity).toFixed(2)}`}
                            variant="default"
                            size="lg"
                            onPress={handleAddToCart}
                            className="w-full"
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}
