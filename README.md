# Edge Finder Pro

Herramienta profesional de análisis y validación de estrategias de trading algorítmico. Detecta ventajas estadísticas reales mediante simulaciones Monte Carlo, análisis de drawdown y pruebas de aleatoriedad.

## Características

### Análisis de Edge
- **Score de Ventaja (0-100)**: Clasificación de estrategias en sin ventaja, ventaja débil, moderada o fuerte
- **Monte Carlo**: Simulación de permutaciones para validar significance estadística
- **Consistencia IS/OOS**: Detección de overfitting mediante comparación in-sample vs out-of-sample
- **Robustez**: Análisis de sensibilidad a parámetros y degradación de rendimiento

### Métricas Avanzadas
- **Expectativa Matemática**: Win rate, R:R ratio, Kelly Criterion
- **Drawdown Analysis**: Recovery factor, Calmar ratio, períodos de recuperación
- **Simulación de Ruina**: Probabilidad de ruin bajo diferentes escenarios
- **Walk-Forward**: Validación de robustez en múltiples períodos OOS

### Visualizaciones
- Curvas de equity con sparklines
- Distribución de resultados Monte Carlo
- Análisis de drawdown e underwater curves
- Retornos mensuales/anuales
- Comparación multi-estrategia

## Tecnologías

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Radix UI + Tailwind CSS + Framer Motion
- **Charts**: Recharts
- **Estado**: Zustand
- **Backend**: Supabase (Edge Functions)
- **Testing**: Vitest + Playwright

## Instalación

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build producción
npm run build
```

## Uso

1. **Cargar estrategias**: Arrastra archivos `.sqx` (StrategyQuant X) al uploader
2. **Analizar**: El sistema calcula automáticamente métricas y scores
3. **Explorar**: Navega entre Dashboard, Monte Carlo, Drawdown y más
4. **Exportar**: Genera informes PDF con todas las métricas

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | Linting con ESLint |
| `npm run test` | Ejecutar tests |
| `npm run test:watch` | Tests en watch mode |

## Estructura

```
src/
├── components/     # Componentes React UI
├── lib/           # Lógica de negocio (parser, estadísticas, Monte Carlo)
├── integrations/  # Integración Supabase
├── hooks/         # Custom hooks
├── pages/         # Rutas principales
└── test/          # Tests
```

## Licencia

MIT
