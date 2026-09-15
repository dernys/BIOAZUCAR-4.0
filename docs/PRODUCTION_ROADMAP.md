# BioAzúcar 4.0 — Production Roadmap

**Estrategia:** Vertical Slices hacia el Primer Despliegue en Planta  
**Principio Rector:** Funcionalidad → Configurabilidad → Integración → Datos Reales → Testing → Seguridad → Operación → Producción

---

## Fases y Prioridades

```text
[P0] Production Blockers & Hardening Base
  ├── Corrección exhaustiva Tema Claro / Oscuro en Wizard y Modales OT
  ├── Persistencia atómica de Conexiones y Tags (Offline-First / Local Storage + Cloud)
  └── Erradicación de fallbacks silenciosos e inconsistencias de estado

[P1] Industrial Configuration & Universal Hierarchy
  ├── Jerarquía Universal: Tenant -> Site -> Area -> Process Cell -> Asset -> Device -> Tag
  ├── Administrador completo de Dispositivos Industriales (Estados: Discovered, Configured, Connected, etc.)
  ├── Tag / Variable Management integral (Edición de rangos, escalado, deadband, alarm limits)
  └── Industrial Tag Tester (READ, WRITE auditado con autorización humana, MONITOR en tiempo real)

[P2] Connectivity Test Center & Commissioning
  ├── Industrial Connectivity Test Center (Protocol -> Device -> Tag -> Quality -> Historian)
  ├── Commissioning Wizard multi-tag con evidencia digital criptográfica
  └── Protocolos honestos (OPC-UA, Modbus, MQTT/Sparkplug B, y EROS con STATUS = PROTOCOL_SPEC_REQUIRED)

[P3] Data Quality & Historian Hardening
  ├── Quality Gate desacoplado de simulación (Detección de Frozen, Outliers, Skew, Bad Quality)
  ├── Historian local con buffer circular persistente para operación 100% offline
  └── Trazabilidad estricta de Provenance (LIVE_OT vs SIMULATION vs DERIVED)

[P4] Operational Readiness & Monitoring
  ├── Dashboards enlazados a variables reales configuradas
  ├── Consola de Diagnóstico OT en tiempo real
  └── Product Readiness Dashboard interno para comisionamiento SAT/FAT

[P5] Verificación Final & Documentación
  ├── Ejecución de la Matriz de Pruebas de Flujo Productivo
  ├── Manuales de Operación, Configuración y Despliegue de Campo
  └── Validación final de compilación y cero regresiones
```
