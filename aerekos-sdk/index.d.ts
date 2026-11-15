export interface AerekosClientOptions {
  baseUrl: string;
  token?: string | null;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface ProxyOptions {
  method?: string;
  path: string;
  projectId?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  raw?: boolean;
}

export class AerekosError extends Error {
  status?: number;
  code?: string;
  body?: unknown;
}

export interface ManagerDescriptor {
  name: string;
  base: string;
  segment: string | null;
  aws: string;
  category: string;
  port: number;
  status: 'implemented' | 'needs-keys';
  projectInPath: boolean;
}

export const MANAGERS: ManagerDescriptor[];

export interface ResourceApi {
  create(projectId: string, body?: Record<string, unknown>): Promise<any>;
  list(projectId: string, query?: Record<string, any>): Promise<any>;
  get(projectId: string, id: string, query?: Record<string, any>): Promise<any>;
  update(projectId: string, id: string, body: Record<string, unknown>): Promise<any>;
  remove(projectId: string, id: string): Promise<any>;
}

export class ManagerApi {
  name: string;
  descriptor: ManagerDescriptor;
  info(projectId?: string): Promise<any>;
  metrics(projectId?: string): Promise<string>;
  proxy<T = any>(opts: ProxyOptions): Promise<T>;
  resource(segment?: string): ResourceApi;
}

export class AerekosClient {
  baseUrl: string;
  token: string | null;
  auth: AuthApi;
  users: UsersApi;
  workers: WorkersApi;
  services: ServicesApi;
  keys: KeyManagerApi;
  secrets: SecretsManagerApi;
  storage: StorageManagerApi;
  intelligence: IntelligenceApi;
  agents: AgentsApi;
  stt: SttApi;
  tts: TtsApi;
  memory: MemoryApi;
  compute: ComputeApi;
  balancer: BalancerApi;
  gateway: GatewayApi;
  llm: LlmApi;
  lora: LoraApi;
  events: EventsApi;
  realtime: RealtimeApi;
  download: DownloadApi;
  functions: FunctionsApi;
  queue: QueueApi;
  data: DataApi;
  stacks: StacksApi;
  db: ThinProxyApi;
  cache: CacheApi;
  search: SearchApi;
  query: QueryApi;
  iot: IotApi;
  push: PushApi;
  notify: NotifyApi;
  config: ConfigApi;
  backup: BackupApi;
  git: ThinProxyApi;
  logs: ThinProxyApi;
  traces: ThinProxyApi;
  iam: IamApi;
  /** Catalog-driven accessor for every manager, keyed by service name. */
  svc: Record<string, ManagerApi>;

  constructor(opts: AerekosClientOptions);
  setToken(token: string): this;
  request<T = any>(method: string, path: string, opts?: RequestOptions): Promise<T>;
  get<T = any>(path: string, opts?: RequestOptions): Promise<T>;
  post<T = any>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  patch<T = any>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  del<T = any>(path: string, opts?: RequestOptions): Promise<T>;
  proxy<T = any>(serviceName: string, opts: ProxyOptions & { raw?: boolean }): Promise<T>;
  invoke<T = any>(opts: { resourceArn: string; method?: string; body?: unknown; projectId?: string; headers?: Record<string, string> }): Promise<T>;
  managerInfo(serviceName: string): ManagerDescriptor;
  manager(serviceName: string): ManagerApi;
  resource(serviceName: string, segment: string, opts?: { base?: string }): ResourceApi;
  ensure(opts: { projectId: string; pack?: string; service?: string; defaults?: boolean }): Promise<any>;
}

export class AuthApi {
  login(username: string, password: string): Promise<{ token?: string; [k: string]: any }>;
  me(): Promise<any>;
  getAppToken(opts: { clientId: string; clientSecret: string; projectId: string; scope?: string }): Promise<any>;
  createCredential(projectId: string, body?: Record<string, unknown>): Promise<any>;
}
export class UsersApi {
  list(projectId: string): Promise<{ items: any[]; users: any[] }>;
  create(projectId: string, body: { username: string; password: string; name?: string; display_color?: string; enabled?: boolean }): Promise<{ user: any }>;
  get(projectId: string, id: string): Promise<{ user: any }>;
  update(projectId: string, id: string, body?: { name?: string; display_color?: string; password?: string; enabled?: boolean }): Promise<{ user: any }>;
  remove(projectId: string, id: string): Promise<{ deleted: boolean; id: string }>;
  login(opts: { username: string; password: string; projectId?: string }): Promise<{ token: string; user: any; expires_in: number }>;
}
export class WorkersApi {
  list(): Promise<any>;
  get(id: string): Promise<any>;
  resources(): Promise<any>;
}
export class ServicesApi {
  list(): Promise<any>;
  get(name: string): Promise<any>;
  enable(name: string, projectId?: string): Promise<any>;
  disable(name: string, projectId?: string): Promise<any>;
  deployments(name: string): Promise<any>;
  health(name: string, projectId?: string): Promise<any>;
}
export class KeyManagerApi {
  list(projectId: string): Promise<any>;
  get(projectId: string, name: string): Promise<any>;
  create(projectId: string, body: unknown): Promise<any>;
  rotate(projectId: string, name: string): Promise<any>;
}
export class SecretsManagerApi {
  list(projectId: string): Promise<any>;
  get(projectId: string, name: string, opts?: { reveal?: boolean }): Promise<any>;
  set(projectId: string, body: unknown): Promise<any>;
  remove(projectId: string, name: string): Promise<any>;
}
export class StorageManagerApi {
  listBuckets(projectId: string): Promise<any>;
  createBucket(projectId: string, body: unknown): Promise<any>;
  listObjects(projectId: string, bucket: string): Promise<any>;
}
export class GatewayApi {
  request(method: string, prettyPath: string, body?: unknown, opts?: RequestOptions): Promise<any>;
}
export class IntelligenceApi {
  list(projectId: string): Promise<any>;
  create(projectId: string, body?: Record<string, unknown>): Promise<any>;
  chat(projectId: string, body: Record<string, unknown>): Promise<any>;
  submit(projectId: string, body?: Record<string, unknown>): Promise<any>;
  job(projectId: string, jobId: string, opts?: { intelligence?: string }): Promise<any>;
  wait(projectId: string, jobId: string, opts?: { intervalMs?: number; timeoutMs?: number; onUpdate?: (job: any) => void; onDelta?: (text: string) => void }): Promise<any>;
  cancel(projectId: string, jobId: string, opts?: { intelligence?: string }): Promise<any>;
  subscribe(projectId: string, jobId: string, opts?: { onUpdate?: (job: any) => void; onDelta?: (delta: string, partial?: string) => void; baseUrl?: string }): { socket: any; close(): void };
  usage(projectId: string, query?: Record<string, any>): Promise<any>;
  attach(projectId: string, id: string, body: { kind: 'rag' | 'memory' | 'lora'; target_name: string; [k: string]: unknown }): Promise<any>;
  attachBalancer(projectId: string, name: string, opts?: { backends?: string[]; health_check_path?: string; address?: string }): Promise<any>;
  detachBalancer(projectId: string, name: string): Promise<any>;
}
export class SttApi {
  transcribe(projectId: string, body: Record<string, unknown>): Promise<any>;
  status(projectId: string): Promise<any>;
}
export class TtsApi {
  synthesize(projectId: string, body: Record<string, unknown>, opts?: { binary?: boolean }): Promise<any>;
  status(projectId: string): Promise<any>;
}
export class AgentsApi {
  setupStatus(projectId: string): Promise<any>;
  setup(projectId: string, body?: Record<string, unknown>): Promise<any>;
  settings(projectId: string): Promise<any>;
  updateSettings(projectId: string, body?: Record<string, unknown>): Promise<any>;
  fleet(projectId: string): Promise<any>;
  list(projectId: string): Promise<any>;
  get(projectId: string, id: string): Promise<any>;
  create(projectId: string, body?: Record<string, unknown>): Promise<any>;
  update(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  remove(projectId: string, id: string): Promise<any>;
  chat(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  voice(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  interrupt(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  approve(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  asks(projectId: string, id: string): Promise<any>;
  pulse(projectId: string, id: string): Promise<any>;
  messages(projectId: string, id: string, query?: Record<string, unknown>): Promise<any>;
  pins(projectId: string, id: string): Promise<any>;
  pin(projectId: string, id: string, key: string, value: string): Promise<any>;
  forget(projectId: string, id: string, key: string): Promise<any>;
  exportMemory(projectId: string, id: string): Promise<any>;
  wipeMemory(projectId: string, id: string): Promise<any>;
  rolls(projectId: string, id: string): Promise<any>;
  refreshRolls(projectId: string, id: string): Promise<any>;
  work(projectId: string, id: string): Promise<any>;
  createWork(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  workers(projectId: string, id: string): Promise<any>;
  spawn(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  runWorker(projectId: string, id: string, wid: string, body?: Record<string, unknown>): Promise<any>;
  cron(projectId: string, id: string): Promise<any>;
  createCron(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  fireCron(projectId: string, id: string, cid: string): Promise<any>;
  skills(projectId: string, id: string): Promise<any>;
  createSkill(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  audit(projectId: string, id: string): Promise<any>;
  fs(projectId: string, id: string, rel?: string): Promise<any>;
  fsWrite(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  term(projectId: string, id: string, cmd: string): Promise<any>;
  tool(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  compact(projectId: string, id: string): Promise<any>;
  plans(projectId: string, id: string): Promise<any>;
  plan(projectId: string, id: string, planId: string): Promise<any>;
  consoleEvents(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  timeline(projectId: string, id: string, since?: string): Promise<any>;
  resume(projectId: string): Promise<any>;
  prompts(projectId: string, id: string): Promise<any>;
  patchPrompts(projectId: string, id: string, prompts: Record<string, string>): Promise<any>;
  resetPrompts(projectId: string, id: string): Promise<any>;
  patchWork(projectId: string, id: string, workId: string, body?: Record<string, unknown>): Promise<any>;
  reorderWork(projectId: string, id: string, ids: string[]): Promise<any>;
  subscribeAsks(projectId: string, agentId: string, opts?: {
    onAsk?: (ask: any) => void;
    onAnswered?: (ask: any) => void;
    onPulse?: (pulse: any) => void;
    onDone?: (evt: any) => void;
    baseUrl?: string;
  }): { socket: any; close(): void };
}
export class MemoryApi {
  stores(projectId: string): Promise<any>;
  ingest(projectId: string, body: Record<string, unknown>): Promise<any>;
  retrieve(projectId: string, body: Record<string, unknown>): Promise<any>;
}
export class ComputeApi {
  list(projectId: string): Promise<any>;
  create(projectId: string, body: Record<string, unknown>): Promise<any>;
  scale(projectId: string, taskId: string, desired: number): Promise<any>;
  remove(projectId: string, taskId: string): Promise<any>;
}
export class BalancerApi {
  list(projectId: string): Promise<any>;
  create(projectId: string, body: Record<string, unknown>): Promise<any>;
  health(projectId: string, id?: string): Promise<any>;
  remove(projectId: string, id: string): Promise<any>;
}

export class LlmApi {
  chat(projectId: string, body: Record<string, unknown>): Promise<any>;
  models(projectId: string): Promise<any>;
  status(projectId: string): Promise<any>;
}
export class LoraApi {
  list(projectId: string): Promise<any>;
  train(projectId: string, body: Record<string, unknown>): Promise<any>;
  submit(projectId: string, body: Record<string, unknown>): Promise<any>;
  job(projectId: string, id: string): Promise<any>;
  wait(projectId: string, id: string, opts?: { intervalMs?: number; timeoutMs?: number }): Promise<any>;
  attach(projectId: string, adapterId: string, intelligence: string): Promise<any>;
}
export class EventsApi {
  publish(projectId: string, opts?: { type?: string; payload?: unknown; bus?: string; source?: string }): Promise<any>;
}
export class RealtimeApi {
  publish(projectId: string, opts?: { channel?: string; payload?: unknown }): Promise<any>;
  connect(opts?: { projectId?: string; channels?: string[]; baseUrl?: string }): { url: string; channel: string; projectId?: string };
}
export class DownloadApi {
  lists(projectId: string): Promise<any>;
  createList(projectId: string, body?: Record<string, unknown>): Promise<any>;
  getList(projectId: string, id: string): Promise<any>;
  updateList(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  deleteList(projectId: string, id: string): Promise<any>;
  windows(projectId: string): Promise<any>;
  createWindow(projectId: string, body?: Record<string, unknown>): Promise<any>;
  indexers(projectId: string): Promise<any>;
  createIndexer(projectId: string, body?: Record<string, unknown>): Promise<any>;
  // Torrent search (Jackett or scrapers): { query, category? }
  search(projectId: string, body?: Record<string, unknown>): Promise<any>;
  // YouTube search (yt-dlp): { query, max? } -> { results: [{id,url,title,duration,channel,view_count,thumbnail}], source:'youtube', engine:'yt-dlp' }
  searchYouTube(projectId: string, body?: Record<string, unknown>): Promise<any>;
  addItems(projectId: string, body?: Record<string, unknown>): Promise<any>;
  quickAdd(opts: { projectId: string; urls: string[]; window?: string; list?: string; format?: string; bucket?: string; prefix?: string }): Promise<any>;
  addItemsToList(projectId: string, listId: string, body?: Record<string, unknown>): Promise<any>;
  listItems(projectId: string, listId: string): Promise<any>;
  items(projectId: string, query?: Record<string, unknown>): Promise<any>;
  getItem(projectId: string, id: string): Promise<any>;
  updateItem(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  removeItem(projectId: string, id: string): Promise<any>;
  pauseItem(projectId: string, id: string): Promise<any>;
  resumeItem(projectId: string, id: string): Promise<any>;
  retryItem(projectId: string, id: string): Promise<any>;
  tick(projectId: string, body?: Record<string, unknown>): Promise<any>;
}
export class FunctionsApi {
  deploy(projectId: string | Record<string, unknown>, body?: Record<string, unknown>): Promise<any>;
  invoke(projectId: string | Record<string, unknown>, name?: string, opts?: { payload?: unknown; invocationType?: string }): Promise<any>;
  attachQueue(projectId: string, name: string, queueName: string, opts?: { engine?: string }): Promise<any>;
  detachQueue(projectId: string, name: string, sourceId: string): Promise<any>;
}
export class QueueApi {
  create(projectId: string, body?: Record<string, unknown>): Promise<any>;
  list(projectId: string): Promise<any>;
  get(projectId: string, name: string): Promise<any>;
  remove(projectId: string, name: string): Promise<any>;
  delete(projectId: string, name: string): Promise<any>;
  stats(projectId: string, name: string): Promise<any>;
  send(projectId: string, opts: { name: string; body: unknown }): Promise<any>;
  receive(projectId: string, opts?: { name: string; max?: number }): Promise<any>;
}
export class DataApi {
  apply(projectId: string, modelsJson: Record<string, unknown>): Promise<any>;
  list(projectId: string, app: string, model: string, query?: Record<string, unknown>): Promise<any>;
  query(projectId: string, app: string, model: string, opts?: Record<string, unknown>): Promise<any>;
  listNested(projectId: string, app: string, parent: string, parentId: string, child: string, query?: Record<string, unknown>): Promise<any>;
  createNested(projectId: string, app: string, parent: string, parentId: string, child: string, body?: Record<string, unknown>): Promise<any>;
  create(projectId: string, app: string, model: string, body?: Record<string, unknown>): Promise<any>;
  get(projectId: string, app: string, model: string, id: string, query?: Record<string, unknown>): Promise<any>;
  update(projectId: string, app: string, model: string, id: string, body: Record<string, unknown>): Promise<any>;
  remove(projectId: string, app: string, model: string, id: string): Promise<any>;
  scale(projectId: string, name: string, desired: number): Promise<any>;
  evaluateAutoscaling(projectId: string, name: string, body?: Record<string, unknown>): Promise<any>;
}
export class StacksApi {
  apply(projectId: string): Promise<any>;
  get(projectId: string): Promise<any>;
  put(projectId: string, body?: Record<string, unknown>): Promise<any>;
  record(projectId: string, body?: Record<string, unknown>): Promise<any>;
}
export class ThinProxyApi {
  proxy<T = any>(opts: ProxyOptions): Promise<T>;
}
export class CacheApi {
  get(projectId: string, key: string): Promise<any>;
  set(projectId: string, key: string, value: unknown): Promise<any>;
}
export class SearchApi {
  query(projectId: string, body?: Record<string, unknown>): Promise<any>;
}
export class QueryApi {
  sql(projectId: string, body?: Record<string, unknown>): Promise<any>;
}
export class IotApi {
  publish(projectId: string, body?: Record<string, unknown>): Promise<any>;
}
export class PushApi {
  send(projectId: string, body?: Record<string, unknown>): Promise<any>;
}
export class NotifyApi {
  providers(projectId: string): Promise<any>;
  list(projectId: string, query?: Record<string, any>): Promise<any>;
  create(projectId: string, body?: Record<string, unknown>): Promise<any>;
  get(projectId: string, id: string): Promise<any>;
  update(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  remove(projectId: string, id: string): Promise<any>;
  send(projectId: string, id: string, body?: Record<string, unknown>): Promise<any>;
  test(projectId: string, body?: Record<string, unknown>): Promise<any>;
}
export class ConfigApi {
  get(projectId: string, query?: Record<string, any>): Promise<any>;
  evaluate(projectId: string, body?: Record<string, unknown>): Promise<any>;
}
export class BackupApi {
  list(projectId: string): Promise<any>;
}
export class IamApi {
  evaluate(body: Record<string, unknown>): Promise<any>;
}
