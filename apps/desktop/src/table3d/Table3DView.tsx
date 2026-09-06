import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ClientView } from '@pizhou/shared';
import { MahjongScene3D } from './MahjongScene3D';

interface Table3DViewProps {
  view: ClientView;
  selectedTileId: string | null;
  onSelectTile: (tileId: string) => void;
  onDiscardTile: (tileId: string) => void;
  onTileHover?: (tileKey: string | null, tileId: string | null) => void;
}

export function Table3DView({
  view,
  selectedTileId,
  onSelectTile,
  onDiscardTile,
  onTileHover,
}: Table3DViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<MahjongScene3D | null>(null);
  const callbacksRef = useRef({ onSelectTile, onDiscardTile, onTileHover });

  useLayoutEffect(() => {
    callbacksRef.current = { onSelectTile, onDiscardTile, onTileHover };
  }, [onSelectTile, onDiscardTile, onTileHover]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new MahjongScene3D(containerRef.current, {
      onSelectTile: (tileId) => callbacksRef.current.onSelectTile(tileId),
      onDiscardTile: (tileId) => callbacksRef.current.onDiscardTile(tileId),
      onTileHover: (tileKey, tileId) => callbacksRef.current.onTileHover?.(tileKey, tileId),
    });
    sceneRef.current = scene;

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, []); // Mount once

  // Synchronize dynamic game view updates
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.update(view, selectedTileId);
    }
  }, [view, selectedTileId]);

  return (
    <div
      ref={containerRef}
      className="table-3d-canvas-container"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'auto',
      }}
    />
  );
}
