import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../lib/api';
import { LogOut, Server, ShoppingCart, Key } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [servers, setServers] = useState([]);
  const [apiKeyCount, setApiKeyCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      loadServers();
      loadApiKeysCount();
    }
  }, [isAuthenticated]);

  const loadServers = async () => {
    try {
      const data = await apiClient.getServers();
      setServers(data.servers || []);
    } catch (err: any) {
      setError('서버 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadApiKeysCount = async () => {
    try {
      const data = await apiClient.getApiKeys();
      const list = data.apiKeys || data.keys || [];
      setApiKeyCount(Array.isArray(list) ? list.length : 0);
    } catch (err: any) {
      // 무시(카운트 실패 시 0)
      setApiKeyCount(0);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const stats = [
    {
      name: '등록된 서버',
      value: servers.length,
      icon: Server,
      color: 'bg-blue-500',
    },
    {
      name: '마켓플레이스',
      value: '12',
      icon: ShoppingCart,
      color: 'bg-green-500',
    },
    {
      name: 'API 키',
      value: apiKeyCount,
      icon: Key,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">MCP Hub</h1>
              <p className="text-gray-600">환영합니다, {user?.username}님!</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <LogOut className="w-4 h-4 mr-2" />
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`p-3 rounded-md ${stat.color}`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stat.value}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              빠른 작업
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <button
                onClick={() => navigate('/servers')}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg border border-gray-300 hover:border-gray-400"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-blue-50 text-blue-700 ring-4 ring-white">
                    <Server className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium">
                    <span className="absolute inset-0" aria-hidden="true" />
                    서버 관리
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    MCP 서버를 추가하고 관리하세요
                  </p>
                </div>
              </button>

              <button
                onClick={() => navigate('/marketplace')}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg border border-gray-300 hover:border-gray-400"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-700 ring-4 ring-white">
                    <ShoppingCart className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium">
                    <span className="absolute inset-0" aria-hidden="true" />
                    마켓플레이스
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    새로운 서버 템플릿을 찾아보세요
                  </p>
                </div>
              </button>

              <button
                onClick={() => navigate('/api-keys')}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg border border-gray-300 hover:border-gray-400"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 ring-4 ring-white">
                    <Key className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium">
                    <span className="absolute inset-0" aria-hidden="true" />
                    API 키 관리
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    API 키를 생성하고 관리하세요
                  </p>
                </div>
              </button>

              <button
                onClick={() => navigate('/groups')}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg border border-gray-300 hover:border-gray-400"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-yellow-50 text-yellow-700 ring-4 ring-white">
                    <Server className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium">
                    <span className="absolute inset-0" aria-hidden="true" />
                    그룹 관리
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    서버 그룹과 라우팅 규칙을 설정하세요
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Servers */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              최근 서버
            </h3>
            {loading ? (
              <div className="text-center py-4">로딩 중...</div>
            ) : error ? (
              <div className="text-red-600 text-center py-4">{error}</div>
            ) : servers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Server className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">서버가 없습니다</h3>
                <p className="mt-1 text-sm text-gray-500">
                  첫 번째 MCP 서버를 추가해보세요.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => navigate('/servers')}
                    className="btn-primary"
                  >
                    서버 추가하기
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden">
                <ul className="divide-y divide-gray-200">
                  {servers.slice(0, 5).map((server: any) => (
                    <li key={server.id} className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <Server className="h-8 w-8 text-gray-400" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {server.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {server.url}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            server.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {server.status === 'active' ? '활성' : '비활성'}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;

