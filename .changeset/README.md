# Changesets

Workflow de versioning para el monorepo Charlybot.

## Uso

### Crear changeset

```bash
bun changeset add
```

Este comando es **interactivo**.

> Recomendación para agentes: no lo uses en sesiones sin TTY. En ese caso, creá los archivos en `.changeset/*.md` manualmente con el formato estándar.

### Versionar

```bash
bun changeset version
```

Esto actualiza los `package.json` con las nuevas versiones según los changesets pendientes.

## Formato

### Frontmatter (formato estándar)

```yaml
---
"<package-name>": patch|minor|major
---
```

Ejemplo:

```yaml
---
"@charlybot/api": patch
---
```

## Configuración

En `.changeset/config.json`:

```json
{
  "baseBranch": "develop",
  "updateLinkedDependencies": true,
  ...
}
```

> **Nota:** `baseBranch` es `develop`.
