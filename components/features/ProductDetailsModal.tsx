import { Button } from '@/components/ui/Button';
import { MezzoMetroGustiStep } from '@/components/features/MezzoMetroGustiStep';
import {
    categorizeIngredient,
    detectPizzaBase,
    getCategoryInfo,
    getIngredientSuggestions,
    INGREDIENT_CATALOG,
    INGREDIENT_CATEGORIES,
} from '@/lib/data/ingredients';
import type { IngredientCategoryId } from '@/lib/data/ingredients';
import { IngredientThumb } from '@/components/features/IngredientThumb';
import { useCategories } from '@/lib/hooks/useCategories';
import { useProducts } from '@/lib/hooks/useProducts';
import {
    BUILDER_INGREDIENT_PRICES,
    BUILDER_PRODUCT_NAME,
    DEFAULT_MENU_PIZZA_SIZE_ID,
    buildMezzoMetroModifiers,
    createMezzoMetroGustoFromProduct,
    getMenuPizzaSize,
    getMenuPizzaUnitPrice,
    getMezzoMetroUnitPrice,
    MENU_PIZZA_SIZES,
} from '@/lib/data/pizzaBuilder';
import type { MenuPizzaSize, MezzoMetroGustoSlot } from '@/lib/data/pizzaBuilder';
import { useCart } from '@/lib/stores/CartContext';
import { cn } from '@/lib/utils/cn';
import type { Product } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type CookingLevel = 'poco_cotta' | 'normale' | 'ben_cotta';
type WizardStepId = 'size' | 'gusti' | 'mezzo_gusti' | 'ingredients' | 'finish';

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
    const insets = useSafeAreaInsets();
    const [quantity, setQuantity] = useState(1);
    const [cookingLevel, setCookingLevel] = useState<CookingLevel>('normale');
    const [sizeId, setSizeId] = useState<MenuPizzaSize['id']>(DEFAULT_MENU_PIZZA_SIZE_ID);
    const [stepIndex, setStepIndex] = useState(0);

    // Map of ingredient modifications: 'no' | 'standard' | 'extra'
    const [modifications, setModifications] = useState<Record<string, 'no' | 'standard' | 'extra'>>({});

    // Ingredienti aggiunti (da suggerimenti o ricerca)
    const [extraIngredients, setExtraIngredients] = useState<string[]>([]);
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<IngredientCategoryId | 'all'>('all');

    // Gusti scelti per le pizze al metro (categoria Al Metro)
    const [selectedGusti, setSelectedGusti] = useState<string[]>([]);
    // Gusti personalizzati per taglia Mezzo metro sul menu
    const [mezzoGusti, setMezzoGusti] = useState<MezzoMetroGustoSlot[]>([]);

    // Note personalizzate per la cucina
    const [notes, setNotes] = useState('');

    const { addItem } = useCart();
    const { data: allProducts } = useProducts();
    const { data: allCategories } = useCategories();
    const showCookingOptions = isPizzaCategoryName(categoryName) || isMetroCategoryName(categoryName);
    const isMetro = isMetroCategoryName(categoryName);
    const isPizza = isPizzaCategoryName(categoryName) || isMetro;
    const isStandardMenuPizza =
        isPizzaCategoryName(categoryName) &&
        !isMetro &&
        product.name !== 'Piccola' &&
        product.name !== BUILDER_PRODUCT_NAME;
    const isMezzoMetro = isStandardMenuPizza && sizeId === 'mezzo_metro';
    const showIngredientTools = !isDrinkCategoryName(categoryName) && (isPizza || (product.ingredients?.length ?? 0) > 0);
    const maxGusti = getMaxGustiForProduct(product.name, categoryName);
    const useWizard = isPizza || showIngredientTools;

    const wizardSteps = useMemo((): { id: WizardStepId; label: string }[] => {
        if (!useWizard) return [];
        const steps: { id: WizardStepId; label: string }[] = [];
        if (isStandardMenuPizza) steps.push({ id: 'size', label: 'Taglia' });
        if (isMezzoMetro) {
            steps.push({ id: 'mezzo_gusti', label: 'Gusti' });
        } else {
            if (maxGusti > 0) steps.push({ id: 'gusti', label: 'Gusti' });
            if (showIngredientTools) steps.push({ id: 'ingredients', label: 'Ingredienti' });
        }
        steps.push({ id: 'finish', label: 'Cottura' });
        return steps;
    }, [isMezzoMetro, isStandardMenuPizza, maxGusti, showIngredientTools, useWizard]);

    const currentStep = wizardSteps[stepIndex] ?? null;
    const isLastStep = stepIndex >= wizardSteps.length - 1;
    const isFirstStep = stepIndex <= 0;

    // Gusti disponibili: le pizze del menu (escluse quelle al metro e i formati)
    const availableMenuPizzas = useMemo(() => {
        if (!allProducts || !allCategories) return [];
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
    }, [allProducts, allCategories]);

    const availableGusti = useMemo(
        () => (maxGusti > 0 ? availableMenuPizzas : []),
        [availableMenuPizzas, maxGusti]
    );

    useEffect(() => {
        if (!visible) return;
        setQuantity(1);
        setModifications({});
        setCookingLevel('normale');
        setSizeId(DEFAULT_MENU_PIZZA_SIZE_ID);
        setStepIndex(0);
        setExtraIngredients([]);
        setIngredientSearch('');
        setActiveCategory('all');
        setSelectedGusti([]);
        setMezzoGusti([createMezzoMetroGustoFromProduct(product)]);
        setNotes('');
    }, [product, visible]);

    useEffect(() => {
        if (sizeId === 'mezzo_metro') {
            setMezzoGusti((current) =>
                current.length > 0 ? current : [createMezzoMetroGustoFromProduct(product)]
            );
        }
    }, [product, sizeId]);

    useEffect(() => {
        if (stepIndex > wizardSteps.length - 1) {
            setStepIndex(Math.max(0, wizardSteps.length - 1));
        }
    }, [stepIndex, wizardSteps.length]);

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

    const selectedSize = getMenuPizzaSize(sizeId);

    const extraIngredientsPrice = useMemo(
        () => extraIngredients.reduce((sum, name) => sum + BUILDER_INGREDIENT_PRICES[categorizeIngredient(name)], 0),
        [extraIngredients]
    );

    const resolvedUnitPrice = useMemo(() => {
        if (isMezzoMetro) {
            const slots =
                mezzoGusti.length > 0 ? mezzoGusti : [createMezzoMetroGustoFromProduct(product)];
            return getMezzoMetroUnitPrice(slots, (name) => BUILDER_INGREDIENT_PRICES[categorizeIngredient(name)]);
        }
        const base = isStandardMenuPizza
            ? getMenuPizzaUnitPrice(product.price, sizeId)
            : product.price;
        return base + extraIngredientsPrice;
    }, [extraIngredientsPrice, isMezzoMetro, isStandardMenuPizza, mezzoGusti, product, sizeId]);

    const totalPrice = resolvedUnitPrice * quantity;

    const canProceedFromCurrentStep = (): boolean => {
        if (!currentStep) return true;
        if (currentStep.id === 'gusti') {
            return selectedGusti.length === maxGusti;
        }
        if (currentStep.id === 'mezzo_gusti') {
            return mezzoGusti.length >= 1 && mezzoGusti.every((gusto) => Boolean(gusto.productName));
        }
        if (currentStep.id === 'size') {
            return Boolean(sizeId);
        }
        return true;
    };

    const handleAddToCart = () => {
        let modifiers: string[] = [];

        if (isMezzoMetro) {
            const slots =
                mezzoGusti.length > 0 ? mezzoGusti : [createMezzoMetroGustoFromProduct(product)];
            modifiers = buildMezzoMetroModifiers(slots);
        } else {
            if (isStandardMenuPizza) {
                modifiers.push(`Taglia: ${selectedSize.label}`);
            }

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
        }

        if (cookingLevel !== 'normale') {
            const cookingLabel = COOKING_OPTIONS.find((option) => option.id === cookingLevel)?.label;
            if (cookingLabel) {
                modifiers.push(`Cottura: ${cookingLabel}`);
            }
        }

        addItem(product, quantity, notes.trim(), modifiers, resolvedUnitPrice);
        onClose();
    };

    const updateModification = (ingredient: string, change: -1 | 1) => {
        setModifications((current) => {
            const currentStatus = current[ingredient] || 'standard';
            let newStatus = currentStatus;

            if (change === -1) {
                if (currentStatus === 'extra') newStatus = 'standard';
                else if (currentStatus === 'standard') newStatus = 'no';
            } else {
                if (currentStatus === 'no') newStatus = 'standard';
                else if (currentStatus === 'standard') newStatus = 'extra';
            }

            return { ...current, [ingredient]: newStatus };
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'no':
                return 'text-destructive';
            case 'extra':
                return 'text-primary';
            default:
                return 'text-foreground';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'no':
                return 'ban';
            case 'extra':
                return 'plus-circle';
            default:
                return 'check-circle';
        }
    };

    const incrementQuantity = () => setQuantity((q) => q + 1);
    const decrementQuantity = () => setQuantity((q) => Math.max(1, q - 1));

    const goNext = () => {
        if (!canProceedFromCurrentStep()) return;
        if (isLastStep) {
            handleAddToCart();
            return;
        }
        setStepIndex((current) => Math.min(current + 1, wizardSteps.length - 1));
    };

    const goBack = () => {
        setStepIndex((current) => Math.max(current - 1, 0));
    };

    const sizeSummary = isStandardMenuPizza ? selectedSize.label : null;
    const footerPrimaryLabel = !useWizard
        ? `Aggiungi al carrello • €${totalPrice.toFixed(2)}`
        : isLastStep
          ? `Aggiungi al carrello • €${totalPrice.toFixed(2)}`
          : 'Avanti';

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end sm:justify-center sm:items-center">
                <Pressable className="absolute inset-0" onPress={onClose} />

                <View className="bg-card w-full sm:w-[500px] sm:rounded-2xl rounded-t-3xl shadow-2xl border border-border max-h-[90%] flex flex-col">
                    {/* Header Image */}
                    <View className="h-40 bg-muted relative sm:rounded-t-2xl overflow-hidden">
                        {product.image_url ? (
                            <Image
                                source={{ uri: product.image_url }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                                accessibilityIgnoresInvertColors
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
                        <View className="absolute bottom-0 left-0 right-0 bg-black/45 px-5 py-3">
                            <Text className="text-white font-extrabold text-xl" numberOfLines={1}>
                                {isMezzoMetro && mezzoGusti.length > 1
                                    ? `Mezzo metro · ${mezzoGusti.map((gusto) => gusto.productName).join(' + ')}`
                                    : product.name}
                            </Text>
                            <Text className="text-white/85 text-sm mt-0.5">
                                €{resolvedUnitPrice.toFixed(2)}
                                {sizeSummary ? ` · ${sizeSummary}` : ''}
                                {isMezzoMetro && mezzoGusti.length > 0
                                    ? ` · ${mezzoGusti.length} gust${mezzoGusti.length === 1 ? 'o' : 'i'}`
                                    : ''}
                                {quantity > 1 ? ` · x${quantity}` : ''}
                            </Text>
                        </View>
                    </View>

                    {/* Step indicator */}
                    {useWizard && wizardSteps.length > 1 && (
                        <View className="px-5 pt-4 pb-2 border-b border-border">
                            <View className="flex-row items-center gap-1 mb-2">
                                {wizardSteps.map((step, index) => {
                                    const isActive = index === stepIndex;
                                    const isDone = index < stepIndex;
                                    return (
                                        <View key={step.id} className="flex-1 flex-row items-center gap-1">
                                            <View
                                                className={cn(
                                                    'h-1.5 flex-1 rounded-full',
                                                    isActive || isDone ? 'bg-[#8d171e]' : 'bg-border'
                                                )}
                                            />
                                        </View>
                                    );
                                })}
                            </View>
                            <Text className="text-xs font-bold uppercase tracking-wide text-[#8d171e]">
                                Passo {stepIndex + 1} di {wizardSteps.length} · {currentStep?.label}
                            </Text>
                        </View>
                    )}

                    <ScrollView className="flex-1 p-5">
                        {product.description && (!useWizard || currentStep?.id === 'size' || currentStep?.id === 'finish') && (
                            <Text className="text-muted-foreground mb-4 text-sm">{product.description}</Text>
                        )}

                        {/* STEP: Taglia */}
                        {(!useWizard || currentStep?.id === 'size') && isStandardMenuPizza && (
                            <View className="mb-2">
                                <Text className="font-bold text-lg mb-1">Scegli la taglia</Text>
                                <Text className="text-xs text-muted-foreground mb-3">
                                    Normale = listino · Piccola = −1€ · Tirata = stesso prezzo · Mezzo metro = 2× listino (fino a 3 gusti)
                                </Text>
                                <View className="gap-2.5">
                                    {MENU_PIZZA_SIZES.map((option) => {
                                        const isSelected = sizeId === option.id;
                                        const optionPrice = getMenuPizzaUnitPrice(product.price, option.id);
                                        return (
                                            <Pressable
                                                key={option.id}
                                                onPress={() => {
                                                    setSizeId(option.id);
                                                    if (option.id === 'mezzo_metro') {
                                                        setMezzoGusti([createMezzoMetroGustoFromProduct(product)]);
                                                    }
                                                }}
                                                className={cn(
                                                    'flex-row items-center justify-between rounded-xl border-2 px-4 py-3.5 active:scale-[0.99]',
                                                    isSelected
                                                        ? 'bg-[#f9ecdd] border-[#8d171e]'
                                                        : 'bg-card border-border'
                                                )}
                                            >
                                                <View className="flex-1 mr-3">
                                                    <Text className="font-bold text-base text-foreground">
                                                        {option.label}
                                                    </Text>
                                                    <Text className="text-muted-foreground text-xs mt-0.5">
                                                        {option.description}
                                                    </Text>
                                                </View>
                                                <Text className="font-bold text-primary">
                                                    €{optionPrice.toFixed(2)}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* STEP: Mezzo metro multi-gusto */}
                        {currentStep?.id === 'mezzo_gusti' && (
                            <MezzoMetroGustiStep
                                gusti={
                                    mezzoGusti.length > 0
                                        ? mezzoGusti
                                        : [createMezzoMetroGustoFromProduct(product)]
                                }
                                availablePizzas={availableMenuPizzas}
                                onChange={setMezzoGusti}
                            />
                        )}

                        {/* STEP: Gusti metro */}
                        {(!useWizard || currentStep?.id === 'gusti') && maxGusti > 0 && (
                            <View className="mb-2">
                                <View className="flex-row items-center justify-between mb-1">
                                    <Text className="font-bold text-lg">Scegli i gusti</Text>
                                    <Text
                                        className={cn(
                                            'text-sm font-bold',
                                            selectedGusti.length === maxGusti
                                                ? 'text-emerald-700'
                                                : 'text-muted-foreground'
                                        )}
                                    >
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
                                                <Text
                                                    className={cn(
                                                        'text-sm font-semibold',
                                                        isSelected ? 'text-primary-foreground' : 'text-foreground'
                                                    )}
                                                >
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

                        {/* STEP: Ingredienti */}
                        {(!useWizard || currentStep?.id === 'ingredients') && showIngredientTools && (
                            <View>
                                {product.ingredients && product.ingredients.length > 0 && (
                                    <View className="mb-6">
                                        <Text className="font-bold text-lg mb-3">Ingredienti</Text>
                                        <Text className="text-xs text-muted-foreground mb-3">
                                            Rimuovi o raddoppia gli ingredienti di base.
                                        </Text>
                                        <View className="gap-3">
                                            {product.ingredients.map((ingredient) => {
                                                const status = modifications[ingredient] || 'standard';
                                                const categoryInfo = getCategoryInfo(categorizeIngredient(ingredient));
                                                return (
                                                    <View
                                                        key={ingredient}
                                                        className="flex-row items-center justify-between bg-card border border-border rounded-xl p-3"
                                                    >
                                                        <View className="flex-row items-center flex-1 mr-2 gap-2.5">
                                                            <IngredientThumb
                                                                name={ingredient}
                                                                size={36}
                                                                fallbackEmoji={categoryInfo.emoji}
                                                            />
                                                            <Text
                                                                className={`font-medium text-lg flex-1 ${getStatusColor(status)}`}
                                                            >
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
                                                                        <FontAwesome
                                                                            name={getStatusIcon(status) as any}
                                                                            size={12}
                                                                            color={status === 'no' ? '#dc2626' : '#8d171e'}
                                                                        />
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
                                                        <IngredientThumb
                                                            name={ingredient}
                                                            size={22}
                                                            fallbackEmoji={categoryInfo.emoji}
                                                        />
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
                                                        <IngredientThumb
                                                            name={suggestion.name}
                                                            size={22}
                                                            fallbackEmoji={categoryInfo.emoji}
                                                        />
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

                                <View className="mb-2">
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

                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerClassName="gap-2 pb-3"
                                    >
                                        <Pressable
                                            onPress={() => setActiveCategory('all')}
                                            className={cn(
                                                'rounded-full border px-3 py-2',
                                                activeCategory === 'all'
                                                    ? 'bg-primary border-primary'
                                                    : 'bg-card border-border'
                                            )}
                                        >
                                            <Text
                                                className={cn(
                                                    'text-sm font-semibold',
                                                    activeCategory === 'all'
                                                        ? 'text-primary-foreground'
                                                        : 'text-foreground'
                                                )}
                                            >
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
                                                    <IngredientThumb
                                                        name={entry.name}
                                                        size={22}
                                                        fallbackEmoji={categoryInfo.emoji}
                                                    />
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
                            </View>
                        )}

                        {/* STEP: Cottura / note / quantità — oppure flusso semplice non-pizza */}
                        {(!useWizard || currentStep?.id === 'finish') && (
                            <View>
                                <View className="flex-row items-center justify-center gap-6 mb-6 bg-secondary/20 p-4 rounded-xl">
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
                                                                isSelected
                                                                    ? 'text-primary-foreground'
                                                                    : 'text-foreground'
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

                                <View className="mb-2">
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
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View
                        className="px-4 pt-4 border-t border-border bg-card sm:rounded-b-2xl gap-3"
                        style={{ paddingBottom: insets.bottom + 16 }}
                    >
                        {useWizard && currentStep?.id === 'gusti' && selectedGusti.length < maxGusti && (
                            <Text className="text-xs text-amber-800 text-center font-semibold">
                                Seleziona {maxGusti - selectedGusti.length} gusto
                                {maxGusti - selectedGusti.length === 1 ? '' : 'i'} per continuare
                            </Text>
                        )}
                        <View className="gap-4 sm:flex-row">
                            {useWizard && !isFirstStep && (
                                <Button
                                    title="Indietro"
                                    variant="outline"
                                    size="lg"
                                    onPress={goBack}
                                    className="w-full sm:w-auto"
                                />
                            )}
                            <View className="w-full sm:w-auto sm:flex-1">
                                <Button
                                    title={footerPrimaryLabel}
                                    variant="brand"
                                    size="cta"
                                    onPress={useWizard ? goNext : handleAddToCart}
                                    disabled={useWizard && !canProceedFromCurrentStep()}
                                    className="w-full"
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
