import axios, { AxiosRequestConfig } from "npm:axios";
import {
  BG,
  BgConfig,
  buildURL,
  DescrambledChallenge,
  FetchFunction,
  getHeaders,
  USER_AGENT,
  WebPoSignalOutput,
} from "npm:bgutils-js@3.2.0";
import { JSDOM } from "npm:jsdom";
import { type Context as InnertubeContext, Innertube } from "npm:youtubei.js";

interface YoutubeSessionData {
  visitorDataToken: string;
  visitorData: string;
  videoIdToken?: string;
  expiresAt: Date;
}

export interface ChallengeData {
  interpreterUrl: {
    privateDoNotAccessOrElseTrustedResourceUrlWrappedValue: string;
  };
  interpreterHash: string;
  program: string;
  globalName: string;
  clientExperimentsStateBlob: string;
}

type TokenMinter = {
  expiry: Date;
  integrityToken: string;
  minter: any;
};

export class PoTokenManager {
  private static readonly REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";
  private static hasDom = false;
  private _minterCache: Map<string, TokenMinter> = new Map();
  private TOKEN_TTL_HOURS = 6;
  private innertube?: Innertube;

  constructor() {
    if (!PoTokenManager.hasDom) {
      const dom = new JSDOM(
        '<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>',
        {
          url: "https://www.youtube.com/",
          referrer: "https://www.youtube.com/",
          userAgent: USER_AGENT,
        },
      );

      Object.assign(globalThis, {
        window: dom.window,
        document: dom.window.document,
        location: dom.window.location,
        origin: dom.window.origin,
        navigator: dom.window.navigator,
      });
      PoTokenManager.hasDom = true;
    }
  }

  private async getInnertube(): Promise<Innertube> {
    if (!this.innertube) {
      this.innertube = await Innertube.create({ retrieve_player: false });
    }
    return this.innertube;
  }

  private async generateVisitorData(): Promise<string | null> {
    try {
      const innertube = await this.getInnertube();
      const visitorData = innertube.session.context.client.visitorData;
      return visitorData || null;
    } catch (e) {
      console.error("Failed to generate visitor data:", e);
      return null;
    }
  }

