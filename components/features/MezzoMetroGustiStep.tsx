import {
  categorizeIngredient,
  detectPizzaBase,
  getCategoryInfo,
  getIngredientSuggestions,
  INGREDIENT_CATALOG,
  INGREDIENT_CATEGORIES,
} from '@/lib/data/ingredients';
import type { IngredientCategoryId } from '@/lib/data/ingredients';
import {
  BUILDER_INGREDIENT_PRICES,
  MAX_MEZZO_METRO_GUSTI,
  createMezzoMetroGustoFromProduct,
} from '@/lib/data/pizzaBuilder';
import type { MezzoMetroGustoSlot } from '@/lib/data/pizzaBuilder';
import { cn } from '@/lib/utils/cn';
import type { Product } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

interface MezzoMetroGustiStepProps {
  readonly gusti: MezzoMetroGustoSlot[];
  readonly availablePizzas: Product[];
  readonly onChange: (next: MezzoMetroGustoSlot[]) => void;
}

function updateModification(
  current: Record<string, 'no' | 'standard' | 'extra'>,
  ingredient: string,
  change: -1 | 1
): Record<string, 'no' | 'standard' | 'extra'> {
  const currentStatus = current[ingredient] || 'standard';
  let newStatus = currentStatus;

  if (change === -1) {
    if (currentStatus === 'extra') newStatus = 'standard';
    else if (currentStatus === 'standard') newStatus = 'no';
  } else if (currentStatus === 'no') {
    newStatus = 'standard';
  } else if (currentStatus === 'standard') {
    newStatus = 'extra';
  }

  return { ...current, [ingredient]: newStatus };
}

