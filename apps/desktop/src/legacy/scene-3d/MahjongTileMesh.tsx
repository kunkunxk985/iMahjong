import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Tile } from '@pizhou/shared';
import { TILE_D, TILE_H, TILE_W } from './tileAtlas';
import type { Texture } from 'three';

/* ─── Dimensions ──────────────────────────────────────────────── */

// The ivory body is the full tile size
const BODY_W = TILE_W;
const BODY_H = TILE_H;
const BODY_D = TILE_D;

// The green back panel is inset from the body edges
const BACK_INSET = 0.022; // how far the green panel is inset on each side
const BACK_W = BODY_W - BACK_INSET * 2;
const BACK_H = BODY_H - BACK_INSET * 2;
const BACK_D = BODY_D * 0.42; // thickness of the green back layer

// The face texture panel sits slightly proud of the surface
const FACE_INSET = 0.018;
const FACE_W = BODY_W - FACE_INSET * 2;
const FACE_H = BODY_H - FACE_INSET * 2;
const FACE_DEPTH = 0.003; // how far the face panel is recessed

// Top chamfer strip (the beveled edge between face and sides)
const CHAMFER_STRIP = 0.008;

/* ─── Shared materials (created once, reused across all tiles) ── */

const ivoryMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#fcf5e3'),
  roughness: 0.22,
  metalness: 0.015,
});

const ivorySideMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#f8eed8'),
  roughness: 0.28,
  metalness: 0.01,
});

const ivoryBottomMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#efe5cf'),
  roughness: 0.35,
  metalness: 0.01,
});

const chamferMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#faf2e0'),
  roughness: 0.18,
  metalness: 0.025,
});

const greenBackMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#0e5a42'),
  roughness: 0.30,
  metalness: 0.04,
});

const highlightEmissiveColor = new THREE.Color('#b8912a');

/* ─── Props ───────────────────────────────────────────────────── */

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

/* ─── Component ───────────────────────────────────────────────── */

