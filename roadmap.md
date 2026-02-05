# 🚽 Project Name: SKIBIDI ORDERS
**Subtitle:** The POS System with infinite Rizz. No cap.
**Version:** 0.1 (Ohio Edition)

> **Contesto :**
> Questo progetto mira a creare un sistema proprietario (stile McDonald's) per la ristorazione che unifichi l'esperienza Consumatore (Web/Mobile) e Gestore/Totem (App Nativa Kiosk).
> Il sistema deve gestire ordini, pagamenti e, crucialmente, la fiscalità italiana tramite comunicazione diretta con Registratori Telematici (RT) Epson via rete locale. l'architettura deve essere **Giga-Chad**:  solida, performante e scalabile.
> **Filosofia:** API-First per iniziare (MVP), ma pronto per diventare Offline-First (Sigma Grindset) in futuro.

## 1. Stack Tecnologico Definito

* **Core Framework:** React Native (Managed Workflow con **Expo**).
* **Linguaggio:** TypeScript (Strict mode).
* **Backend / Database:** **Supabase** (PostgreSQL).
    * Auth: Supabase Auth.
    * Realtime: Per sincronizzazione ordini.
    * Edge Functions: Per logiche complesse (opzionale).
* **UI/UX:**
    * **Styling:** NativeWind (Tailwind CSS per React Native) configurato per replicare il design system di **shadcn/ui**.
    * **Icons:** Lucide React Native.
* **State Management Locale:** React Context + TanStack Query (per caching server state).
* **Fiscalità (Hardware):** Comunicazione diretta TCP/HTTP XML (protocollo Epson ePOS) - *No WebUSB, No Cloud API dependence per la stampa core.*

---

## 2. Architettura del Progetto

Il progetto seguirà un approccio Monorepo (o struttura modulare interna) per condividere la Business Logic tra Web (Cliente) e Native (Totem).

* `/app`: Routing basato su Expo Router.
* `/components`: Componenti UI riutilizzabili (Button, Card, Modal).
* `/lib`: Logica fiscale, chiamate API, utility.
* `/types`: Definizioni TypeScript condivise (Database schema).

---

## 3. Fasi di Sviluppo (Step-by-Step)

### FASE 1: Scaffolding e Infrastruttura Base
* **Obiettivo:** Avere l'ambiente pronto e il DB configurato.
* [ ] Inizializzare progetto Expo con TypeScript e Expo Router.
* [ ] Configurare NativeWind (Tailwind) per funzionare su Native e Web.
* [ ] Creare design system base (Colori, Tipografia, Componenti atomici stile Shadcn).
* [ ] Setup progetto **Supabase**:
    * Creare tabelle: `profiles` (ruoli: admin, customer, kiosk), `products`, `categories`, `orders`, `order_items`.
    * Impostare RLS (Row Level Security) Policies.

### FASE 2: Interfaccia e Logica "Core" (Menu & Carrello)
* **Obiettivo:** L'utente può vedere prodotti e aggiungerli al carrello.
* [ ] Implementare navigazione (Stack per mobile, Layout responsive per Tablet/Totem).
* [ ] Creare componente `ProductCard` e griglia Menu.
* [ ] Implementare Logica Carrello (Context locale): aggiunta, rimozione, calcolo totali.
* [ ] Implementare autenticazione (Login Admin vs Accesso Anonimo Kiosk).

### FASE 3: Fiscalizzazione API (MVP) & Coda di Invio
* **Obiettivo:** Fiscalizzare gli ordini tramite API Cloud e gestire i fallimenti di rete.
* **Strategia:** Usare un Pattern Adapter per poter cambiare facilmente provider in futuro.
* [ ] **Database Update (Supabase):**
    * Aggiungere a `orders`: `fiscal_status` (enum: pending, success, error), `fiscal_external_id`, `pdf_url`.
* [ ] **Fiscal Service Layer:**
    * Creare interfaccia `IFiscalProvider` con metodo `emitReceipt(order)`.
    * Implementare `CloudApiProvider` (es. mock iniziale o integrazione reale A-Cube/FattureInCloud).
* [ ] **Gestione "Flag" / Coda (Queue):**
    * Se la chiamata API fallisce (o manca internet), salvare l'ordine su Supabase con `fiscal_status: 'error'`.
    * Creare un bottone/funzione "Riprova invio falliti" nella Dashboard Admin.
* [ ] **Visualizzazione Scontrino:**
    * Invece di stampare su carta termica, mostrare il PDF generato dall'API o un "Scontrino Digitale" a schermo.



### FASE 4: Gestione Ordini e Realtime
* **Obiettivo:** Quando un ordine è pagato/stampato, appare in cucina (Dashboard).
* [ ] Salvataggio Ordine su Supabase dopo la conferma fiscale.
* [ ] Implementare Dashboard "Kitchen View" per il personale (che ascolta i cambiamenti Realtime di Supabase).
* [ ] Cambio stato ordine (In preparazione -> Pronto -> Consegnato).

### FASE 5: Robustezza Offline (Offline-First & Fallback)
* **Obiettivo:** Garantire che la cucina riceva l'ordine anche se Supabase è irraggiungibile.
* **Strategia:** Usare la stampa fisica LAN come backup immediato della notifica digitale.
* [ ] **Local Storage & Queue:**
    * Implementare `AsyncStorage` o `WatermelonDB` per salvare l'ordine localmente sul dispositivo se la chiamata API a Supabase fallisce.
    * Creare un "Background Sync Job" che riprova a inviare gli ordini a Supabase quando torna la connessione.
* [ ] **Hybrid Order Dispatching:**
    * Logica nell'invio ordine:
        1. Prova a salvare su Supabase.
        2. Se riesce -> La cucina riceve notifica digitale + stampa (opzionale).
        3. Se fallisce (No Internet) -> Salva in locale + **FORZA STAMPA FISICA** su stampante cucina (via LAN IP).
* [ ] **UX Feedback:**
    * Mostrare un avviso discreto all'utente/gestore: "Modalità Offline: I dati verranno sincronizzati appena possibile".
---

## 4. Prompt Iniziale per Claude Code

*Copia questo prompt per iniziare:*

"Claude, agisci come Senior React Native Architect esperto in sistemi POS. Dobbiamo sviluppare il progetto descritto in questo file ROADMAP.md.
Inizia dalla **FASE 1**.
Genera lo scaffolding di un progetto Expo + TypeScript.
Configura NativeWind in modo che io possa usare le classi Tailwind.
Configura il client Supabase.
Dammi la struttura delle cartelle ottimizzata per scalare.
Non scrivere ancora codice complesso, facciamo prima il setup dell'ambiente."