export interface RoutingCondition {
  toolName?: string;
}

export interface RoutingRule {
  id: string;
  condition: RoutingCondition;
  targetServerId: string;
  priority: number;
  enabled: boolean;
}

/**
 * Simple in-memory routing rules store keyed by groupId
 * NOTE: For production, persist to DB (e.g., server_groups.routing_rules JSONB)
 */
export class RoutingRulesStore {
  private static instance: RoutingRulesStore;
  private rulesByGroup = new Map<string, RoutingRule[]>();

  static getInstance(): RoutingRulesStore {
    if (!this.instance) this.instance = new RoutingRulesStore();
    return this.instance;
  }

  getRules(groupId: string): RoutingRule[] {
    return this.rulesByGroup.get(groupId) || [];
  }

  setRules(groupId: string, rules: RoutingRule[]): void {
    // sort by priority desc for evaluation order
    const sorted = [...rules].sort((a, b) => b.priority - a.priority);
    this.rulesByGroup.set(groupId, sorted);
  }
}





