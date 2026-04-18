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
  state: TicketState;
  created: string;
  updated: string;
};
