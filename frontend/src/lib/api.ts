import axios from 'axios';
import type { AxiosInstance } from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth-storage');
      if (token) {
        try {
          const authData = JSON.parse(token);
          if (authData.state?.token) {
            config.headers.Authorization = `Bearer ${authData.state.token}`;
          }
        } catch (error) {
          console.error('Error parsing auth token:', error);
        }
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Only redirect if not already on login page
          if (window.location.pathname !== '/login') {
            localStorage.removeItem('auth-storage');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // User endpoints
  async register(userData: { username: string; email: string; password: string }) {
    const response = await this.client.post('/users/register', userData);
    return response.data;
  }

  async login(credentials: { email: string; password: string }) {
    const response = await this.client.post('/users/login', credentials);
    return response.data;
  }

  async getProfile() {
    const response = await this.client.get('/users/profile');
    return response.data;
  }

  // Server endpoints
  async getServers() {
    const response = await this.client.get('/servers');
    return response.data;
  }

  async getServer(id: string) {
    const response = await this.client.get(`/servers/${id}`);
    return response.data;
  }

  async createServer(serverData: any) {
    const response = await this.client.post('/servers', serverData);
    return response.data;
  }

  async updateServer(id: string, serverData: any) {
    const response = await this.client.put(`/servers/${id}`, serverData);
    return response.data;
  }

  async deleteServer(id: string) {
    const response = await this.client.delete(`/servers/${id}`);
    return response.data;
  }

  async getServerTools(id: string) {
    const response = await this.client.get(`/servers/${id}/tools`);
    return response.data;
  }

  async testServerConnection(id: string) {
    const response = await this.client.post(`/servers/${id}/test`);
    return response.data;
  }

  // Marketplace endpoints
  async getMarketplaceServers() {
    const response = await this.client.get('/marketplace');
    return response.data;
  }

  async getMarketplaceServer(id: string) {
    const response = await this.client.get(`/marketplace/${id}`);
    return response.data;
  }

  async installMarketplaceServer(serverId: string, config: any) {
    const response = await this.client.post(`/marketplace/${serverId}/install`, config);
    return response.data;
  }

  // API Keys endpoints
  async getApiKeys() {
    const response = await this.client.get('/users/api-keys');
    return response.data;
  }

  // Group endpoints
  async getGroups() {
    const response = await this.client.get('/groups');
    return response.data;
  }

  async createGroup(data: { name: string; description?: string; serverIds?: string[] }) {
    const response = await this.client.post('/groups', data);
    return response.data;
  }

  async updateGroup(id: string, data: { name?: string; description?: string; serverIds?: string[] }) {
    const response = await this.client.put(`/groups/${id}`, data);
    return response.data;
  }

  async deleteGroup(id: string) {
    const response = await this.client.delete(`/groups/${id}`);
    return response.data;
  }

  async getGroupRoutingRules(groupId: string) {
    const response = await this.client.get(`/groups/${groupId}/routing-rules`);
    return response.data;
  }

  async setGroupRoutingRules(groupId: string, rules: any[]) {
    const response = await this.client.put(`/groups/${groupId}/routing-rules`, { rules });
    return response.data;
  }

  async createApiKey(name: string) {
    const response = await this.client.post('/users/api-keys', { name });
    return response.data;
  }

  async deleteApiKey(id: string) {
    const response = await this.client.delete(`/users/api-keys/${id}`);
    return response.data;
  }
}

export const apiClient = new ApiClient();

