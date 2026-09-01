import { tileLabel, type AvailableAction, type GameAction } from '@pizhou/shared';

interface ActionBarProps {
  actions: AvailableAction[];
  onAction: (action: GameAction) => void;
  onDiscard: () => void;
  canDiscard: boolean;
  selectedTileId?: string | null;
}

const LABELS: Record<string, string> = {
  hu: '胡',
  kan: '坎上',
  'ming-gang': '杠',
  'an-gang': '暗杠',
  'zi-gang': '自杠',
  peng: '碰',
  chi: '吃',
  pass: '过',
  discard: '出牌',
  'close-gate': '关门',
};

function actionLabel(action: AvailableAction): string {
  if (action.key === 'qidong-gang-hu') return '起手杠胡';
  if (action.kind === 'chi' && action.tiles?.length) {
    return `吃 ${action.tiles.map((tile) => tileLabel(tile)).join('')}`;
  }
  if ((action.kind === 'kan' || action.kind === 'an-gang' || action.kind === 'zi-gang') && action.key) {
    return `${LABELS[action.kind]} ${tileLabel(action.key)}`;
  }
  return LABELS[action.kind] ?? action.kind;
}

export function ActionBar({ actions, onAction, onDiscard, canDiscard, selectedTileId }: ActionBarProps) {
  const buttons = actions.filter((action) => action.kind !== 'discard');
  if (buttons.length === 0 && !canDiscard) return null;

  const discardDisabled = !canDiscard || !selectedTileId;
  const isClaimWindow = buttons.some((action) => action.kind !== 'pass');

  return (
    <div
      className={`action-bar ${isClaimWindow ? 'has-claims' : ''} ${canDiscard && selectedTileId ? 'is-ready' : ''}`}
      data-action-count={buttons.length}
    >
      {buttons.map((action, index) => {
        const isCloseGate = action.kind === 'close-gate';
        const needsGateDiscard = isCloseGate && Boolean(action.tileIds?.length);
        const gateTileValid = !needsGateDiscard || Boolean(selectedTileId && action.tileIds?.includes(selectedTileId));
        return (
          <button
            key={`${action.kind}-${action.key ?? ''}-${action.tileIds?.join('-') ?? index}`}
            type="button"
            className={`btn-action action-${action.kind} ${action.kind === 'hu' ? 'primary' : ''} ${action.kind === 'pass' ? 'ghost' : ''} ${isCloseGate ? 'close-gate-btn' : ''}`}
            title={needsGateDiscard ? (gateTileValid ? '打出此牌并关门' : '点击可直接打出候选牌并关门') : undefined}
            onClick={() => {
              let targetTileId = action.tileId;
              if (needsGateDiscard) {
                targetTileId = (selectedTileId && action.tileIds?.includes(selectedTileId))
                  ? selectedTileId
                  : action.tileIds?.[0];
              }
              onAction({ ...action, tileId: targetTileId });
            }}
          >
            {isCloseGate ? '关门' : actionLabel(action)}
          </button>
        );
      })}
      {canDiscard ? (
        <button
          type="button"
          className={`btn-action action-discard ${selectedTileId ? 'is-ready' : ''}`}
          disabled={discardDisabled}
          title={discardDisabled ? '请先选牌' : undefined}
          onClick={onDiscard}
        >
          出牌
        </button>
      ) : null}
    </div>
  );
}
