#!/usr/bin/env node

/**
 * Script de sincronización atómica de versiones para el monorepositorio Sugar Ludo.
 * Actualiza los 7 archivos obligatorios en un solo comando:
 * 1. package.json (raíz)
 * 2. lib/version.ts
 * 3. sugar-ludo-landing/components/GamerHUDModal.tsx
 * 4. sugar-ludo-admin-hub/package.json
 * 5. sugar-ludo-admin-hub/lib/version.ts
 * 6. sugar-ludo-landing/package.json
 * 7. sugar-ludo-landing/lib/constants.ts
 *
 * Uso:
 *   node scripts/bump-version.js            -> Muestra el estado actual en los 7 archivos
 *   node scripts/bump-version.js 9.4.1      -> Actualiza atómicamente a 9.4.1
 *   npm run bump 9.4.1
 */

const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.resolve(__dirname, '..')

const TARGET_FILES = [
  {
    name: 'package.json (raíz)',
    relPath: 'package.json',
    detect: (content) => {
      const m = content.match(/"version":\s*"([^"]+)"/)
      return m ? m[1] : null
    },
    update: (content, newVer) => {
      return content.replace(/"version":\s*"[^"]+"/, `"version": "${newVer}"`)
    }
  },
  {
    name: 'lib/version.ts',
    relPath: 'lib/version.ts',
    detect: (content) => {
      const m = content.match(/packageJson\.version\s*:\s*'([^']+)'/)
      return m ? m[1] : null
    },
    update: (content, newVer) => {
      return content.replace(/(packageJson\.version\s*:\s*')[^']+'/, `$1${newVer}'`)
    }
  },
  {
    name: 'sugar-ludo-landing/components/GamerHUDModal.tsx',
    relPath: 'sugar-ludo-landing/components/GamerHUDModal.tsx',
    detect: (content) => {
      const m = content.match(/version\s*=\s*'([^']+)'/)
      return m ? m[1] : null
    },
    update: (content, newVer) => {
      return content.replace(/(version\s*=\s*')[^']+'/, `$1${newVer}'`)
    }
  },
  {
    name: 'sugar-ludo-admin-hub/package.json',
    relPath: 'sugar-ludo-admin-hub/package.json',
    detect: (content) => {
      const m = content.match(/"version":\s*"([^"]+)"/)
      return m ? m[1] : null
    },
    update: (content, newVer) => {
      return content.replace(/"version":\s*"[^"]+"/, `"version": "${newVer}"`)
    }
  },
  {
    name: 'sugar-ludo-admin-hub/lib/version.ts',
    relPath: 'sugar-ludo-admin-hub/lib/version.ts',
    detect: (content) => {
      const m = content.match(/packageJson\.version\s*:\s*'([^']+)'/)
      return m ? m[1] : null
    },
    update: (content, newVer) => {
      return content.replace(/(packageJson\.version\s*:\s*')[^']+'/, `$1${newVer}'`)
    }
  },
  {
    name: 'sugar-ludo-landing/package.json',
    relPath: 'sugar-ludo-landing/package.json',
    detect: (content) => {
      const m = content.match(/"version":\s*"([^"]+)"/)
      return m ? m[1] : null
    },
    update: (content, newVer) => {
      return content.replace(/"version":\s*"[^"]+"/, `"version": "${newVer}"`)
    }
  },
  {
    name: 'sugar-ludo-landing/lib/constants.ts',
    relPath: 'sugar-ludo-landing/lib/constants.ts',
    detect: (content) => {
      const m = content.match(/export const APP_VERSION\s*=\s*'([^']+)'/)
      return m ? m[1] : null
    },
    update: (content, newVer) => {
      return content.replace(/(export const APP_VERSION\s*=\s*')[^']+'/, `$1${newVer}'`)
    }
  }
]

function getTargetVersion(arg) {
  if (!arg) return null
  return arg.replace(/^v/i, '').trim()
}

function isValidSemver(v) {
  return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v)
}

