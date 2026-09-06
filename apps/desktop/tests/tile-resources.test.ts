import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import type { Tile } from '@pizhou/shared';
import { TileMeshFactory } from '../src/table3d/TileGeometry.ts';

const tile: Tile = { id: 'wan-1-0', key: 'wan-1', suit: 'wan', rank: 1 };

test('repeated updates share geometry, textures and face materials', (t) => {
  const load = t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const factory = new TileMeshFactory();
  t.after(() => factory.dispose());
  const meshes = Array.from({ length: 1000 }, (_, i) => factory.createTileMesh({ ...tile, id: `tile-${i}` }));
  assert.equal(new Set(meshes.map((mesh) => mesh.geometry)).size, 1);
  assert.equal(new Set(meshes.map((mesh) => (mesh.material as THREE.Material[])[4])).size, 1);
  assert.equal(load.mock.callCount(), 2, 'one back and one face texture');
  assert.equal(new Set(meshes.map((mesh) => mesh.userData.tileId)).size, 1000);
});

test('different faces keep distinct materials and textures', (t) => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const factory = new TileMeshFactory();
  t.after(() => factory.dispose());
  const a = factory.createTileMesh(tile);
  const b = factory.createTileMesh({ ...tile, id: 'wan-2-0', rank: 2, key: 'wan-2' });
  const faceA = (a.material as THREE.MeshPhysicalMaterial[])[4];
  const faceB = (b.material as THREE.MeshPhysicalMaterial[])[4];
  assert.notEqual(faceA, faceB);
  assert.notEqual(faceA.map, faceB.map);
});

test('leaving a scene disposes shared resources once and keeps other scenes independent', (t) => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const factory = new TileMeshFactory();
  const other = new TileMeshFactory();
  t.after(() => other.dispose());
  const first = factory.createTileMesh(tile);
  factory.createTileMesh(tile);
  const second = other.createTileMesh(tile);
  const resources = new Set<THREE.EventDispatcher<any>>([first.geometry]);
  for (const material of first.material as THREE.MeshPhysicalMaterial[]) {
    resources.add(material);
    if (material.map) resources.add(material.map);
  }
  let disposals = 0;
  for (const resource of resources) resource.addEventListener('dispose', () => disposals++);
  let otherDisposed = false;
  second.geometry.addEventListener('dispose', () => { otherDisposed = true; });
  factory.dispose();
  assert.equal(disposals, resources.size);
  assert.equal(otherDisposed, false);
  assert.notEqual(first.geometry, second.geometry);
});
