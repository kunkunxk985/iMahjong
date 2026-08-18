import { tileLabel, type AvailableAction, type GameAction } from '@pizhou/shared';

interface ActionBarProps {
  actions: AvailableAction[];
  onAction: (action: GameAction) => void;
  onDiscard: () => void;
  canDiscard: boolean;
}

const LABELS: Record<string, string> = {
  hu: '胡',
  'ming-gang': '杠',
  'an-gang': '暗杠',
  'bu-gang': '补杠',
  peng: '碰',
  chi: '吃',
  pass: '过',
  discard: '出牌',
};

function actionLabel(action: AvailableAction): string {
  if (action.key === 'qidong-gang-hu') return '起手杠胡';
  if (action.kind === 'chi' && action.tiles?.length) {
    return `吃 ${action.tiles.map((tile) => tileLabel(tile)).join('')}`;
  }
  if ((action.kind === 'an-gang' || action.kind === 'bu-gang') && action.key) {
    return `${LABELS[action.kind]} ${tileLabel(action.key)}`;
  }
  return LABELS[action.kind] ?? action.kind;
}

export function ActionBar({ actions, onAction, onDiscard, canDiscard }: ActionBarProps) {
  const buttons = actions.filter((action) => action.kind !== 'discard');
  if (buttons.length === 0 && !canDiscard) return null;
  return (
    <div className="action-bar">
      {buttons.map((action, index) => (
        <button
          key={`${action.kind}-${action.key ?? ''}-${action.tileIds?.join('-') ?? index}`}
          type="button"
          className={`btn-action ${action.kind === 'hu' ? 'primary' : ''} ${action.kind === 'pass' ? 'ghost' : ''}`}
          onClick={() => onAction(action)}
        >
          {actionLabel(action)}
        </button>
      ))}
      {canDiscard ? (
        <button type="button" className="btn-action" onClick={onDiscard}>
          出牌
        </button>
      ) : null}
    </div>
  );
}
