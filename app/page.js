"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import AddServerForm from "./components/AddServerForm";

export default function Home() {
  const router = useRouter();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingServer, setEditingServer] = useState(null);
  const [connectingServer, setConnectingServer] = useState(null);
  const [pingError, setPingError] = useState(null);

  const fetchServers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use relative path - will be proxied to localhost:8080
      const response = await fetch('/api/v1/servers');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Fetched servers:', data);
      setServers(data);
    } catch (err) {
      setError(err.message);
      // Для демонстрации добавим тестовые данные
      setServers([
        { id: 1, name: 'Production Server', ip: '192.168.1.100', port: 8080, status: 'online' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const addServer = (newServer) => {
    setServers(prev => [...prev, newServer]);
  };

  const handleEditServer = (server) => {
    setEditingServer(server);
  };

  const handleConnectToServer = async (server) => {
    setConnectingServer(server.id);
    setPingError(null);
    
    try {
      console.log(`Pinging server ${server.id}...`);
      
      // Отправляем пинг на сервер через API
      const response = await fetch(`/api/v1/server/${server.id}/ping`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });


      if (!response.ok) {
        throw new Error(`Ping failed: ${response.status}`);
      }

      console.log('Server is accessible, navigating...');
      router.push(`/servers/${server.id}`);
      
    } catch (error) {
      console.error('Ping error:', error);
      setPingError({
        message: `Server "${server.name || server.id}" is not accessible: ${error.message}`,
        server: server,
        showEditOption: true
      });
      
      // Автоматически скрыть ошибку через 10 секунд
      setTimeout(() => {
        setPingError(null);
      }, 10000);
    } finally {
      setConnectingServer(null);
    }
  };

  const updateServer = (updated) => {
    if (updated.deleted) {
      // Remove server from list if it was deleted
      setServers(prev => prev.filter(s => s.id !== updated.id));
    } else {
      // Update existing server
      setServers(prev =>
        prev.map(s => (s.id === updated.id ? updated : s))
      );
    }
  };

  const serverStats = {
    total: servers.length,
    online: servers.filter(s => s.status === 'online').length,
    offline: servers.filter(s => s.status === 'offline').length,
  };

  return (
    <div className="min-h-screen bg-slate-50 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Servers</h1>
              <p className="text-sm text-slate-500">Manage and connect to your file servers</p>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{serverStats.total}</div>
              <div className="text-xs sm:text-sm text-slate-500 mt-0.5">Total</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                <span className="text-2xl font-bold text-slate-900 tabular-nums">{serverStats.online}</span>
              </div>
              <div className="text-xs sm:text-sm text-slate-500 mt-0.5">Online</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                <span className="text-2xl font-bold text-slate-400 tabular-nums">{serverStats.offline}</span>
              </div>
              <div className="text-xs sm:text-sm text-slate-500 mt-0.5">Offline</div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <AddServerForm
            onServerAdded={addServer}
            editingServer={editingServer}
            onServerUpdated={updateServer}
            onClose={() => setEditingServer(null)}
          />
          <button
            onClick={fetchServers}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span className="hidden sm:inline">{loading ? 'Loading…' : 'Refresh'}</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-start gap-3">
            <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-900">Loading error</p>
              <p className="text-slate-500">{error}</p>
              <p className="text-slate-400 text-xs mt-1">Showing test data</p>
            </div>
          </div>
        )}

        {pingError && (
          <div className="mb-6 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 text-sm mb-1">Connection failed</h3>
                <p className="text-slate-500 text-sm mb-4">
                  {typeof pingError === 'string' ? pingError : pingError.message}
                </p>

                {pingError.showEditOption && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        handleEditServer(pingError.server);
                        setPingError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                      Edit settings
                    </button>

                    <button
                      onClick={() => handleConnectToServer(pingError.server)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                      disabled={connectingServer === pingError.server?.id}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      {connectingServer === pingError.server?.id ? 'Retrying…' : 'Try again'}
                    </button>

                    <button
                      onClick={() => setPingError(null)}
                      className="inline-flex items-center px-3.5 py-2 text-slate-500 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {loading && servers.length === 0 && (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-700 border-t-transparent"></div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => {
            const isOnline = server.status === 'online';
            return (
              <div
                key={server.id}
                className="group p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 truncate">
                      {server.name || `Server ${server.id}`}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                      isOnline ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
                    {server.status || 'offline'}
                  </span>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center text-slate-500">
                    <span className="w-14 flex-shrink-0 text-slate-400">Host</span>
                    <span className="font-mono text-slate-700 truncate">{server.host_name}</span>
                  </div>
                  {server.port && (
                    <div className="flex items-center text-slate-500">
                      <span className="w-14 flex-shrink-0 text-slate-400">Port</span>
                      <span className="font-mono text-slate-700">{server.port}</span>
                    </div>
                  )}
                  <div className="flex items-center text-slate-500">
                    <span className="w-14 flex-shrink-0 text-slate-400">ID</span>
                    <span className="font-mono text-slate-700">{server.id}</span>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={connectingServer === server.id}
                    onClick={() => handleConnectToServer(server)}
                  >
                    {connectingServer === server.id ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Connecting…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                        </svg>
                        Connect
                      </>
                    )}
                  </button>
                  <button
                    className="inline-flex items-center justify-center px-3 py-2.5 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
                    onClick={() => handleEditServer(server)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {servers.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">No servers yet</h3>
            <p className="text-slate-500 text-sm">Add your first server to get started</p>
          </div>
        )}
      </main>
    </div>
  );
}
