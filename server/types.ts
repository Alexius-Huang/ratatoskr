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

export type TicketType = 'Task' | 'Epic' | 'Bug';

export type TicketState =
  | 'NOT_READY'
  | 'PLANNING'
  | 'READY'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE';

export type TicketChildCounts = {
  total: number;
  byState: Record<TicketState, number>;
};

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
  childCounts?: TicketChildCounts;
};

export type TicketDetail = TicketSummary & {
  body: string;
};

export type ArchivedTicketRecord = TicketSummary & {
  archived: string;
  body: string;
};

export type PlanResponse = {
  path: string;
  body: string;
};

export type CreateTicketRequest = {
  type: string;
  title: string;
  state?: string;
  epic?: number | null;
  body?: string;
};

export type UpdateTicketRequest = {
  title?: string;
  state?: string;
  type?: string;
  epic?: number | null;
  body?: string;
};

export type ArchiveBlockedError = {
  error: string;
  blockers: Partial<Record<TicketState, number>>;
};

export type PlanResult =
  | { ok: true; data: PlanResponse }
  | {
      ok: false;
      reason:
        | 'ticket-not-found'
        | 'no-plan-doc'
        | 'out-of-scope'
        | 'file-not-found';
    };
