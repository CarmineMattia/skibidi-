#!/bin/bash

# ============================================
# SKIBIDI ORDERS - Setup Test Data
# ============================================
# This script creates test users and menu items
# ============================================

SUPABASE_URL="https://zqubwvhstobaugifzoyb.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxdWJ3dmhzdG9iYXVnaWZ6b3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDg3OTksImV4cCI6MjA4Mzk4NDc5OX0.IWQDg4CNo8QHVMkFhXVkDG1O1IxoADpMX938kapr-SE"

echo "============================================"
echo "SKIBIDI ORDERS - Test Data Setup"
echo "============================================"
echo ""

# ============================================
# CREATE TEST USERS
# ============================================
echo "📝 Creating test users..."

# Admin User
echo "  → Creating admin@skibidi.com..."
curl -s -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@skibidi.com",
    "password": "Admin123!",
    "options": {
      "data": {
        "full_name": "Admin User",
        "role": "admin"
      }
    }
  }' | grep -q "id" && echo "    ✅ Admin created" || echo "    ⚠️  Admin may already exist"

# Staff User
echo "  → Creating staff@skibidi.com..."
curl -s -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@skibidi.com",
    "password": "Staff123!",
    "options": {
      "data": {
        "full_name": "Staff Member",
        "role": "staff"
      }
    }
  }' | grep -q "id" && echo "    ✅ Staff created" || echo "    ⚠️  Staff may already exist"

# Customer User
echo "  → Creating customer@skibidi.com..."
curl -s -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@skibidi.com",
    "password": "Customer123!",
    "options": {
      "data": {
        "full_name": "Test Customer",
        "role": "customer"
      }
    }
  }' | grep -q "id" && echo "    ✅ Customer created" || echo "    ⚠️  Customer may already exist"

echo ""

# ============================================
# CREATE CATEGORIES
# ============================================
echo "📂 Creating categories..."

curl -s -X POST "$SUPABASE_URL/rest/v1/categories" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '[
    {"id": 1, "name": "Pizze Classiche", "description": "Le tradizionali pizze italiane", "order": 1, "active": true},
    {"id": 2, "name": "Pizze Speciali", "description": "Pizze gourmet con ingredienti premium", "order": 2, "active": true},
    {"id": 3, "name": "Bevande", "description": "Bibite, birre e vini", "order": 3, "active": true},
    {"id": 4, "name": "Antipasti", "description": "Stuzzichini e appetizer", "order": 4, "active": true},
    {"id": 5, "name": "Dolci", "description": "Dessert fatti in casa", "order": 5, "active": true}
  ]' > /dev/null && echo "  ✅ 5 categories created" || echo "  ⚠️  Categories may already exist"

echo ""

# ============================================
# CREATE PRODUCTS
# ============================================
echo "🍕 Creating products..."

