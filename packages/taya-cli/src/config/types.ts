export type Provider = "github" | "bits-codebase";

export interface WorkDirectory {
  path: string;
  provider?: Provider;
  default_branch?: string;
  last_used_at?: string;
  use_count: number;
}

export interface WorkdirsDocument {
  workdirs: WorkDirectory[];
}

export interface TayaConfig {
  version: 1;
  herdr_session: "taya";
  default_workflow: string;
}
