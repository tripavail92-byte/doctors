import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppConfig } from '../../config/configuration';

export interface CreateRoomInput {
  /** Room name — we key it to the encounter/appointment. */
  room: string;
  /** Identity of the joining participant. */
  identity: string;
  displayName?: string;
  /** Grant publish rights (doctor) vs subscribe-only. Defaults true. */
  canPublish?: boolean;
  /** Token lifetime in seconds. Defaults 3600. */
  ttlSeconds?: number;
}

export interface TelehealthRoom {
  provider: 'livekit';
  mode: 'live' | 'stub';
  room: string;
  identity: string;
  /** LiveKit server URL for the client SDK to connect to. */
  url: string;
  /** Signed access token (LiveKit JWT grant). Valid JWT in both modes. */
  token: string;
  expiresAt: string;
}

/**
 * Telehealth video via LiveKit.
 *
 * A LiveKit access token is a JWT signed (HS256) with the project's API secret
 * carrying a `video` grant. We mint a genuinely valid token in both modes — the
 * only difference is whether a real server `url`/secret is configured (live) or
 * demo defaults are used (stub). This lets the join flow be wired and tested;
 * an actual media session additionally needs a reachable LiveKit server.
 */
@Injectable()
export class TelehealthService {
  private readonly logger = new Logger(TelehealthService.name);
  private readonly cfg: AppConfig['integrations']['telehealth'];

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.cfg = config.get('integrations', { infer: true }).telehealth;
  }

  mode(): 'live' | 'stub' {
    return this.cfg.url && this.cfg.apiKey && this.cfg.apiSecret ? 'live' : 'stub';
  }

  createRoom(input: CreateRoomInput): TelehealthRoom {
    const live = this.mode() === 'live';
    const apiKey = live ? this.cfg.apiKey : 'devkey';
    const apiSecret = live ? this.cfg.apiSecret : 'devsecret-not-for-production';
    const url = live ? this.cfg.url : 'wss://localhost:7880';
    const ttl = input.ttlSeconds ?? 3600;
    const now = Math.floor(Date.now() / 1000);
    const canPublish = input.canPublish ?? true;

    // LiveKit v2 grant claim shape.
    const token = this.jwt.sign(
      {
        name: input.displayName ?? input.identity,
        video: {
          room: input.room,
          roomJoin: true,
          canPublish,
          canSubscribe: true,
          canPublishData: true,
        },
      },
      {
        secret: apiSecret,
        issuer: apiKey,
        subject: input.identity,
        jwtid: input.identity,
        notBefore: 0,
        expiresIn: ttl,
      },
    );

    if (!live) {
      this.logger.log(`[stub] LiveKit room "${input.room}" token minted for ${input.identity}`);
    }
    return {
      provider: 'livekit',
      mode: live ? 'live' : 'stub',
      room: input.room,
      identity: input.identity,
      url,
      token,
      expiresAt: new Date((now + ttl) * 1000).toISOString(),
    };
  }
}
