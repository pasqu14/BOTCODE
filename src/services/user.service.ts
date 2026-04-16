import type { User } from '../../generated/prisma';
import { prisma } from '../database/client';

export interface CreateUserDto {
  telegramId: bigint;
  username?: string;
  firstName: string;
  lastName?: string;
}

export async function findOrCreateUser(dto: CreateUserDto): Promise<User> {
  return prisma.user.upsert({
    where: { telegramId: dto.telegramId },
    update: {
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
    },
    create: {
      telegramId: dto.telegramId,
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
    },
  });
}

export async function deactivateUser(telegramId: bigint): Promise<User> {
  return prisma.user.update({
    where: { telegramId },
    data: { isActive: false },
  });
}
