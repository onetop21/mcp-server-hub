import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../lib/api';
import { ArrowLeft, Plus, Copy, Trash2, Key } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed?: string;
}

const ApiKeys: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const data = await apiClient.getApiKeys();
      setApiKeys(data.apiKeys || []);
    } catch (err: any) {
      setError('API 키 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setCreating(true);
    try {
      const response = await apiClient.createApiKey(newKeyName.trim());
      setApiKeys([...apiKeys, response.apiKey]);
      setNewKeyName('');
      setShowCreateForm(false);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || '알 수 없는 오류';
      if (status === 409) {
        setError('동일한 이름의 활성 API 키가 이미 존재합니다. 다른 이름을 사용하세요.');
      } else {
        setError('API 키 생성에 실패했습니다: ' + msg);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('정말로 이 API 키를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await apiClient.deleteApiKey(id);
      setApiKeys(apiKeys.filter(key => key.id !== id));
    } catch (err: any) {
      setError('API 키 삭제에 실패했습니다.');
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    alert('API 키가 클립보드에 복사되었습니다.');
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
                <h1 className="text-3xl font-bold text-gray-900">API 키 관리</h1>
                <p className="text-gray-600">API 키를 생성하고 관리하세요</p>
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                새 API 키
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
        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white shadow rounded-lg mb-6 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">새 API 키 생성</h3>
            <form onSubmit={handleCreateKey}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="keyName" className="block text-sm font-medium text-gray-700">
                    키 이름
                  </label>
                  <input
                    type="text"
                    id="keyName"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="예: 프로덕션 키, 개발 키"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-end space-x-3">
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn-primary"
                  >
                    {creating ? '생성 중...' : '생성'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewKeyName('');
                    }}
                    className="btn-secondary"
                  >
                    취소
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* API Keys List */}
        {loading ? (
          <div className="text-center py-8">로딩 중...</div>
        ) : error ? (
          <div className="text-red-600 text-center py-8">{error}</div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-12">
            <Key className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">API 키가 없습니다</h3>
            <p className="mt-1 text-sm text-gray-500">
              첫 번째 API 키를 생성해보세요.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary"
              >
                API 키 생성하기
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {apiKeys.map((apiKey) => (
                <li key={apiKey.id}>
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Key className="h-8 w-8 text-gray-400" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {apiKey.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          생성일: {new Date(apiKey.createdAt).toLocaleDateString()}
                        </div>
                        {apiKey.lastUsed && (
                          <div className="text-sm text-gray-500">
                            마지막 사용: {new Date(apiKey.lastUsed).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                          {apiKey.key.substring(0, 8)}...
                        </code>
                        <button
                          onClick={() => handleCopyKey(apiKey.key)}
                          className="p-2 text-gray-400 hover:text-gray-600"
                          title="복사"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleDeleteKey(apiKey.id)}
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

        {/* Usage Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">API 키 사용법</h3>
          <div className="text-sm text-blue-800">
            <p className="mb-2">API 키를 사용하여 MCP Hub API에 인증할 수 있습니다:</p>
            <code className="block bg-blue-100 p-2 rounded text-xs">
              curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3000/api/servers
            </code>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ApiKeys;


