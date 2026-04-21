---
name: monorepo-versioning
description: >
  Versiona workspaces del monorepo sin usar Changesets, calculando paquetes
  afectados, bumps semánticos, actualizaciones de dependencias internas,
  changelogs por workspace y release final con commit y tag git.
  Trigger: Cuando el usuario pide versionar, preparar release, bump de versiones,
  o reemplazar el flujo de Changesets en CharlyBot.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Usuario pide preparar un release del monorepo
- Usuario pide bump de versiones en workspaces
- Usuario pide reemplazar o evitar `changeset version`
- Hay que actualizar versiones internas entre `apps/*` y `packages/*`

## Critical Patterns

### PROHIBIDO usar Changesets

**NUNCA** usar:

- `bun changeset add`
- `bun changeset version`
- `changeset publish`
- archivos `.changeset/*.md`

Este skill reemplaza ese flujo. La fuente de verdad son los `package.json` de los workspaces.

### Qué workspaces existen en este repo

Workspaces definidos en raíz:

- `apps/*`
- `packages/*`

Antes de versionar, leer siempre:

1. `package.json` raíz
2. `apps/*/package.json`
3. `packages/*/package.json`

### Regla de instalación / tooling

- La instalación se gestiona desde la **raíz del monorepo**
- No asumir `node_modules` por app como mecanismo de release
- El flujo de versionado es **independiente** del package manager

### Workflow obligatorio

1. Detectar workspaces modificados
2. Construir grafo de dependencias internas
3. Calcular workspaces impactados indirectamente
4. Proponer bump por paquete (`patch`, `minor`, `major`)
5. Mostrar plan y pedir confirmación
6. Actualizar versiones en `package.json`
7. Actualizar dependencias internas que apunten a otros workspaces
8. Actualizar `CHANGELOG.md` de cada workspace afectado
9. Actualizar `CHANGELOG.md` raíz con la unión del release
10. Generar artefacto de release manual
11. Crear commit git del release
12. Crear tag git del release
13. Mostrar diff/resumen final

**NUNCA** saltear el paso de confirmación antes de escribir versiones.

### Flujo obligatorio de release en este repo

Cuando el usuario pida versionar o sacar release, el agente debe seguir ESTE flujo:

1. Armar `Release Plan`
2. Pedir confirmación
3. Actualizar versiones en workspaces
4. Actualizar changelogs por workspace
5. Actualizar changelog raíz
6. Crear artefacto en `releases/`
7. Crear commit
8. Crear tag
9. Mostrar resultado final

No dejar el release “a medias”. Si el usuario pidió release completo, el flujo termina con **commit + tag**.

### Cómo detectar impacto

#### Cambio directo

Si un workspace tiene cambios funcionales propios:

- bugfix → `patch`
- feature no breaking → `minor`
- breaking change → `major`

#### Cambio indirecto por dependencia interna

Si `workspace-b` depende de `workspace-a` y `workspace-a` cambió:

- si hay que actualizar el rango interno para seguir consistente, `workspace-b` recibe al menos `patch`
- si el cambio de `workspace-a` es breaking y obliga adaptación, `workspace-b` debe revisarse manualmente

### Regla para dependencias internas

Cuando un workspace depende de otro workspace del repo:

- preservar el protocolo actual si existe (`workspace:*`, `workspace:^`, `workspace:~`)
- si el repo decide dejar versiones explícitas, actualizar al nuevo rango equivalente
- **no mezclar estrategias dentro del mismo repo sin indicación explícita del usuario**

Tabla de actualización:

| Rango actual | Actualización esperada |
|---|---|
| `workspace:*` | mantener `workspace:*` |
| `workspace:^` | mantener `workspace:^` |
| `workspace:~` | mantener `workspace:~` |
| `^1.2.3` | `^<nueva-version>` |
| `~1.2.3` | `~<nueva-version>` |
| `1.2.3` | `<nueva-version>` |

### Artefacto de release

En vez de `.changeset/*.md`, crear un archivo manual en:

```text
releases/YYYY-MM-DD-<slug>.md
```

Ese archivo debe incluir:

- fecha
- paquetes versionados
- versión anterior → nueva versión
- motivo del bump
- dependencias internas actualizadas

### Changelogs obligatorios

Este repo ya usa `CHANGELOG.md` por workspace. El agente debe mantenerlos.

Reglas:

- actualizar `apps/*/CHANGELOG.md` o `packages/*/CHANGELOG.md` solo para workspaces afectados
- agregar una nueva entrada al inicio del archivo
- mantener el encabezado existente del changelog (`# nombre-del-paquete`)
- usar secciones semánticas consistentes:
  - `### Major Changes`
  - `### Minor Changes`
  - `### Patch Changes`
- si un paquete solo cambia por dependencia interna, agregar bloque:
  - `- Updated dependencies`
  - `  - @otro/paquete@x.y.z`

### Changelog raíz obligatorio

Además de los changelogs por workspace, mantener un `CHANGELOG.md` en la raíz con la unión del release.

Formato esperado:

- encabezado `# charlybot`
- una sección por versión de release global o fecha/tag
- resumen de todos los workspaces afectados
- subsección por workspace con sus cambios resumidos

Si el archivo no existe, crearlo en la raíz.

### Commit y tag git obligatorios

Si el usuario pide “sacar release”, “versionar” o “preparar release” como flujo completo, este skill debe terminar con:

1. `git add` de archivos del release
2. `git commit`
3. `git tag`

Convenciones:

- commit: `chore: release <workspace-a> <version>, <workspace-b> <version>`
- tag: **siempre** `<workspace>@<version>`
- si el release afecta múltiples workspaces, crear **un tag por cada workspace afectado**

