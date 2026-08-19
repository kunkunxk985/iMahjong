import { ContactShadows, Environment, Lightformer, RoundedBox, useTexture } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, SMAA, Bloom } from '@react-three/postprocessing';
import { Suspense, useLayoutEffect } from 'react';
import * as THREE from 'three';
import type { ClientView, Tile } from '@pizhou/shared';
import { MahjongTileMesh } from './MahjongTileMesh';
import { BACK_URL, FACE_URLS, FELT_URL, TILE_H, TILE_W, WOOD_URL, relativeSeat } from './tileAtlas';

const COLS = 8;
const GAP_X = TILE_W + 0.045;
const GAP_Z = TILE_H + 0.04;

function configureMap(tex: THREE.Texture, repeatX = 1, repeatY = 1): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function useTableTextures() {
  const felt = useTexture(FELT_URL);
  const wood = useTexture(WOOD_URL);
  const back = useTexture(BACK_URL);
  const faces = useTexture(FACE_URLS);
  useLayoutEffect(() => {
    configureMap(felt, 3.2, 2.2);
    configureMap(wood, 2.4, 1.6);
    configureMap(back);
    Object.values(faces).forEach((tex) => configureMap(tex));
  }, [back, faces, felt, wood]);
  return { felt, wood, back, faces };
}

function riverOrigin(rel: number): { x: number; z: number; yaw: number } {
  if (rel === 0) return { x: 0, z: 1.55, yaw: 0 };
  if (rel === 1) return { x: 2.35, z: 0, yaw: -Math.PI / 2 };
  if (rel === 2) return { x: 0, z: -1.55, yaw: Math.PI };
  return { x: -2.35, z: 0, yaw: Math.PI / 2 };
}

function rackOrigin(rel: number): { x: number; z: number; yaw: number } {
  if (rel === 0) return { x: 0, z: 2.95, yaw: 0 };
  if (rel === 1) return { x: 3.85, z: 0, yaw: -Math.PI / 2 };
  if (rel === 2) return { x: 0, z: -2.95, yaw: Math.PI };
  return { x: -3.85, z: 0, yaw: Math.PI / 2 };
}

function alongEdge(origin: { x: number; z: number; yaw: number }, lateral: number, inward: number): [number, number, number] {
  const cos = Math.cos(origin.yaw);
  const sin = Math.sin(origin.yaw);
  const x = origin.x + lateral * cos - inward * sin;
  const z = origin.z - lateral * sin - inward * cos;
  return [x, 0, z];
}

function TableFurniture({ felt, wood }: { felt: THREE.Texture; wood: THREE.Texture }) {
  return (
    <group>
      <RoundedBox args={[12.4, 0.72, 8.7]} radius={0.42} smoothness={4} position={[0, -0.42, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={wood} roughness={0.52} metalness={0.08} envMapIntensity={0.5} />
      </RoundedBox>
      <RoundedBox args={[10.55, 0.1, 6.95]} radius={0.32} smoothness={4} position={[0, -0.01, 0]} receiveShadow>
        <meshStandardMaterial map={felt} roughness={0.9} metalness={0} envMapIntensity={0.3} />
      </RoundedBox>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[1.05, 1.16, 64]} />
        <meshStandardMaterial color="#d4b05a" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[1.05, 48]} />
        <meshStandardMaterial color="#0d2a1c" roughness={0.85} metalness={0.04} />
      </mesh>
    </group>
  );
}

