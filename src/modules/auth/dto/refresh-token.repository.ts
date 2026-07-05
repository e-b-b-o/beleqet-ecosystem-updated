import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  IRefreshTokenRepository,
  RefreshTokenSnapshot,
} from '../interfaces/refresh-token-repository.interface';

/**
 * Prisma-backed implementation of {@link IRefreshTokenRepository}, using
 * the schema's existing `RefreshToken` table. The `token` column stores
 * a SHA-256 hash — see {@link TokenIssuanceService} for hashing.
 */
@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { userId, token: tokenHash, expiresAt },
    });
  }

  public async findByHash(
    tokenHash: string,
  ): Promise<RefreshTokenSnapshot | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      select: { id: true, userId: true, expiresAt: true },
    });

    return record;
  }

  public async deleteById(id: string): Promise<void> {
    await this.prisma.refreshToken.delete({ where: { id } });
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
