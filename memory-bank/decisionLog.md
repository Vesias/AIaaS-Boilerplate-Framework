# Decision Log - Next.js 15 MicroSaaS Boilerplate

## Architektur-Entscheidungen

### [2025-01-25] Framework-Wahl: Next.js 15
**Entscheidung:** Next.js 15 mit App Router
**Grund:** 
- Modernste React-Features (Server Components)
- Optimierte Performance durch automatisches Code-Splitting
- Integrierte SEO-Optimierung
- Starke TypeScript-Integration
- Große Community und Ecosystem

**Alternativen:** Vite + React, Remix, SvelteKit
**Trade-offs:** Steile Lernkurve für App Router, größere Bundle-Size

### [2025-01-25] Styling-Lösung: Tailwind CSS + shadcn/ui
**Entscheidung:** Tailwind CSS als Primary Styling-Lösung mit shadcn/ui Komponenten
**Grund:**
- Utility-first Approach für schnelle Entwicklung
- Konsistente Design-Token
- shadcn/ui bietet production-ready Komponenten
- Gute TypeScript-Integration
- Tree-shaking für optimale Bundle-Size

**Alternativen:** Styled-Components, Emotion, CSS Modules
**Trade-offs:** Größere HTML-Klassenlisten, initiale Lernkurve

### [2025-01-25] TypeScript-Konfiguration: Strict Mode
**Entscheidung:** Strict TypeScript-Konfiguration
**Grund:**
- Frühe Fehlererkennung
- Bessere IDE-Unterstützung
- Robusterer Code für Production
- Team-Entwicklung Consistency

**Trade-offs:** Längere initiale Entwicklungszeit, mehr Boilerplate

## Technische Entscheidungen

### Package Manager
**Status:** Pending
**Optionen:** npm, yarn, pnpm
**Empfehlung:** pnpm (Performance, Disk-Space Efficiency)

### Testing-Setup
**Status:** Pending  
**Optionen:** Jest + Testing Library, Vitest, Playwright
**Empfehlung:** Jest + React Testing Library (Community Standard)

### State Management
**Status:** Pending
**Optionen:** React Context, Zustand, Redux Toolkit
**Empfehlung:** React Context für Start, Zustand bei Bedarf

### Database Integration
**Status:** Future Consideration
**Optionen:** Prisma + PostgreSQL, Drizzle, Supabase
**Empfehlung:** Prisma für Type-Safety

## Pending Decisions
- [ ] Package Manager finale Wahl
- [ ] Testing Framework Integration
- [ ] Environment Variable Structure
- [ ] Deployment Target (Vercel, Netlify, Custom)
- [ ] Authentication Strategy (NextAuth, Clerk, Custom)
### [2025-06-25] Tailwind CSS v4 ESLint-Compliance erfolgreich implementiert
**Entscheidung:** ES-Module Import-Syntax für tailwindcss-animate Plugin
**Grund:** 
- ESLint-Regel verbietet CommonJS require() in TypeScript-Konfigurationsdateien
- Moderne ES-Module Syntax bevorzugt für bessere Type-Safety
- Konsistenz mit Next.js 15 Best Practices
- Vermeidung von Linting-Fehlern in der IDE

**Umsetzung:** 
```typescript
// VORHER (ESLint-Fehler):
plugins: [require("tailwindcss-animate")]

// NACHHER (ESLint-konform):
import tailwindcssAnimate from "tailwindcss-animate";
plugins: [tailwindcssAnimate]
```

**Ergebnis:** ✅ Development Server läuft fehlerfrei, Tailwind CSS v4 vollständig konfiguriert
**Trade-offs:** Keine negativen Auswirkungen, nur Vorteile durch moderne Syntax
### [2025-06-25 20:09:00] Database-Wahl: Supabase Integration
**Entscheidung:** Supabase als Primary Database-Lösung für das MicroSaaS Boilerplate
**Grund:**
- Nahtlose Integration mit Next.js 15 und TypeScript
- Real-time Subscriptions für moderne UX
- Integrierte Authentication (kompatibel mit Clerk)
- PostgreSQL-basiert mit vollständiger SQL-Unterstützung
- Automatische API-Generierung
- Optimale Performance für MicroSaaS-Anwendungen

**Alternativen:** Prisma + PostgreSQL, Drizzle, MongoDB
**Trade-offs:** Vendor-Lock-in, aber hervorragende DX und Feature-Set
**API-Keys:** Erfolgreich konfiguriert (lqtsjmaqnehczyegsrds.supabase.co)