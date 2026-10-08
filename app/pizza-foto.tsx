import { Stack, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { getPizzaPhotoCatalog } from '@/lib/data/pizzaPhotos';

export default function PizzaPhotoCatalog() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const columns = width >= 1000 ? 3 : width >= 600 ? 2 : 1;
  const cardWidth = (Math.min(width, 1280) - 48 - (columns - 1) * 16) / columns;
  return <>
    <Stack.Screen options={{ headerShown: false, title: 'Le pizze di Ambrosia' }} />
    <ScrollView className="flex-1 bg-[#f9ecdd]" contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
      <View style={{ width: '100%', maxWidth: 1232, alignSelf: 'center' }}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/menu')} className="self-start mb-6 rounded-xl bg-[#8d171e] px-5 py-3"><Text className="text-white font-bold">Vai al menu</Text></Pressable>
        <Text className="text-3xl font-black text-[#8d171e]">Le pizze di Ambrosia</Text>
        <Text className="text-base text-gray-700 mt-3 mb-6">48 immagini illustrative generate a partire dagli ingredienti del menu. Ogni pizza ha la propria ricetta.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {getPizzaPhotoCatalog().map(photo => <View key={photo.id} style={{ width: cardWidth }} className="rounded-2xl bg-white border border-[#ead8c7] overflow-hidden">
            <Image source={{ uri: photo.imageUrl }} accessibilityLabel={photo.name} style={{ width: '100%', aspectRatio: 1 }} resizeMode="cover" />
            <View className="p-4"><Text className="text-xs text-[#8d171e] font-bold">{photo.category}</Text><Text className="text-xl font-extrabold text-gray-900 mt-1">{photo.name}</Text><Text className="text-sm text-gray-600 mt-2">{photo.recipe}</Text></View>
          </View>)}
        </View>
        <Text className="text-sm text-gray-600 mt-8">Stria e pizze al metro: immagini in attesa di una ricetta definita.</Text>
      </View>
    </ScrollView>
  </>;
}
