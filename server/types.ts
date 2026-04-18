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

export type TicketType = 'Task' | 'Epic';

export type TicketState =
  | 'NOT_READY'
  | 'PLANNING'
  | 'READY'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE';

export type TicketSummary = {
  number: number;
  displayId: string;
  type: TicketType;
  title: string;
  epic?: number;
  epicTitle?: string;
  state: TicketState;
  planDoc?: string;
  created: string;
  updated: string;
};
