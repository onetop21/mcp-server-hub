export interface Endpoint {
  id: string;
  userId: string;
  groupId?: string;
  url: string;
  sseUrl: string;
  httpUrl: string;
  apiKeyId: string;
  createdAt: Date;
  lastAccessedAt?: Date;
}

export interface ServerGroup {
  id: string;
  userId: string;
  name: string;
  description: string;
  serverIds: string[];
  routingRules: RoutingRule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupConfig {
  name: string;
  description?: string;
  servers?: string[];
  serverIds?: string[];
  routingPolicy?: RoutingPolicy;
}

export type RoutingPolicy = 'round-robin' | 'random' | 'priority';

export interface RoutingRule {
  id: string;
  condition: RoutingCondition;
  targetServerId: string;
  priority: number;
  enabled: boolean;
}

export interface RoutingCondition {
  toolName?: string;
  parameterMatch?: Record<string, any>;
  serverTags?: string[];
}