function SeatPieces({
  rel,
  discards,
  handCount,
  melds,
  lastId,
  faces,
  back,
  current,
}: {
  rel: number;
  discards: Tile[];
  handCount: number;
  melds: Tile[][];
  lastId?: string;
  faces: Record<string, THREE.Texture>;
  back: THREE.Texture;
  current: boolean;
}) {
  const river = riverOrigin(rel);
  const rack = rackOrigin(rel);
  const shown = discards.slice(-24);
  const stand = Math.min(handCount, 14);

  return (
    <group>
      {shown.map((tile, index) => {
        const row = Math.floor(index / COLS);
        const col = index % COLS;
        const lateral = (col - (Math.min(shown.length, COLS) - 1) / 2) * GAP_X;
        const inward = -row * GAP_Z;
        const pos = alongEdge(river, lateral, inward);
        return (
          <MahjongTileMesh
            key={tile.id}
            tile={tile}
            face={faces[tile.key]}
            back={back}
            highlight={tile.id === lastId}
            position={pos}
            yaw={river.yaw}
          />
        );
      })}
      {rel !== 0
        ? Array.from({ length: stand }, (_, index) => {
            const lateral = (index - (stand - 1) / 2) * (TILE_W * 0.78);
            return (
              <MahjongTileMesh
                key={`back-${rel}-${index}`}
                back={back}
                faceDown
                standing
                highlight={current}
                position={alongEdge(rack, lateral, 0)}
                yaw={rack.yaw}
              />
            );
          })
        : null}
      {rel !== 0
        ? melds.map((group, gi) =>
            group.map((tile, ti) => {
              const lateral = (gi - (melds.length - 1) / 2) * 1.35 + (ti - 1) * (TILE_W * 0.72);
              return (
                <MahjongTileMesh
                  key={`meld-${tile.id}`}
                  tile={tile}
                  face={faces[tile.key]}
                  back={back}
                  position={alongEdge(rack, lateral, 0.42)}
                  yaw={rack.yaw}
                />
              );
            }),
          )
        : null}
    </group>
  );
}

function SceneBody({ view }: { view: ClientView }) {
  const { felt, wood, back, faces } = useTableTextures();
  const lastId = view.lastDiscard?.tile.id;

  return (
    <>
      <color attach="background" args={['#120a05']} />
      <Environment resolution={256}>
        <Lightformer form="circle" intensity={2} position={[0, 5, -9]} scale={8} color="#fff4e0" />
        <Lightformer form="rect" intensity={1.2} position={[-5, 2, -4]} scale={[4, 8, 1]} color="#ffe8c0" />
        <Lightformer form="rect" intensity={0.8} position={[5, 1, -4]} scale={[4, 8, 1]} color="#c0d0ff" />
        <Lightformer form="circle" intensity={0.6} position={[0, -3, 4]} scale={5} color="#ffffff" />
      </Environment>
      <hemisphereLight args={['#fff1d0', '#1a1008', 0.35]} />
      <ambientLight intensity={0.22} />
      <directionalLight
        position={[5.2, 10.5, 4.2]}
        intensity={1.25}
        color="#fff4dc"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={24}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <spotLight position={[-4.5, 7.5, 3.2]} angle={0.55} penumbra={0.6} intensity={0.55} color="#ffd9a0" />
      <pointLight position={[0, 2.4, 0]} intensity={view.lastDiscard ? 0.55 : 0.18} color="#f0d27a" distance={6} />

      <TableFurniture felt={felt} wood={wood} />

      {view.players.map((player) => {
        const rel = relativeSeat(player.seat, view.mySeat);
        const meldTiles = player.melds.map((meld) => meld.tiles);
        return (
          <SeatPieces
            key={player.seat}
            rel={rel}
            discards={player.discards}
            handCount={player.handCount}
            melds={meldTiles}
            lastId={lastId}
            faces={faces}
            back={back}
            current={view.currentSeat === player.seat}
          />
        );
      })}

      {view.lastDiscard ? (
        <MahjongTileMesh
          tile={view.lastDiscard.tile}
          face={faces[view.lastDiscard.tile.key]}
          back={back}
          highlight
          position={[0, 0.04, 0]}
          yaw={0}
        />
      ) : null}

      <ContactShadows position={[0, -0.78, 0]} opacity={0.42} scale={16} blur={2.4} far={2.8} />
    </>
  );
}

function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      <Bloom intensity={0.15} luminanceThreshold={0.65} mipmapBlur />
    </EffectComposer>
  );
}

export function TableScene({ view }: { view: ClientView }) {
  return (
    <div className="table-3d">
      <Canvas
        shadows
        dpr={[1, Math.min(window.devicePixelRatio, 3)]}
        camera={{ position: [0, 7.05, 7.15], fov: 36, near: 0.1, far: 40 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, 0.15);
        }}
      >
        <Suspense fallback={null}>
          <SceneBody view={view} />
          <Effects />
        </Suspense>
      </Canvas>
    </div>
  );
}