  private async getDescrambledChallenge(
    bgConfig: BgConfig,
    innertubeContext?: InnertubeContext,
  ): Promise<DescrambledChallenge> {
    try {
      if (!innertubeContext) {
        const innertube = await this.getInnertube();
        innertubeContext = innertube.session.context;
      }
      if (!innertubeContext) throw new Error("Innertube context unavailable");

      const attGetResponse = await bgConfig.fetch(
        "https://www.youtube.com/youtubei/v1/att/get?prettyPrint=false",
        {
          method: "POST",
          headers: {
            ...getHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            context: innertubeContext,
            engagementType: "ENGAGEMENT_TYPE_UNBOUND",
          }),
        },
      );
      const attestation = await attGetResponse.json();
      const challenge = attestation.bgChallenge as ChallengeData;

      const { program, globalName, interpreterHash } = challenge;
      const { privateDoNotAccessOrElseTrustedResourceUrlWrappedValue } =
        challenge.interpreterUrl;

      const interpreterJSResponse = await bgConfig.fetch(
        `https:${privateDoNotAccessOrElseTrustedResourceUrlWrappedValue}`,
      );
      const interpreterJS = await interpreterJSResponse.text();

      return {
        program,
        globalName,
        interpreterHash,
        interpreterJavascript: {
          privateDoNotAccessOrElseSafeScriptWrappedValue: interpreterJS,
          privateDoNotAccessOrElseTrustedResourceUrlWrappedValue,
        },
      };
    } catch (e) {
      console.warn(
        "Failed to get challenge from Innertube, falling back to BG.Challenge.create",
        e,
      );
      const descrambledChallenge = await BG.Challenge.create(bgConfig);
      if (descrambledChallenge) return descrambledChallenge;
      throw new Error("Could not get Botguard challenge");
    }
  }

  private async generateTokenMinter(
    bgConfig: BgConfig,
    innertubeContext?: InnertubeContext,
  ): Promise<TokenMinter> {
    const descrambledChallenge = await this.getDescrambledChallenge(
      bgConfig,
      innertubeContext,
    );

    const { program, globalName } = descrambledChallenge;
    const interpreterJavascript = descrambledChallenge.interpreterJavascript
      ?.privateDoNotAccessOrElseSafeScriptWrappedValue;

    if (interpreterJavascript) {
      new Function(interpreterJavascript)();
    } else throw new Error("Could not load VM");

    const bgClient = await BG.BotGuardClient.create({
      program,
      globalName,
      globalObj: bgConfig.globalObj,
    });

    const webPoSignalOutput: WebPoSignalOutput = [];
    const botguardResponse = await bgClient.snapshot({ webPoSignalOutput });

    const integrityTokenResp = await bgConfig.fetch(buildURL("GenerateIT"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify([PoTokenManager.REQUEST_KEY, botguardResponse]),
    });

    const [
      integrityToken,
      estimatedTtlSecs,
      mintRefreshThreshold,
      websafeFallbackToken,
    ] = await integrityTokenResp.json();

    const integrityTokenData = {
      integrityToken,
      estimatedTtlSecs,
      mintRefreshThreshold,
      websafeFallbackToken,
    };

    if (!integrityToken) throw new Error("Unexpected empty integrity token");

    const tokenMinter: TokenMinter = {
      expiry: new Date(Date.now() + estimatedTtlSecs * 1000),
      integrityToken,
      minter: await BG.WebPoMinter.create(
        integrityTokenData,
        webPoSignalOutput,
      ),
    };

    this._minterCache.set("default", tokenMinter);
    return tokenMinter;
  }

  private normalizeHeaders(
    headers?: HeadersInit,
  ): Record<string, string> | undefined {
    if (!headers) return undefined;
    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }
    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }
    return headers as Record<string, string>;
  }

  private getFetch(): FetchFunction {
    return async (
      input: URL | RequestInfo,
      options?: RequestInit,
    ): Promise<any> => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
      const method = (options?.method || "GET").toUpperCase();
      const axiosOpt: AxiosRequestConfig = {
        headers: this.normalizeHeaders(options?.headers),
      };

      const response =
        await (method === "GET"
          ? axios.get(url, axiosOpt)
          : axios.post(url, options?.body, axiosOpt));

      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        json: async () => response.data,
        text: async () =>
          typeof response.data === "string"
            ? response.data
            : JSON.stringify(response.data),
      };
    };
  }

  async generatePoToken(
    visitorData?: string,
    videoId?: string,
    client?: string,
  ): Promise<YoutubeSessionData> {
    if (!visitorData) {
      visitorData = (await this.generateVisitorData()) || undefined;
      if (!visitorData) throw new Error("Unable to generate visitor data");
    }

    const bgConfig: BgConfig = {
      fetch: this.getFetch(),
      globalObj: globalThis as any,
      identifier: visitorData,
      requestKey: PoTokenManager.REQUEST_KEY,
    };

    let tokenMinter = this._minterCache.get("default");
    if (!tokenMinter || new Date() >= tokenMinter.expiry) {
      const innertube = await this.getInnertube();
      tokenMinter = await this.generateTokenMinter(
        bgConfig,
        innertube.session.context,
      );
    }

    const visitorDataToken = await tokenMinter.minter.mintAsWebsafeString(
      visitorData,
    );
    if (!visitorDataToken) throw new Error("Unexpected empty POT");

    let videoIdToken = undefined;
    if (videoId) {
      const bindingId = (client === "IOS" || client === "ANDROID") ? visitorData : videoId;
      videoIdToken = await tokenMinter.minter.mintAsWebsafeString(bindingId);
    }

    return {
      visitorDataToken,
      visitorData,
      videoIdToken,
      expiresAt: new Date(Date.now() + this.TOKEN_TTL_HOURS * 60 * 60 * 1000),
    };
  }
}

export const potManager = new PoTokenManager();
