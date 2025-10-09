import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../lib/api';
import { ArrowLeft, Plus, Edit, Trash2, Play, Server, X, Eye, EyeOff } from 'lucide-react';

interface Server {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  description?: string; // e.g., namespace 표시 등
  createdAt: string;
  protocol?: string;
  namespace?: string;
  config?: any;
}

interface Tool {
  name: string;
  description: string;
  inputSchema?: any;
}

const Servers: React.FC = () => {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<'stdio' | 'http' | 'sse'>('stdio');
  const [namespace, setNamespace] = useState('');
  const [stdioCommand, setStdioCommand] = useState('');
  const [stdioArgs, setStdioArgs] = useState(''); // comma-separated
  const [httpBaseUrl, setHttpBaseUrl] = useState('');
  const [sseUrl, setSseUrl] = useState('');

  // edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    namespace: '',
    protocol: 'stdio' as 'stdio' | 'http' | 'sse',
    stdioCommand: '',
    stdioArgs: '',
    httpBaseUrl: '',
    sseUrl: ''
  });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState('');

  // tools modal state
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [serverTools, setServerTools] = useState<Tool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [toolsError, setToolsError] = useState('');
  
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const data = await apiClient.getServers();
      const items: Server[] = (data.servers || []).map((s: any) => ({
        id: s.serverId || s.id,
        name: s.name,
        status: s.status || 'inactive',
        description: s.namespace ? `namespace: ${s.namespace}` : undefined,
        createdAt: s.createdAt || new Date().toISOString(),
      }));
      setServers(items);
    } catch (err: any) {
      setError('서버 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!name.trim()) {
      setCreateError('이름을 입력하세요.');
      return;
    }
    setCreating(true);
    try {
      let config: any = {};
      if (protocol === 'stdio') {
        if (!stdioCommand.trim()) {
          throw new Error('STDIO command를 입력하세요.');
        }
        const args = stdioArgs
          ? stdioArgs.split(',').map(s => s.trim()).filter(Boolean)
          : [];
        config = { stdio: { command: stdioCommand.trim(), args, env: {} } };
      } else if (protocol === 'http') {
        if (!httpBaseUrl.trim()) {
          throw new Error('HTTP baseUrl을 입력하세요.');
        }
        config = { http: { baseUrl: httpBaseUrl.trim(), headers: {} } };
      } else if (protocol === 'sse') {
        if (!sseUrl.trim()) {
          throw new Error('SSE url을 입력하세요.');
        }
        config = { sse: { url: sseUrl.trim(), headers: {} } };
      }

      const payload = {
        name: name.trim(),
        protocol,
        config,
        namespace: namespace.trim() || undefined,
      };
      const res = await apiClient.createServer(payload);
      const created: Server = {
        id: res.serverId || res.id,
        name: res.name,
        status: res.status || 'inactive',
        description: res.namespace ? `namespace: ${res.namespace}` : undefined,
        createdAt: res.createdAt || new Date().toISOString(),
      };
      setServers([created, ...servers]);
      // reset form
      setShowCreateForm(false);
      setName(''); setNamespace(''); setProtocol('stdio');
      setStdioCommand(''); setStdioArgs(''); setHttpBaseUrl(''); setSseUrl('');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '알 수 없는 오류';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 서버를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await apiClient.deleteServer(id);
      setServers(servers.filter(server => server.id !== id));
    } catch (err: any) {
      setError('서버 삭제에 실패했습니다.');
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      await apiClient.testServerConnection(id);
      setServers(servers.map(s => s.id === id ? { ...s, status: 'active' } : s));
      alert('연결 테스트 성공! 서버가 활성화되었습니다.');
    } catch (err: any) {
      alert('연결 테스트 실패: ' + (err.response?.data?.message || '알 수 없는 오류'));
    }
  };

  const openEditModal = (id: string) => {
    const server = servers.find(s => s.id === id);
    if (!server) return;

    setEditingServer(server);
    setEditForm({
      name: server.name,
      namespace: server.namespace || '',
      protocol: server.protocol as 'stdio' | 'http' | 'sse' || 'stdio',
      stdioCommand: server.config?.stdio?.command || '',
      stdioArgs: server.config?.stdio?.args?.join(', ') || '',
      httpBaseUrl: server.config?.http?.baseUrl || '',
      sseUrl: server.config?.sse?.url || ''
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingServer(null);
    setEditForm({
      name: '',
      namespace: '',
      protocol: 'stdio',
      stdioCommand: '',
      stdioArgs: '',
      httpBaseUrl: '',
      sseUrl: ''
    });
    setEditError('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServer) return;

    setEditing(true);
    setEditError('');

    try {
      const updateData: any = {
        name: editForm.name.trim(),
        namespace: editForm.namespace.trim() || undefined
      };

      // Protocol-specific config
      if (editForm.protocol === 'stdio') {
        updateData.config = {
          stdio: {
            command: editForm.stdioCommand.trim(),
            args: editForm.stdioArgs.split(',').map(arg => arg.trim()).filter(arg => arg.length > 0)
          }
        };
      } else if (editForm.protocol === 'http') {
        updateData.config = {
          http: {
            baseUrl: editForm.httpBaseUrl.trim()
          }
        };
      } else if (editForm.protocol === 'sse') {
        updateData.config = {
          sse: {
            url: editForm.sseUrl.trim()
          }
        };
      }

      const res = await apiClient.updateServer(editingServer.id, updateData);
      setServers(servers.map(s =>
        s.id === editingServer.id
          ? { ...s, name: res.name, namespace: res.namespace, config: res.config }
          : s
      ));
      closeEditModal();
    } catch (err: any) {
      setEditError(err.response?.data?.error?.message || '알 수 없는 오류');
    } finally {
      setEditing(false);
    }
  };

  const openToolsModal = async (id: string) => {
    setLoadingTools(true);
    setToolsError('');
    setServerTools([]);

    try {
      const data = await apiClient.getServerTools(id);
      setServerTools(data.tools || []);
    } catch (err: any) {
      setToolsError(err.response?.data?.message || '알 수 없는 오류');
    } finally {
      setLoadingTools(false);
    }

    setShowToolsModal(true);
  };

  const closeToolsModal = () => {
    setShowToolsModal(false);
    setServerTools([]);
    setToolsError('');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">서버 관리</h1>
                <p className="text-gray-600">MCP 서버를 관리하세요</p>
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => { setShowCreateForm(true); }}
                className="btn-primary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                서버 추가
              </button>
              <button
                onClick={handleLogout}
                className="btn-secondary"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-center py-8">로딩 중...</div>
        ) : error ? (
          <div className="text-red-600 text-center py-8">{error}</div>
        ) : servers.length === 0 ? (
          <div className="text-center py-12">
            <Server className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">서버가 없습니다</h3>
            <p className="mt-1 text-sm text-gray-500">
              첫 번째 MCP 서버를 추가해보세요.
            </p>
            <div className="mt-6">
              <button
                onClick={() => { setShowCreateForm(true); }}
                className="btn-primary"
              >
                서버 추가하기
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {servers.map((server) => (
                <li key={server.id}>
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Server className="h-8 w-8 text-gray-400" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {server.name}
                        </div>
                        {server.description && (
                          <div className="text-sm text-gray-500">{server.description}</div>
                        )}
                        {server.description && (
                          <div className="text-sm text-gray-500 mt-1">
                            {server.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        server.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {server.status === 'active' ? '활성' : '비활성'}
                      </span>
                      <button
                        onClick={() => handleTestConnection(server.id)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                        title="연결 테스트"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(server.id)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                        title="편집"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {server.status === 'active' && (
                        <button
                          onClick={() => openToolsModal(server.id)}
                          className="p-2 text-gray-400 hover:text-gray-600"
                          title="도구 목록"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(server.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white shadow rounded-lg p-6 mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">새 서버 추가</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && (
                <div className="text-red-600 text-sm">{createError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">이름</label>
                  <input className="mt-1 block w-full border-gray-300 rounded-md" value={name} onChange={e=>setName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">네임스페이스(선택)</label>
                  <input className="mt-1 block w-full border-gray-300 rounded-md" value={namespace} onChange={e=>setNamespace(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">프로토콜</label>
                  <select className="mt-1 block w-full border-gray-300 rounded-md" value={protocol} onChange={e=>setProtocol(e.target.value as any)}>
                    <option value="stdio">stdio</option>
                    <option value="http">http</option>
                    <option value="sse">sse</option>
                  </select>
                </div>
              </div>

              {protocol === 'stdio' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">STDIO command</label>
                    <input className="mt-1 block w-full border-gray-300 rounded-md" value={stdioCommand} onChange={e=>setStdioCommand(e.target.value)} placeholder="예: node" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">STDIO args(콤마 구분)</label>
                    <input className="mt-1 block w-full border-gray-300 rounded-md" value={stdioArgs} onChange={e=>setStdioArgs(e.target.value)} placeholder="예: -v" />
                  </div>
                </div>
              )}

              {protocol === 'http' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">HTTP baseUrl</label>
                  <input className="mt-1 block w-full border-gray-300 rounded-md" value={httpBaseUrl} onChange={e=>setHttpBaseUrl(e.target.value)} placeholder="예: http://localhost:1234" required />
                </div>
              )}

              {protocol === 'sse' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">SSE url</label>
                  <input className="mt-1 block w-full border-gray-300 rounded-md" value={sseUrl} onChange={e=>setSseUrl(e.target.value)} placeholder="예: http://localhost:1234/events" required />
                </div>
              )}

              <div className="flex space-x-3">
                <button type="submit" className="btn-primary" disabled={creating}>{creating ? '생성 중...' : '생성'}</button>
                <button type="button" className="btn-secondary" onClick={()=>{ setShowCreateForm(false); setCreateError(''); }}>
                  취소
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Edit Server Modal */}
      {showEditModal && editingServer && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">서버 수정</h3>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">이름</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    value={editForm.name}
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">네임스페이스</label>
                  <input
                    type="text"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    value={editForm.namespace}
                    onChange={e => setEditForm({...editForm, namespace: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">프로토콜</label>
                  <select
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    value={editForm.protocol}
                    onChange={e => setEditForm({...editForm, protocol: e.target.value as 'stdio' | 'http' | 'sse'})}
                  >
                    <option value="stdio">STDIO</option>
                    <option value="http">HTTP</option>
                    <option value="sse">SSE</option>
                  </select>
                </div>

                {editForm.protocol === 'stdio' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">명령어</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        value={editForm.stdioCommand}
                        onChange={e => setEditForm({...editForm, stdioCommand: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">인자 (쉼표로 구분)</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        value={editForm.stdioArgs}
                        onChange={e => setEditForm({...editForm, stdioArgs: e.target.value})}
                        placeholder="arg1, arg2, arg3"
                      />
                    </div>
                  </>
                )}

                {editForm.protocol === 'http' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">기본 URL</label>
                    <input
                      type="url"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.httpBaseUrl}
                      onChange={e => setEditForm({...editForm, httpBaseUrl: e.target.value})}
                    />
                  </div>
                )}

                {editForm.protocol === 'sse' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">SSE URL</label>
                    <input
                      type="url"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      value={editForm.sseUrl}
                      onChange={e => setEditForm({...editForm, sseUrl: e.target.value})}
                    />
                  </div>
                )}

                {editError && (
                  <div className="text-red-600 text-sm">{editError}</div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="btn-secondary"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={editing}
                    className="btn-primary"
                  >
                    {editing ? '수정 중...' : '수정'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tools Modal */}
      {showToolsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">서버 도구 목록</h3>
                <button
                  onClick={closeToolsModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {loadingTools ? (
                <div className="text-center py-8">로딩 중...</div>
              ) : toolsError ? (
                <div className="text-red-600 text-center py-8">{toolsError}</div>
              ) : serverTools.length === 0 ? (
                <div className="text-center py-8 text-gray-500">도구가 없습니다.</div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {serverTools.map((tool, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">{tool.name}</h4>
                      <p className="text-sm text-gray-600 mb-3">{tool.description}</p>
                      {tool.inputSchema && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                            입력 스키마 보기
                          </summary>
                          <pre className="mt-2 bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(tool.inputSchema, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={closeToolsModal}
                  className="btn-secondary"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Servers;


