import { useEffect, useRef, useState } from 'react';
import { DEFAULT_WS_URL, type ClientView, type GameAction, type Settlement } from '@pizhou/shared';
import { RulesModal } from './components/RulesModal';
import { SettingsModal } from './components/SettingsModal';
import { GameClient } from './ws/client';
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

function savedServerUrl(): string {
  try {
    return localStorage.getItem('pizhou.serverUrl') || '';
  } catch {
    return '';
  }
}

export function App() {
  const [nickname, setNicknameState] = useState(initialNickname);
  const [serverUrl, setServerUrl] = useState(savedServerUrl);
  const [serverUrlReady, setServerUrlReady] = useState(() => Boolean(savedServerUrl()));
  const [mode, setMode] = useState<Mode>('home');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('connecting');
  const [view, setView] = useState<ClientView | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [error, setError] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const clientRef = useRef<GameClient | null>(null);
  const requestedModeRef = useRef<Mode>('home');

  if (!clientRef.current) {
    clientRef.current = new GameClient({
      onView: (next) => {
        setMode(requestedModeRef.current === 'local' ? 'local' : 'online');
        setView(next);
        setSettlement(next.settlement);
        setError('');
      },
      onSettlement: (nextSettlement, nextView) => {
        setMode(requestedModeRef.current === 'local' ? 'local' : 'online');
        setView(nextView);
        setSettlement(nextSettlement);
        setError('');
      },
      onError: (message) => setError(message),
      onStatus: (status) => setNetworkStatus(status),
      onLeft: () => {
        requestedModeRef.current = 'home';
        setMode('home');
        setView(null);
        setSettlement(null);
      },
    });
  }

  useEffect(() => {
    const saved = savedServerUrl();
    if (saved) {
      setServerUrl(saved);
      setServerUrlReady(true);
      return;
    }

    const envWsUrl = import.meta.env.VITE_WS_URL;
    if (envWsUrl) {
      setServerUrl(envWsUrl);
      setServerUrlReady(true);
      return;
    }

    let active = true;
    const localUrl = window.pizhou?.getLocalServerUrl;
    if (localUrl) {
      void localUrl().then((url) => {
        if (!active) return;
        setServerUrl(url || DEFAULT_WS_URL);
        setServerUrlReady(true);
      });
    } else {
      setServerUrl(DEFAULT_WS_URL);
      setServerUrlReady(true);
    }

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!serverUrlReady || !serverUrl) return undefined;
    clientRef.current?.connect(serverUrl);
    return () => clientRef.current?.disconnect();
  }, [serverUrl, serverUrlReady]);

  useEffect(() => () => clientRef.current?.disconnect(), []);

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
    if (!requireOnline()) return;
    setError('');
    requestedModeRef.current = 'local';
    clientRef.current?.createRoom(nickname.trim(), true);
  };

  const sendAction = (action: GameAction) => {
    if (!view) return;
    clientRef.current?.action(view.sequence, action);
  };

  const leave = () => {
    clientRef.current?.leave();
    requestedModeRef.current = 'home';
    setMode('home');
    setView(null);
    setSettlement(null);
    setError('');
  };

  const again = () => clientRef.current?.again();

  const saveServerUrl = (value: string) => {
    const next = value.trim() || DEFAULT_WS_URL;
    setServerUrl(next);
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
            serverUrl={serverUrl}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onStartLocal={startLocal}
            onRules={() => setRulesOpen(true)}
            onSettings={() => setSettingsOpen(true)}
          />
        )}

        {settlement && view?.phase === 'settlement' ? (
          <SettlementModal
            settlement={settlement}
            onAgain={again}
            onLeave={leave}
            readyCount={view.players.filter((player) => player.ready).length}
            alreadyReady={Boolean(view.players[view.mySeat]?.ready)}
          />
        ) : null}
        {rulesOpen ? <RulesModal onClose={() => setRulesOpen(false)} /> : null}
        {settingsOpen ? (
          <SettingsModal serverUrl={serverUrl} onSave={saveServerUrl} onClose={() => setSettingsOpen(false)} />
        ) : null}
        {error && inGame ? <div className="toast">{error}</div> : null}
      </div>
    </div>
  );
}
