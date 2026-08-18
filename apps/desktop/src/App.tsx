import { useEffect, useRef, useState } from 'react';
import type { ClientView, GameAction, Settlement } from '@pizhou/shared';
import { RulesModal } from './components/RulesModal';
import { LocalTable } from './game/localTable';
import { Lobby } from './views/Lobby';
import { SettlementModal } from './views/Settlement';
import { Table } from './views/Table';

export function App() {
  const [nickname, setNickname] = useState(() => `玩家${String(Math.floor(Math.random() * 90) + 10)}`);
  const [view, setView] = useState<ClientView | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [error, setError] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const tableRef = useRef<LocalTable | null>(null);

  if (!tableRef.current) {
    tableRef.current = new LocalTable((next) => {
      setView(next);
      setSettlement(next.settlement);
      setError('');
    });
  }

  useEffect(() => {
    return () => tableRef.current?.dispose();
  }, []);

  const sendAction = (action: GameAction) => {
    const message = tableRef.current?.act(action);
    if (message) setError(message);
  };

  const inGame = view && (view.phase === 'playing' || view.phase === 'settlement');

  return (
    <div className="viewport">
      <div className="stage">
        {inGame && view ? (
          <Table view={view} onAction={sendAction} onRules={() => setRulesOpen(true)} />
        ) : (
          <Lobby
            nickname={nickname}
            setNickname={setNickname}
            error={error}
            onStart={() => tableRef.current?.start(nickname)}
            onRules={() => setRulesOpen(true)}
          />
        )}
        {settlement && view?.phase === 'settlement' ? (
          <SettlementModal
            settlement={settlement}
            onAgain={() => tableRef.current?.again()}
            readyCount={4}
          />
        ) : null}
        {rulesOpen ? <RulesModal onClose={() => setRulesOpen(false)} /> : null}
        {error && inGame ? <div className="toast">{error}</div> : null}
      </div>
    </div>
  );
}