### Política oficial de tags para este repo

Este monorepo usa **tags por workspace**, no tags globales.

Formato obligatorio:

- `@charlybot/api@2.6.1`
- `@charlybot/bot@2.8.3`
- `@charlybot/shared@2.5.2`
- `dashboard@0.1.1`
- `landing@0.1.1`

Reglas:

1. Si cambia un solo workspace → crear un solo tag `<workspace>@<version>`
2. Si cambian varios workspaces → crear varios tags, uno por workspace
3. **No usar** tags globales tipo `v2.6.1` para representar el release completo del monorepo
4. El commit del release puede ser único, pero los tags deben ser por workspace

Archivos a incluir en el commit:

- `package.json` afectados
- `CHANGELOG.md` raíz
- `apps/*/CHANGELOG.md` afectados
- `packages/*/CHANGELOG.md` afectados
- `releases/*.md` nuevo

**Nunca** crear commit vacío.

### Política para apps privadas

No asumir que una app privada debe versionarse o no.

Primero verificar si el repo la trata como:

- workspace con versión mantenida (`apps/api`, `apps/bot`, etc.)
- app fuera del release público pero con versionado interno
- app excluida del release

Si no está claro, **preguntar antes de cambiar versiones**.

## Decision Tree

| Situación | Acción |
|---|---|
| Solo cambió implementación sin romper contrato | `patch` |
| Se agrega funcionalidad compatible | `minor` |
| Se rompe API/contrato/consumo | `major` |
| Solo cambió una dependencia interna y el paquete debe reflejarlo | `patch` |
| No hubo cambio ni impacto interno | no versionar |

## Output Contract

Antes de editar, mostrar siempre:

```md
## Release Plan
- @paquete/a: 1.2.0 -> 1.2.1 (patch) — motivo
- @paquete/b: 2.0.0 -> 2.1.0 (minor) — motivo

## Internal Dependency Updates
- @paquete/b depende de @paquete/a: ^1.2.0 -> ^1.2.1

## Release Artifact
- releases/2026-04-20-mi-release.md

## Changelog Updates
- apps/api/CHANGELOG.md
- packages/shared/CHANGELOG.md
- CHANGELOG.md

## Git
- commit: chore: release @charlybot/api 2.6.1, @charlybot/shared 2.5.2
- tags:
  - @charlybot/api@2.6.1
  - @charlybot/shared@2.5.2
```

Y pedir confirmación explícita.

## Code Examples

### Ejemplo de plan

```md
## Release Plan
- @charlybot/shared: 2.5.1 -> 2.5.2 (patch) — fix interno de prisma
- @charlybot/api: 2.6.0 -> 2.6.1 (patch) — consume nueva versión de shared
```

### Ejemplo de artefacto manual

```md
# Release 2026-04-20 - prisma-fix

## Packages
- @charlybot/shared: 2.5.1 -> 2.5.2
- @charlybot/api: 2.6.0 -> 2.6.1

## Reasons
- @charlybot/shared: bugfix interno
- @charlybot/api: actualización de dependencia interna

## Internal Dependency Updates
- @charlybot/api: @charlybot/shared workspace:* -> workspace:*
```

### Ejemplo de changelog por workspace

```md
## 2.6.1

### Patch Changes

- Fix token refresh cookie handling

- Updated dependencies
  - @charlybot/shared@2.5.2
```

### Ejemplo de changelog raíz

```md
# charlybot

## v2.6.1

### @charlybot/shared
- Fix internal Prisma/Valkey behavior

### @charlybot/api
- Fix token refresh cookie handling
- Updated dependency on `@charlybot/shared@2.5.2`
```

### Ejemplo de commit y tag

```bash
git add CHANGELOG.md apps/api/CHANGELOG.md packages/shared/CHANGELOG.md releases/2026-04-20-prisma-fix.md apps/api/package.json packages/shared/package.json
git commit -m "chore: release @charlybot/api 2.6.1, @charlybot/shared 2.5.2"
git tag "@charlybot/api@2.6.1"
git tag "@charlybot/shared@2.5.2"
```

## Commands

```bash
# Ver workspaces
bun pm ls

# Ver cambios
git status
git diff

# Crear commit y tag al final del release
git add <archivos>
git commit -m "chore: release <workspace-a> <version>, <workspace-b> <version>"
git tag "<workspace-a>@<version>"
git tag "<workspace-b>@<version>"

# No usar:
# bun changeset version
# bun changeset add
```

## Checklist antes de terminar

- [ ] Se detectaron workspaces modificados
- [ ] Se revisó impacto por dependencias internas
- [ ] Se propuso bump por paquete con motivo
- [ ] Se pidió confirmación antes de editar
- [ ] Se actualizaron `package.json` afectados
- [ ] Se actualizaron los `CHANGELOG.md` por workspace
- [ ] Se actualizó o creó el `CHANGELOG.md` raíz
- [ ] Se creó artefacto en `releases/`
- [ ] Se creó commit git del release
- [ ] Se creó tag git del release
- [ ] Se mostró resumen final

## Resources

- **Template release**: [assets/release-template.md](assets/release-template.md)
- **Template plan**: [assets/release-plan-template.md](assets/release-plan-template.md)
- **Template changelog raíz**: [assets/root-changelog-template.md](assets/root-changelog-template.md)
- **Template changelog workspace**: [assets/workspace-changelog-template.md](assets/workspace-changelog-template.md)
- **Contexto del repo**: [../../AGENTS.md](../../AGENTS.md)