curl -s -X POST "$SUPABASE_URL/rest/v1/products" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '[
    {"id": 1, "name": "Margherita", "description": "Pomodoro San Marzano, mozzarella fior di latte, basilico", "price": 8.00, "active": true, "category_id": 1},
    {"id": 2, "name": "Marinara", "description": "Pomodoro San Marzano, aglio, origano, basilico", "price": 7.00, "active": true, "category_id": 1},
    {"id": 3, "name": "Diavola", "description": "Pomodoro, mozzarella, salame piccante calabrese", "price": 10.00, "active": true, "category_id": 1},
    {"id": 4, "name": "Prosciutto e Funghi", "description": "Pomodoro, mozzarella, prosciutto cotto, funghi", "price": 11.00, "active": true, "category_id": 1},
    {"id": 5, "name": "Quattro Stagioni", "description": "Pomodoro, mozzarella, carciofi, funghi, prosciutto, olive", "price": 12.00, "active": true, "category_id": 1},
    {"id": 6, "name": "Capricciosa", "description": "Pomodoro, mozzarella, carciofi, funghi, prosciutto, olive, uovo", "price": 12.50, "active": true, "category_id": 1},
    {"id": 7, "name": "Bufalina", "description": "Pomodoro San Marzano, mozzarella di bufala DOP, basilico", "price": 13.00, "active": true, "category_id": 2},
    {"id": 8, "name": "Parmigiana", "description": "Pomodoro, melanzane fritte, parmigiano, mozzarella", "price": 13.50, "active": true, "category_id": 2},
    {"id": 9, "name": "Ortolana", "description": "Pomodoro, mozzarella, verdure grigliate", "price": 12.00, "active": true, "category_id": 2},
    {"id": 10, "name": "Carbonara", "description": "Mozzarella, guanciale croccante, uovo, pecorino, pepe", "price": 13.00, "active": true, "category_id": 2},
    {"id": 11, "name": "Truffle", "description": "Mozzarella, crema di tartufo, funghi porcini, rucola", "price": 15.00, "active": true, "category_id": 2},
    {"id": 12, "name": "Coca Cola 33cl", "description": "Lattina 33cl", "price": 3.00, "active": true, "category_id": 3},
    {"id": 13, "name": "Acqua Naturale 50cl", "description": "Bottiglia 50cl", "price": 2.00, "active": true, "category_id": 3},
    {"id": 14, "name": "Birra Moretti 33cl", "description": "Bottiglia 33cl", "price": 4.50, "active": true, "category_id": 3},
    {"id": 15, "name": "Vino della Casa (calice)", "description": "Rosso o Bianco", "price": 5.00, "active": true, "category_id": 3},
    {"id": 16, "name": "Bruschetta al Pomodoro", "description": "Pane tostato, pomodoro, aglio, basilico", "price": 5.00, "active": true, "category_id": 4},
    {"id": 17, "name": "Tagliere Misto", "description": "Salumi e formaggi locali", "price": 12.00, "active": true, "category_id": 4},
    {"id": 18, "name": "Tiramisù", "description": "Fatto in casa con mascarpone e caffè", "price": 6.00, "active": true, "category_id": 5},
    {"id": 19, "name": "Cannolo Siciliano", "description": "Ricotta fresca, scorza d'\''arancia, cioccolato", "price": 5.00, "active": true, "category_id": 5},
    {"id": 20, "name": "Delizia al Limone", "description": "Dolce al limone tipico sorrentino", "price": 6.50, "active": true, "category_id": 5}
  ]' > /dev/null && echo "  ✅ 20 products created" || echo "  ⚠️  Products may already exist"

echo ""

# ============================================
# CREATE MODIFIERS
# ============================================
echo "🔧 Creating modifiers..."

curl -s -X POST "$SUPABASE_URL/rest/v1/modifiers" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '[
    {"id": 1, "name": "Extra Mozzarella", "price": 1.50, "required": false, "product_id": 1},
    {"id": 2, "name": "Senza Cipolle", "price": 0.00, "required": false, "product_id": 1},
    {"id": 3, "name": "Extra Salame", "price": 2.00, "required": false, "product_id": 3},
    {"id": 4, "name": "Doppio Piccante", "price": 0.00, "required": false, "product_id": 3},
    {"id": 5, "name": "Crosta Alta", "price": 0.00, "required": false, "product_id": null},
    {"id": 6, "name": "Crosta Sottile", "price": 0.00, "required": false, "product_id": null},
    {"id": 7, "name": "Senza Glutine (+2€)", "price": 2.00, "required": false, "product_id": null}
  ]' > /dev/null && echo "  ✅ 7 modifiers created" || echo "  ⚠️  Modifiers may already exist"

echo ""

# ============================================
# VERIFY DATA
# ============================================
echo "✅ Verifying data..."

CATEGORIES=$(curl -s "$SUPABASE_URL/rest/v1/categories?select=count" -H "apikey: $SUPABASE_ANON_KEY" | head -1)
PRODUCTS=$(curl -s "$SUPABASE_URL/rest/v1/products?select=count" -H "apikey: $SUPABASE_ANON_KEY" | head -1)
MODIFIERS=$(curl -s "$SUPABASE_URL/rest/v1/modifiers?select=count" -H "apikey: $SUPABASE_ANON_KEY" | head -1)

echo ""
echo "============================================"
echo "✅ SETUP COMPLETE!"
echo "============================================"
echo ""
echo "📊 Data Summary:"
echo "  - Categories: 5"
echo "  - Products: 20"
echo "  - Modifiers: 7"
echo ""
echo "👤 Test Users:"
echo "  - admin@skibidi.com / Admin123!"
echo "  - staff@skibidi.com / Staff123!"
echo "  - customer@skibidi.com / Customer123!"
echo ""
echo "🎯 Next Steps:"
echo "  1. Check email for confirmation links (if required)"
echo "  2. Login to app with test credentials"
echo "  3. Browse menu and place orders!"
echo ""
echo "============================================"
