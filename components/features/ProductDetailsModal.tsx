import { Button } from '@/components/ui/Button';
import {
    categorizeIngredient,
    detectPizzaBase,
    getCategoryInfo,
    getIngredientSuggestions,
    INGREDIENT_CATALOG,
    INGREDIENT_CATEGORIES,
} from '@/lib/data/ingredients';
import type { IngredientCategoryId } from '@/lib/data/ingredients';
import { useCategories } from '@/lib/hooks/useCategories';
import { useProducts } from '@/lib/hooks/useProducts';
import { BUILDER_INGREDIENT_PRICES, BUILDER_PRODUCT_NAME } from '@/lib/data/pizzaBuilder';
import { useCart } from '@/lib/stores/CartContext';
import { cn } from '@/lib/utils/cn';
import type { Product } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

type CookingLevel = 'poco_cotta' | 'normale' | 'ben_cotta';

const COOKING_OPTIONS: { id: CookingLevel; label: string }[] = [
    { id: 'poco_cotta', label: 'Poco cotta' },
    { id: 'normale', label: 'Normale' },
    { id: 'ben_cotta', label: 'Ben cotta' },
];

function isPizzaCategoryName(categoryName?: string): boolean {
    if (!categoryName) return false;
    return categoryName.toLowerCase().includes('pizz');
}

function isDrinkCategoryName(categoryName?: string): boolean {
    if (!categoryName) return false;
    return categoryName.toLowerCase().includes('bevand');
}

function isMetroCategoryName(categoryName?: string): boolean {
    if (!categoryName) return false;
    return categoryName.toLowerCase().includes('metro');
}

/**
 * Quanti gusti si possono scegliere per le pizze al metro,
 * dedotto dal nome del prodotto (Metà = 1, Due Terzi = 2, Farcita = 3).
 */
function getMaxGustiForProduct(productName: string, categoryName?: string): number {
    if (!isMetroCategoryName(categoryName)) return 0;
    const normalized = productName.toLowerCase();
    if (normalized.includes('metà') || normalized.includes('meta ')) return 1;
    if (normalized.includes('due terzi')) return 2;
    if (normalized.includes('farcita')) return 3;
    return 0;
}

interface ProductDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    product: Product;
    categoryName?: string;
}

