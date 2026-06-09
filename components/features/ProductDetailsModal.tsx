import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/stores/CartContext';
import { cn } from '@/lib/utils/cn';
import type { Product } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';

type CookingLevel = 'poco_cotta' | 'ben_cotta';

const COOKING_OPTIONS: { id: CookingLevel; label: string }[] = [
    { id: 'poco_cotta', label: 'Poco cotta' },
    { id: 'ben_cotta', label: 'Ben cotta' },
];

function isPizzaCategoryName(categoryName?: string): boolean {
    if (!categoryName) return false;
    return categoryName.toLowerCase().includes('pizz');
}

interface ProductDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    product: Product;
    categoryName?: string;
}

export function ProductDetailsModal({ visible, onClose, product, categoryName }: ProductDetailsModalProps) {
    const [quantity, setQuantity] = useState(1);
    const [cookingLevel, setCookingLevel] = useState<CookingLevel | null>(null);

    // Map of ingredient modifications: 'no' | 'standard' | 'extra'
    const [modifications, setModifications] = useState<Record<string, 'no' | 'standard' | 'extra'>>({});

    const { addItem } = useCart();
    const showCookingOptions = isPizzaCategoryName(categoryName);

    useEffect(() => {
        if (!visible) return;
        setQuantity(1);
        setModifications({});
        setCookingLevel(null);
    }, [product.id, visible]);

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

        if (cookingLevel) {
            const cookingLabel = COOKING_OPTIONS.find((option) => option.id === cookingLevel)?.label;
            if (cookingLabel) {
                modifiers.push(`Cottura: ${cookingLabel}`);
            }
        }

        addItem(product, quantity, '', modifiers);
        onClose();

        // Reset state
        setQuantity(1);
        setModifications({});
        setCookingLevel(null);
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
            case 'no': return 'ban';
            case 'extra': return 'plus-circle';
            default: return 'check-circle';
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
                                <FontAwesome name="cutlery" size={44} color="#9ca3af" />
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
                        <View className="flex-row items-center justify-center gap-6 mb-8 bg-secondary/20 p-4 rounded-xl">
                            <Pressable
                                onPress={decrementQuantity}
                                className="w-12 h-12 rounded-full bg-card border border-border items-center justify-center active:scale-95"
                            >
                                <FontAwesome name="minus" size={20} color="#000" />
                            </Pressable>

                            <Text className="text-3xl font-bold text-foreground w-12 text-center">
                                {quantity}
                            </Text>

                            <Pressable
                                onPress={incrementQuantity}
                                className="w-12 h-12 rounded-full bg-primary items-center justify-center active:scale-95 shadow-md"
                            >
                                <FontAwesome name="plus" size={20} color="white" />
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

                                                <View className="flex-row items-center gap-3 bg-secondary/30 rounded-lg p-1">
                                                    <Pressable
                                                        onPress={() => updateModification(ingredient, -1)}
                                                        className={`w-8 h-8 items-center justify-center rounded-md ${status === 'no' ? 'opacity-30' : 'bg-card shadow-sm'}`}
                                                        disabled={status === 'no'}
                                                    >
                                                        <FontAwesome name="minus" size={12} color="#000" />
                                                    </Pressable>

                                                    <View className="w-24 items-center">
                                                        {status !== 'standard' && (
                                                            <View className="flex-row items-center gap-1">
                                                                <FontAwesome name={getStatusIcon(status) as any} size={12} color={status === 'no' ? '#dc2626' : '#ea580c'} />
                                                                <Text className="text-sm font-bold">
                                                                    {status === 'no' ? 'No' : 'Extra'}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>

                                                    <Pressable
                                                        onPress={() => updateModification(ingredient, 1)}
                                                        className={`w-8 h-8 items-center justify-center rounded-md ${status === 'extra' ? 'opacity-30' : 'bg-card shadow-sm'}`}
                                                        disabled={status === 'extra'}
                                                    >
                                                        <FontAwesome name="plus" size={12} color="#000" />
                                                    </Pressable>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {showCookingOptions && (
                            <View className="mb-6">
                                <Text className="font-bold text-lg mb-3">Cotture</Text>
                                <Text className="text-muted-foreground text-sm mb-3">Cottere</Text>
                                <View className="flex-row gap-3">
                                    {COOKING_OPTIONS.map((option) => {
                                        const isSelected = cookingLevel === option.id;
                                        return (
                                            <Pressable
                                                key={option.id}
                                                onPress={() => setCookingLevel(isSelected ? null : option.id)}
                                                className={cn(
                                                    'flex-1 items-center justify-center rounded-xl border px-4 py-3 active:scale-[0.98]',
                                                    isSelected
                                                        ? 'bg-primary border-primary'
                                                        : 'bg-card border-border'
                                                )}
                                            >
                                                <Text
                                                    className={cn(
                                                        'font-semibold text-base text-center',
                                                        isSelected ? 'text-primary-foreground' : 'text-foreground'
                                                    )}
                                                >
                                                    {option.label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        )}
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
