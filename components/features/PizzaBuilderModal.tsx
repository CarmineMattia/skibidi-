import { Button } from '@/components/ui/Button';
import {
    categorizeIngredient,
    getCategoryInfo,
    getIngredientSuggestions,
    INGREDIENT_CATALOG,
    INGREDIENT_CATEGORIES,
} from '@/lib/data/ingredients';
import type { CatalogIngredient, IngredientCategoryId } from '@/lib/data/ingredients';
import {
    BUILDER_DOUGHS,
    BUILDER_INGREDIENT_PRICES,
    BUILDER_SAUCES,
    BUILDER_SIZES,
    buildSelectionModifiers,
    calculateBuilderPrice,
    getBuilderSize,
} from '@/lib/data/pizzaBuilder';
import type { BuilderSelection } from '@/lib/data/pizzaBuilder';
import { useCart } from '@/lib/stores/CartContext';
import { cn } from '@/lib/utils/cn';
import type { Product } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

type CookingLevel = 'poco_cotta' | 'normale' | 'ben_cotta';

const COOKING_OPTIONS: { id: CookingLevel; label: string }[] = [
    { id: 'poco_cotta', label: 'Poco cotta' },
    { id: 'normale', label: 'Normale' },
    { id: 'ben_cotta', label: 'Ben cotta' },
];

interface PizzaBuilderModalProps {
    visible: boolean;
    onClose: () => void;
    /** Prodotto "Componi la tua pizza" a cui agganciare la riga d'ordine */
    product: Product;
}

interface SelectedIngredient {
    name: string;
    category: IngredientCategoryId;
}

