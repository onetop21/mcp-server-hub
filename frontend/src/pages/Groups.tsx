import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../lib/api';
import { LogOut, PlusCircle, Edit, Trash2, Share2 } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description?: string;
  serverIds: string[];
  createdAt: string;
  updatedAt: string;
}

const Groups: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const navigate = useNavigate();
  const { logout } = useAuthStore();

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await apiClient.getGroups();
      setGroups((data.groups || []).map((g: any) => ({
        id: g.id,
        name: g.name,
        description: g.description || '',
        serverIds: g.serverIds || [],
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })));
    } catch (err: any) {
      setError('그룹 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await apiClient.createGroup({ name: newName.trim(), description: newDesc.trim() || undefined });
      const g = res.group || res;
      setGroups([...groups, {
        id: g.id,
        name: g.name,
        description: g.description || '',
        serverIds: g.serverIds || [],
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      }]);
      setShowCreateForm(false);
      setNewName('');
      setNewDesc('');
    } catch (err: any) {
      setError('그룹 생성에 실패했습니다: ' + (err.response?.data?.error?.message || '알 수 없는 오류'));
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (id: string) => {
    const current = groups.find(g => g.id === id);
    const name = prompt('새 그룹 이름을 입력하세요', current?.name || '');
    if (!name || !name.trim()) return;
    try {
      await apiClient.updateGroup(id, { name: name.trim() });
      setGroups(groups.map(g => g.id === id ? { ...g, name: name.trim() } : g));
    } catch (err: any) {
      alert('수정 실패: ' + (err.response?.data?.error?.message || '알 수 없는 오류'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 그룹을 삭제하시겠습니까?')) return;
    try {
      await apiClient.deleteGroup(id);
      setGroups(groups.filter(g => g.id !== id));
    } catch (err: any) {
      alert('삭제 실패: ' + (err.response?.data?.error?.message || '알 수 없는 오류'));
    }
  };

  const handleEditRules = async (id: string) => {
    try {
      const data = await apiClient.getGroupRoutingRules(id);
      const existing = data.rules || [];
      const toolName = prompt('규칙 추가 - toolName (예: create_issue)', '');
      if (toolName === null) return;
      const targetServerId = prompt('규칙 추가 - targetServerId (서버 ID)', '');
      if (!targetServerId) return;
      const priorityStr = prompt('규칙 추가 - priority (숫자, 높을수록 우선)', '100');
      const priority = Number(priorityStr || '100');
      const ruleId = `rule-${Date.now()}`;
      const newRules = [
        ...existing,
        { id: ruleId, condition: { toolName: toolName || undefined }, targetServerId, priority, enabled: true }
      ];
      await apiClient.setGroupRoutingRules(id, newRules);
      alert('규칙이 저장되었습니다.');
    } catch (err: any) {
      alert('규칙 편집 실패: ' + (err.response?.data?.error?.message || '알 수 없는 오류'));
    }
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
              <div>
                <h1 className="text-3xl font-bold text-gray-900">그룹 관리</h1>
                <p className="text-gray-600">서버 그룹과 라우팅 규칙을 관리하세요</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary flex items-center"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                그룹 추가
              </button>
              <button onClick={handleLogout} className="btn-secondary">
                <LogOut className="w-4 h-4 mr-2" /> 로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {showCreateForm && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <input
                type="text"
                className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="그룹 이름"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <input
                type="text"
                className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="설명 (선택)"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
              <div className="flex space-x-2">
                <button type="submit" disabled={creating} className="btn-primary flex-1">{creating ? '생성 중...' : '생성'}</button>
                <button type="button" onClick={() => setShowCreateForm(false)} className="btn-secondary">취소</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">로딩 중...</div>
        ) : error ? (
          <div className="text-red-600 text-center py-8">{error}</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900">그룹이 없습니다</h3>
            <p className="mt-1 text-sm text-gray-500">첫 번째 그룹을 생성해보세요.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {groups.map(group => (
              <li key={group.id} className="bg-white shadow rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{group.name}</h3>
                    <p className="text-sm text-gray-500">{group.description}</p>
                    <div className="mt-2 text-xs text-gray-500">서버 {group.serverIds.length}개</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => handleEdit(group.id)} className="p-2 text-gray-400 hover:text-gray-600" title="편집">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleEditRules(group.id)} className="p-2 text-gray-400 hover:text-gray-600" title="라우팅 규칙">
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(group.id)} className="p-2 text-red-500 hover:text-red-600" title="삭제">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default Groups;



