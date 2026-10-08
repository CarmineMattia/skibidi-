import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({ resolve: { alias: { 'react-native': 'react-native-web', '@': fileURLToPath(new URL('.', import.meta.url)) } }, test: { include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.spec.tsx'] } });