export function PizzaBuilderModal({ visible, onClose, product }: PizzaBuilderModalProps) {
    const [quantity, setQuantity] = useState(1);
    const [sizeId, setSizeId] = useState(BUILDER_SIZES[1].id);
    const [doughId, setDoughId] = useState(BUILDER_DOUGHS[0].id);
    const [sauceId, setSauceId] = useState(BUILDER_SAUCES[0].id);
    const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([]);
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<IngredientCategoryId | 'all'>('all');
    const [cookingLevel, setCookingLevel] = useState<CookingLevel>('normale');
    const [notes, setNotes] = useState('');

    const { addItem } = useCart();

    useEffect(() => {
        if (!visible) return;
        setQuantity(1);
        setSizeId(BUILDER_SIZES[1].id);
        setDoughId(BUILDER_DOUGHS[0].id);
        setSauceId(BUILDER_SAUCES[0].id);
        setSelectedIngredients([]);
        setIngredientSearch('');
        setActiveCategory('all');
        setCookingLevel('normale');
        setNotes('');
    }, [visible]);

    const selection: BuilderSelection = useMemo(
        () => ({ sizeId, doughId, sauceId, ingredients: selectedIngredients }),
        [sizeId, doughId, sauceId, selectedIngredients]
    );

    const breakdown = useMemo(() => calculateBuilderPrice(selection), [selection]);
    const size = getBuilderSize(sizeId);

    const pizzaBase = sauceId === 'bianca' ? 'bianca' : 'rossa';

    const suggestions = useMemo(() => {
        const existing = [
            sauceId === 'bianca' ? 'mozzarella' : 'pomodoro',
            'mozzarella',
            ...selectedIngredients.map((ingredient) => ingredient.name),
        ];
        return getIngredientSuggestions(existing, pizzaBase, 6);
    }, [sauceId, selectedIngredients, pizzaBase]);

    const searchableIngredients = useMemo(() => {
        const query = ingredientSearch.trim().toLowerCase();
        return INGREDIENT_CATALOG.filter((entry) => {
            // Pomodoro e mozzarella sono già gestiti dalla base
            if (entry.name === 'Pomodoro' || entry.name === 'Mozzarella') return false;
            if (activeCategory !== 'all' && entry.category !== activeCategory) return false;
            if (query && !entry.name.toLowerCase().includes(query)) return false;
            return true;
        });
    }, [ingredientSearch, activeCategory]);

    const isIngredientSelected = (name: string): boolean =>
        selectedIngredients.some((ingredient) => ingredient.name === name);

    const toggleIngredient = (entry: CatalogIngredient) => {
        setSelectedIngredients((current) =>
            current.some((ingredient) => ingredient.name === entry.name)
                ? current.filter((ingredient) => ingredient.name !== entry.name)
                : [...current, { name: entry.name, category: entry.category }]
        );
    };

    const ingredientPriceLabel = (category: IngredientCategoryId): string => {
        const price = BUILDER_INGREDIENT_PRICES[category] * size.ingredientMultiplier;
        return `+€${price.toFixed(2)}`;
    };

    const handleAddToCart = () => {
        const modifiers = buildSelectionModifiers(selection);

        if (cookingLevel !== 'normale') {
            const cookingLabel = COOKING_OPTIONS.find((option) => option.id === cookingLevel)?.label;
            if (cookingLabel) {
                modifiers.push(`Cottura: ${cookingLabel}`);
            }
        }

        addItem(product, quantity, notes.trim(), modifiers, breakdown.total);
        onClose();
    };

    const incrementQuantity = () => setQuantity((q) => q + 1);
    const decrementQuantity = () => setQuantity((q) => Math.max(1, q - 1));

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end sm:justify-center sm:items-center">
                <Pressable className="absolute inset-0" onPress={onClose} />

                <View className="bg-card w-full sm:w-[540px] sm:rounded-2xl rounded-t-3xl shadow-2xl border border-border max-h-[92%] flex flex-col">

                    {/* Header */}
                    <View className="bg-[#8d171e] sm:rounded-t-2xl rounded-t-3xl px-6 py-5 flex-row items-center justify-between">
                        <View className="flex-1 mr-3">
                            <Text className="text-white font-extrabold text-2xl">Componi la tua pizza</Text>
                            <Text className="text-white/80 text-sm mt-1">
                                Taglia, impasto, base e tutti gli ingredienti che vuoi
                            </Text>
                        </View>
                        <Pressable className="bg-white/15 p-2 rounded-full" onPress={onClose}>
                            <FontAwesome name="times" size={20} color="white" />
                        </Pressable>
                    </View>

                    <ScrollView className="flex-1 p-6">
                        {/* Quantity */}
                        <View className="flex-row items-center justify-center gap-6 mb-6 bg-secondary/20 p-4 rounded-xl">
                            <Pressable
                                onPress={decrementQuantity}
                                className="w-12 h-12 rounded-full bg-card border border-border items-center justify-center active:scale-95"
                            >
                                <FontAwesome name="minus" size={20} color="#000" />
                            </Pressable>
                            <Text className="text-3xl font-bold text-foreground w-12 text-center">{quantity}</Text>
                            <Pressable
                                onPress={incrementQuantity}
                                className="w-12 h-12 rounded-full bg-primary items-center justify-center active:scale-95 shadow-md"
                            >
                                <FontAwesome name="plus" size={20} color="white" />
                            </Pressable>
                        </View>

                        {/* Taglia */}
                        <View className="mb-6">
                            <Text className="font-bold text-lg mb-3">Taglia</Text>
                            <View className="gap-3">
                                {BUILDER_SIZES.map((option) => {
                                    const isSelected = sizeId === option.id;
                                    return (
                                        <Pressable
                                            key={option.id}
                                            onPress={() => setSizeId(option.id)}
                                            className={cn(
                                                'flex-row items-center justify-between rounded-xl border-2 px-4 py-3 active:scale-[0.99]',
                                                isSelected ? 'bg-[#f9ecdd] border-[#8d171e]' : 'bg-card border-border'
                                            )}
                                        >
                                            <View className="flex-1 mr-2">
                                                <Text className="font-bold text-base">{option.label}</Text>
                                                {option.description && (
                                                    <Text className="text-muted-foreground text-xs">{option.description}</Text>
                                                )}
                                            </View>
                                            <Text className="font-bold text-primary">€{option.basePrice.toFixed(2)}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Impasto */}
                        <View className="mb-6">
                            <Text className="font-bold text-lg mb-3">Impasto</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {BUILDER_DOUGHS.map((option) => {
                                    const isSelected = doughId === option.id;
                                    return (
                                        <Pressable
                                            key={option.id}
                                            onPress={() => setDoughId(option.id)}
                                            className={cn(
                                                'rounded-full border px-4 py-2.5 active:scale-95',
                                                isSelected ? 'bg-primary border-primary' : 'bg-card border-border'
                                            )}
                                        >
                                            <Text className={cn('font-semibold text-sm', isSelected ? 'text-primary-foreground' : 'text-foreground')}>
                                                {option.label}
                                                {option.surcharge > 0 ? ` (+€${option.surcharge.toFixed(2)})` : ''}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Base */}
                        <View className="mb-6">
                            <Text className="font-bold text-lg mb-3">Base</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {BUILDER_SAUCES.map((option) => {
                                    const isSelected = sauceId === option.id;
                                    return (
                                        <Pressable
                                            key={option.id}
                                            onPress={() => setSauceId(option.id)}
                                            className={cn(
                                                'rounded-full border px-4 py-2.5 active:scale-95',
                                                isSelected ? 'bg-primary border-primary' : 'bg-card border-border'
                                            )}
                                        >
                                            <Text className={cn('font-semibold text-sm', isSelected ? 'text-primary-foreground' : 'text-foreground')}>
                                                {option.label}
                                                {option.surcharge > 0 ? ` (+€${option.surcharge.toFixed(2)})` : ''}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <Text className="text-xs text-muted-foreground mt-2">
                                La mozzarella è sempre inclusa nella base.
                            </Text>
                        </View>

                        {/* Ingredienti scelti */}
                        {selectedIngredients.length > 0 && (
                            <View className="mb-6">
                                <Text className="font-bold text-lg mb-3">I tuoi ingredienti</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {selectedIngredients.map((ingredient) => {
                                        const categoryInfo = getCategoryInfo(ingredient.category);
                                        return (
                                            <Pressable
                                                key={ingredient.name}
                                                onPress={() => toggleIngredient({ name: ingredient.name, category: ingredient.category })}
                                                className={cn(
                                                    'flex-row items-center gap-2 rounded-full border px-3 py-2 active:scale-95',
                                                    categoryInfo.chipClass
                                                )}
                                            >
                                                <View className={cn('w-2 h-2 rounded-full', categoryInfo.dotClass)} />
                                                <Text className={cn('text-sm font-semibold', categoryInfo.textClass)}>
                                                    {ingredient.name} · {ingredientPriceLabel(ingredient.category)}
                                                </Text>
                                                <FontAwesome name="times-circle" size={14} color="#6b7280" />
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Il pizzaiolo consiglia */}
                        {suggestions.length > 0 && (
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
                                                onPress={() => toggleIngredient(suggestion)}
                                                className={cn(
                                                    'flex-row items-center gap-2 rounded-full border px-3 py-2 active:scale-95',
                                                    categoryInfo.chipClass
                                                )}
                                            >
                                                <View className={cn('w-2 h-2 rounded-full', categoryInfo.dotClass)} />
                                                <Text className={cn('text-sm font-semibold', categoryInfo.textClass)}>
                                                    {suggestion.name} · {ingredientPriceLabel(suggestion.category)}
                                                </Text>
                                                <FontAwesome name="plus" size={12} color="#8d171e" />
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Cerca ingredienti */}
                        <View className="mb-6">
                            <Text className="font-bold text-lg mb-3">Aggiungi ingredienti</Text>

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
                                            <Text className={cn('text-sm font-semibold', category.textClass)}>{category.label}</Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>

                            <View className="flex-row flex-wrap gap-2">
                                {searchableIngredients.map((entry) => {
                                    const categoryInfo = getCategoryInfo(entry.category);
                                    const isSelected = isIngredientSelected(entry.name);
                                    return (
                                        <Pressable
                                            key={entry.name}
                                            onPress={() => toggleIngredient(entry)}
                                            className={cn(
                                                'flex-row items-center gap-2 rounded-full border px-3 py-2 active:scale-95',
                                                categoryInfo.chipClass,
                                                isSelected && 'border-primary border-2'
                                            )}
                                        >
                                            <View className={cn('w-2 h-2 rounded-full', categoryInfo.dotClass)} />
                                            <Text className={cn('text-sm font-semibold', categoryInfo.textClass)}>
                                                {entry.name} · {ingredientPriceLabel(entry.category)}
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
                                    <Text className="text-sm text-muted-foreground py-2">Nessun ingrediente trovato.</Text>
                                )}
                            </View>
                        </View>

                        {/* Cottura */}
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
                                                isSelected ? 'bg-primary border-primary' : 'bg-card border-border'
                                            )}
                                        >
                                            <Text className={cn('font-semibold text-base text-center', isSelected ? 'text-primary-foreground' : 'text-foreground')}>
                                                {option.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

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

                        {/* Riepilogo prezzo */}
                        <View className="mb-6 bg-secondary/20 border border-border rounded-xl p-4 gap-1.5">
                            <Text className="font-bold text-base mb-1">Riepilogo</Text>
                            <View className="flex-row justify-between">
                                <Text className="text-sm text-muted-foreground">Base ({size.label})</Text>
                                <Text className="text-sm font-semibold">€{breakdown.base.toFixed(2)}</Text>
                            </View>
                            {breakdown.dough > 0 && (
                                <View className="flex-row justify-between">
                                    <Text className="text-sm text-muted-foreground">Impasto</Text>
                                    <Text className="text-sm font-semibold">+€{breakdown.dough.toFixed(2)}</Text>
                                </View>
                            )}
                            {breakdown.sauce > 0 && (
                                <View className="flex-row justify-between">
                                    <Text className="text-sm text-muted-foreground">Base extra</Text>
                                    <Text className="text-sm font-semibold">+€{breakdown.sauce.toFixed(2)}</Text>
                                </View>
                            )}
                            {breakdown.ingredients > 0 && (
                                <View className="flex-row justify-between">
                                    <Text className="text-sm text-muted-foreground">
                                        Ingredienti ({selectedIngredients.length})
                                    </Text>
                                    <Text className="text-sm font-semibold">+€{breakdown.ingredients.toFixed(2)}</Text>
                                </View>
                            )}
                            <View className="flex-row justify-between pt-2 mt-1 border-t border-border">
                                <Text className="font-bold">Totale pizza</Text>
                                <Text className="font-bold text-primary">€{breakdown.total.toFixed(2)}</Text>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Footer Action */}
                    <View className="p-4 border-t border-border bg-card sm:rounded-b-2xl">
                        <Button
                            title={`Aggiungi al carrello • €${(breakdown.total * quantity).toFixed(2)}`}
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
