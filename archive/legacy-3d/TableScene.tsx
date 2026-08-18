import { ContactShadows, RoundedBox, useTexture } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { type ClientView, type Tile } from '@pizhou/shared';
import { MahjongTileMesh } from './MahjongTileMesh';
import { BACK_URL, FACE_URLS, FELT_URL, TILE_D, TILE_W, WOOD_URL, relativeSeat } from './tileAtlas';

function configureMap(tex: THREE.Texture, repeatX = 1, repeatY = 1): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
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
    configureMap(felt, 4.0, 2.8);
    configureMap(wood, 3.2, 2.0);
    configureMap(back);
    Object.values(faces).forEach((tex) => configureMap(tex));
  }, [back, faces, felt, wood]);
  return { felt, wood, back, faces };
}

function rackOrigin(rel: number): { x: number; z: number; yaw: number } {
  if (rel === 0) return { x: 0, z: 2.95, yaw: 0 };
  if (rel === 1) return { x: 3.85, z: 0, yaw: -Math.PI / 2 };
  if (rel === 2) return { x: 0, z: -2.95, yaw: Math.PI };
  return { x: -3.85, z: 0, yaw: Math.PI / 2 };
}

function wallOrigin(rel: number): { x: number; z: number; yaw: number } {
  if (rel === 0) return { x: 0, z: 2.22, yaw: 0 };
  if (rel === 1) return { x: 3.12, z: 0, yaw: -Math.PI / 2 };
  if (rel === 2) return { x: 0, z: -2.22, yaw: Math.PI };
  return { x: -3.12, z: 0, yaw: Math.PI / 2 };
}

function alongEdge(origin: { x: number; z: number; yaw: number }, lateral: number, inward: number, y = 0): [number, number, number] {
  const cos = Math.cos(origin.yaw);
  const sin = Math.sin(origin.yaw);
  const x = origin.x + lateral * cos - inward * sin;
  const z = origin.z - lateral * sin - inward * cos;
  return [x, y, z];
}

