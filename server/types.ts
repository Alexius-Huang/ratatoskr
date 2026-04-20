export type RatatoskrConfig = {
  prefix: string;
  name?: string;
  description?: string;
  thumbnail?: string | null;
  github_repo?: string;
};

export type PullRequestInfo = {
  url: string;
  number: number;
  title: string;
  state: string;
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
  | 'DONE'
  | 'WONT_DO';

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
  epicColor?: string;
  color?: string;
  state: TicketState;
  planDoc?: string;
  branch?: string;
  prs?: string[];
  wontDoReason?: string;
  created: string;
  updated: string;
  childCounts?: TicketChildCounts;
};

export type TicketDetail = TicketSummary & {
  body: string;
  pullRequests?: PullRequestInfo[];
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
  wont_do_reason?: string;
};

export type UpdateTicketRequest = {
  title?: string;
  state?: string;
  type?: string;
  epic?: number | null;
  body?: string;
  plan_doc?: string | null;
  color?: string | null;
  branch?: string | null;
  pr?: string;
  wont_do_reason?: string | null;
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
