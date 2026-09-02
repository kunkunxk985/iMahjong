import * as THREE from 'three';
import {
  isPrivatePlayerView,
  type ClientView,
  type Tile,
} from '@pizhou/shared';
import { relativeSeat } from '../table/BoardSeats';
import { createTileMesh, TILE_H, TILE_W } from './TileGeometry';

export interface Scene3DCallbacks {
  onSelectTile?: (tileId: string) => void;
  onDiscardTile?: (tileId: string) => void;
  onTileHover?: (tileKey: string | null, tileId: string | null) => void;
}

export class MahjongScene3D {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
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

  constructor(container: HTMLElement, callbacks: Scene3DCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x061811); // Deep night jade

    // Camera: high perspective angled down at ~50 degrees
    const aspect = container.clientWidth / container.clientHeight || 16 / 9;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
    this.camera.position.set(0, 32, 28);
    this.camera.lookAt(0, -2, 0);

    // Renderer with soft shadow maps & PBR tone mapping
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

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
    // Warm gentle ambient
    const ambient = new THREE.AmbientLight(0xfff8ee, 1.3);
    this.scene.add(ambient);

    // Main downward spotlight with soft shadow
    const mainSpot = new THREE.DirectionalLight(0xfff6e5, 2.4);
    mainSpot.position.set(0, 40, 15);
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

    // Front fill light (lights up player's standing tile front faces)
    const frontFill = new THREE.DirectionalLight(0xbbf7d0, 1.2);
    frontFill.position.set(0, 12, 35);
    this.scene.add(frontFill);

