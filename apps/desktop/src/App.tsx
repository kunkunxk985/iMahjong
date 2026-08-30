import { useEffect, useRef, useState } from 'react';
import { DEFAULT_WS_URL, type ClientView, type GameAction, type Settlement } from '@pizhou/shared';
import { HuCelebration } from './components/HuCelebration';
import { RulesModal } from './components/RulesModal';
import { SettingsModal } from './components/SettingsModal';
import { GameClient, isLoopbackWs } from './ws/client';
import { Lobby, type NetworkStatus } from './views/Lobby';
import { SettlementModal } from './views/Settlement';
import { Table } from './views/Table';
import { WaitingRoom } from './views/WaitingRoom';

type Mode = 'home' | 'local' | 'online';

function initialNickname(): string {
  try {
    const saved = localStorage.getItem('pizhou.nickname');
    if (saved) return saved;
  } catch {
    // localStorage is optional in restricted renderer environments.
  }
  return `玩家${String(Math.floor(Math.random() * 90) + 10)}`;
}

function savedOverrideUrl(): string {
  try {
    return localStorage.getItem('pizhou.serverUrl') || '';
  } catch {
    return '';
  }
}

export function App() {
  const [nickname, setNicknameState] = useState(initialNickname);
  const [localUrl, setLocalUrl] = useState('');
  const [localUrlReady, setLocalUrlReady] = useState(false);
  const [overrideUrl, setOverrideUrl] = useState(savedOverrideUrl);
  const [soloIntent, setSoloIntent] = useState(false);
  const [mode, setMode] = useState<Mode>('home');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('connecting');
  const [view, setView] = useState<ClientView | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [error, setError] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const clientRef = useRef<GameClient | null>(null);
  const requestedModeRef = useRef<Mode>('home');
  const pendingSoloRef = useRef(false);
  const seenSettlementRef = useRef<Settlement | null>(null);

  if (!clientRef.current) {
    clientRef.current = new GameClient({
      onView: (next) => {
        setMode(requestedModeRef.current === 'local' ? 'local' : 'online');
        setView(next);
        if (next.settlement && next.settlement !== seenSettlementRef.current) {
          seenSettlementRef.current = next.settlement;
          setCelebrating(true);
        } else if (!next.settlement) {
          seenSettlementRef.current = null;
          setCelebrating(false);
        }
        setSettlement(next.settlement);
        setError('');
      },
      onSettlement: (nextSettlement, nextView) => {
        setMode(requestedModeRef.current === 'local' ? 'local' : 'online');
        setView(nextView);
        if (nextSettlement !== seenSettlementRef.current) {
          seenSettlementRef.current = nextSettlement;
          setCelebrating(true);
        }
        setSettlement(nextSettlement);
        setError('');
      },
      onError: (message) => setError(message),
      onStatus: (status) => setNetworkStatus(status),
      onLeft: () => {
        pendingSoloRef.current = false;
        requestedModeRef.current = 'home';
        setSoloIntent(false);
        setMode('home');
        setView(null);
        setSettlement(null);
      },
    });
  }

  useEffect(() => {
    let active = true;
    const envWsUrl = import.meta.env.VITE_WS_URL;
    if (envWsUrl) {
      setLocalUrl(envWsUrl);
      setLocalUrlReady(true);
      return undefined;
    }

    const localUrlApi = window.pizhou?.getLocalServerUrl;
    if (!localUrlApi) {
      setLocalUrl(DEFAULT_WS_URL);
      setLocalUrlReady(true);
      return undefined;
    }

    void localUrlApi().then((url) => {
      if (!active) return;
      setLocalUrl(url || DEFAULT_WS_URL);
      setLocalUrlReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const targetUrl = soloIntent
    ? (localUrl || DEFAULT_WS_URL)
    : (overrideUrl.trim() || localUrl || DEFAULT_WS_URL);
  const urlReady = soloIntent ? localUrlReady : Boolean(overrideUrl.trim()) || localUrlReady;

  useEffect(() => {
    if (!urlReady || !targetUrl) return undefined;
    clientRef.current?.connect(targetUrl);
    return () => clientRef.current?.disconnect(false);
  }, [targetUrl, urlReady]);

  useEffect(() => () => clientRef.current?.disconnect(), []);

  useEffect(() => {
    if (!pendingSoloRef.current) return;
    if (networkStatus !== 'open') return;
    if (!isLoopbackWs(clientRef.current?.url ?? '')) return;
    pendingSoloRef.current = false;
    clientRef.current?.createRoom(nickname.trim() || '玩家', true);
  }, [networkStatus, nickname]);

  const setNickname = (value: string) => {
    setNicknameState(value);
    try {
      localStorage.setItem('pizhou.nickname', value);
    } catch {
      // Ignore storage failures; the current session still works.
    }
  };

  const requireOnline = (): boolean => {
    if (!nickname.trim()) {
      setError('请先输入昵称');
      return false;
    }
    if (networkStatus !== 'open') {
      setError('还没有连上牌桌服务器，请检查服务器地址');
      return false;
    }
    setError('');
    return true;
  };

  const createRoom = () => {
    if (!requireOnline()) return;
    requestedModeRef.current = 'online';
    clientRef.current?.createRoom(nickname.trim());
  };

  const joinRoom = (roomCode: string) => {
    if (!requireOnline()) return;
    requestedModeRef.current = 'online';
    clientRef.current?.joinRoom(roomCode, nickname.trim());
  };

  const startLocal = () => {
    if (soloIntent || pendingSoloRef.current) return;
    if (!nickname.trim()) {
      setError('请先输入昵称');
      return;
    }
    setError('');
    requestedModeRef.current = 'local';
    pendingSoloRef.current = true;
    setSoloIntent(true);
    if (networkStatus === 'open' && isLoopbackWs(clientRef.current?.url ?? '')) {
      pendingSoloRef.current = false;
      clientRef.current?.createRoom(nickname.trim(), true);
    }
  };

  const sendAction = (action: GameAction) => {
    if (!view) return;
    clientRef.current?.action(view.sequence, action);
  };

  const leave = () => {
    pendingSoloRef.current = false;
    setSoloIntent(false);
    clientRef.current?.leave();
    requestedModeRef.current = 'home';
    setMode('home');
    setView(null);
    setSettlement(null);
    setError('');
  };

  const again = () => clientRef.current?.again();

  const saveServerUrl = (value: string) => {
    const next = value.trim();
    setOverrideUrl(next);
    try {
      localStorage.setItem('pizhou.serverUrl', next);
    } catch {
      // Ignore storage failures; the current session still works.
    }
    setSettingsOpen(false);
    setError('');
  };

  const inGame = Boolean(view && (view.phase === 'playing' || view.phase === 'settlement'));
  const inWaitingRoom = Boolean(mode === 'online' && view?.phase === 'lobby');
  const displayUrl = clientRef.current?.url || targetUrl;
  const soloBusy = soloIntent && networkStatus !== 'open';

  return (
    <div className="viewport">
      <div className="stage">
        {inGame && view ? (
          <Table
            view={view}
            onAction={sendAction}
            onRules={() => setRulesOpen(true)}
            onLeave={leave}
            networkStatus={networkStatus}
            practice={mode === 'local'}
          />
        ) : inWaitingRoom && view ? (
          <WaitingRoom
            view={view}
            onReady={(ready) => clientRef.current?.ready(ready)}
            onStart={() => clientRef.current?.start()}
            onLeave={leave}
            onRules={() => setRulesOpen(true)}
          />
        ) : (
          <Lobby
            nickname={nickname}
            setNickname={setNickname}
            error={error}
            networkStatus={networkStatus}
            serverUrl={displayUrl}
            soloBusy={soloBusy}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onStartLocal={startLocal}
            onRules={() => setRulesOpen(true)}
            onSettings={() => setSettingsOpen(true)}
          />
        )}

        {settlement && view?.phase === 'settlement' && celebrating ? (
          <HuCelebration
            view={view}
            settlement={settlement}
            onFinish={() => setCelebrating(false)}
          />
        ) : settlement && view?.phase === 'settlement' ? (
          <SettlementModal
            view={view}
            settlement={settlement}
            onAgain={again}
            onLeave={leave}
            readyCount={view.players.filter((player) => player.ready).length}
            alreadyReady={Boolean(view.players[view.mySeat]?.ready)}
          />
        ) : null}
        {rulesOpen ? <RulesModal onClose={() => setRulesOpen(false)} /> : null}
        {settingsOpen ? (
          <SettingsModal serverUrl={overrideUrl} onSave={saveServerUrl} onClose={() => setSettingsOpen(false)} />
        ) : null}
        {error && inGame ? <div className="toast">{error}</div> : null}
      </div>
    </div>
  );
}
