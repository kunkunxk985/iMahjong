import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  isPrivatePlayerView,
  type ClientView,
  type Tile,
} from '@pizhou/shared';
import { relativeSeat } from '../table/BoardSeats';
import { TileMeshFactory, TILE_H, TILE_W } from './TileGeometry';

export interface Scene3DCallbacks {
  onSelectTile?: (tileId: string) => void;
  onDiscardTile?: (tileId: string) => void;
  onTileHover?: (tileKey: string | null, tileId: string | null) => void;
}

export class MahjongScene3D {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private environmentTarget: THREE.WebGLRenderTarget | null = null;
  private textureLoader = new THREE.TextureLoader();
  /**
   * Every texture this scene created, so destroy() can release them.
   *
   * Textures are referenced from materials rather than from the geometry walk in
   * destroy(), so without this registry the felt/wood surface maps survive every
   * 3D remount. felt-normal.png alone is ~760KB of GPU memory.
   */
  private ownedTextures: THREE.Texture[] = [];
  private camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-999, -999);

  // Scene elements
  private tableGroup = new THREE.Group();
  private handsGroup = new THREE.Group();
  private discardsGroup = new THREE.Group();
  private meldsGroup = new THREE.Group();

  // Interactive meshes
  private handTileMeshes: THREE.Mesh[] = [];
  private hoveredMesh: THREE.Mesh | null = null;
  private selectedTileId: string | null = null;

  private callbacks: Scene3DCallbacks = {};
  private animationFrameId = 0;
  private isDestroyed = false;
  private tiles = new TileMeshFactory();
  private lastView: ClientView | null = null;
  private removeListeners: (() => void) | null = null;

  constructor(container: HTMLElement, callbacks: Scene3DCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x061811); // Deep night jade

    // Camera: ergonomic mahjong perspective looking down at table center
    const aspect = container.clientWidth / container.clientHeight || 16 / 9;
    this.camera = new THREE.PerspectiveCamera(this.fovForAspect(aspect), aspect, 0.1, 1000);
    // A seated player's-eye 3/4 view: low enough that the standing hand tiles
    // read as solid objects with visible side thickness instead of a flat strip,
    // yet high enough to still take in the whole table layout.
    this.camera.position.set(0, 24, 30);
    this.camera.lookAt(0, -1, 4);

    // Renderer with soft shadow maps & PBR tone mapping
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    container.appendChild(this.renderer.domElement);

    // Groups
    this.scene.add(this.tableGroup);
    this.scene.add(this.handsGroup);
    this.scene.add(this.discardsGroup);
    this.scene.add(this.meldsGroup);

    this.setupLighting();
    this.setupTable();
    this.setupEventListeners();

    this.animate = this.animate.bind(this);
    this.animate();
  }

  private setupLighting(): void {
    // Image-based lighting. Without this every PBR surface is lit by analytic
    // lights alone, so the felt reads flat and the tiles lose the soft
    // environment reflection that makes ivory look like ivory. PMREM-prefiltered
    // so roughness responds correctly.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const envRT = pmrem.fromScene(room, 0.04);
    this.scene.environment = envRT.texture;
    // Keep a reference so the render target can be released on destroy.
    this.environmentTarget = envRT;
    pmrem.dispose();
    // RoomEnvironment builds its own meshes. PMREMGenerator does not free the
    // scene it was handed, so those geometries leak unless disposed here — the
    // 3D regression test asserts zero geometries remain after teardown.
    room.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        mats.forEach((material: THREE.Material) => material.dispose());
      }
    });

    // Depth: the felt should fall away toward the rails instead of ending at a
    // hard silhouette. Fog also softens the far tile walls.
    this.scene.fog = new THREE.Fog(0x07231a, 58, 120);

    // Warm gentle ambient. Deliberately low now that IBL carries most of the
    // fill; the directional lights below provide shape and shadows.
    const ambient = new THREE.AmbientLight(0xfff8ee, 0.55);
    this.scene.add(ambient);

    // Main downward spotlight with soft shadow
    const mainSpot = new THREE.DirectionalLight(0xfff6e5, 2.1);
    mainSpot.position.set(0, 38, 14);
    mainSpot.castShadow = true;
    mainSpot.shadow.mapSize.width = 2048;
    mainSpot.shadow.mapSize.height = 2048;
    mainSpot.shadow.camera.near = 10;
    mainSpot.shadow.camera.far = 80;
    const shadowSize = 25;
    mainSpot.shadow.camera.left = -shadowSize;
    mainSpot.shadow.camera.right = shadowSize;
    mainSpot.shadow.camera.top = shadowSize;
    mainSpot.shadow.camera.bottom = -shadowSize;
    mainSpot.shadow.bias = -0.0005;
    this.scene.add(mainSpot);

    // Front fill light (illuminates player's standing tile faces directly)
    const frontFill = new THREE.DirectionalLight(0xfef9c3, 1.4);
    frontFill.position.set(0, 16, 32);
    this.scene.add(frontFill);

    // Back rim light (creates beautiful golden edge rim on tiles)
    const rimLight = new THREE.DirectionalLight(0xa7f3d0, 0.8);
    rimLight.position.set(0, 22, -28);
    this.scene.add(rimLight);
  }

  /**
   * Loads a tiling surface texture with sRGB decode for colour maps and
   * linear data for normal/roughness maps, plus mipmaps and anisotropy so it
   * does not shimmer at the table's grazing angles.
   */
  private loadSurfaceTexture(path: string, repeat: number, srgb: boolean): THREE.Texture {
    const texture = this.textureLoader.load(path);
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
    this.ownedTextures.push(texture);
    return texture;
  }

  private setupTable(): void {
    // Emerald felt. The project already ships a real 1024px felt photograph in
    // public/assets/felt.jpg — it was only ever used by the old CSS table. Tiling
    // it across the surface gives the woven texture and micro-sheen that a flat
    // colour cannot, which is most of the distance to the reference look.
    const feltGeo = new THREE.CylinderGeometry(27.5, 27.5, 0.5, 96);
    const feltMat = new THREE.MeshStandardMaterial({
      color: 0x2a8a63, // Multiplies the texture; carries the emerald hue
      map: this.loadSurfaceTexture('./assets/felt.jpg', 4, true),
      normalMap: this.loadSurfaceTexture('./assets/felt-normal.png', 4, false),
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: this.loadSurfaceTexture('./assets/felt-rough.png', 4, false),
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.5,
    });
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.position.y = -0.25;
    felt.receiveShadow = true;
    this.tableGroup.add(felt);

    // Walnut rail. Same story as the felt: a real wood photograph already ships
    // in public/assets/wood.jpg. Tiled around the rail it gives the grain and
    // the warm specular streak that a flat brown cannot.
    const railGeo = new THREE.CylinderGeometry(29.2, 29.6, 1.3, 96);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x8a5a34, // Tints the wood toward imperial walnut
      map: this.loadSurfaceTexture('./assets/wood.jpg', 6, true),
      roughness: 0.38,
      metalness: 0.06,
      envMapIntensity: 0.7,
    });
    const rail = new THREE.Mesh(railGeo, railMat);
    // Keep the rail top below the felt; coplanar surfaces flicker across the table.
    rail.position.y = -0.95;
    rail.receiveShadow = true;
    this.tableGroup.add(rail);

    // Brass Inlay Ring
    const brassGeo = new THREE.RingGeometry(27.2, 27.6, 64);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xdfb15b,
      metalness: 0.85,
      roughness: 0.22,
    });
    const brassRing = new THREE.Mesh(brassGeo, brassMat);
    brassRing.rotation.x = -Math.PI / 2;
    brassRing.position.y = 0.01;
    this.tableGroup.add(brassRing);
  }

  private setupEventListeners(): void {
    const el = this.container;

    const onPointerMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onClick = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.handTileMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const tileId = hit.userData.tileId as string;
        if (tileId) {
          if (this.selectedTileId === tileId) {
            // Second click on already selected tile = discard
            this.callbacks.onDiscardTile?.(tileId);
          } else {
            this.callbacks.onSelectTile?.(tileId);
          }
        }
      }
    };

    const onPointerLeave = () => {
      this.mouse.set(-999, -999);
      if (this.hoveredMesh) {
        this.hoveredMesh = null;
        this.callbacks.onTileHover?.(null, null);
      }
    };

    el.addEventListener('mousemove', onPointerMove);
    el.addEventListener('click', onClick);
    el.addEventListener('mouseleave', onPointerLeave);

    const onResize = () => {
      if (!this.container || this.isDestroyed) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w === 0 || h === 0) return;
      this.camera.aspect = w / h;
      this.camera.fov = this.fovForAspect(w / h);
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    window.addEventListener('resize', onResize);
    this.removeListeners = () => {
      el.removeEventListener('mousemove', onPointerMove);
      el.removeEventListener('click', onClick);
      el.removeEventListener('mouseleave', onPointerLeave);
      window.removeEventListener('resize', onResize);
    };
  }

  private fovForAspect(aspect: number): number {
    // Preserve the hand's horizontal framing in narrower desktop windows.
    return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(38 / 2)) * Math.max(1, (16 / 9) / aspect)));
  }

  public update(view: ClientView, selectedId: string | null): void {
    this.selectedTileId = selectedId;
    // Selection and hover do not change the server view or require new meshes.
    if (this.lastView === view) return;
    this.lastView = view;
    this.hoveredMesh = null;

    // Clear old dynamic meshes
    while (this.handsGroup.children.length > 0) {
      this.handsGroup.remove(this.handsGroup.children[0]);
    }
    while (this.discardsGroup.children.length > 0) {
      this.discardsGroup.remove(this.discardsGroup.children[0]);
    }
    while (this.meldsGroup.children.length > 0) {
      this.meldsGroup.remove(this.meldsGroup.children[0]);
    }

    this.handTileMeshes = [];

    const mySeat = view.mySeat;
    const me = view.players.find((player) => player.seat === mySeat);

    // 1. Render Own Hand (Bottom)
    if (me && isPrivatePlayerView(me)) {
      this.renderPlayerHand(me.hand, selectedId);
    }

    // 2. Render Opponents' Hands (Standing Tile Backs, Scaled Proportionately)
    view.players.forEach((player) => {
      if (player.seat === mySeat) return;
      const rel = relativeSeat(player.seat, mySeat);
      const count = isPrivatePlayerView(player) ? player.hand.length : player.handCount;
      this.renderOpponentHand(rel, count);
    });

    // 3. Render 4-Way Discard Rivers
    view.players.forEach((player) => {
      const rel = relativeSeat(player.seat, mySeat);
      this.renderDiscardRiver(rel, player.discards, view.lastDiscard?.tile.id);
    });

    // 4. Render Melds
    view.players.forEach((player) => {
      const rel = relativeSeat(player.seat, mySeat);
      this.renderPlayerMelds(rel, player.melds);
    });
  }

  private renderPlayerHand(hand: Tile[], selectedId: string | null): void {
    const count = hand.length;
    if (count === 0) return;

    // Tighter spacing keeps a full 14-tile hand inside the frame at 1280px;
    // the drawn 14th tile still gets its own separating gap below.
    const spacing = TILE_W + 0.02;
    const totalWidth = (count - 1) * spacing;
    const startX = -totalWidth / 2;
    const mid = (count - 1) / 2;

    hand.forEach((tile, index) => {
      const mesh = this.tiles.createTileMesh(tile);
      const isSelected = selectedId === tile.id;

      let posX = startX + index * spacing;
      if (index === count - 1 && count % 3 === 2) {
        // Newly drawn 14th tile is separated by gap
        posX += 0.65;
      }

      const baseY = 1.5; // Resting on the table surface
      // Gentle fan: tiles away from the centre recede toward the player, so the
      // hand arcs like a real held hand instead of a rigid flat strip. The arc
      // lives in Z (not Y) so the hover/select lift animation on baseY is intact.
      const arc = Math.abs(index - mid);
      const posZ = 13.2 + arc * 0.55;
      mesh.position.set(posX, baseY + (isSelected ? 1.4 : 0.0), posZ);
      // Lean the tiles back ~29° so their faces turn up toward the seated
      // player and a sliver of the ivory side edge catches the light — the
      // depth cue a flat, edge-on tile completely lacks.
      mesh.rotation.set(-0.5, 0, 0);

      mesh.userData.baseY = baseY;
      mesh.userData.tileId = tile.id;
      mesh.userData.tileKey = tile.key;

      this.handsGroup.add(mesh);
      this.handTileMeshes.push(mesh);
    });
  }

  private renderOpponentHand(rel: number, count: number): void {
    if (count <= 0) return;
    const oppScale = 0.76; // Clean, elegant scale that never blocks the field
    const spacing = (TILE_W + 0.06) * oppScale;
    const totalWidth = (count - 1) * spacing;
    const startOffset = -totalWidth / 2;

    for (let i = 0; i < count; i += 1) {
      const mesh = this.tiles.createTileMesh(null, true);
      mesh.scale.set(oppScale, oppScale, oppScale);
      const offset = startOffset + i * spacing;

      if (rel === 2) {
        // Top Player (Opposite)
        mesh.position.set(-offset, 1.15, -14.8);
        mesh.rotation.set(0.32, Math.PI, 0);
      } else if (rel === 1) {
        // Right Player
        mesh.position.set(14.8, 1.15, offset);
        mesh.rotation.set(0, -Math.PI / 2, -0.32);
      } else if (rel === 3) {
        // Left Player
        mesh.position.set(-14.8, 1.15, -offset);
        mesh.rotation.set(0, Math.PI / 2, 0.32);
      }

      this.handsGroup.add(mesh);
    }
  }

  private renderDiscardRiver(rel: number, discards: Tile[], lastDiscardId?: string): void {
    if (discards.length === 0) return;

    // Discard rivers lie flat on the felt in the center (6 per row)
    const cols = 6;
    const riverScale = 0.82;
    const spacingX = (TILE_W + 0.08) * riverScale;
    const spacingZ = (TILE_H + 0.08) * riverScale;

    discards.forEach((tile, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      const mesh = this.tiles.createTileMesh(tile);
      mesh.scale.set(riverScale, riverScale, riverScale);
      const isLast = tile.id === lastDiscardId;

      // Lay flat: front face points upward (+Y)
      mesh.rotation.set(-Math.PI / 2, 0, 0);

      // Local grid position
      const localX = (col - 2.5) * spacingX;
      const localZ = row * spacingZ + 2.8;

      // Transform according to seat orientation
      if (rel === 0) {
        mesh.position.set(localX, isLast ? 0.18 : 0.04, localZ);
      } else if (rel === 2) {
        mesh.position.set(-localX, isLast ? 0.18 : 0.04, -localZ);
        mesh.rotation.set(-Math.PI / 2, 0, Math.PI);
      } else if (rel === 1) {
        mesh.position.set(localZ, isLast ? 0.18 : 0.04, localX);
        mesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
      } else if (rel === 3) {
        mesh.position.set(-localZ, isLast ? 0.18 : 0.04, -localX);
        mesh.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      }

      this.discardsGroup.add(mesh);
    });
  }

  private renderPlayerMelds(rel: number, melds: any[]): void {
    if (!melds || melds.length === 0) return;

    const meldScale = 0.8;
    let meldOffset = 0;
    melds.forEach((meld) => {
      meld.tiles?.forEach((tile: Tile, tIndex: number) => {
        const mesh = this.tiles.createTileMesh(tile);
        mesh.scale.set(meldScale, meldScale, meldScale);
        mesh.rotation.set(-Math.PI / 2, 0, 0);

        const spacing = (TILE_W + 0.06) * meldScale;
        const xOffset = -15.5 + meldOffset * 2.8 + tIndex * spacing;

        if (rel === 0) {
          mesh.position.set(xOffset, 0.04, 15.2);
        } else if (rel === 2) {
          mesh.position.set(-xOffset, 0.04, -15.2);
          mesh.rotation.set(-Math.PI / 2, 0, Math.PI);
        } else if (rel === 1) {
          mesh.position.set(15.2, 0.04, xOffset);
          mesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
        } else if (rel === 3) {
          mesh.position.set(-15.2, 0.04, -xOffset);
          mesh.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
        }

        this.meldsGroup.add(mesh);
      });
      meldOffset += 1;
    });
  }

  private animate(): void {
    if (this.isDestroyed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    // Hover Raycasting
    if (this.mouse.x !== -999 && this.handTileMeshes.length > 0) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.handTileMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        if (this.hoveredMesh !== hit) {
          this.hoveredMesh = hit;
          this.callbacks.onTileHover?.(hit.userData.tileKey, hit.userData.tileId);
        }
      } else {
        if (this.hoveredMesh) {
          this.hoveredMesh = null;
          this.callbacks.onTileHover?.(null, null);
        }
      }
    }

    // Smooth hover/select elevation interpolation based on baseY (CRITICAL FIX!)
    this.handTileMeshes.forEach((mesh) => {
      const isHovered = mesh === this.hoveredMesh;
      const isSelected = mesh.userData.tileId === this.selectedTileId;
      const baseY = mesh.userData.baseY ?? 1.5;
      const lift = isSelected ? 1.4 : isHovered ? 0.7 : 0.0;
      const targetY = baseY + lift;
      mesh.position.y += (targetY - mesh.position.y) * 0.25;
    });

    this.renderer.render(this.scene, this.camera);
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.removeListeners?.();
    this.removeListeners = null;
    cancelAnimationFrame(this.animationFrameId);
    this.tableGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material: THREE.Material) => material.dispose());
      }
    });
    this.scene.traverse((object) => {
      if (object instanceof THREE.DirectionalLight) {
        object.shadow.map?.dispose();
        object.shadow.map = null;
        object.shadow.dispose();
      }
    });
    this.tiles.dispose();
    // TileMeshFactory.dispose() releases its own cached tile textures; these are
    // the table surface maps (felt colour/normal/roughness + wood grain), which
    // hang off materials and are missed by the geometry walk above.
    for (const texture of this.ownedTextures) texture.dispose();
    this.ownedTextures = [];
    // The PMREM environment render target is not part of the scene graph, so
    // scene.clear() will not release its GPU memory. The 3D regression test
    // asserts retired WebGL contexts are freed, so release it explicitly.
    this.environmentTarget?.dispose();
    this.environmentTarget = null;
    this.scene.environment = null;
    this.scene.clear();
    this.handTileMeshes = [];
    this.hoveredMesh = null;
    this.lastView = null;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
