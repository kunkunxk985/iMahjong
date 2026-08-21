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
  'bu-gang': '补杠',
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
  if ((action.kind === 'kan' || action.kind === 'an-gang' || action.kind === 'bu-gang') && action.key) {
    return `${LABELS[action.kind]} ${tileLabel(action.key)}`;
  }
  return LABELS[action.kind] ?? action.kind;
}

export function ActionBar({ actions, onAction, onDiscard, canDiscard, selectedTileId }: ActionBarProps) {
  const buttons = actions.filter((action) => action.kind !== 'discard');
  if (buttons.length === 0 && !canDiscard) return null;
  return (
    <div className="action-bar">
      {buttons.map((action, index) => {
        const needsGateDiscard = action.kind === 'close-gate' && Boolean(action.tileIds?.length);
        const gateTileValid = !needsGateDiscard || Boolean(selectedTileId && action.tileIds?.includes(selectedTileId));
        return (
          <button
            key={`${action.kind}-${action.key ?? ''}-${action.tileIds?.join('-') ?? index}`}
            type="button"
            className={`btn-action ${action.kind === 'hu' ? 'primary' : ''} ${action.kind === 'pass' ? 'ghost' : ''}`}
            disabled={!gateTileValid}
            title={needsGateDiscard && !gateTileValid ? '先选择一张牌；打出后留下两对才能关门' : undefined}
            onClick={() => onAction({ ...action, tileId: needsGateDiscard ? selectedTileId ?? undefined : action.tileId })}
          >
            {actionLabel(action)}
          </button>
        );
      })}
      {canDiscard ? (
        <button type="button" className="btn-action" onClick={onDiscard}>
          出牌
        </button>
      ) : null}
    </div>
  );
}
