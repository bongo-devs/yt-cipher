export interface Solvers {
  n: ((val: string) => string) | null;
  sig: ((val: string) => string) | null;
}

export interface SignatureRequest {
  encrypted_signature: string;
  n_param: string;
  player_url: string;
}

export interface SignatureResponse {
  decrypted_signature: string;
  decrypted_n_sig: string;
}

export interface StsRequest {
  player_url: string;
}

export interface StsResponse {
  sts: string;
}

export interface ResolveUrlRequest {
  stream_url: string;
  player_url: string;
  encrypted_signature: string;
  signature_key?: string;
  n_param?: string;
}

export interface ResolveUrlResponse {
  resolved_url: string;
}

export interface PoTokenRequest {
  visitorData?: string;
  videoId?: string;
  client?: string;
  /** Binds the content token to an arbitrary string instead of the videoId. */
  contentBinding?: string;
}

export interface PoTokenResponse {
  visitorDataToken: string;
  visitorData: string;
  videoIdToken?: string;
  /** What `videoIdToken` is bound to, which is not the videoId for every client. */
  contentBinding?: string;
  /** Only valid while a SABR session reports `StreamProtectionStatus=2`. Never cached. */
  coldStartToken?: string;
  expiresAt: string;
}

export interface WorkerWithStatus extends Worker {
  isIdle?: boolean;
}

export interface Task {
  data: string;
  resolve: (output: string) => void;
  reject: (error: unknown) => void;
}

export type ApiRequest =
  | SignatureRequest
  | StsRequest
  | ResolveUrlRequest
  | PoTokenRequest;

/** The requests that name a player script. `withPlayer` only wraps those routes. */
export type PlayerRequest = SignatureRequest | StsRequest | ResolveUrlRequest;

// Parsing into this context helps avoid multi copies of requests
// since request body can only be read once.
import { PlayerScript } from "./player.ts";

export interface RequestContext {
  req: Request;
  body: ApiRequest;
  playerScript?: PlayerScript;
}
