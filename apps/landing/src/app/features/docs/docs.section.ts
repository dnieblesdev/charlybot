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
          name: '/play',
          description: 'Reproduce una canción desde YouTube o Spotify. Busca automáticamente si no se proporciona una URL exacta.',
          adminOnly: false,
          params: [
            { name: 'canción', type: 'string', required: true, description: 'Nombre de la canción o URL de YouTube/Spotify' }
          ],
          expectedOutput: '🎵 Reproduciendo ahora: [Nombre de la canción] • Solicitado por @usuario'
        },
        {
          name: '/skip',
          description: 'Salta la canción actual y pasa a la siguiente en la cola.',
          adminOnly: false,
          params: [],
          expectedOutput: '⏭️ Canción saltada. Ahora suena: [Siguiente canción]'
        },
        {
          name: '/queue',
          description: 'Muestra las canciones en la cola de reproducción actual.',
          adminOnly: false,
          params: [],
          expectedOutput: '📋 Cola de reproducción (5/20):\n1. Canción A\n2. Canción B\n...'
        },
        {
          name: '/pause',
          description: 'Pausa la reproducción actual.',
          adminOnly: false,
          params: [],
          expectedOutput: '⏸️ Reproducción pausada. Usá /resume para continuar.'
        },
        {
          name: '/volume',
          description: 'Ajusta el volumen del reproductor entre 0 y 100.',
          adminOnly: false,
          params: [
            { name: 'nivel', type: 'number', required: true, description: 'Volumen deseado (0-100)' }
          ],
          expectedOutput: '🔊 Volumen ajustado a 75%'
        }
      ]
    },
    {
      icon: Shield,
      name: 'Moderación',
      subtitle: 'Mantené tu servidor seguro y ordenado',
      commands: [
        {
          name: '/warn',
          description: 'Envía una advertencia a un usuario. Se registra en los logs del servidor.',
          adminOnly: true,
          params: [
            { name: 'usuario', type: 'user', required: true, description: 'Usuario a advertir' },
            { name: 'razón', type: 'string', required: false, description: 'Motivo de la advertencia' }
          ],
          expectedOutput: '⚠️ @usuario ha sido advertido. Razón: Lenguaje inapropiado'
        },
        {
          name: '/clear',
          description: 'Elimina una cantidad específica de mensajes del canal actual.',
          adminOnly: true,
          params: [
            { name: 'cantidad', type: 'number', required: true, description: 'Número de mensajes a borrar (1-100)' }
          ],
          expectedOutput: '🧹 42 mensajes eliminados del canal.'
        },
        {
          name: '/ban',
          description: 'Banea permanentemente a un usuario del servidor.',
          adminOnly: true,
          params: [
            { name: 'usuario', type: 'user', required: true, description: 'Usuario a banear' },
            { name: 'razón', type: 'string', required: false, description: 'Motivo del ban' }
          ],
          expectedOutput: '🔨 @usuario ha sido baneado del servidor. Razón: Spam repetido'
        },
        {
          name: '/timeout',
          description: 'Aísla temporalmente a un usuario impidiéndole interactuar.',
          adminOnly: true,
          params: [
            { name: 'usuario', type: 'user', required: true, description: 'Usuario a aislar' },
            { name: 'duración', type: 'string', required: true, description: 'Duración (ej: 10m, 1h, 1d)' }
          ],
          expectedOutput: '🔇 @usuario ha sido silenciado por 1 hora.'
        },
        {
          name: '/kick',
          description: 'Expulsa a un usuario del servidor. Puede volver a unirse con una nueva invitación.',
          adminOnly: true,
          params: [
            { name: 'usuario', type: 'user', required: true, description: 'Usuario a expulsar' },
            { name: 'razón', type: 'string', required: false, description: 'Motivo de la expulsión' }
          ],
          expectedOutput: '👢 @usuario ha sido expulsado. Razón: Comportamiento inadecuado'
        }
      ],
      cards: [
        {
          icon: '📊',
          title: 'Logs Automáticos',
          description: 'CharlyBot registra automáticamente mensajes eliminados, ediciones, entradas, salidas y cambios de roles. Todo queda documentado en el canal de logs que configures.'
        },
        {
          icon: '🛡️',
          title: 'Auto-Moderación',
          description: 'Configurá filtros automáticos para palabras prohibidas, spam de menciones, enlaces maliciosos y flood de mensajes. El bot actúa sin intervención manual.'
        }
      ]
    },
    {
      icon: Coins,
      name: 'Economía',
      subtitle: 'Sistema de monedas virtuales con trabajos, tienda y más',
      commands: [
        {
          name: '/daily',
          description: 'Reclama tu recompensa diaria de monedas. Se reinicia cada 24 horas.',
          adminOnly: false,
          params: [],
          expectedOutput: '💰 ¡Recompensa diaria reclamada! +200 monedas. Racha actual: 5 días 🔥'
        },
        {
          name: '/balance',
          description: 'Consulta tu balance actual de monedas o el de otro usuario.',
          adminOnly: false,
          params: [
            { name: 'usuario', type: 'user', required: false, description: 'Usuario a consultar (opcional, por defecto vos)' }
          ],
          expectedOutput: '💳 Balance de @usuario: 12,450 monedas | Banco: 5,000 monedas'
        },
        {
          name: '/shop',
          description: 'Abre la tienda del servidor donde podés comprar items y roles.',
          adminOnly: false,
          params: [],
          expectedOutput: '🏪 **Tienda del Servidor**\n1. 🎨 Color de nombre (500 monedas)\n2. 📛 Rol personalizado (2000 monedas)\n...'
        },
        {
          name: '/pay',
          description: 'Transfiere monedas a otro usuario.',
          adminOnly: false,
          params: [
            { name: 'usuario', type: 'user', required: true, description: 'Destinatario' },
            { name: 'cantidad', type: 'number', required: true, description: 'Cantidad de monedas' }
          ],
          expectedOutput: '💸 Transferiste 500 monedas a @usuario. Tu nuevo balance: 11,950 monedas.'
        },
        {
          name: '/work',
          description: 'Trabaja para ganar monedas. Hay distintos trabajos disponibles según tu nivel.',
          adminOnly: false,
          params: [],
          expectedOutput: '👷 Trabajaste como Programador y ganaste 350 monedas. Tu balance: 12,300 monedas.'
        },
        {
          name: '/give-coins',
          description: 'Otorga monedas a un usuario. Solo disponible para administradores.',
          adminOnly: true,
          params: [
            { name: 'usuario', type: 'user', required: true, description: 'Usuario que recibe las monedas' },
            { name: 'cantidad', type: 'number', required: true, description: 'Cantidad de monedas a otorgar' }
          ],
          expectedOutput: '🎁 @admin otorgó 1000 monedas a @usuario.'
        }
      ]
    },
    {
      icon: Wrench,
      name: 'Utilidades',
      subtitle: 'Herramientas prácticas para el día a día de tu servidor',
      commands: [
        {
          name: '/ping',
          description: 'Muestra la latencia del bot y el tiempo de respuesta de la API de Discord.',
          adminOnly: false,
          params: [],
          expectedOutput: '🏓 Pong! Latencia: 42ms | API: 28ms'
        },
        {
          name: '/avatar',
          description: 'Muestra el avatar de un usuario en tamaño completo.',
          adminOnly: false,
          params: [
            { name: 'usuario', type: 'user', required: false, description: 'Usuario cuyo avatar querés ver' }
          ],
          expectedOutput: '[Imagen del avatar de @usuario en tamaño completo]'
        },
        {
          name: '/serverinfo',
          description: 'Muestra información detallada del servidor actual.',
          adminOnly: false,
          params: [],
          expectedOutput: '📊 **Servidor**\nMiembros: 1,234 | Canales: 45 | Roles: 12 | Creado: 15/03/2023'
        },
        {
          name: '/help',
          description: 'Muestra la lista de comandos disponibles o información sobre un comando específico.',
          adminOnly: false,
          params: [
            { name: 'comando', type: 'string', required: false, description: 'Comando del que querés más info' }
          ],
          expectedOutput: '📚 **Ayuda de CharlyBot**\nUsá /help [comando] para detalles específicos.\nCategorías: Música, Moderación, Economía...'
        }
      ]
    },
    {
      icon: Gamepad2,
      name: 'Diversión',
      subtitle: 'Juegos, niveles, duelos y sistemas RPG para tu comunidad',
      commands: [
        {
          name: '/duel',
          description: 'Desafía a otro usuario a un duelo. El resultado depende de las stats de cada jugador.',
          adminOnly: false,
          params: [
            { name: 'usuario', type: 'user', required: true, description: 'Usuario a desafiar' }
          ],
          expectedOutput: '⚔️ @usuario1 (❤️ 85/100) vs @usuario2 (❤️ 42/100) — ¡@usuario1 gana el duelo!'
        },
        {
          name: '/level',
          description: 'Muestra tu nivel actual, XP y progreso hacia el siguiente nivel.',
          adminOnly: false,
          params: [
            { name: 'usuario', type: 'user', required: false, description: 'Usuario a consultar' }
          ],
          expectedOutput: '⭐ @usuario — Nivel 24 | XP: 4,520/5,000 | ████████░░ 90%'
        },
        {
          name: '/rank',
          description: 'Muestra el ranking de niveles del servidor.',
          adminOnly: false,
          params: [],
          expectedOutput: '🏆 **Top 5 del Servidor**\n1. @usuarioA — Nivel 42\n2. @usuarioB — Nivel 38\n...'
        },
        {
          name: '/rpg',
          description: 'Accede a tu perfil RPG con clase, stats y habilidades especiales.',
          adminOnly: false,
          params: [],
          expectedOutput: '🧙 @usuario — Clase: Mago Nv.15\nATK: 42 | DEF: 28 | MAG: 65\nHabilidades: Bola de Fuego, Teleport'
        },
        {
          name: '/achievements',
          description: 'Muestra tus logros desbloqueados. También podés consultar los de otro usuario.',
          adminOnly: false,
          params: [
            { name: 'usuario', type: 'user', required: false, description: 'Usuario a consultar (opcional, por defecto vos)' }
          ],
          expectedOutput: '🏅 Logros de @usuario (12/30):\n✅ Primer duelo\n✅ Racha de 7 días\n🔒 Coleccionista (falta 1 ítem)'
        }
      ],
      cards: [
        {
          icon: '🎭',
          title: 'Sistema de Clases',
          description: 'El sistema RPG incluye 5 clases (Guerrero, Mago, Arquero, Curandero, Asesino) cada una con stats y habilidades únicas. Desbloqueá nuevas habilidades al subir de nivel.'
        },
        {
          icon: '🏅',
          title: 'Logros y Recompensas',
          description: 'Completá logros para ganar recompensas exclusivas. Hay más de 30 logros que abarcan actividad, economía, combate y eventos especiales.'
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
