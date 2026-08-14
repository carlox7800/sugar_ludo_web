---
description: Reglas de protección de código y aislamiento de módulos para AntiGravity.
trigger: Always On
---

# 🛡️ Reglas de Protección de Código

## 1. Aislamiento de Modificaciones
* **Afectación Mínima:** Modifica ÚNICAMENTE el archivo o componente directamente relacionado con la solicitud.
* **Prohibido Refactorizar:** No reestructures, simplifiques ni borres código de otros módulos que ya funcionan correctamente (modos offline, online, lobby, etc.).

## 2. Inviolabilidad de Funciones Existentes
* **Preservar Contratos:** Mantén intactas las interfaces, firmas de funciones y eventos que conectan con otros componentes.
* **Sin Efectos Secundarios:** Resuelve los errores localmente sin alterar variables o estados globales compartidos.

## 3. Verificación Previa al Guardado
* Revisa que no hayas eliminado líneas de código en archivos ajenos a la solicitud antes de confirmar cambios.