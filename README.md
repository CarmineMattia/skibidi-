# Skibidi Orders 🍟

Self-ordering kiosk system for restaurants, pizzerias, and bars. Built with Expo (React Native).

## Features

- 📱 **Menu Display** - Beautiful product grid with categories
- 🛒 **Shopping Cart** - Add items, customize, checkout
- 👨‍🍳 **Kitchen Dashboard** - Real-time order management
- 🔐 **Admin Panel** - Product & category management
- 🧾 **Fiscal Integration** - Italian receipt compliance

## Tech Stack

- **Expo** (React Native 0.81)
- **TypeScript**
- **Supabase** (Backend/DB)
- **React Query**
- **NativeWind** (Tailwind CSS)
- **Expo Router**

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repo
git clone https://github.com/CarmineMattia/skibidi-.git
cd skibidi-

# Install dependencies
npm install

# Start development
npm start
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Required variables:
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

## Deployment

### Web (Netlify)

```bash
# Export for web
npx expo export --platform web

# Deploy to Netlify
# Option 1: Drag & drop the 'dist' folder to https://app.netlify.com/drop
# Option 2: Use Netlify CLI
npx netlify-cli deploy --prod --dir=./dist
```

### Android (EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Build
eas build -p android
```

### iOS (EAS)

```bash
eas build -p ios
```

## Project Structure

```
skibidi-/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation
│   │   ├── menu.tsx      # Main menu
│   │   ├── kitchen.tsx   # Kitchen dashboard
│   │   └── two.tsx       # Admin/settings
│   ├── login.tsx         # Auth page
│   ├── modal.tsx         # Checkout modal
│   └── order-success.tsx # Success page
├── components/            # React components
├── lib/                  # Hooks, stores, utilities
├── types/                # TypeScript types
└── assets/               # Images, fonts
```

## License

MIT
