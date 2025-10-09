import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../lib/api';
import { ArrowLeft, Download, Star, ExternalLink } from 'lucide-react';

interface MarketplaceServer {
  id: string;
  name: string;
  description: string;
  protocol: 'stdio' | 'http' | 'sse';
  rating?: number;
  installCount?: number;
  tags: string[];
  documentation?: string;
}

const Marketplace: React.FC = () => {
  const [servers, setServers] = useState<MarketplaceServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  useEffect(() => {
    loadMarketplaceServers();
  }, []);

  const loadMarketplaceServers = async () => {
    try {
      const data = await apiClient.getMarketplaceServers();
      setServers(data.servers || []);
    } catch (err: any) {
      setError('마켓플레이스 서버 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (serverId: string) => {
    try {
      const details = await apiClient.getMarketplaceServer(serverId);
      const name = prompt('설치할 서버의 이름을 입력하세요', details?.name || '');
      if (!name || !name.trim()) return;

      const env: Record<string, string> = {};
      const requiredEnv: string[] = details?.requiredEnv || [];
      for (const key of requiredEnv) {
        const value = prompt(`환경변수 ${key} 값을 입력하세요`, '');
        if (value === null || value.trim() === '') {
          alert(`${key} 값이 필요합니다.`);
          return;
        }
        env[key] = value.trim();
      }

      await apiClient.installMarketplaceServer(serverId, { name: name.trim(), env });
      alert('서버가 성공적으로 설치되었습니다!');
      navigate('/servers');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || '알 수 없는 오류';
      alert('서버 설치에 실패했습니다: ' + msg);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const categories = ['all', 'integration'];
  const filteredServers = servers.filter(server => {
    const matchesSearch = server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         server.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || selectedCategory === 'integration';
    return matchesSearch && matchesCategory;
  });

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
                <h1 className="text-3xl font-bold text-gray-900">마켓플레이스</h1>
                <p className="text-gray-600">MCP 서버 템플릿을 찾아보세요</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-secondary"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="bg-white shadow rounded-lg mb-6 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                검색
              </label>
              <input
                type="text"
                id="search"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="서버 이름이나 설명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                카테고리
              </label>
              <select
                id="category"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? '전체' : category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Server Grid */}
        {loading ? (
          <div className="text-center py-8">로딩 중...</div>
        ) : error ? (
          <div className="text-red-600 text-center py-8">{error}</div>
        ) : filteredServers.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900">검색 결과가 없습니다</h3>
            <p className="mt-1 text-sm text-gray-500">
              다른 검색어나 카테고리를 시도해보세요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServers.map((server) => (
              <div key={server.id} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">{server.name}</h3>
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {server.protocol}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{server.description}</p>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-400 mr-1" />
                        {server.rating ?? 5}
                      </div>
                      <div className="flex items-center">
                        <Download className="h-4 w-4 mr-1" />
                        {server.installCount ?? 0}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {server.protocol}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1">
                    {server.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex space-x-3">
                    <button
                      onClick={() => handleInstall(server.id)}
                      className="flex-1 btn-primary flex items-center justify-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      설치
                    </button>
                    <button
                      onClick={() => window.open(server.documentation, '_blank')}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Marketplace;



