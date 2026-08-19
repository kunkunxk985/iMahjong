import type { Tile } from '@pizhou/shared';
import { TILE_D, TILE_H, TILE_W } from './tileAtlas';
import type { Texture } from 'three';

interface MahjongTileMeshProps {
  tile?: Tile;
  face?: Texture;
  back: Texture;
  faceDown?: boolean;
  highlight?: boolean;
  standing?: boolean;
  position: [number, number, number];
  yaw?: number;
}

export function MahjongTileMesh({
  face,
  back,
  faceDown,
  highlight,
  standing,
  position,
  yaw = 0,
}: MahjongTileMeshProps) {
  const faceMap = faceDown || !face ? back : face;
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh
        rotation={standing ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
        position={standing ? [0, TILE_H / 2, 0] : [0, TILE_D / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[TILE_W, TILE_D, TILE_H]} />
        <meshStandardMaterial attach="material-0" color="#efe6ce" roughness={0.38} metalness={0.08} envMapIntensity={0.6} />
        <meshStandardMaterial attach="material-1" color="#efe6ce" roughness={0.38} metalness={0.08} envMapIntensity={0.6} />
        <meshStandardMaterial
          attach="material-2"
          map={faceMap}
          roughness={0.28}
          metalness={0.06}
          envMapIntensity={0.8}
          emissive={highlight ? '#8a6a18' : '#000000'}
          emissiveIntensity={highlight ? 0.32 : 0}
        />
        <meshStandardMaterial attach="material-3" map={back} roughness={0.45} metalness={0.05} envMapIntensity={0.5} />
        <meshStandardMaterial attach="material-4" color="#efe6ce" roughness={0.38} metalness={0.08} envMapIntensity={0.6} />
        <meshStandardMaterial attach="material-5" color="#efe6ce" roughness={0.38} metalness={0.08} envMapIntensity={0.6} />
      </mesh>
    </group>
  );
}