function main() {
  const args = process.argv.slice(2)
  const rawArg = args[0]
  const targetVersion = getTargetVersion(rawArg)

  console.log('\n======================================================')
  console.log('   SUGAR LUDO - GESTOR DE VERSIONADO DEL MONOREPO   ')
  console.log('======================================================\n')

  // Validar existencia física de los 7 archivos
  for (const item of TARGET_FILES) {
    const fullPath = path.join(ROOT_DIR, item.relPath)
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ Error crítico: Archivo no encontrado: ${item.relPath}`)
      process.exit(1)
    }
  }

  // MODO INFORMATIVO (sin argumentos)
  if (!targetVersion) {
    console.log('ℹ️  Modo informativo: Estado actual de las versiones:\n')
    let allMatch = true
    let firstVer = null

    for (let i = 0; i < TARGET_FILES.length; i++) {
      const item = TARGET_FILES[i]
      const fullPath = path.join(ROOT_DIR, item.relPath)
      const content = fs.readFileSync(fullPath, 'utf-8')
      const detected = item.detect(content) || 'NO DETECTADA'

      if (i === 0) {
        firstVer = detected
      } else if (detected !== firstVer) {
        allMatch = false
      }

      console.log(`  [${i + 1}/7] ${item.name.padEnd(46)} -> v${detected}`)
    }

    console.log('\n------------------------------------------------------')
    if (allMatch && firstVer) {
      console.log(`✅ Consistencia perfecta: Los 7 archivos están sincronizados en v${firstVer}`)
    } else {
      console.log(`⚠️  Discrepancia detectada: Las versiones no están sincronizadas.`)
    }
    console.log('------------------------------------------------------')
    console.log('\nPara actualizar todos los archivos sincrónicamente:')
    console.log('  npm run bump <nueva_version>')
    console.log('  Ejemplo: npm run bump 9.4.1\n')
    process.exit(0)
  }

  // VALIDACIÓN SEMVER
  if (!isValidSemver(targetVersion)) {
    console.error(`❌ Error: Formato de versión inválido "${rawArg}".`)
    console.error('   Debe seguir el estándar SemVer (ej. 9.4.1 o v9.4.1).\n')
    process.exit(1)
  }

  console.log(`🎯 Iniciando actualización atómica a la versión: v${targetVersion}\n`)

  const updates = []

  // Fase 1: Leer y transformar en memoria
  for (let i = 0; i < TARGET_FILES.length; i++) {
    const item = TARGET_FILES[i]
    const fullPath = path.join(ROOT_DIR, item.relPath)
    const content = fs.readFileSync(fullPath, 'utf-8')
    const oldVer = item.detect(content)
    const newContent = item.update(content, targetVersion)

    if (newContent === content && oldVer === targetVersion) {
      updates.push({ item, fullPath, newContent, note: `Ya estaba en v${targetVersion} (sin cambios)` })
    } else if (newContent === content) {
      console.error(`❌ Error: El patrón de reemplazo no modificó el archivo: ${item.relPath}`)
      process.exit(1)
    } else {
      updates.push({ item, fullPath, newContent, note: `v${oldVer} -> v${targetVersion}` })
    }
  }

  // Fase 2: Escritura en disco
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i]
    fs.writeFileSync(u.fullPath, u.newContent, 'utf-8')
    console.log(`  ✓ [${i + 1}/7] ${u.item.name.padEnd(46)} [${u.note}]`)
  }

  // Fase 3: Verificación post-escritura
  let verifiedAll = true
  for (const item of TARGET_FILES) {
    const fullPath = path.join(ROOT_DIR, item.relPath)
    const content = fs.readFileSync(fullPath, 'utf-8')
    const verified = item.detect(content)
    if (verified !== targetVersion) {
      verifiedAll = false
      console.error(`❌ Error de verificación: ${item.relPath} tiene v${verified} en vez de v${targetVersion}`)
    }
  }

  console.log('\n======================================================')
  if (verifiedAll) {
    console.log(`✨ ¡ÉXITO! Los 7 archivos se actualizaron a v${targetVersion} sincrónicamente.`)
  } else {
    console.error(`❌ Se detectaron fallas de verificación en algunos archivos.`)
    process.exit(1)
  }
  console.log('======================================================\n')
}

main()
