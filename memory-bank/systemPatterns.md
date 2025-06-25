# System Patterns - Next.js 15 AIaaS Boilerplate

## Architektur-Patterns

### App Router Pattern
- Dateibasiertes Routing mit App Router
- Server- und Client-Komponenten-Trennung
- Layout-Hierarchie für konsistente UI

### Component Pattern
```typescript
// Atomic Design Pattern
components/
├── atoms/          # Basis-Elemente (Button, Input)
├── molecules/      # Kombinierte Elemente (SearchBox)
├── organisms/      # Komplexe Komponenten (Header, Sidebar)
└── templates/      # Page-Level Layouts
```

### Configuration Pattern
```typescript
// Zentrale Konfiguration
config/
├── database.ts     # DB-Verbindungen
├── auth.ts        # Authentifizierung
├── api.ts         # API-Endpoints
└── constants.ts   # App-Konstanten
```

## Code Patterns

### TypeScript Patterns
- Strict Mode aktiviert
- Interface-first Design
- Utility Types für Flexibilität
- Branded Types für Domain-spezifische Typen

### Styling Patterns
- Tailwind CSS mit Component-level Styles
- CSS-in-JS für dynamische Styles
- Design System mit shadcn/ui
- Responsive Design Mobile-first

### Performance Patterns
- Image Optimization mit next/image
- Code Splitting automatisch
- Static Generation wo möglich
- Server-side Rendering für SEO

## Naming Conventions
- **Files:** kebab-case (auth-button.tsx)
- **Components:** PascalCase (AuthButton)
- **Functions:** camelCase (handleSubmit)
- **Constants:** SCREAMING_SNAKE_CASE (API_BASE_URL)
- **Types:** PascalCase mit suffix (UserType, ApiResponse)

## Error Handling Patterns
- try-catch für async operations
- Error boundaries für React Komponenten
- Centralized error logging
- User-friendly error messages

## State Management Patterns
- React State für lokale UI-States
- Context API für geteilte States
- Zustand/Redux für komplexe App-States
- Server State mit React Query (optional)