import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/api/supabase';
import type { Product } from '@/types';
import { FontAwesome } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, Text, TextInput, View } from 'react-native';

interface EditProductModalProps {
    visible: boolean;
    onClose: () => void;
    product?: Product | null; // Product is optional for creation
}

export function EditProductModal({ visible, onClose, product }: EditProductModalProps) {
    const isEditing = !!product;

    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [image, setImage] = useState<string | null | undefined>(null);
    const [ingredients, setIngredients] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const queryClient = useQueryClient();

    // Reset state when modal opens/closes or product changes
    useEffect(() => {
        if (visible) {
            if (product) {
                setName(product.name);
                setPrice(product.price.toString());
                setImage(product.image_url);
                setIngredients(product.ingredients?.join(', ') || '');
            } else {
                setName('');
                setPrice('');
                setImage(null);
                setIngredients('');
            }
        }
    }, [visible, product]);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            uploadImage(result.assets[0].base64);
        }
    };

    const uploadImage = async (base64: string) => {
        setIsLoading(true);
        try {
            // Use a temp ID for new products or existing ID
            const idForImage = product?.id || `new-${Date.now()}`;
            const fileName = `${idForImage}-${Date.now()}.jpg`;

            console.log('Uploading image:', fileName);

            const { data, error } = await supabase.storage
                .from('products')
                .upload(fileName, decode(base64), {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (error) {
                console.error('Upload error details:', error);
                throw error;
            }

            console.log('Upload successful:', data);

            const { data: { publicUrl } } = supabase.storage
                .from('products')
                .getPublicUrl(fileName);

            console.log('Public URL:', publicUrl);

            setImage(publicUrl);
            Alert.alert('Successo', 'Immagine caricata con successo!');
        } catch (error: any) {
            console.error('Upload error:', error);
            Alert.alert(
                'Errore Upload',
                error?.message || 'Caricamento immagine fallito. Verifica le permessi Storage.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to decode base64 for Supabase upload (simplified)
    // In a real app, use a proper polyfill or ArrayBuffer
    const decode = (base64: string) => {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    };

    const handleSave = async () => {
        if (!name || !price) {
            Alert.alert('Errore', 'Nome e prezzo sono obbligatori');
            return;
        }

        setIsLoading(true);
        try {
            const ingredientsArray = ingredients
                .split(',')
                .map(i => i.trim())
                .filter(i => i.length > 0);

            const productData = {
                name,
                price: parseFloat(price),
                image_url: image || null, // Ensure null instead of undefined
                ingredients: ingredientsArray,
                category_id: product?.category_id || '85316818-56a5-4eed-9066-7a23341db9cb', // Use existing category or default to "Panini"
                active: true,
                display_order: 0,
            };

            console.log('Saving product:', productData);

            let error;

            if (isEditing && product) {
                const { error: updateError } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', product.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('products')
                    .insert(productData);
                error = insertError;
            }

            if (error) {
                console.error('Database save error:', error);
                throw error;
            }

            // Invalidate queries to refresh the list
            queryClient.invalidateQueries({ queryKey: ['products'] });
            onClose();
            Alert.alert('Successo', isEditing ? 'Prodotto aggiornato' : 'Prodotto creato');
        } catch (error: any) {
            console.error('Save error:', error);
            Alert.alert(
                'Errore',
                error?.message || 'Impossibile salvare il prodotto'
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-center items-center p-4">
                <View className="bg-card w-full max-w-md rounded-2xl p-6 shadow-xl border border-border">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-xl font-bold text-card-foreground">
                            {isEditing ? 'Modifica Prodotto' : 'Nuovo Prodotto'}
                        </Text>
                        <Pressable onPress={onClose}>
                            <FontAwesome name="times" size={24} color="#6b7280" />
                        </Pressable>
                    </View>

                    {/* Image Picker */}
                    <Pressable onPress={pickImage} className="items-center mb-6" disabled={isLoading}>
                        {image ? (
                            <View className="relative">
                                <Image
                                    source={{ uri: image }}
                                    className="w-32 h-32 rounded-xl bg-muted"
                                    onError={(e) => {
                                        console.error('Image load error:', e.nativeEvent.error);
                                        Alert.alert('Errore', 'Impossibile caricare l\'immagine');
                                    }}
                                />
                                {isLoading && (
                                    <View className="absolute inset-0 bg-black/50 rounded-xl items-center justify-center">
                                        <Text className="text-white">Caricamento...</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View className="w-32 h-32 rounded-xl bg-muted items-center justify-center border-2 border-dashed border-border">
                                <FontAwesome name="camera" size={32} color="#9ca3af" />
                                <Text className="text-xs text-muted-foreground mt-2">
                                    {isLoading ? 'Caricamento...' : 'Cambia Foto'}
                                </Text>
                            </View>
                        )}
                        <Text className="text-primary font-medium mt-2">
                            {isLoading ? 'Attendere...' : 'Tocca per modificare'}
                        </Text>
                    </Pressable>

                    {/* Inputs */}
                    <View className="gap-4 mb-6">
                        <View>
                            <Text className="text-sm font-medium text-muted-foreground mb-1">Nome</Text>
                            <TextInput
                                className="bg-background border border-border rounded-lg p-3 text-foreground"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>
                        <View>
                            <Text className="text-sm font-medium text-muted-foreground mb-1">Prezzo (€)</Text>
                            <TextInput
                                className="bg-background border border-border rounded-lg p-3 text-foreground"
                                value={price}
                                onChangeText={setPrice}
                                keyboardType="numeric"
                            />
                        </View>
                        <View>
                            <Text className="text-sm font-medium text-muted-foreground mb-1">Ingredienti (separati da virgola)</Text>
                            <TextInput
                                className="bg-background border border-border rounded-lg p-3 text-foreground"
                                value={ingredients}
                                onChangeText={setIngredients}
                                placeholder="Pomodoro, Mozzarella, Basilico"
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                    </View>

                    {/* Actions */}
                    <View className="flex-row gap-3">
                        <Button
                            title="Annulla"
                            variant="outline"
                            onPress={onClose}
                            className="flex-1"
                        />
                        <Button
                            title={isLoading ? 'Salvataggio...' : 'Salva Modifiche'}
                            variant="default"
                            onPress={handleSave}
                            disabled={isLoading}
                            className="flex-1"
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}
