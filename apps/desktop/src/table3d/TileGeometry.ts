import * as THREE from 'three';
import type { Tile } from '@pizhou/shared';

export const TILE_W = 2.2;
export const TILE_H = 3.0;
export const TILE_D = 1.5;

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

export function getTileTexturePath(tile?: Tile | null): string {
  if (!tile || tile.key === 'back' || !tile.suit || !tile.rank) {
    return './assets/tile-back.png';
  }
  return `./assets/tiles/${tile.suit}-${tile.rank}.png`;
}

export function loadTileTexture(path: string): THREE.Texture {
  if (textureCache.has(path)) {
    return textureCache.get(path)!;
  }
  const texture = textureLoader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 16; // Extreme crispness at perspective angles
  textureCache.set(path, texture);
  return texture;
}

// Reusable base materials - Luxury Ivory Bone & Emerald Jadeite
const sideMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xfbf7ed, // Polished ivory bone side
  roughness: 0.22,
  metalness: 0.02,
  clearcoat: 0.6,
  clearcoatRoughness: 0.15,
});

const backTexture = loadTileTexture('./assets/tile-back.png');
const backMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x0a4230, // Royal emerald jadeite backing
  map: backTexture,
  roughness: 0.18,
  metalness: 0.04,
  clearcoat: 0.85,
  clearcoatRoughness: 0.12,
});

// Single shared box geometry for all tiles
export const sharedTileGeometry = new THREE.BoxGeometry(TILE_W, TILE_H, TILE_D);

export function createTileMesh(tile?: Tile | null, isBack = false): THREE.Mesh {
  let frontMat: THREE.Material;

  if (isBack || !tile || tile.key === 'back') {
    frontMat = backMaterial;
  } else {
    const path = getTileTexturePath(tile);
    const texture = loadTileTexture(path);
    frontMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: texture,
      roughness: 0.16,
      metalness: 0.01,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    });
  }

  // Materials for the 6 faces:
  // 0: +x (right), 1: -x (left), 2: +y (top), 3: -y (bottom), 4: +z (front), 5: -z (back)
  const materials: THREE.Material[] = [
    sideMaterial,
    sideMaterial,
    sideMaterial,
    sideMaterial,
    frontMat,
    backMaterial,
  ];

  const mesh = new THREE.Mesh(sharedTileGeometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  if (tile) {
    mesh.userData = { tileId: tile.id, tileKey: tile.key, tile };
  }

  return mesh;
}
