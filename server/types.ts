export type RatatoskrConfig = {
  prefix: string;
  name?: string;
  description?: string;
  thumbnail?: string | null;
};

export type ProjectSummary = {
  name: string;
  config: RatatoskrConfig | null;
  hasConfig: boolean;
  warnings: string[];
};