export function ProductDetailsModal({ visible, onClose, product, categoryName }: ProductDetailsModalProps) {
    const [quantity, setQuantity] = useState(1);
    const [cookingLevel, setCookingLevel] = useState<CookingLevel>('normale');

    // Map of ingredient modifications: 'no' | 'standard' | 'extra'
    const [modifications, setModifications] = useState<Record<string, 'no' | 'standard' | 'extra'>>({});

    // Ingredienti aggiunti (da suggerimenti o ricerca)
    const [extraIngredients, setExtraIngredients] = useState<string[]>([]);
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<IngredientCategoryId | 'all'>('all');

    // Gusti scelti per le pizze al metro
    const [selectedGusti, setSelectedGusti] = useState<string[]>([]);

    // Note personalizzate per la cucina
    const [notes, setNotes] = useState('');

    const { addItem } = useCart();
    const { data: allProducts } = useProducts();
    const { data: allCategories } = useCategories();
    const showCookingOptions = isPizzaCategoryName(categoryName) || isMetroCategoryName(categoryName);
    const isPizza = isPizzaCategoryName(categoryName) || isMetroCategoryName(categoryName);
    const showIngredientTools = !isDrinkCategoryName(categoryName) && (isPizza || (product.ingredients?.length ?? 0) > 0);
    const maxGusti = getMaxGustiForProduct(product.name, categoryName);

    // Gusti disponibili: le pizze del menu (escluse quelle al metro e i formati)
    const availableGusti = useMemo(() => {
        if (maxGusti === 0 || !allProducts || !allCategories) return [];
        const pizzaCategoryIds = new Set(
            allCategories
                .filter((category) => isPizzaCategoryName(category.name) && !isMetroCategoryName(category.name))
                .map((category) => category.id)
        );
        return allProducts.filter(
            (candidate) =>
                pizzaCategoryIds.has(candidate.category_id ?? '') &&
                candidate.name !== 'Piccola' &&
                candidate.name !== BUILDER_PRODUCT_NAME
        );
    }, [maxGusti, allProducts, allCategories]);

    useEffect(() => {
        if (!visible) return;
        setQuantity(1);
        setModifications({});
        setCookingLevel('normale');
        setExtraIngredients([]);
        setIngredientSearch('');
        setActiveCategory('all');
        setSelectedGusti([]);
        setNotes('');
    }, [product.id, visible]);

    const pizzaBase = useMemo(
        () => detectPizzaBase(product.ingredients, product.description),
        [product.ingredients, product.description]
    );

    const suggestions = useMemo(() => {
        if (!isPizza) return [];
        return getIngredientSuggestions([...(product.ingredients ?? []), ...extraIngredients], pizzaBase, 6);
    }, [isPizza, product.ingredients, extraIngredients, pizzaBase]);

    const searchableIngredients = useMemo(() => {
        const query = ingredientSearch.trim().toLowerCase();
        const baseIngredients = (product.ingredients ?? []).map((ingredient) => ingredient.toLowerCase());

        return INGREDIENT_CATALOG.filter((entry) => {
            // Già sulla pizza di serie: si gestisce dalla lista ingredienti sopra
            if (baseIngredients.some((base) => base.includes(entry.name.toLowerCase()) || entry.name.toLowerCase().includes(base))) {
                return false;
            }
            if (activeCategory !== 'all' && entry.category !== activeCategory) return false;
            if (query && !entry.name.toLowerCase().includes(query)) return false;
            return true;
        });
    }, [product.ingredients, ingredientSearch, activeCategory]);

    const toggleExtraIngredient = (name: string) => {
        setExtraIngredients((current) =>
            current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
        );
    };

    const toggleGusto = (name: string) => {
        setSelectedGusti((current) => {
            if (current.includes(name)) {
                return current.filter((item) => item !== name);
            }
            if (current.length >= maxGusti) return current;
            return [...current, name];
        });
    };

    const handleAddToCart = () => {
        // Convert modifications map to string array for cart
        const modifiers: string[] = [];

        selectedGusti.forEach((gusto, index) => {
            modifiers.push(maxGusti > 1 ? `Gusto ${index + 1}: ${gusto}` : `Gusto: ${gusto}`);
        });

        Object.entries(modifications).forEach(([ingredient, status]) => {
            if (status === 'no') {
                modifiers.push(`No ${ingredient}`);
            } else if (status === 'extra') {
                modifiers.push(`Extra ${ingredient}`);
            }
        });

        extraIngredients.forEach((ingredient) => {
            modifiers.push(`+ ${ingredient}`);
        });

        if (cookingLevel !== 'normale') {
            const cookingLabel = COOKING_OPTIONS.find((option) => option.id === cookingLevel)?.label;
            if (cookingLabel) {
                modifiers.push(`Cottura: ${cookingLabel}`);
            }
        }

        addItem(product, quantity, notes.trim(), modifiers, product.price + extraIngredientsPrice);
        onClose();

        // Reset state
        setQuantity(1);
        setModifications({});
        setCookingLevel('normale');
        setExtraIngredients([]);
        setIngredientSearch('');
        setActiveCategory('all');
        setSelectedGusti([]);
        setNotes('');
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

    const extraIngredientsPrice = useMemo(
        () => extraIngredients.reduce((sum, name) => sum + BUILDER_INGREDIENT_PRICES[categorizeIngredient(name)], 0),
        [extraIngredients]
    );

    const totalPrice = (product.price + extraIngredientsPrice) * quantity;

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

                        {/* Gusti per pizze al metro */}
                        {maxGusti > 0 && (
                            <View className="mb-6">
                                <View className="flex-row items-center justify-between mb-1">
                                    <Text className="font-bold text-lg">Scegli i gusti</Text>
                                    <Text className={cn(
                                        'text-sm font-bold',
                                        selectedGusti.length === maxGusti ? 'text-emerald-700' : 'text-muted-foreground'
                                    )}>
                                        {selectedGusti.length}/{maxGusti}
                                    </Text>
                                </View>
                                <Text className="text-xs text-muted-foreground mb-3">
                                    Componi il metro con i gusti delle pizze del nostro menu.
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {availableGusti.map((gusto) => {
                                        const isSelected = selectedGusti.includes(gusto.name);
                                        const isDisabled = !isSelected && selectedGusti.length >= maxGusti;
                                        return (
                                            <Pressable
                                                key={gusto.id}
                                                onPress={() => toggleGusto(gusto.name)}
                                                disabled={isDisabled}
                                                className={cn(
                                                    'flex-row items-center gap-2 rounded-full border px-3 py-2 active:scale-95',
                                                    isSelected ? 'bg-primary border-primary' : 'bg-card border-border',
                                                    isDisabled && 'opacity-40'
                                                )}
                                            >
                                                <Text className={cn(
                                                    'text-sm font-semibold',
                                                    isSelected ? 'text-primary-foreground' : 'text-foreground'
                                                )}>
                                                    {gusto.name}
                                                </Text>
                                                {isSelected && <FontAwesome name="check" size={12} color="#fff" />}
                                            </Pressable>
                                        );
                                    })}
                                    {availableGusti.length === 0 && (
                                        <Text className="text-sm text-muted-foreground py-2">
                                            Caricamento gusti...
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Ingredients / Modifiers */}
                        {product.ingredients && product.ingredients.length > 0 && (
                            <View className="mb-6">
                                <Text className="font-bold text-lg mb-3">Ingredienti</Text>
                                <View className="gap-3">
                                    {product.ingredients.map((ingredient) => {
                                        const status = modifications[ingredient] || 'standard';
                                        const categoryInfo = getCategoryInfo(categorizeIngredient(ingredient));
                                        return (
                                            <View key={ingredient} className="flex-row items-center justify-between bg-card border border-border rounded-xl p-3">
                                                <View className="flex-row items-center flex-1 mr-2">
                                                    <View className={cn('w-2.5 h-2.5 rounded-full mr-2', categoryInfo.dotClass)} />
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
                                                                <FontAwesome name={getStatusIcon(status) as any} size={12} color={status === 'no' ? '#dc2626' : '#8d171e'} />
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

                        {/* Aggiunte selezionate */}
                        {extraIngredients.length > 0 && (
                            <View className="mb-6">
                                <Text className="font-bold text-lg mb-3">Le tue aggiunte</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {extraIngredients.map((ingredient) => {
                                        const categoryInfo = getCategoryInfo(categorizeIngredient(ingredient));
                                        return (
                                            <Pressable
                                                key={ingredient}
                                                onPress={() => toggleExtraIngredient(ingredient)}
                                                className={cn(
                                                    'flex-row items-center gap-2 rounded-full border px-3 py-2 active:scale-95',
                                                    categoryInfo.chipClass
                                                )}
                                            >
                                                <View className={cn('w-2 h-2 rounded-full', categoryInfo.dotClass)} />
                                                <Text className={cn('text-sm font-semibold', categoryInfo.textClass)}>
                                                    + {ingredient}
                                                </Text>
                                                <FontAwesome name="times-circle" size={14} color="#6b7280" />
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Il pizzaiolo consiglia */}
                        {isPizza && suggestions.length > 0 && (
                            <View className="mb-6">
                                <View className="flex-row items-center gap-2 mb-1">
                                    <FontAwesome name="magic" size={16} color="#8d171e" />
                                    <Text className="font-bold text-lg">Il pizzaiolo consiglia</Text>
                                </View>
                                <Text className="text-xs text-muted-foreground mb-3">
                                    {pizzaBase === 'bianca'
                                        ? 'Abbinamenti pensati per la base bianca'
                                        : 'Abbinamenti pensati per la base rossa'}
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {suggestions.map((suggestion) => {
                                        const categoryInfo = getCategoryInfo(suggestion.category);
                                        return (
                                            <Pressable
                                                key={suggestion.name}
                                                onPress={() => toggleExtraIngredient(suggestion.name)}
                                                className={cn(
                                                    'flex-row items-center gap-2 rounded-full border px-3 py-2 active:scale-95',
                                                    categoryInfo.chipClass
                                                )}
                                            >
                                                <View className={cn('w-2 h-2 rounded-full', categoryInfo.dotClass)} />
                                                <Text className={cn('text-sm font-semibold', categoryInfo.textClass)}>
                                                    {suggestion.name}
                                                </Text>
                                                <FontAwesome name="plus" size={12} color="#8d171e" />
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Cerca e aggiungi ingredienti */}
                        {showIngredientTools && (
                            <View className="mb-6">
                                <Text className="font-bold text-lg mb-3">Aggiungi ingredienti</Text>

                                {/* Search bar */}
                                <View className="flex-row items-center bg-background border border-border rounded-xl px-3 mb-3">
                                    <FontAwesome name="search" size={16} color="#9ca3af" />
                                    <TextInput
                                        className="flex-1 px-3 py-3 text-base text-foreground min-h-[48px]"
                                        placeholder="Cerca un ingrediente..."
                                        value={ingredientSearch}
                                        onChangeText={setIngredientSearch}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                    {ingredientSearch.length > 0 && (
                                        <Pressable onPress={() => setIngredientSearch('')} hitSlop={8}>
                                            <FontAwesome name="times-circle" size={16} color="#9ca3af" />
                                        </Pressable>
                                    )}
                                </View>

                                {/* Category filter chips */}
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-3">
                                    <Pressable
                                        onPress={() => setActiveCategory('all')}
                                        className={cn(
                                            'rounded-full border px-3 py-2',
                                            activeCategory === 'all' ? 'bg-primary border-primary' : 'bg-card border-border'
                                        )}
                                    >
                                        <Text className={cn('text-sm font-semibold', activeCategory === 'all' ? 'text-primary-foreground' : 'text-foreground')}>
                                            Tutti
                                        </Text>
                                    </Pressable>
                                    {INGREDIENT_CATEGORIES.map((category) => {
                                        const isActive = activeCategory === category.id;
                                        return (
                                            <Pressable
                                                key={category.id}
                                                onPress={() => setActiveCategory(isActive ? 'all' : category.id)}
                                                className={cn(
                                                    'flex-row items-center gap-1.5 rounded-full border px-3 py-2',
                                                    category.chipClass,
                                                    isActive && 'border-primary'
                                                )}
                                            >
                                                <Text className="text-sm">{category.emoji}</Text>
                                                <Text className={cn('text-sm font-semibold', category.textClass)}>
                                                    {category.label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>

                                {/* Ingredient chips */}
                                <View className="flex-row flex-wrap gap-2">
                                    {searchableIngredients.map((entry) => {
                                        const categoryInfo = getCategoryInfo(entry.category);
                                        const isSelected = extraIngredients.includes(entry.name);
                                        return (
                                            <Pressable
                                                key={entry.name}
                                                onPress={() => toggleExtraIngredient(entry.name)}
                                                className={cn(
                                                    'flex-row items-center gap-2 rounded-full border px-3 py-2 active:scale-95',
                                                    categoryInfo.chipClass,
                                                    isSelected && 'border-primary border-2'
                                                )}
                                            >
                                                <View className={cn('w-2 h-2 rounded-full', categoryInfo.dotClass)} />
                                                <Text className={cn('text-sm font-semibold', categoryInfo.textClass)}>
                                                    {entry.name}
                                                </Text>
                                                <FontAwesome
                                                    name={isSelected ? 'check-circle' : 'plus'}
                                                    size={isSelected ? 14 : 12}
                                                    color={isSelected ? '#8d171e' : '#9ca3af'}
                                                />
                                            </Pressable>
                                        );
                                    })}
                                    {searchableIngredients.length === 0 && (
                                        <Text className="text-sm text-muted-foreground py-2">
                                            Nessun ingrediente trovato.
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {showCookingOptions && (
                            <View className="mb-6">
                                <Text className="font-bold text-lg mb-3">Cottura</Text>
                                <View className="flex-row gap-3">
                                    {COOKING_OPTIONS.map((option) => {
                                        const isSelected = cookingLevel === option.id;
                                        return (
                                            <Pressable
                                                key={option.id}
                                                onPress={() => setCookingLevel(option.id)}
                                                className={cn(
                                                    'flex-1 items-center justify-center rounded-xl border px-2 py-3 active:scale-[0.98]',
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

                        {/* Note per la cucina */}
                        <View className="mb-6">
                            <Text className="font-bold text-lg mb-3">Note per la cucina</Text>
                            <TextInput
                                className="bg-background border border-border rounded-xl p-4 min-h-[100px] text-foreground"
                                placeholder="Es. allergie, intolleranze, richieste particolari..."
                                multiline
                                textAlignVertical="top"
                                value={notes}
                                onChangeText={setNotes}
                            />
                        </View>
                    </ScrollView>

                    {/* Footer Action */}
                    <View className="p-4 border-t border-border bg-card sm:rounded-b-2xl">
                        <Button
                            title={`Aggiungi al carrello • €${totalPrice.toFixed(2)}`}
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
