"use client";

import { useState, useEffect } from "react";
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function AddServerForm({ onServerAdded, editingServer, onServerUpdated, onClose }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [connectingToServer, setConnectingToServer] = useState(false);
  const [pingError, setPingError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    host_name: '',
    port: '8080',
    status: 'offline'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editingServer) {
      // Pre-fill form for editing
      setFormData({
        name: editingServer.name || editingServer.id?.toString() || '',
        host_name: editingServer.host_name || '',
        port: editingServer.port?.toString() || '8080',
        status: editingServer.status || 'offline'
      });
      setIsOpen(true);
    }
  }, [editingServer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const serverData = {
        name: formData.name,
        host_name: formData.host_name,
        port: parseInt(formData.port) || 0,
        status: formData.status,
        ...(editingServer && { id: parseFloat(editingServer.id) })
      };
      console.log('editingServer:', editingServer);
      // Use proxied endpoint through Next.js
      const route = editingServer
        ? `/api/v1/server/${editingServer.id}`
        : '/api/v1/servers';
      const method = editingServer ? 'PUT' : 'POST';

      const response = await fetch(route, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Request failed');
      }

      const updatedServer = await response.json();
      if (editingServer) {
        onServerUpdated(updatedServer);
      } else {
        onServerAdded(updatedServer);
      }

      setIsOpen(false);
      onClose && onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingServer?.id) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response =  await fetch(`/api/v1/server/delete/${editingServer.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      
      // Remove server from UI after successful deletion
      onServerUpdated && onServerUpdated({ ...editingServer, deleted: true });
      setIsOpen(false);
      onClose && onClose();
    } catch (error) {
      console.error('Error deleting server:', error);
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleConnectToServer = async () => {
    if (!editingServer?.id) return;
    
    setConnectingToServer(true);
    setPingError(null);
    
    try {
      console.log(`Pinging server ${editingServer.id}...`);
      
      // Отправляем пинг на сервер через API
      const response = await fetch(`/api/v1/server/ping/${editingServer.id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Ping failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Ping error:', error);
      setPingError({
        message: `Server is not accessible: ${error.message}`,
        showRetryOption: true
      });
      
      // Автоматически скрыть ошибку через 8 секунд
      setTimeout(() => {
        setPingError(null);
      }, 8000);
    } finally {
      setConnectingToServer(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-800 active:bg-slate-700 transition-colors shadow-sm font-medium"
      >
        {isOpen ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Server
          </>
        )}
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">
                {editingServer ? 'Edit server' : 'Add new server'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onClose && onClose();
                }}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {error && (
                <div className="mb-5 p-3.5 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-2.5 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              {pingError && (
                <div className="mb-5 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 text-sm mb-1">Connection failed</h4>
                      <p className="text-slate-500 text-sm mb-3">
                        {typeof pingError === 'string' ? pingError : pingError.message}
                      </p>

                      {pingError.showRetryOption && (
                        <div className="flex gap-2">
                          <button
                            onClick={handleConnectToServer}
                            disabled={connectingToServer}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-xs font-medium"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            {connectingToServer ? 'Retrying…' : 'Try again'}
                          </button>

                          <button
                            onClick={() => setPingError(null)}
                            className="inline-flex items-center px-3 py-1.5 text-slate-500 rounded-lg hover:bg-slate-100 transition-colors text-xs font-medium"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                    Server name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                    placeholder="My Server"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="host_name" className="block text-sm font-medium text-slate-700">
                    Host name / IP address
                  </label>
                  <input
                    type="text"
                    id="host_name"
                    name="host_name"
                    value={formData.host_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                    placeholder="192.168.1.100 or server.example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="port" className="block text-sm font-medium text-slate-700">
                    Port
                  </label>
                  <input
                    type="number"
                    id="port"
                    name="port"
                    value={formData.port}
                    onChange={handleInputChange}
                    min="1"
                    max="65535"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                    placeholder="8080"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {editingServer ? 'Updating…' : 'Adding…'}
                    </>
                  ) : (
                    editingServer ? 'Update' : 'Add server'
                  )}
                </button>
                {editingServer && editingServer.id && (
                  <button
                    type="button"
                    onClick={handleConnectToServer}
                    disabled={connectingToServer}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connectingToServer ? (
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
                )}
                {editingServer && editingServer.id && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex items-center justify-center px-4 py-2.5 text-sm text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    disabled={isSubmitting}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
