import prisma from '../../lib/prisma';

export class AbuseDetectionService {
  async checkUserAbuse(userId: string): Promise<'clean' | 'warn' | 'suspend'> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const cancellations = await prisma.requestEvent.count({
      where: {
        request: { userId },
        type: 'CANCELLED',
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { abuseWarningCount: true },
    });

    if (cancellations >= 5 || (user?.abuseWarningCount ?? 0) >= 2) return 'suspend';
    if (cancellations >= 3) return 'warn';
    return 'clean';
  }

  async checkProfessionalAbuse(professionalId: string): Promise<'clean' | 'warn' | 'suspend'> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const cancellations = await prisma.requestEvent.count({
      where: {
        professionalId,
        type: { in: ['CANCELLED', 'NO_RESPONSE'] },
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      select: { abuseWarningCount: true },
    });

    if (cancellations >= 5 || (professional?.abuseWarningCount ?? 0) >= 2) return 'suspend';
    if (cancellations >= 3) return 'warn';
    return 'clean';
  }
}
