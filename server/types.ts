export type BoardConfig = {
  columns: TicketState[];
};

export type RatatoskrConfig = {
  prefix: string;
  name?: string;
  description?: string;
  thumbnail?: string | null;
  github_repo?: string;
  board?: BoardConfig;
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

export type TicketResolution = 'VIBED' | 'PLANNED' | 'MANUAL';

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
  blocks: string[];
  blockedBy: string[];
  wontDoReason?: string;
  resolution?: TicketResolution;
  isReviewed?: boolean;
  created: string;
  updated: string;
  childCounts?: TicketChildCounts;
};

export type TicketDetail = TicketSummary & {
  body: string;
  comments: Comment[];
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
  resolution?: TicketResolution | null;
  is_reviewed?: boolean | null;
  blocks?: string[] | null;
  blocked_by?: string[] | null;
};

export type UserProfile = {
  username: string;
  display_name: string;
  email?: string;
};

export type CommentRequestAuthor = {
  username: string;
  display_name: string;
};

export type CreateCommentRequest = {
  body: string;
  author?: CommentRequestAuthor;
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

export type Comment = {
  n: number;
  author: string;
  displayName: string;
  timestamp: string; // ISO 8601 — original creation
  updated?: string; // ISO 8601 — last edit (absent if never edited)
  body: string; // markdown content after frontmatter
};

export type EditCommentRequest = {
  body: string;
};

export type CommentInput = {
  author: string;
  displayName: string;
  body: string;
  // timestamp is intentionally omitted — server-generated
};
