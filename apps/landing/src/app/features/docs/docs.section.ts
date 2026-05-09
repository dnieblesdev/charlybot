import { Component, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { LucideAngularModule, Music, Shield, Coins, Wrench, Gamepad2 } from 'lucide-angular';

export interface CommandParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface Command {
  name: string;
  description: string;
  adminOnly: boolean;
  params: CommandParam[];
  expectedOutput: string;
}

export interface ModuleCard {
  icon?: string;
  title: string;
  description: string;
}

export interface CommandModule {
  icon: any;
  name: string;
  subtitle: string;
  commands: Command[];
  cards?: ModuleCard[];
}

@Component({
  selector: 'app-docs-section',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <section class="section" id="comandos">
      <div class="container">
        <h2 class="heading-section">
          Comandos disponibles
        </h2>
        <p class="text-body">
          Explorá todo lo que CharlyBot puede hacer por tu servidor. Cada módulo trae comandos con ejemplos y parámetros detallados.
        </p>

        <!-- Mobile: dropdown selector -->
        <select class="docs-mobile-select"
                [value]="selectedModule().name"
                (change)="onModuleChange($event)">
          @for (mod of modules; track mod.name) {
            <option [value]="mod.name">{{ mod.name }}</option>
          }
        </select>

        <!-- Two-panel layout -->
        <div class="docs-panel">
          <!-- Sidebar -->
          <nav class="docs-sidebar">
            @for (mod of modules; track mod.name) {
              <button class="docs-sidebar-item"
                      [class.docs-sidebar-item--active]="selectedModule().name === mod.name"
                      (click)="selectedModule.set(mod)">
                <lucide-icon [img]="mod.icon" [size]="20"></lucide-icon>
                <span>{{ mod.name }}</span>
              </button>
            }
          </nav>

          <!-- Content area -->
          <div class="docs-content">
            <!-- Module header -->
            <div class="docs-module-header">
              <div class="docs-module-icon">
                <lucide-icon [img]="selectedModule().icon" [size]="24"></lucide-icon>
              </div>
              <div>
                <h3 class="docs-module-title">{{ selectedModule().name }}</h3>
                <p class="docs-module-subtitle">{{ selectedModule().subtitle }}</p>
              </div>
            </div>

            <!-- Command blocks -->
            @for (cmd of selectedModule().commands; track cmd.name) {
              <div class="command-block">
                <div class="command-block__header">
                  <span class="command-badge">{{ cmd.name }}</span>
                  @if (cmd.adminOnly) {
                    <span class="admin-tag">
                      <lucide-icon [img]="shieldIcon" [size]="12"></lucide-icon>
                      Admin
                    </span>
                  }
                  <button class="command-copy-btn"
                          (click)="copyCommand(cmd.name)"
                          [attr.aria-label]="'Copiar ' + cmd.name">
                    {{ copiedCommand() === cmd.name ? '✓ Copiado' : 'Copiar' }}
                  </button>
                </div>
                <p class="command-block__desc">{{ cmd.description }}</p>

                @if (cmd.params.length > 0) {
                  <div class="params-block">
                    <span class="params-block__label">Parámetros</span>
                    <table class="params-table">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Tipo</th>
                          <th>Req.</th>
                          <th>Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (p of cmd.params; track p.name) {
                          <tr>
                            <td class="params-table__name">{{ p.name }}</td>
                            <td><code>{{ p.type }}</code></td>
                            <td>{{ p.required ? 'Sí' : 'No' }}</td>
                            <td>{{ p.description }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }

                <div class="command-block__output">
                  <span class="command-block__output-label">Respuesta</span>
                  <pre>{{ cmd.expectedOutput }}</pre>
                </div>
              </div>
            }

            <!-- Module cards -->
            @if (selectedModule().cards && selectedModule().cards!.length > 0) {
              <div class="docs-cards">
                @for (card of selectedModule().cards; track card.title) {
                  <div class="docs-card">
                    @if (card.icon) {
                      <span class="docs-card__icon">{{ card.icon }}</span>
                    }
                    <h4 class="docs-card__title">{{ card.title }}</h4>
                    <p class="docs-card__desc">{{ card.description }}</p>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    /* Mobile select */
    .docs-mobile-select {
      display: none;
    }

    @media (max-width: 767px) {
      .docs-mobile-select {
        display: block;
        width: 100%;
        padding: 0.75rem 1rem;
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        font-size: 1rem;
        margin-bottom: 1.5rem;
        appearance: auto;
      }
    }

    /* Two-panel */
    .docs-panel {
      display: flex;
      gap: 2rem;
      align-items: flex-start;
    }

    /* Sidebar */
    .docs-sidebar {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      width: 220px;
      flex-shrink: 0;
      position: sticky;
      top: 5rem;
    }

    @media (max-width: 767px) {
      .docs-sidebar {
        display: none;
      }
    }

    .docs-sidebar-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.625rem 0.875rem;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--color-text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: all var(--transition-base);
      font-family: var(--font-family-base);
    }

    .docs-sidebar-item:hover {
      background: var(--color-bg-surface);
      color: var(--color-text-primary);
    }

    .docs-sidebar-item--active {
      background: rgba(139, 92, 246, 0.15);
      color: var(--color-accent);
    }

    /* Content */
    .docs-content {
      flex: 1;
      min-width: 0;
    }

    /* Module header */
    .docs-module-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .docs-module-icon {
      width: 3rem;
      height: 3rem;
      border-radius: 9999px;
      background: rgba(139, 92, 246, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-accent);
      flex-shrink: 0;
    }

    .docs-module-title {
      font-size: 1.5rem;
      font-weight: var(--font-heading-weight);
      color: var(--color-text-primary);
      margin: 0;
    }

    .docs-module-subtitle {
      color: var(--color-text-secondary);
      margin: 0.25rem 0 0 0;
      font-size: 0.875rem;
    }

    /* Command block */
    .command-block {
      background: var(--color-bg-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      margin-bottom: 1rem;
    }

    .command-block__header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }

    .command-badge {
      display: inline-block;
      padding: 0.25rem 0.625rem;
      background: rgba(139, 92, 246, 0.15);
      color: var(--color-accent);
      border-radius: var(--radius-sm);
      font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
      font-size: 0.8125rem;
      font-weight: 500;
    }

    .admin-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      background: rgba(59, 130, 246, 0.18);
      color: var(--color-accent-blue);
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 500;
    }

    .command-copy-btn {
      margin-left: auto;
      padding: 0.25rem 0.75rem;
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      color: var(--color-text-secondary);
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-base);
      font-family: var(--font-family-base);
    }

    .command-copy-btn:hover {
      background: var(--color-bg-surface);
      border-color: var(--color-accent);
      color: var(--color-accent);
    }

    .command-block__desc {
      color: var(--color-text-secondary);
      font-size: 0.875rem;
      margin: 0 0 1rem 0;
      line-height: 1.6;
    }

    /* Params */
    .params-block {
      margin-bottom: 1rem;
    }

    .params-block__label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .params-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .params-table th {
      text-align: left;
      padding: 0.375rem 0.5rem;
      color: var(--color-text-secondary);
      font-weight: 500;
      border-bottom: 1px solid var(--color-border);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .params-table td {
      padding: 0.375rem 0.5rem;
      color: var(--color-text-secondary);
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    .params-table__name {
      font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
      font-size: 0.8125rem;
      color: var(--color-accent);
    }

    .params-table code {
      font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      background: var(--color-bg-elevated);
      padding: 0.0625rem 0.3125rem;
      border-radius: 0.25rem;
    }

    /* Output */
    .command-block__output {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .command-block__output-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text-primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .command-block__output pre {
      display: block;
      padding: 0.5rem 0.75rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      color: var(--color-text-secondary);
      font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
      font-size: 0.8125rem;
      white-space: pre-wrap;
      line-height: 1.6;
      margin: 0;
    }

    /* Cards */
    .docs-cards {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-top: 2rem;
    }

    @media (min-width: 768px) {
      .docs-cards {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .docs-card {
      background: var(--color-bg-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
    }

    .docs-card__icon {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
      display: block;
    }

    .docs-card__title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--color-text-primary);
      margin: 0 0 0.375rem 0;
    }

    .docs-card__desc {
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
      margin: 0;
      line-height: 1.5;
    }
  `]
})
export class DocsSection {
  private readonly isBrowser: boolean;
  readonly shieldIcon = Shield;

  readonly selectedModule = signal<CommandModule>({} as CommandModule);
  readonly copiedCommand = signal<string | null>(null);

  modules: CommandModule[] = [
    {
      icon: Music,
      name: 'Música',
      subtitle: 'Reproducí música en tu servidor desde YouTube y Spotify',
      commands: [
        {
          name: '/music play',
          description: 'Reproduce una canción o playlist de YouTube/Spotify por nombre o URL.',
          adminOnly: false,
          params: [
            { name: 'query', type: 'string', required: true, description: 'URL o nombre de la canción/playlist' }
          ],
          expectedOutput: '🎵 Reproduciendo ahora: [Nombre de la canción] • Solicitado por @usuario'
        },
        {
          name: '/music skip',
          description: 'Salta a la siguiente canción en la cola.',
          adminOnly: false,
          params: [],
          expectedOutput: '⏭️ Canción saltada. Ahora suena: [Siguiente canción]'
        },
        {
          name: '/music playlist',
          description: 'Muestra la cola de reproducción actual con paginación.',
          adminOnly: false,
          params: [
            { name: 'page', type: 'integer', required: false, description: 'Número de página a mostrar' }
          ],
          expectedOutput: '📋 Cola de reproducción (5/20):\n1. Canción A\n2. Canción B\n...'
        },
        {
          name: '/music nowplaying',
          description: 'Muestra la canción que se está reproduciendo actualmente.',
          adminOnly: false,
          params: [],
          expectedOutput: '🎶 Ahora suena: [Nombre de la canción] — 2:34 / 4:12'
        },
        {
          name: '/music pause',
          description: 'Pausa la reproducción actual.',
          adminOnly: false,
          params: [],
          expectedOutput: '⏸️ Reproducción pausada.'
        },
        {
          name: '/music resume',
          description: 'Reanuda la reproducción pausada.',
          adminOnly: false,
          params: [],
          expectedOutput: '▶️ Reproducción reanuda.'
        },
        {
          name: '/music stop',
          description: 'Detiene la reproducción y limpia la cola.',
          adminOnly: false,
          params: [],
          expectedOutput: '⏹️ Reproducción detenida y cola limpiada.'
        },
        {
          name: '/music loop',
          description: 'Configura el modo de repetición: desactivar, repetir canción o repetir cola.',
          adminOnly: false,
          params: [
            { name: 'mode', type: 'string', required: true, description: 'Modo: Desactivar, Repetir canción, Repetir cola' }
          ],
          expectedOutput: '🔁 Modo de repetición: Repetir canción'
        },
        {
          name: '/music shuffle',
          description: 'Mezcla aleatoriamente la cola de reproducción.',
          adminOnly: false,
          params: [],
          expectedOutput: '🔀 Cola mezclada aleatoriamente.'
        },
        {
          name: '/music volume',
          description: 'Ajusta el volumen de la reproducción (0-200%).',
          adminOnly: false,
          params: [
            { name: 'level', type: 'integer', required: true, description: 'Nivel de volumen (0-200)' }
          ],
          expectedOutput: '🔊 Volumen ajustado a 75%'
        },
        {
          name: '/music remove',
          description: 'Elimina una canción específica de la cola.',
          adminOnly: false,
          params: [
            { name: 'position', type: 'integer', required: true, description: 'Posición de la canción en la cola' }
          ],
          expectedOutput: '🗑️ Canción eliminada de la cola.'
        },
        {
          name: '/music clear',
          description: 'Limpia la cola sin detener la canción actual.',
          adminOnly: false,
          params: [],
          expectedOutput: '🧹 Cola limpiada.'
        },
        {
          name: '/music join',
          description: 'Une el bot a tu canal de voz actual.',
          adminOnly: false,
          params: [],
          expectedOutput: '🎧 uniendome al canal de voz...'
        },
        {
          name: '/music leave',
          description: 'Hace que el bot salga del canal de voz.',
          adminOnly: false,
          params: [],
          expectedOutput: '👋 Saliendo del canal de voz.'
        }
      ]
    },
    {
      icon: Coins,
      name: 'Economía',
      subtitle: 'Sistema de monedas virtual con trabajos, crímenes y ruleta',
      commands: [
        {
          name: '/economia balance',
          description: 'Consulta tu balance de bolsillo y banco, o el de otro usuario.',
          adminOnly: false,
          params: [
            { name: 'usuario', type: 'user', required: false, description: 'Usuario a consultar (opcional)' }
          ],
          expectedOutput: '💳 Balance de @usuario:\nBolsillo: 1,500 monedas\nBanco: 5,000 monedas'
        },
        {
          name: '/economia deposit',
          description: 'Deposita dinero de tu bolsillo al banco para protegerlo.',
          adminOnly: false,
          params: [
            { name: 'cantidad', type: 'integer', required: true, description: 'Cantidad a depositar (usa un número o "all" para todo)' }
          ],
          expectedOutput: '🏦 Depositaste 500 monedas al banco. Nuevo balance: 1,000 / 5,500'
        },
        {
          name: '/economia retirar',
          description: 'Retira dinero del banco a tu bolsillo.',
          adminOnly: false,
          params: [
            { name: 'cantidad', type: 'integer', required: true, description: 'Cantidad a retirar (usa un número o "all" para todo)' }
          ],
          expectedOutput: '💸 Retiraste 500 monedas del banco. Nuevo balance: 1,500 / 5,000'
        },
        {
          name: '/economia work',
          description: 'Trabaja para ganar dinero. El cooldown se configura por servidor.',
          adminOnly: false,
          params: [],
          expectedOutput: '👷 Trabajaste como Programador y ganaste 350 monedas.'
        },
        {
          name: '/economia crime',
          description: 'Comete un crimen para ganar dinero extra. Incluye riesgo de prisión.',
          adminOnly: false,
          params: [],
          expectedOutput: '💰 Robaste 200 monedas. ¡Cuidado con la policía!'
        },
        {
          name: '/economia rob',
          description: 'Intenta robar dinero del bolsillo de otro usuario.',
          adminOnly: false,
          params: [
            { name: 'usuario', type: 'user', required: true, description: 'Usuario al que quieres robar' }
          ],
          expectedOutput: '🕵️ Intentaste robar a @usuario. ¡Éxito! Ganaste 150 monedas.'
        },
        {
          name: '/economia ruleta',
          description: 'Juega a la ruleta apostándo tu dinero a color o número.',
          adminOnly: false,
          params: [
            { name: 'tipo', type: 'string', required: true, description: 'Tipo de apuesta: color o número' },
            { name: 'apuesta', type: 'string', required: true, description: 'Tu apuesta: red/black/green o número (0-36)' },
            { name: 'cantidad', type: 'integer', required: true, description: 'Cantidad de dinero a apostar' }
          ],
          expectedOutput: '🎰 Apostaste 100 monedas a rojo... ¡Ganaste 200 monedas! 🔴'
        },
        {
          name: '/economia leaderboard',
          description: 'Muestra el ranking de los usuarios más ricos del servidor.',
          adminOnly: false,
          params: [
            { name: 'cantidad', type: 'integer', required: false, description: 'Cantidad de usuarios a mostrar (5-25, por defecto 10)' }
          ],
          expectedOutput: '🏆 **Top 5 del Servidor**\n1. @usuarioA — 45,000 monedas\n2. @usuarioB — 38,500 monedas\n...'
        },
        {
          name: '/economia bail',
          description: 'Paga tu fianza para salir de la prisión si fuiste atrapado.',
          adminOnly: false,
          params: [],
          expectedOutput: '🚓 Pagaste la fianza y saliste de prisión.'
        }
      ],
      cards: [
        {
          icon: '⚙️',
          title: 'Configuración por Servidor',
          description: 'Los administradores pueden configurar cooldowns de work/crime/rob, multiplicadores de ganancia, dinero inicial y canal de ruleta dedicado.'
        }
      ]
    },
    {
      icon: Gamepad2,
      name: 'XP y Niveles',
      subtitle: 'Sistema de experiencia y roles por nivel para premiar la actividad',
      commands: [
        {
          name: '/xp rank',
          description: 'Muestra tu nivel y XP actual o el de otro usuario.',
          adminOnly: false,
          params: [
            { name: 'usuario', type: 'user', required: false, description: 'Usuario a consultar (opcional)' }
          ],
          expectedOutput: '⭐ @usuario — Nivel 24\nXP: 4,520 / 5,000\n████████░░ 90%'
        },
        {
          name: '/xp leaderboard',
          description: 'Muestra el top 10 de usuarios por XP en el servidor.',
          adminOnly: false,
          params: [],
          expectedOutput: '🏆 **Top 10 por XP**\n1. @usuarioA — Nivel 42\n2. @usuarioB — Nivel 38\n...'
        },
        {
          name: '/xp level-roles add',
          description: 'Asocia un rol que se dará automáticamente al alcanzar un nivel.',
          adminOnly: true,
          params: [
            { name: 'nivel', type: 'integer', required: true, description: 'Nivel requerido' },
            { name: 'rol', type: 'role', required: true, description: 'Rol que se dará al alcanzar el nivel' }
          ],
          expectedOutput: '✅ Rol @VIP agregado para el nivel 10.'
        },
        {
          name: '/xp level-roles list',
          description: 'Lista todas las asociaciones de roles por nivel configuradas.',
          adminOnly: true,
          params: [],
          expectedOutput: '📋 **Roles por Nivel**\nNivel 5 → @Novato\nNivel 10 → @Veterano\nNivel 20 → @Élite'
        },
        {
          name: '/xp level-roles remove',
          description: 'Elimina la asociación de rol para un nivel específico.',
          adminOnly: true,
          params: [
            { name: 'nivel', type: 'integer', required: true, description: 'Nivel cuya asociación quieres eliminar' }
          ],
          expectedOutput: '🗑️ Asociación de nivel 10 eliminada.'
        },
        {
          name: '/xp config enable',
          description: 'Habilita el sistema de XP en el servidor.',
          adminOnly: true,
          params: [],
          expectedOutput: '✅ Sistema de XP habilitado.'
        },
        {
          name: '/xp config disable',
          description: 'Deshabilita el sistema de XP en el servidor.',
          adminOnly: true,
          params: [],
          expectedOutput: '✅ Sistema de XP deshabilitado.'
        },
        {
          name: '/xp config set-xp',
          description: 'Establece la cantidad de XP ganada por mensaje.',
          adminOnly: true,
          params: [
            { name: 'cantidad', type: 'integer', required: true, description: 'XP por mensaje (mínimo 1)' }
          ],
          expectedOutput: '✅ XP por mensaje establecido a 15.'
        }
      ],
      cards: [
        {
          icon: '🎭',
          title: 'Roles Automáticos',
          description: 'Configurá que al alcanzar ciertos niveles, el usuario reciba un rol automáticamente. Incentivá la actividad en tu servidor.'
        }
      ]
    },
    {
      icon: Shield,
      name: 'Configuración',
      subtitle: 'Configurá canales de logs, bienvenida y más para tu servidor',
      commands: [
        {
          name: '/config set-welcome',
          description: 'Configura el canal para mensajes de bienvenida.',
          adminOnly: true,
          params: [
            { name: 'canal', type: 'channel', required: true, description: 'Canal donde se enviará el mensaje de bienvenida' }
          ],
          expectedOutput: '✅ Canal de bienvenida configurado.'
        },
        {
          name: '/config set-voice-log',
          description: 'Configura el canal para registrar entrada/salida de canales de voz.',
          adminOnly: true,
          params: [
            { name: 'canal', type: 'channel', required: true, description: 'Canal donde se registrarán los logs de voz' }
          ],
          expectedOutput: '✅ Canal de logs de voz configurado.'
        },
        {
          name: '/config set-message-log',
          description: 'Configura el canal para registrar mensajes editados y eliminados.',
          adminOnly: true,
          params: [
            { name: 'canal', type: 'channel', required: true, description: 'Canal donde se registrarán los logs de mensajes' }
          ],
          expectedOutput: '✅ Canal de logs de mensajes configurado.'
        },
        {
          name: '/config set-image-channel',
          description: 'Configura el canal para reenviar imágenes automáticamente.',
          adminOnly: true,
          params: [
            { name: 'canal', type: 'channel', required: true, description: 'Canal donde se reenviarán las imágenes' }
          ],
          expectedOutput: '✅ Canal de reenvío de imágenes configurado.'
        },
        {
          name: '/config show',
          description: 'Muestra la configuración actual del servidor.',
          adminOnly: false,
          params: [
            { name: 'publico', type: 'boolean', required: false, description: '¿Mostrar públicamente?' }
          ],
          expectedOutput: '⚙️ **Configuración del Servidor**\nBienvenida: #general\nLogs de voz: #logs\n...'
        },
        {
          name: '/config remove',
          description: 'Elimina toda la configuración del servidor.',
          adminOnly: true,
          params: [],
          expectedOutput: '🗑️ Configuración del servidor eliminada.'
        }
      ],
      cards: [
        {
          icon: '📊',
          title: 'Logs Automáticos',
          description: 'El bot registra automáticamente mensajes eliminados, ediciones, entradas, salidas y cambios de roles en los canales configurados.'
        }
      ]
    },
    {
      icon: Shield,
      name: 'AutoRole',
      subtitle: 'Asigna roles automáticamente con reacciones o botones',
      commands: [
        {
          name: '/autorole setup',
          description: 'Configura un mensaje con botones o reacciones para asignar roles automáticamente.',
          adminOnly: true,
          params: [
            { name: 'message_id', type: 'string', required: false, description: 'ID del mensaje existente (opcional)' },
            { name: 'canal', type: 'channel', required: false, description: 'Canal donde se enviará el mensaje (si no usás message_id)' }
          ],
          expectedOutput: '✅ Mensaje de autorole creado con botones de roles.'
        },
        {
          name: '/autorole listar',
          description: 'Lista todos los mensajes de autorole configurados en el servidor.',
          adminOnly: true,
          params: [],
          expectedOutput: '📋 **AutoRole configurado**\nMensaje ID: 123456789\nRoles: @Verde, @Azul'
        },
        {
          name: '/autorole editar',
          description: 'Edita el mensaje, rol o botones de un autorole existente.',
          adminOnly: true,
          params: [
            { name: 'message_id', type: 'string', required: true, description: 'ID del mensaje a editar' }
          ],
          expectedOutput: '✏️ Autorole editado correctamente.'
        },
        {
          name: '/autorole remover',
          description: 'Elimina un mensaje de autorole y su configuración.',
          adminOnly: true,
          params: [
            { name: 'message_id', type: 'string', required: true, description: 'ID del mensaje a eliminar' }
          ],
          expectedOutput: '🗑️ Autorole eliminado.'
        }
      ]
    },
    {
      icon: Shield,
      name: 'Verificación',
      subtitle: 'Sistema de verificación de usuarios con panel y revisión manual',
      commands: [
        {
          name: '/verificacion setup',
          description: 'Configura el sistema de verificación con canal, rol y canales de log.',
          adminOnly: true,
          params: [
            { name: 'verification-channel', type: 'channel', required: true, description: 'Canal donde se mostrará el botón de verificación' },
            { name: 'log-channel', type: 'channel', required: true, description: 'Canal donde se registrarán las verificaciones' },
            { name: 'verified-role', type: 'role', required: true, description: 'Rol que se asignará a los usuarios verificados' }
          ],
          expectedOutput: '✅ Sistema de verificación configurado.'
        },
        {
          name: '/verificacion panel',
          description: 'Envía el panel de verificación al canal configurado.',
          adminOnly: true,
          params: [],
          expectedOutput: '📋 Panel de verificación enviado al canal.'
        },
        {
          name: '/verificacion pendientes',
          description: 'Lista todas las solicitudes de verificación pendientes de revisión.',
          adminOnly: true,
          params: [],
          expectedOutput: '📝 **Solicitudes pendientes**\n1. @usuario1 — hace 2 horas\n2. @usuario2 — hace 5 horas'
        }
      ]
    },
    {
      icon: Wrench,
      name: 'Utilidades',
      subtitle: 'Herramientas prácticas para personalizar el bot',
      commands: [
        {
          name: '/ping',
          description: 'Verifica el estado y latencia del bot.',
          adminOnly: false,
          params: [],
          expectedOutput: '📡 Latencia: 42ms\n🌐 API: 28ms\n✅ Estado: En línea'
        },
        {
          name: '/guild-avatar server',
          description: 'Establece el avatar del bot con el ícono actual del servidor.',
          adminOnly: true,
          params: [],
          expectedOutput: '✅ Avatar del bot actualizado al ícono del servidor.'
        },
        {
          name: '/guild-avatar custom',
          description: 'Establece un avatar personalizado para el bot subiendo una imagen.',
          adminOnly: true,
          params: [
            { name: 'imagen', type: 'attachment', required: true, description: 'La imagen para usar como avatar (PNG, JPG o GIF)' }
          ],
          expectedOutput: '✅ Avatar del bot actualizado a la imagen personalizada.'
        },
        {
          name: '/guild-avatar reset',
          description: 'Elimina el avatar del servidor y vuelve al avatar global del bot.',
          adminOnly: true,
          params: [],
          expectedOutput: '✅ Avatar del servidor eliminado. Volviendo al avatar global.'
        },
        {
          name: '/nickname server',
          description: 'Establece el apodo del bot con el nombre actual del servidor.',
          adminOnly: true,
          params: [],
          expectedOutput: '✅ Apodo del bot establecido al nombre del servidor.'
        },
        {
          name: '/nickname custom',
          description: 'Establece un apodo personalizado para el bot.',
          adminOnly: true,
          params: [
            { name: 'nombre', type: 'string', required: true, description: 'El nuevo apodo para el bot (máx. 32 caracteres)' }
          ],
          expectedOutput: '✅ Apodo del bot cambiado a: [nombre].'
        }
      ]
    }
  ];

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.selectedModule.set(this.modules[0]);
  }

  onModuleChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const found = this.modules.find(m => m.name === select.value);
    if (found) {
      this.selectedModule.set(found);
    }
  }

  copyCommand(name: string): void {
    if (this.isBrowser) {
      navigator.clipboard.writeText(name).then(() => {
        this.copiedCommand.set(name);
        setTimeout(() => this.copiedCommand.set(null), 2000);
      }).catch(() => {});
    }
  }
}
