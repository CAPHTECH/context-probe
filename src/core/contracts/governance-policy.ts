export interface MetricThresholds {
  warn?: number;
  fail?: number;
}

export interface MetricPolicy {
  formula: string;
  thresholds?: MetricThresholds;
}

export interface DomainPolicy {
  metrics: Record<string, MetricPolicy>;
  review?: {
    require_human_if?: string[];
  };
}

export interface PolicyConfig {
  profiles: Record<
    string,
    {
      domains: Record<string, DomainPolicy>;
      history_filters?: {
        ignore_commit_patterns?: string[];
        ignore_paths?: string[];
      };
    }
  >;
}
