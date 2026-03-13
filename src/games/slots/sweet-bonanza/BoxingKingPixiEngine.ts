/**
 * Boxing King PixiJS/WebGL Engine — Jili-style professional slot
 * GSAP animations, cell frames, win glow, knockout effects
 */
import { Application, Assets, Sprite, Container, Graphics } from 'pixi.js';
import gsap from 'gsap';

const ROWS = 3;
const COLS = 5;

export interface SimpleSymbol {
  id: string;
  isWild: boolean;
  isScatter: boolean;
}

export interface BoxingKingPixiEngineCallbacks {
  onSpinComplete?: () => void;
  onCascadeStep?: (step: number) => void;
}

const SYMBOL_IDS = ['boxer', 'gloves', 'trophy', 'A', 'K', 'Q', 'J', '10', 'wild', 'scatter'];

export class BoxingKingPixiEngine {
  private app!: Application;
  private container!: HTMLDivElement;
  private symbolTextures: Record<string, import('pixi.js').Texture> = {};
  private gridSprites: Sprite[][] = [];
  private gridContainer!: Container;
  private cellWidth = 0;
  private cellHeight = 0;
  private gap = 4;
  private callbacks: BoxingKingPixiEngineCallbacks = {};
  private isSpinning = false;
  private spinReelOffsets: number[] = [];
  private spinTargets: number[] = [];
  private cascadeAnimating = false;