export function MahjongTileMesh({
  face,
  back,
  faceDown,
  highlight,
  standing,
  position,
  yaw = 0,
}: MahjongTileMeshProps) {
  const isBack = faceDown || !face;
  const faceMap = isBack ? back : face;

  // Dynamically create the face material with the correct texture
  const faceMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: faceMap,
      color: isBack ? '#0f6049' : '#ffffff',
      roughness: isBack ? 0.30 : 0.16,
      metalness: isBack ? 0.04 : 0.02,
      emissive: highlight ? highlightEmissiveColor : new THREE.Color('#000000'),
      emissiveIntensity: highlight ? 0.5 : 0,
    });
  }, [faceMap, isBack, highlight]);

  // Back side material with texture
  const backSideMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: back,
      color: '#0f5a44',
      roughness: 0.30,
      metalness: 0.03,
    });
  }, [back]);

  // Body rotation & position for standing vs lying flat
  const bodyRotation: [number, number, number] = standing
    ? [-Math.PI / 2, 0, 0]
    : [0, 0, 0];
  const bodyY = standing
    ? BODY_H / 2
    : BODY_D / 2 + (highlight ? 0.025 : 0);

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <group rotation={bodyRotation} position={[0, bodyY, 0]}>

        {/* ── Layer 1: Ivory Body Shell ── */}
        {/*
         * This is the main body of the tile — the white/ivory part.
         * RoundedBox with 6 materials:
         *   0=+X  1=-X  2=+Y(top)  3=-Y(bottom)  4=+Z(front face)  5=-Z(back)
         */}
        <RoundedBox
          args={[BODY_W, BODY_D, BODY_H]}
          radius={0.014}
          smoothness={4}
          castShadow
          receiveShadow
        >
          {/* +X right side */}
          <primitive attach="material-0" object={ivorySideMaterial} />
          {/* -X left side */}
          <primitive attach="material-1" object={ivorySideMaterial} />
          {/* +Y top surface (the face side when lying flat) */}
          <primitive attach="material-2" object={ivoryMaterial} />
          {/* -Y bottom */}
          <primitive attach="material-3" object={ivoryBottomMaterial} />
          {/* +Z front edge */}
          <primitive attach="material-4" object={ivorySideMaterial} />
          {/* -Z back edge */}
          <primitive attach="material-5" object={ivorySideMaterial} />
        </RoundedBox>

        {/* ── Layer 2: Face Texture Panel (slightly raised on top) ── */}
        {/*
         * A thin panel sitting just above the ivory body surface.
         * This gives the visual impression that the engraving / print
         * is recessed into the tile surface.
         */}
        <mesh
          position={[0, BODY_D / 2 + FACE_DEPTH / 2 + 0.001, 0]}
          castShadow
        >
          <boxGeometry args={[FACE_W, FACE_DEPTH, FACE_H]} />
          <primitive attach="material" object={faceMaterial} />
        </mesh>

        {/* ── Layer 3: Green Back Inlay (recessed on bottom) ── */}
        {/*
         * Real mahjong tiles have a green/jade coloured back that is
         * inset into the ivory body. We model this as a separate slab
         * that sits slightly below the bottom surface of the body,
         * with smaller width/height to expose the ivory rim.
         */}
        <mesh
          position={[0, -(BODY_D / 2) + BACK_D / 2 - 0.001, 0]}
        >
          <boxGeometry args={[BACK_W, BACK_D, BACK_H]} />
          <primitive attach="material" object={backSideMaterial} />
        </mesh>

        {/* ── Layer 4: Top Chamfer / Bevel Strips ── */}
        {/*
         * Four thin strips around the top perimeter to simulate
         * the subtle 45° chamfer that real tiles have. This catches
         * light at a different angle than the flat top, creating
         * the characteristic "edge gleam" of polished mahjong tiles.
         */}
        {/* Front chamfer */}
        <mesh
          position={[0, BODY_D / 2 + 0.0005, BODY_H / 2 - CHAMFER_STRIP / 2]}
          rotation={[Math.PI / 6, 0, 0]}
        >
          <boxGeometry args={[BODY_W - 0.004, 0.002, CHAMFER_STRIP]} />
          <primitive attach="material" object={chamferMaterial} />
        </mesh>
        {/* Back chamfer */}
        <mesh
          position={[0, BODY_D / 2 + 0.0005, -(BODY_H / 2 - CHAMFER_STRIP / 2)]}
          rotation={[-Math.PI / 6, 0, 0]}
        >
          <boxGeometry args={[BODY_W - 0.004, 0.002, CHAMFER_STRIP]} />
          <primitive attach="material" object={chamferMaterial} />
        </mesh>
        {/* Left chamfer */}
        <mesh
          position={[-(BODY_W / 2 - CHAMFER_STRIP / 2), BODY_D / 2 + 0.0005, 0]}
          rotation={[0, 0, -Math.PI / 6]}
        >
          <boxGeometry args={[CHAMFER_STRIP, 0.002, BODY_H - 0.004]} />
          <primitive attach="material" object={chamferMaterial} />
        </mesh>
        {/* Right chamfer */}
        <mesh
          position={[BODY_W / 2 - CHAMFER_STRIP / 2, BODY_D / 2 + 0.0005, 0]}
          rotation={[0, 0, Math.PI / 6]}
        >
          <boxGeometry args={[CHAMFER_STRIP, 0.002, BODY_H - 0.004]} />
          <primitive attach="material" object={chamferMaterial} />
        </mesh>

      </group>

      {/* ── Gold Aura Glow (highlighted tiles only) ── */}
      {highlight ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <planeGeometry args={[TILE_W * 1.4, TILE_H * 1.4]} />
          <meshBasicMaterial color="#f0c842" transparent opacity={0.3} />
        </mesh>
      ) : null}
    </group>
  );
}
