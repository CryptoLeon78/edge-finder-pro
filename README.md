# Edge Finder Pro

**Professional Trading Strategy Analysis & Validation Tool**

Edge Finder Pro es una herramienta profesional de análisis y validación de estrategias de trading algorítmico. Detecta ventajas estadísticas reales mediante simulaciones Monte Carlo, análisis de drawdown, pruebas de aleatoriedad y análisis de correlación de portfolios.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Stack](https://img.shields.io/badge/Stack-React%20%2B%20TypeScript%20%2B%20Vite-cyan)

---

## Tabla de Contenidos

1. [Características](#características)
2. [Planes de Suscripción](#planes-de-suscripción)
3. [Instalación](#instalación)
4. [Uso](#uso)
5. [Tecnologías](#tecnologías)
6. [Estructura del Proyecto](#estructura-del-proyecto)
7. [API Reference](#api-reference)
8. [Desarrollo](#desarrollo)
9. [Licencia](#licencia)

---

## Características

### 🔬 Análisis de Edge (Ventaja Estadística)

| Métrica | Descripción |
|---------|-------------|
| **Edge Score (0-100)** | Clasificación de estrategias: Sin ventaja, Débil, Moderada, Fuerte |
| **Monte Carlo** | Simulación de permutaciones para validar significancia estadística |
| **Z-Score** | Medición de distancia del rendimiento real vs. distribuciones aleatorias |
| **p-Value** | Probabilidad de que el resultado sea aleatorio |

### 📊 Métricas Avanzadas

| Categoría | Métricas |
|-----------|----------|
| **Expectativa** | Win Rate, Profit Factor, R:R Ratio, Kelly Criterion, Expectativa |
| **Drawdown** | Max DD %, Recovery Factor, Calmar Ratio, Duración de DD |
| **Rendimiento** | CAGR, Sharpe Ratio, Sortino Ratio, UI (Ulcer Index) |
| **Walk-Forward** | Degradación IS→OOS, Consistencia, Eficiencia OOS |

### 🎲 Simulaciones

- **Permutation Monte Carlo**: 1000+ simulaciones de reordenamiento de trades
- **Ruin Simulation**: Probabilidad de ruin bajo diferentes escenarios
- **Confidence Intervals**: IC 95% y 99% para resultados finales

### 🔍 Pruebas de Aleatoriedad

- **Runs Test**: Detección de patrones no aleatorios en secuencias de trades
- **Autocorrelation**: Correlación entre trades consecutivos
- **Jarque-Bera**: Normalidad de la distribución de resultados
- **Randomness Score**: Score compuesto de aleatoriedad (0-100)

### 📈 Visualizaciones

- Curvas de equity con análisis IS/OOS
- Distribución de resultados Monte Carlo
- Análisis de drawdown e underwater curves
- Matriz de correlación entre estrategias
- Walk-forward analysis charts
- Comparación multi-estrategia

### 🤝 Análisis de Portfolio

- **Matriz de Correlación**: Identifica estrategias complementarias
- **Diversification Score**: Score de diversificación del portfolio
- **Combined Equity**: Equity curve combinada de múltiples estrategias
- **Alpha Decay Detection**: Detecta degradación IS→OOS en portfolios

---

## Planes de Suscripción

### 🆓 Básico (Free)

**Precio**: $0/mes

Perfecto para traders que están iniciando y necesitan validar sus primeras estrategias.

| Feature | Incluido |
|---------|----------|
| Análisis de hasta 3 estrategias | ✅ |
| Métricas básicas (Win Rate, PF, DD) | ✅ |
| Edge Score básico | ✅ |
| Visualizaciones estándar | ✅ |
| Monte Carlo (100 simulaciones) | ✅ |
| Pruebas de aleatoriedad | ✅ |
| Walk-Forward básico | ❌ |
| Análisis de Portfolio | ❌ |
| Simulación de Ruina | ❌ |
| Export PDF | ❌ |
| Soporte prioritario | ❌ |

### 💼 Pro

**Precio**: $29/mes

Para traders y pequeños fondos que necesitan análisis profundos.

| Feature | Incluido |
|---------|----------|
| Análisis de hasta 20 estrategias | ✅ |
| Métricas avanzadas completas | ✅ |
| Edge Score detallado | ✅ |
| Todas las visualizaciones | ✅ |
| Monte Carlo (1000+ simulaciones) | ✅ |
| Pruebas de aleatoriedad | ✅ |
| Walk-Forward | ✅ |
| Análisis de Portfolio | ✅ |
| Simulación de Ruina | ✅ |
| Export PDF | ✅ |
| Soporte por email | ✅ |

### 🏢 Enterprise

**Precio**: $99/mes

Para fondos de inversión y profesionales que requieren análisis enterprise.

| Feature | Incluido |
|---------|----------|
| Estrategias ilimitadas | ✅ |
| Métricas enterprise | ✅ |
| Edge Score + Análisis de componentes | ✅ |
| Visualizaciones personalizadas | ✅ |
| Monte Carlo (5000+ simulaciones) | ✅ |
| Pruebas de aleatoriedad avanzadas | ✅ |
| Walk-Forward multi-ventana | ✅ |
| Portfolio Optimization | ✅ |
| Simulación de Ruina avanzada | ✅ |
| Export PDF ilimitado | ✅ |
| API Access | ✅ |
| Soporte prioritario 24/7 | ✅ |
| Personalización de阈值 | ✅ |

---

## Instalación

### Prerrequisitos

- Node.js 18+ 
- npm 9+

```bash
# Clonar el repositorio
git clone https://github.com/your-repo/edge-finder-pro.git
cd edge-finder-pro

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tu configuración

# Iniciar servidor de desarrollo
npm run dev
```

### Configuración de Variables de Entorno

```env
# Base de datos (Supabase)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Email (Resend)
VITE_RESEND_API_KEY=re_xxxxxxxxxxxx
VITE_EMAIL_FROM=noreply@ildaambuef.resend.app

# Auth (opcional)
VITE_STRIPE_PUBLIC_KEY=pk_test_xxx
```

---

## Uso

### 1. Cargar Estrategias

Arrastra archivos `.sqx` (StrategyQuant X) al uploader o haz clic para seleccionar.

### 2. Análisis Automático

El sistema procesa automáticamente:
- Parseo de archivos SQX (soporta Build 142+)
- Cálculo de métricas de trading
- Simulaciones Monte Carlo
- Análisis de drawdown
- Pruebas de aleatoriedad

### 3. Explorar Resultados

Navega entre las diferentes pestañas:

| Pestaña | Descripción |
|---------|-------------|
| **Dashboard** | Resumen general con métricas clave |
| **Monte Carlo** | Simulaciones y análisis de significancia |
| **Drawdown** | Análisis profundo de drawdowns |
| **Walk-Forward** | Validación de robustez |
| **Randomness** | Pruebas de aleatoriedad |
| **Correlation** | Análisis de portfolio y correlación |

### 4. Exportar Informes

Genera informes PDF completos con todas las métricas y visualizaciones.

---

## Tecnologías

### Frontend

| Tecnología | Propósito |
|------------|-----------|
| **React 18** | Framework UI |
| **TypeScript** | Tipado estático |
| **Vite** | Build tool |
| **Tailwind CSS** | Estilos |
| **Framer Motion** | Animaciones |
| **Recharts** | Gráficos |

### Backend & Servicios

| Servicio | Propósito |
|----------|-----------|
| **Supabase** | Base de datos y auth |
| **Resend** | Envío de emails |
| **Stripe** | Pagos (próximamente) |

### Estado

| Librería | Uso |
|----------|-----|
| **Zustand** | Estado global |
| **React Query** | Data fetching |

---

## Estructura del Proyecto

```
src/
├── components/           # Componentes React
│   ├── ui/              # Componentes base (botones, inputs)
│   ├── Charts.tsx       # Gráficos reutilizables
│   ├── CorrelationAnalysis.tsx
│   ├── DrawdownAnalysis.tsx
│   ├── MetricsPanel.tsx
│   ├── MonteCarloAdvanced.tsx
│   ├── RandomnessCharts.tsx
│   ├── StrategyComparison.tsx
│   ├── TradesTable.tsx
│   └── WalkForwardPanel.tsx
├── lib/                 # Lógica de negocio
│   ├── binary-parser.ts       # Parser de archivos SQX
│   ├── sqx-parser.ts          # Parser principal
│   ├── correlation-utils.ts   # Análisis de correlación
│   ├── drawdown-utils.ts      # Análisis de drawdown
│   ├── monte-carlo-real.ts    # Simulaciones Monte Carlo
│   ├── randomness-tests.ts    # Pruebas de aleatoriedad
│   ├── statistics.ts          # Análisis de edge
│   ├── walk-forward.ts        # Walk-forward analysis
│   ├── thresholds.ts          # Configuración de umbrales
│   ├── chart-utils.ts        # Utilidades de gráficos
│   └── store.ts               # Estado Zustand
├── pages/
│   └── Index.tsx              # Página principal
├── App.tsx                    # Componente raíz
├── main.tsx                   # Entry point
└── index.css                  # Estilos globales
```

---

## API Reference

### Funciones Principales

```typescript
// Análisis de Edge
analyzeEdge(strategy: SQXStrategy): EdgeAnalysis

// Monte Carlo
runPermutationMC(trades, initialCapital, iterations): PermutationMCResult

// Expectativa Matemática
analyzeExpectancy(trades): ExpectancyAnalysis

// Simulación de Ruina
simulateRuin(trades, initialCapital, ruinThreshold): RuinSimulationResult

// Walk-Forward
runWalkForward(trades, numWindows, oosRatio): WalkForwardResult

// Correlación
analyzePortfolio(strategyIds, tradesMap): PortfolioAnalysis

// Pruebas de Aleatoriedad
runAllRandomnessTests(trades): RandomnessResult
```

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Iniciar servidor de desarrollo (puerto 8081) |
| `npm run build` | Build de producción |
| `npm run lint` | Linting con ESLint |
| `npm run typecheck` | Verificación de tipos |

---

## Configuración de Thresholds

Todos los umbrales de cálculo están centralizados en `src/lib/thresholds.ts`:

```typescript
export const THRESHOLDS = {
  alerts: {
    maxDrawdownDanger: 30,    // %
    maxDrawdownWarning: 20,   // %
    recoveryFactorDanger: 1,
    // ...
  },
  monteCarlo: {
    iterations: 1000,
    ruinIterations: 5000,
    // ...
  },
  // ...
};
```

---

## Contribuir

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/amazing`)
3. Commit tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing`)
5. Abre un Pull Request

---

## Licencia

MIT License - Ver [LICENSE](LICENSE) para detalles.

---

## Soporte

- 📧 Email: support@edgefinderpro.com
- 📚 Docs: [docs.edgefinderpro.com](https://docs.edgefinderpro.com)
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/edge-finder-pro/issues)

---

**Edge Finder Pro** - Validación profesional de estrategias de trading