import { getIngredientImageUrl } from '@/lib/data/ingredientImages';
import { useState } from 'react';
import { Image, Text, View } from 'react-native';

interface IngredientThumbProps {
  readonly name: string;
  /** diametro in px (default 28) */
  readonly size?: number;
  /** emoji di fallback (es. categoria) */
  readonly fallbackEmoji?: string;
}

/**
 * Miniatura circolare di un ingrediente; se l'URL manca o fallisce, mostra emoji.
 */
export function IngredientThumb({
  name,
  size = 28,
  fallbackEmoji = '🍽️',
}: IngredientThumbProps) {
  const uri = getIngredientImageUrl(name);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = !!uri && failedUri !== uri;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: '#f3e7da',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#ead8c7',
      }}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailedUri(uri)}
          accessibilityLabel={name}
        />
      ) : (
        <Text style={{ fontSize: Math.max(12, size * 0.45), lineHeight: size }}>
          {fallbackEmoji}
        </Text>
      )}
    </View>
  );
}