function TableFurniture({ felt, wood, mySeat }: { felt: THREE.Texture; wood: THREE.Texture; mySeat: number }) {
  return (
    <group>
      {/* Warm rosewood frame: restrained gloss, like a real home table under a lamp. */}
      <RoundedBox args={[12.6, 0.76, 8.9]} radius={0.46} smoothness={6} position={[0, -0.44, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={wood} color="#4a2416" roughness={0.5} metalness={0.06} />
      </RoundedBox>

      {/* Deep jade felt: high roughness keeps the play surface calm and readable. */}
      <RoundedBox args={[10.75, 0.12, 7.15]} radius={0.34} smoothness={6} position={[0, -0.01, 0]} receiveShadow>
        <meshStandardMaterial map={felt} color="#2b8066" roughness={0.94} metalness={0.01} />
      </RoundedBox>

      {/* Quiet brass inlay: it frames the center without competing with the discard. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}>
        <ringGeometry args={[1.08, 1.22, 64]} />
        <meshStandardMaterial color="#d5ad55" metalness={0.62} roughness={0.34} />
      </mesh>

      {/* Center Dial Plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.013, 0]}>
        <circleGeometry args={[1.08, 48]} />
        <meshStandardMaterial color="#071f18" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* Subtle seat markers. */}
      {[0, 1, 2, 3].map((rel) => {
        const dist = 0.82;
        const angle = -rel * (Math.PI / 2) + Math.PI / 2;
        const x = Math.cos(angle) * dist;
        const z = -Math.sin(angle) * dist;
        return (
          <group key={rel} position={[x, 0.018, z]} rotation={[-Math.PI / 2, 0, -rel * (Math.PI / 2)]}>
            <mesh>
              <ringGeometry args={[0.16, 0.18, 32]} />
              <meshBasicMaterial color={rel === 0 ? '#d5ad55' : '#8c713c'} transparent opacity={rel === 0 ? 0.48 : 0.24} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function WallStacks({ wallCount, back }: { wallCount: number; back: THREE.Texture }) {
  // 120 tiles total = ~15 stacks of 2 on each of the 4 sides
  const stacksPerSide = 15;
  const remainingStacks = Math.ceil(wallCount / 2);

  return (
    <group>
      {[0, 1, 2, 3].map((side) => {
        const origin = wallOrigin(side);
        const sideStackLimit = Math.min(stacksPerSide, Math.max(0, remainingStacks - side * stacksPerSide));
        if (sideStackLimit <= 0) return null;

        return (
          <group key={`wall-side-${side}`}>
            {Array.from({ length: sideStackLimit }, (_, i) => {
              const lateral = (i - (stacksPerSide - 1) / 2) * (TILE_W * 1.05);
              return (
                <group key={`stack-${side}-${i}`}>
                  {/* Bottom Tile */}
                  <MahjongTileMesh
                    back={back}
                    faceDown
                    position={alongEdge(origin, lateral, 0, 0)}
                    yaw={origin.yaw}
                  />
                  {/* Top Tile */}
                  <MahjongTileMesh
                    back={back}
                    faceDown
                    position={alongEdge(origin, lateral, 0, TILE_D + 0.005)}
                    yaw={origin.yaw}
                  />
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function SeatPieces({
  rel,
  handCount,
  melds,
  faces,
  back,
  current,
}: {
  rel: number;
  handCount: number;
  melds: Tile[][];
  faces: Record<string, THREE.Texture>;
  back: THREE.Texture;
  current: boolean;
}) {
  const rack = rackOrigin(rel);
  const stand = Math.min(handCount, 14);

  return (
    <group>
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

  return (
    <>
      <color attach="background" args={['#0a2b22']} />

      {/* A warm home-table key, a cool jade fill, and a very soft brass rim. */}
      <ambientLight intensity={0.38} color="#fff0d7" />
      <hemisphereLight args={['#f8ead4', '#0a281f', 0.28]} />

      <directionalLight
        position={[5.5, 10.5, 5.5]}
        intensity={1.12}
        color="#ffd9a8"
        castShadow
        shadow-bias={-0.0001}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={26}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />

      <directionalLight position={[-7.0, 5.5, -2.0]} intensity={0.28} color="#78c9b4" />

      <directionalLight position={[-1.5, 4.5, -7.0]} intensity={0.24} color="#d5ad55" />

      {/* Only the current discard gets a small warm lift. */}
      <pointLight
        position={[0, 2.2, 0]}
        intensity={view.lastDiscard ? 0.46 : 0.08}
        color="#e8bd62"
        distance={5.5}
      />

      {/* Table Structure */}
      <TableFurniture felt={felt} wood={wood} mySeat={view.mySeat} />

      {/* 3D Remaining Wall Stacks */}
      <WallStacks wallCount={view.wallCount} back={back} />

      {/* Player Discards & Opponent Hands */}
      {view.players.map((player) => {
        const rel = relativeSeat(player.seat, view.mySeat);
        const meldTiles = player.melds.map((meld) => meld.tiles);
        return (
          <SeatPieces
            key={player.seat}
            rel={rel}
            handCount={player.handCount}
            melds={meldTiles}
            faces={faces}
            back={back}
            current={view.currentSeat === player.seat}
          />
        );
      })}

      {/* Realistic Soft Contact Floor Shadow */}
      <ContactShadows position={[0, -0.82, 0]} opacity={0.55} scale={18} blur={2.6} far={3.2} />
    </>
  );
}

export function TableScene({ view }: { view: ClientView }) {
  return (
    <div className="table-3d">
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        camera={{ position: [0, 7.1, 7.15], fov: 36, near: 0.1, far: 45 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        onCreated={({ camera, gl }) => {
          camera.lookAt(0, 0, 0.15);
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Suspense fallback={null}>
          <SceneBody view={view} />
        </Suspense>
      </Canvas>
    </div>
  );
}
