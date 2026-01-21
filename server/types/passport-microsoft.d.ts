declare module 'passport-microsoft' {
  import { Strategy as PassportStrategy } from 'passport';

  interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    tenant?: string;
  }

  interface Profile {
    id: string;
    displayName?: string;
    name?: {
      familyName?: string;
      givenName?: string;
    };
    emails?: Array<{ value: string; type?: string }>;
    _json?: {
      mail?: string;
      userPrincipalName?: string;
      givenName?: string;
      surname?: string;
    };
  }

  type VerifyCallback = (
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: any, user?: any) => void
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyCallback);
  }
}
