import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccountLinkingService, ACCOUNT_REPOSITORY } from './services/account-linking.service';
import { TokenEncryptionService } from './services/token-encryption.service';
import { AccountRepository } from './repositories/account.repository';
import { TOKEN_ENCRYPTION_KEY, loadAuthEnvConfig, AuthEnvConfig } from './config/auth.config';
import { TOKEN_CIPHER } from './interfaces/token-cipher.interface';
import { GoogleStrategy } from './strategies/google.strategy';
import { LinkedInStrategy } from './strategies/linkedin.strategy';

/**
 * Injection token for the fully-loaded, validated {@link AuthEnvConfig}.
 * Loaded exactly once at module initialization (see the factory provider
 * below) rather than re-read from `process.env` throughout the module.
 */
export const AUTH_ENV_CONFIG = Symbol('AUTH_ENV_CONFIG');

/**
 * Wires the Social Logins module's dependency graph.
 *
 * ## Composition root
 *
 * This is the ONLY file in the auth module that:
 * - calls {@link loadAuthEnvConfig} (i.e. touches `process.env`), and
 * - binds abstract injection tokens (`ACCOUNT_REPOSITORY`, `TOKEN_CIPHER`,
 *   `TOKEN_ENCRYPTION_KEY`) to their concrete implementations.
 *
 * Every other file in this module depends only on interfaces
 * ({@link IAccountRepository}, {@link ITokenCipher}) or receives already-
 * validated values via constructor injection. This is what makes
 * `AccountLinkingService` and `TokenEncryptionService` fully unit-testable
 * without booting a real Nest application — see their `.spec.ts` files,
 * which inject hand-written fakes for these same tokens.
 *
 * @remarks
 * `google.strategy.ts` and `linkedin.strategy.ts` (added in a follow-up
 * PR slice) will also be registered as providers here once implemented,
 * consuming `AUTH_ENV_CONFIG` for their client id/secret/callback URL.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: AUTH_ENV_CONFIG,
      useFactory: (): AuthEnvConfig => loadAuthEnvConfig(),
    },
    {
      provide: TOKEN_ENCRYPTION_KEY,
      useFactory: (config: AuthEnvConfig): Buffer => config.tokenEncryptionKey,
      inject: [AUTH_ENV_CONFIG],
    },
    // Register the concrete classes once, then alias the abstract tokens
    // to the SAME singleton via `useExisting` — using `useClass` on both
    // the token and the class would silently instantiate two separate
    // instances of what should be one shared service.
    TokenEncryptionService,
    AccountRepository,
    {
      provide: TOKEN_CIPHER,
      useExisting: TokenEncryptionService,
    },
    {
      provide: ACCOUNT_REPOSITORY,
      useExisting: AccountRepository,
    },
    AccountLinkingService,
    GoogleStrategy,
    LinkedInStrategy,
  ],
  exports: [AccountLinkingService, TokenEncryptionService],
})
export class AuthModule {}