    // Back rim light
    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.6);
    rimLight.position.set(0, 20, -30);
    this.scene.add(rimLight);
  }

  private setupTable(): void {
    // 3D Emerald Felt Playing Surface
    const feltGeo = new THREE.CylinderGeometry(28, 28, 0.5, 64);
    const feltMat = new THREE.MeshStandardMaterial({
      color: 0x0c3725, // Deep emerald felt
      roughness: 0.85,
      metalness: 0.02,
    });
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.position.y = -0.25;
    felt.receiveShadow = true;
    this.tableGroup.add(felt);

    // Walnut Wooden Beveled Rail
    const railGeo = new THREE.CylinderGeometry(29.5, 29.8, 1.2, 64);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x22130a, // Dark walnut
      roughness: 0.45,
      metalness: 0.15,
    });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.y = -0.6;
    rail.receiveShadow = true;
    this.tableGroup.add(rail);

    // Brass Inlay Ring
    const brassGeo = new THREE.RingGeometry(27.8, 28.1, 64);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xdfb15b,
      metalness: 0.85,
      roughness: 0.25,
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
            // Second click on already selected tile = discard intent
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
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    window.addEventListener('resize', onResize);
  }

  public update(view: ClientView, selectedId: string | null): void {
    this.selectedTileId = selectedId;

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
    const me = view.players[mySeat];

    // 1. Render Own Hand (Bottom)
    if (me && isPrivatePlayerView(me)) {
      this.renderPlayerHand(me.hand, selectedId);
    }

    // 2. Render Opponents' Hands (Standing Tile Backs)
    view.players.forEach((player) => {
      if (player.seat === mySeat) return;
      const rel = relativeSeat(player.seat, mySeat);
      const count = isPrivatePlayerView(player) ? player.hand.length : 13;
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

    const spacing = TILE_W + 0.12;
    const totalWidth = (count - 1) * spacing;
    const startX = -totalWidth / 2;

    hand.forEach((tile, index) => {
      const mesh = createTileMesh(tile);
      const isSelected = selectedId === tile.id;

      // Base standing position: tilted backward 12 degrees facing player
      let posX = startX + index * spacing;
      if (index === count - 1 && count % 3 === 2) {
        // Newly drawn 14th tile is separated by gap
        posX += 0.6;
      }

      mesh.position.set(posX, isSelected ? 1.0 : 0.0, 16.5);
      mesh.rotation.set(-0.21, 0, 0); // Slight backward tilt

      mesh.userData.baseY = isSelected ? 1.0 : 0.0;
      mesh.userData.tileId = tile.id;
      mesh.userData.tileKey = tile.key;

      this.handsGroup.add(mesh);
      this.handTileMeshes.push(mesh);
    });
  }

  private renderOpponentHand(rel: number, count: number): void {
    if (count <= 0) return;
    const spacing = TILE_W + 0.08;
    const totalWidth = (count - 1) * spacing;
    const startOffset = -totalWidth / 2;

    for (let i = 0; i < count; i += 1) {
      const mesh = createTileMesh(null, true);
      const offset = startOffset + i * spacing;

      if (rel === 2) {
        // Top Player (Opposite)
        mesh.position.set(-offset, 0, -16.5);
        mesh.rotation.set(0.21, Math.PI, 0); // Facing player with green back
      } else if (rel === 1) {
        // Right Player
        mesh.position.set(16.5, 0, offset);
        mesh.rotation.set(0, -Math.PI / 2, -0.21);
      } else if (rel === 3) {
        // Left Player
        mesh.position.set(-16.5, 0, -offset);
        mesh.rotation.set(0, Math.PI / 2, 0.21);
      }

      this.handsGroup.add(mesh);
    }
  }

  private renderDiscardRiver(rel: number, discards: Tile[], lastDiscardId?: string): void {
    if (discards.length === 0) return;

    // Discard rivers lie flat on the felt in the center (6 per row)
    const cols = 6;
    const spacingX = TILE_W + 0.08;
    const spacingZ = TILE_H + 0.08;

    discards.forEach((tile, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      const mesh = createTileMesh(tile);
      const isLast = tile.id === lastDiscardId;

      // Lay flat: front face points upward (+Y)
      mesh.rotation.set(-Math.PI / 2, 0, 0);

      // Local grid position
      const localX = (col - 2.5) * spacingX;
      const localZ = row * spacingZ + 2.5;

      // Transform according to seat orientation
      if (rel === 0) {
        // Bottom player's river
        mesh.position.set(localX, isLast ? 0.2 : 0.02, localZ);
      } else if (rel === 2) {
        // Top player's river
        mesh.position.set(-localX, isLast ? 0.2 : 0.02, -localZ);
        mesh.rotation.set(-Math.PI / 2, 0, Math.PI);
      } else if (rel === 1) {
        // Right player's river
        mesh.position.set(localZ, isLast ? 0.2 : 0.02, localX);
        mesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
      } else if (rel === 3) {
        // Left player's river
        mesh.position.set(-localZ, isLast ? 0.2 : 0.02, -localX);
        mesh.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      }

      this.discardsGroup.add(mesh);
    });
  }

  private renderPlayerMelds(rel: number, melds: any[]): void {
    if (!melds || melds.length === 0) return;

    let meldOffset = 0;
    melds.forEach((meld) => {
      meld.tiles?.forEach((tile: Tile, tIndex: number) => {
        const mesh = createTileMesh(tile);
        mesh.rotation.set(-Math.PI / 2, 0, 0);

        const spacing = TILE_W + 0.06;
        const xOffset = -18 + meldOffset * 3.2 + tIndex * spacing;

        if (rel === 0) {
          // Own meld: bottom left flat
          mesh.position.set(xOffset, 0.02, 17.5);
        } else if (rel === 2) {
          // Top meld
          mesh.position.set(-xOffset, 0.02, -17.5);
          mesh.rotation.set(-Math.PI / 2, 0, Math.PI);
        } else if (rel === 1) {
          // Right meld
          mesh.position.set(17.5, 0.02, xOffset);
          mesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
        } else if (rel === 3) {
          // Left meld
          mesh.position.set(-17.5, 0.02, -xOffset);
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

    // Smooth hover/select elevation interpolation
    this.handTileMeshes.forEach((mesh) => {
      const isHovered = mesh === this.hoveredMesh;
      const isSelected = mesh.userData.tileId === this.selectedTileId;
      const targetY = isSelected ? 1.0 : isHovered ? 0.45 : 0.0;
      mesh.position.y += (targetY - mesh.position.y) * 0.25;
    });

    this.renderer.render(this.scene, this.camera);
  }

  public destroy(): void {
    this.isDestroyed = true;
    cancelAnimationFrame(this.animationFrameId);
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