  async init(containerEl: HTMLDivElement, assetUrls: Record<string, string>): Promise<void> {
    this.container = containerEl;
    const rect = containerEl.getBoundingClientRect();
    const w = Math.min(rect.width || 400, 480);
    const h = Math.min(rect.height || 300, 360);

    this.cellWidth = (w - this.gap * (COLS + 1)) / COLS;
    this.cellHeight = (h - this.gap * (ROWS + 1)) / ROWS;

    this.app = new Application();
    await this.app.init({
      background: 0x050810,
      width: w,
      height: h,
      antialias: true,
      resolution: Math.min(2.5, window.devicePixelRatio || 1),
      autoDensity: true,
      resizeTo: containerEl,
    });

    containerEl.innerHTML = '';
    containerEl.appendChild(this.app.canvas);

    // Load textures
    for (const [id, url] of Object.entries(assetUrls)) {
      try {
        const tex = await Assets.load(url);
        this.symbolTextures[id] = tex;
      } catch {
        console.warn('Failed to load symbol:', id, url);
      }
    }

    // Fallback: use first loaded texture for missing
    const fallback = Object.values(this.symbolTextures)[0];
    if (fallback) {
      for (const id of SYMBOL_IDS) {
        if (!this.symbolTextures[id]) this.symbolTextures[id] = fallback;
      }
    }

    this.gridContainer = new Container();
    this.app.stage.addChild(this.gridContainer);

    // Jili-style: cell frames (dark inner + gold border)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const frame = new Graphics();
        const x = this.gap + c * (this.cellWidth + this.gap);
        const y = this.gap + r * (this.cellHeight + this.gap);
        // Inner dark (arena cell feel)
        frame.roundRect(x + 2, y + 2, this.cellWidth - 4, this.cellHeight - 4, 6);
        frame.fill(0x0d1520);
        // Gold border (2px)
        frame.roundRect(x, y, this.cellWidth, this.cellHeight, 8);
        frame.stroke({ width: 2, color: 0xc9a227 });
        this.gridContainer.addChild(frame);
      }
    }

    // Create symbol sprites
    const maxW = this.cellWidth - 8;
    const maxH = this.cellHeight - 8;
    for (let r = 0; r < ROWS; r++) {
      this.gridSprites[r] = [];
      for (let c = 0; c < COLS; c++) {
        const sprite = new Sprite(fallback || this.symbolTextures['boxer']);
        sprite.anchor.set(0.5);
        this.scaleSpriteToCell(sprite);
        sprite.x = this.gap + c * (this.cellWidth + this.gap) + this.cellWidth / 2;
        sprite.y = this.gap + r * (this.cellHeight + this.gap) + this.cellHeight / 2;
        this.gridContainer.addChild(sprite);
        this.gridSprites[r][c] = sprite;
      }
    }

    this.app.stage.eventMode = 'static';
  }

  setCallbacks(cb: BoxingKingPixiEngineCallbacks): void {
    this.callbacks = { ...this.callbacks, ...cb };
  }

  private getTexture(sym: SimpleSymbol): import('pixi.js').Texture {
    return this.symbolTextures[sym.id] || this.symbolTextures['boxer']!;
  }

  private addWinBurst(x: number, y: number): void {
    const burst = new Graphics();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 12 + Math.random() * 8;
      const bx = x + Math.cos(angle) * dist;
      const by = y + Math.sin(angle) * dist;
      burst.circle(bx, by, 4);
      burst.fill(0xffdd44);
    }
    this.gridContainer.addChild(burst);
    gsap.to(burst.scale, { x: 2.5, y: 2.5, duration: 0.5, ease: 'power2.out' });
    gsap.to(burst, {
      alpha: 0,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => {
        if (burst.parent) this.gridContainer.removeChild(burst);
      },
    });
  }

  /** Fling + blast: winning symbols fly outward and explode (use clone so original stays for cascade) */
  private addFlingBlast(sprite: Sprite, centerX: number, centerY: number): void {
    const clone = new Sprite(sprite.texture);
    clone.anchor.set(0.5);
    clone.x = sprite.x;
    clone.y = sprite.y;
    clone.scale.copyFrom(sprite.scale);
    clone.alpha = 1;
    this.gridContainer.addChild(clone);
    sprite.alpha = 0;

    const dx = sprite.x - centerX;
    const dy = sprite.y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;
    const flingDist = 70 + Math.random() * 50;
    const targetX = clone.x + dirX * flingDist + (Math.random() - 0.5) * 25;
    const targetY = clone.y + dirY * flingDist + (Math.random() - 0.5) * 25;

    gsap.to(clone, {
      x: targetX,
      y: targetY,
      alpha: 0,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: () => {
        if (clone.parent) this.gridContainer.removeChild(clone);
      },
    });
    gsap.to(clone.scale, {
      x: clone.scale.x * 1.4,
      y: clone.scale.y * 1.4,
      duration: 0.4,
      ease: 'power2.in',
    });
    gsap.to(clone, {
      rotation: (Math.random() - 0.5) * 0.6,
      duration: 0.4,
      ease: 'power2.in',
    });

    this.addWinBurst(sprite.x, sprite.y);
    for (let i = 0; i < 6; i++) {
      const p = new Graphics();
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
      const r = 25 + Math.random() * 25;
      p.circle(0, 0, 4);
      p.fill(0xffdd44);
      p.x = sprite.x;
      p.y = sprite.y;
      this.gridContainer.addChild(p);
      const targetX = sprite.x + Math.cos(angle) * r;
      const targetY = sprite.y + Math.sin(angle) * r;
      gsap.to(p, {
        x: targetX,
        y: targetY,
        alpha: 0,
        duration: 0.4,
        ease: 'power2.out',
        onComplete: () => {
          if (p.parent) this.gridContainer.removeChild(p);
        },
      });
    }
  }

  private getBaseScale(sprite: Sprite): number {
    const maxW = this.cellWidth - 8;
    const maxH = this.cellHeight - 8;
    const tex = sprite.texture;
    const origW = (tex as any)?.orig?.width ?? (tex as any)?.width ?? 64;
    const origH = (tex as any)?.orig?.height ?? (tex as any)?.height ?? 64;
    const scaleX = maxW / origW;
    const scaleY = maxH / origH;
    return Math.min(scaleX, scaleY, 1.2);
  }

  private scaleSpriteToCell(sprite: Sprite): void {
    const scale = this.getBaseScale(sprite);
    sprite.scale.set(scale);
  }

  setGrid(grid: SimpleSymbol[][]): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const sym = grid[r]?.[c];
        if (sym && this.gridSprites[r]?.[c]) {
          const sprite = this.gridSprites[r][c];
          sprite.texture = this.getTexture(sym);
          sprite.alpha = 1;
          this.scaleSpriteToCell(sprite);
        }
      }
    }
  }

  async spinToGrid(grid: SimpleSymbol[][], turbo = false): Promise<void> {
    if (this.isSpinning) return;
    this.isSpinning = true;

    const duration = turbo ? 0.35 : 0.5;
    const colDelay = turbo ? 0.015 : 0.035;
    const randomSym = (): SimpleSymbol => ({
      id: SYMBOL_IDS[Math.floor(Math.random() * 8)],
      isWild: false,
      isScatter: false,
    });

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        this.gridSprites[r][c].texture = this.getTexture(randomSym());
      }
    }

    const cycleInterval = setInterval(() => {
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          this.gridSprites[r][c].texture = this.getTexture(randomSym());
        }
      }
    }, turbo ? 30 : 45);

    const tl = gsap.timeline({
      onComplete: () => {
        clearInterval(cycleInterval);
        this.setGrid(grid);
        this.isSpinning = false;
        this.callbacks.onSpinComplete?.();
      },
    });

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const sprite = this.gridSprites[r][c];
        const baseY = this.gap + r * (this.cellHeight + this.gap) + this.cellHeight / 2;
        const baseScale = this.getBaseScale(sprite);
        sprite.y = baseY + this.cellHeight * 0.6;
        sprite.alpha = 0.65;
        sprite.scale.set(baseScale * 0.92);
        tl.to(
          sprite,
          {
            y: baseY,
            alpha: 1,
            duration,
            ease: 'back.out(1.2)',
            overwrite: true,
          },
          c * colDelay
        );
        tl.to(
          sprite.scale,
          { x: baseScale, y: baseScale, duration, ease: 'back.out(1.2)' },
          c * colDelay
        );
      }
    }

    const totalTime = (COLS - 1) * colDelay + duration;
    await new Promise((r) => setTimeout(r, totalTime * 1000 + 50));
  }

  async playCascadeWin(winPositions: Set<string>, newGrid: SimpleSymbol[][], turbo = false): Promise<void> {
    if (this.cascadeAnimating) return;
    this.cascadeAnimating = true;

    const duration = turbo ? 0.08 : 0.13;
    const delay = turbo ? 0.04 : 0.12;
    const flingDuration = 0.4;

    // Grid center for fling direction
    const centerX = this.gap + 2 * (this.cellWidth + this.gap) + this.cellWidth / 2;
    const centerY = this.gap + 1 * (this.cellHeight + this.gap) + this.cellHeight / 2;

    // Fling + blast: winning symbols fly outward and explode
    for (const pos of winPositions) {
      const [r, c] = pos.split('-').map(Number);
      const sprite = this.gridSprites[r]?.[c];
      if (sprite) {
        sprite.alpha = 1;
        this.scaleSpriteToCell(sprite);
        this.addFlingBlast(sprite, centerX, centerY);
      }
    }

    await new Promise((r) => setTimeout(r, flingDuration * 1000));

    // Cascade fall (GSAP)
    const startY = this.gap + (this.cellHeight + this.gap) / 2 - 30;
    const promises: Promise<void>[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const sym = newGrid[r]?.[c];
        if (sym && this.gridSprites[r]?.[c]) {
          const sprite = this.gridSprites[r][c];
          sprite.texture = this.getTexture(sym);
          this.scaleSpriteToCell(sprite);
          sprite.y = startY;
          sprite.alpha = 0;
          const endY = this.gap + r * (this.cellHeight + this.gap) + this.cellHeight / 2;
          promises.push(
            new Promise<void>((resolve) => {
              gsap.to(sprite, {
                y: endY,
                alpha: 1,
                duration,
                delay: r * 0.02,
                ease: 'power2.out',
                onComplete: () => resolve(),
              });
            })
          );
        }
      }
    }

    await Promise.all(promises);
    this.setGrid(newGrid);
    this.cascadeAnimating = false;
    this.callbacks.onCascadeStep?.(0);
    await new Promise((r) => setTimeout(r, delay * 1000));
  }

  highlightScatter(positions: Set<string>): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key = `${r}-${c}`;
        const sprite = this.gridSprites[r][c];
        if (sprite) {
          sprite.tint = positions.has(key) ? 0xffdd44 : 0xffffff;
        }
      }
    }
  }

  resetTint(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.gridSprites[r][c].tint = 0xffffff;
      }
    }
  }

  destroy(): void {
    gsap.killTweensOf(this.gridSprites.flat());
    this.app?.destroy(true, { children: true });
  }
}