export function MezzoMetroGustiStep({ gusti, availablePizzas, onChange }: MezzoMetroGustiStepProps) {
  const [expandedId, setExpandedId] = useState<string | null>(gusti[0]?.id ?? null);
  const [pickingForId, setPickingForId] = useState<string | null>(null);
  const [searchByGusto, setSearchByGusto] = useState<Record<string, string>>({});
  const [categoryByGusto, setCategoryByGusto] = useState<Record<string, IngredientCategoryId | 'all'>>({});

  const updateGusto = (id: string, patch: Partial<MezzoMetroGustoSlot>) => {
    onChange(gusti.map((gusto) => (gusto.id === id ? { ...gusto, ...patch } : gusto)));
  };

  const replaceGustoProduct = (slotId: string, pizza: Product) => {
    const next = createMezzoMetroGustoFromProduct(pizza, slotId);
    onChange(gusti.map((gusto) => (gusto.id === slotId ? next : gusto)));
    setPickingForId(null);
    setExpandedId(slotId);
  };

  const addGusto = () => {
    if (gusti.length >= MAX_MEZZO_METRO_GUSTI) return;
    const fallback = availablePizzas[0];
    if (!fallback) return;
    const usedIds = new Set(gusti.map((gusto) => gusto.productId));
    const candidate = availablePizzas.find((pizza) => !usedIds.has(pizza.id)) ?? fallback;
    const next = createMezzoMetroGustoFromProduct(candidate);
    onChange([...gusti, next]);
    setExpandedId(next.id);
    setPickingForId(next.id);
  };

  const removeGusto = (id: string) => {
    if (gusti.length <= 1) return;
    const next = gusti.filter((gusto) => gusto.id !== id);
    onChange(next);
    if (expandedId === id) setExpandedId(next[0]?.id ?? null);
    if (pickingForId === id) setPickingForId(null);
  };

  return (
    <View>
      <Text className="font-bold text-lg mb-1">Componi il mezzo metro</Text>
      <Text className="text-xs text-muted-foreground mb-4">
        Parti dal gusto scelto, poi aggiungi un secondo o terzo gusto. Per ciascuno puoi togliere o
        aggiungere ingredienti.
      </Text>

      <View className="gap-3 mb-4">
        {gusti.map((gusto, index) => {
          const isExpanded = expandedId === gusto.id;
          const isPicking = pickingForId === gusto.id;
          const search = searchByGusto[gusto.id] ?? '';
          const activeCategory = categoryByGusto[gusto.id] ?? 'all';
          const pizzaBase = detectPizzaBase(gusto.baseIngredients, null);
          const suggestions = getIngredientSuggestions(
            [...gusto.baseIngredients, ...gusto.extraIngredients],
            pizzaBase,
            4
          );
          const searchable = INGREDIENT_CATALOG.filter((entry) => {
            const base = gusto.baseIngredients.map((item) => item.toLowerCase());
            if (
              base.some(
                (item) =>
                  item.includes(entry.name.toLowerCase()) || entry.name.toLowerCase().includes(item)
              )
            ) {
              return false;
            }
            if (activeCategory !== 'all' && entry.category !== activeCategory) return false;
            if (search.trim() && !entry.name.toLowerCase().includes(search.trim().toLowerCase())) {
              return false;
            }
            return true;
          });

          return (
            <View
              key={gusto.id}
              className={cn(
                'rounded-xl border-2 overflow-hidden',
                isExpanded ? 'border-[#8d171e] bg-[#f9ecdd]/40' : 'border-border bg-card'
              )}
            >
              <Pressable
                onPress={() => setExpandedId(isExpanded ? null : gusto.id)}
                className="flex-row items-center justify-between px-4 py-3 active:opacity-80"
              >
                <View className="flex-1 mr-2">
                  <Text className="text-[10px] font-bold uppercase tracking-wide text-[#8d171e]">
                    Gusto {index + 1}
                    {index === 0 ? ' · principale' : ''}
                  </Text>
                  <Text className="font-bold text-base text-foreground" numberOfLines={1}>
                    {gusto.productName}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    €{gusto.listPrice.toFixed(2)} listino
                    {gusto.extraIngredients.length > 0
                      ? ` · +${gusto.extraIngredients.length} aggiunte`
                      : ''}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  {gusti.length > 1 && (
                    <Pressable
                      onPress={() => removeGusto(gusto.id)}
                      hitSlop={8}
                      className="h-8 w-8 items-center justify-center rounded-full bg-destructive/10"
                    >
                      <FontAwesome name="trash-o" size={14} color="#b91c1c" />
                    </Pressable>
                  )}
                  <FontAwesome
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#6b7280"
                  />
                </View>
              </Pressable>

              {isExpanded && (
                <View className="px-4 pb-4 border-t border-border/60 pt-3 gap-4">
                  <View>
                    <Text className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                      Cambia gusto
                    </Text>
                    <Pressable
                      onPress={() => setPickingForId(isPicking ? null : gusto.id)}
                      className="flex-row items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5"
                    >
                      <Text className="font-semibold text-foreground">{gusto.productName}</Text>
                      <FontAwesome
                        name={isPicking ? 'times' : 'exchange'}
                        size={14}
                        color="#8d171e"
                      />
                    </Pressable>
                    {isPicking && (
                      <View className="flex-row flex-wrap gap-2 mt-2">
                        {availablePizzas.map((pizza) => {
                          const selected = pizza.id === gusto.productId;
                          return (
                            <Pressable
                              key={pizza.id}
                              onPress={() => replaceGustoProduct(gusto.id, pizza)}
                              className={cn(
                                'rounded-full border px-3 py-1.5',
                                selected ? 'bg-primary border-primary' : 'bg-card border-border'
                              )}
                            >
                              <Text
                                className={cn(
                                  'text-sm font-semibold',
                                  selected ? 'text-primary-foreground' : 'text-foreground'
                                )}
                              >
                                {pizza.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {gusto.baseIngredients.length > 0 && (
                    <View>
                      <Text className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                        Ingredienti di base
                      </Text>
                      <View className="gap-2">
                        {gusto.baseIngredients.map((ingredient) => {
                          const status = gusto.modifications[ingredient] || 'standard';
                          const categoryInfo = getCategoryInfo(categorizeIngredient(ingredient));
                          return (
                            <View
                              key={ingredient}
                              className="flex-row items-center justify-between bg-card border border-border rounded-xl p-2.5"
                            >
                              <View className="flex-row items-center flex-1 mr-2">
                                <View className={cn('w-2 h-2 rounded-full mr-2', categoryInfo.dotClass)} />
                                <Text
                                  className={cn(
                                    'font-medium flex-1',
                                    status === 'no' && 'text-destructive',
                                    status === 'extra' && 'text-primary'
                                  )}
                                >
                                  {ingredient}
                                </Text>
                              </View>
                              <View className="flex-row items-center gap-2 bg-secondary/30 rounded-lg p-1">
                                <Pressable
                                  onPress={() =>
                                    updateGusto(gusto.id, {
                                      modifications: updateModification(
                                        gusto.modifications,
                                        ingredient,
                                        -1
                                      ),
                                    })
                                  }
                                  disabled={status === 'no'}
                                  className={`w-7 h-7 items-center justify-center rounded-md ${status === 'no' ? 'opacity-30' : 'bg-card'}`}
                                >
                                  <FontAwesome name="minus" size={11} color="#000" />
                                </Pressable>
                                <Text className="text-xs font-bold w-12 text-center">
                                  {status === 'no' ? 'No' : status === 'extra' ? 'Extra' : '—'}
                                </Text>
                                <Pressable
                                  onPress={() =>
                                    updateGusto(gusto.id, {
                                      modifications: updateModification(
                                        gusto.modifications,
                                        ingredient,
                                        1
                                      ),
                                    })
                                  }
                                  disabled={status === 'extra'}
                                  className={`w-7 h-7 items-center justify-center rounded-md ${status === 'extra' ? 'opacity-30' : 'bg-card'}`}
                                >
                                  <FontAwesome name="plus" size={11} color="#000" />
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {suggestions.length > 0 && (
                    <View>
                      <Text className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                        Consigliati
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {suggestions.map((suggestion) => {
                          const categoryInfo = getCategoryInfo(suggestion.category);
                          const selected = gusto.extraIngredients.includes(suggestion.name);
                          return (
                            <Pressable
                              key={suggestion.name}
                              onPress={() =>
                                updateGusto(gusto.id, {
                                  extraIngredients: selected
                                    ? gusto.extraIngredients.filter((item) => item !== suggestion.name)
                                    : [...gusto.extraIngredients, suggestion.name],
                                })
                              }
                              className={cn(
                                'flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5',
                                categoryInfo.chipClass,
                                selected && 'border-primary border-2'
                              )}
                            >
                              <Text className={cn('text-xs font-semibold', categoryInfo.textClass)}>
                                {suggestion.name}
                              </Text>
                              <FontAwesome
                                name={selected ? 'check' : 'plus'}
                                size={10}
                                color="#8d171e"
                              />
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  <View>
                    <Text className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                      Aggiungi ingredienti
                    </Text>
                    <View className="flex-row items-center bg-background border border-border rounded-xl px-3 mb-2">
                      <FontAwesome name="search" size={14} color="#9ca3af" />
                      <TextInput
                        className="flex-1 px-2 py-2.5 text-sm text-foreground"
                        placeholder="Cerca..."
                        value={search}
                        onChangeText={(value) =>
                          setSearchByGusto((current) => ({ ...current, [gusto.id]: value }))
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    <View className="flex-row flex-wrap gap-1.5 mb-2">
                      <Pressable
                        onPress={() =>
                          setCategoryByGusto((current) => ({ ...current, [gusto.id]: 'all' }))
                        }
                        className={cn(
                          'rounded-full border px-2.5 py-1',
                          activeCategory === 'all' ? 'bg-primary border-primary' : 'border-border'
                        )}
                      >
                        <Text
                          className={cn(
                            'text-xs font-semibold',
                            activeCategory === 'all' ? 'text-white' : 'text-foreground'
                          )}
                        >
                          Tutti
                        </Text>
                      </Pressable>
                      {INGREDIENT_CATEGORIES.map((category) => (
                        <Pressable
                          key={category.id}
                          onPress={() =>
                            setCategoryByGusto((current) => ({
                              ...current,
                              [gusto.id]: activeCategory === category.id ? 'all' : category.id,
                            }))
                          }
                          className={cn(
                            'rounded-full border px-2.5 py-1',
                            category.chipClass,
                            activeCategory === category.id && 'border-primary'
                          )}
                        >
                          <Text className={cn('text-xs font-semibold', category.textClass)}>
                            {category.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      {searchable.slice(0, 24).map((entry) => {
                        const categoryInfo = getCategoryInfo(entry.category);
                        const selected = gusto.extraIngredients.includes(entry.name);
                        const price = BUILDER_INGREDIENT_PRICES[entry.category] * 2;
                        return (
                          <Pressable
                            key={entry.name}
                            onPress={() =>
                              updateGusto(gusto.id, {
                                extraIngredients: selected
                                  ? gusto.extraIngredients.filter((item) => item !== entry.name)
                                  : [...gusto.extraIngredients, entry.name],
                              })
                            }
                            className={cn(
                              'flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5',
                              categoryInfo.chipClass,
                              selected && 'border-primary border-2'
                            )}
                          >
                            <Text className={cn('text-xs font-semibold', categoryInfo.textClass)}>
                              {entry.name}
                            </Text>
                            <Text className="text-[10px] text-muted-foreground">
                              +€{price.toFixed(2)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {gusti.length < MAX_MEZZO_METRO_GUSTI && (
        <Pressable
          onPress={addGusto}
          className="flex-row items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#8d171e]/40 bg-[#8d171e]/[0.04] py-3.5 active:opacity-80"
        >
          <FontAwesome name="plus-circle" size={16} color="#8d171e" />
          <Text className="font-bold text-[#8d171e]">
            Aggiungi {gusti.length === 1 ? 'secondo' : 'terzo'} gusto
          </Text>
        </Pressable>
      )}

      <Text className="text-xs text-muted-foreground mt-3 text-center">
        Prezzo base = 2× il gusto più caro del mezzo metro
      </Text>
    </View>
  );
}
