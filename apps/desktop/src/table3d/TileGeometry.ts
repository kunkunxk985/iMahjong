import * as THREE from 'three';
import type { Tile } from '@pizhou/shared';

export const TILE_W = 2.2;
export const TILE_H = 3.0;
export const TILE_D = 1.5;

export function getTileTexturePath(tile?: Tile | null): string {
  if (!tile || tile.key === 'back' || !tile.suit || !tile.rank) {
    return './assets/tile-back.png';
  }
  return `./assets/tiles/${tile.suit}-${tile.rank}.png`;
}

/** Each scene owns a bounded set of shared tile resources. */
export class TileMeshFactory {
  private textureLoader = new THREE.TextureLoader();
  private textureCache = new Map<string, THREE.Texture>();
  private faceMaterials = new Map<string, THREE.Material>();

  private loadTileTexture(path: string): THREE.Texture {
    const cached = this.textureCache.get(path);
    if (cached) return cached;
    const texture = this.textureLoader.load(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 16;
    this.textureCache.set(path, texture);
    return texture;
  }

  // Reusable base materials - Luxury Ivory Bone & Emerald Jadeite
  private sideMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xfbf7ed, // Polished ivory bone side
    roughness: 0.22,
    metalness: 0.02,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
  });

  private backMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a4230, // Royal emerald jadeite backing
    map: this.loadTileTexture('./assets/tile-back.png'),
    roughness: 0.18,
    metalness: 0.04,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  });

  // Single shared box geometry for all tiles
  private sharedTileGeometry = new THREE.BoxGeometry(TILE_W, TILE_H, TILE_D);

  createTileMesh(tile?: Tile | null, isBack = false): THREE.Mesh {
    let frontMat: THREE.Material;

    if (isBack || !tile || tile.key === 'back') {
      frontMat = this.backMaterial;
    } else {
      const path = getTileTexturePath(tile);
      const texture = this.loadTileTexture(path);
      frontMat = this.faceMaterials.get(path) ?? new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: texture,
        roughness: 0.16,
        metalness: 0.01,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
      });
      this.faceMaterials.set(path, frontMat);
    }

    // Materials for the 6 faces:
    // 0: +x (right), 1: -x (left), 2: +y (top), 3: -y (bottom), 4: +z (front), 5: -z (back)
    const materials: THREE.Material[] = [
      this.sideMaterial,
      this.sideMaterial,
      this.sideMaterial,
      this.sideMaterial,
      frontMat,
      this.backMaterial,
    ];

    const mesh = new THREE.Mesh(this.sharedTileGeometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    if (tile) {
      mesh.userData = { tileId: tile.id, tileKey: tile.key, tile };
    }

    return mesh;
  }

  dispose(): void {
    this.sharedTileGeometry.dispose();
    this.sideMaterial.dispose();
    this.backMaterial.dispose();
    for (const material of this.faceMaterials.values()) material.dispose();
    for (const texture of this.textureCache.values()) texture.dispose();
    this.faceMaterials.clear();
    this.textureCache.clear();
  }
}
