import { prisma } from '@/lib/prisma';
import { PortfolioService, PortfolioOverview } from './portfolio-service';
import { LiabilityService, LiabilityOverview } from './liability-service';
import { ActivityLogService } from './activity-log-service';
import { createLogger } from '@/lib/logger';
import { randomBytes } from 'crypto';

const logger = createLogger('FamilyService');

// ==================== 类型定义 ====================

export interface FamilyInfo {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FamilyMemberInfo {
  id: string;
  userId: string;
  familyId: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface FamilyInvitationInfo {
  id: string;
  familyId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  inviterId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  inviter: {
    name: string;
    email: string;
  };
  family: {
    name: string;
  };
}

export interface FamilyTransferParams {
  familyId: string;
  fromUserId: string;
  toUserId: string;
  operatorId: string;
  assetType: 'HOLDING' | 'ASSET' | 'CASH_ACCOUNT' | 'LIABILITY';
  holdingId?: string;
  assetId?: string;
  liabilityId?: string;
  quantity?: number;
  transferAll?: boolean;
  targetAccountId?: string; // 目标投资账户（Holding 转移时需要）
  notes?: string;
}

export interface FamilyTransferResult {
  transferId: string;
  assetName: string;
  assetType: string;
  fromUserName: string;
  toUserName: string;
  quantity: number | null;
  valueCny: number;
  transferredAt: Date;
}

export interface FamilyTransferRecord {
  id: string;
  familyId: string;
  fromUser: { id: string; name: string };
  toUser: { id: string; name: string };
  assetType: string;
  assetName: string;
  quantity: number | null;
  valueCny: number;
  notes: string | null;
  status: string;
  transferredAt: Date;
}

export interface MemberPortfolioBreakdown {
  userId: string;
  userName: string;
  role: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  percentage: number; // 占家庭总资产百分比
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPercent: number;
  todayPnl: number;
  todayPnlPercent: number;
}

export interface FamilyAssetDistribution {
  category: string;
  categoryName: string;
  value: number;
  percentage: number;
  color: string;
}

export interface FamilyPortfolioOverview {
  familyId: string;
  familyName: string;
  // 汇总数据
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  totalCash: number;
  totalInvestmentValue: number;
  totalCashAssets: number;
  totalOtherAssets: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPercent: number;
  securitiesUnrealizedPnl: number;
  securitiesUnrealizedPnlPercent: number;
  todayPnl: number;
  todayPnlPercent: number;
  // 家庭统计
  memberCount: number;
  accountCount: number;
  holdingCount: number;
  // 成员明细
  memberBreakdown: MemberPortfolioBreakdown[];
  // 资产分布
  assetDistribution: FamilyAssetDistribution[];
  // ✨ 底层敞口详情（用于图例下拉展开）
  equityByRegion?: {
    total: number;
    count: number;
    byRegion: Array<{
      regionCode: string;
      regionName: string;
      value: number;
      percentage: number;
      count: number;
      color: string;
      holdings: Array<{
        symbol: string;
        name: string;
        marketValue: number;
        percentage: number;
      }>;
    }>;
  };
  groupsSubCategories?: Record<string, {
    groupCode: string;
    groupName: string;
    total: number;
    count: number;
    bySubCategory: Array<{
      categoryCode: string;
      categoryName: string;
      value: number;
      percentage: number;
      count: number;
      color: string;
      items: Array<{
        id: string;
        name: string;
        value: number;
        percentage: number;
      }>;
    }>;
  }>;
  calculatedAt: Date;
}

// ==================== 服务类 ====================

export class FamilyService {

  // ==================== 家庭 CRUD ====================

  /**
   * 创建家庭，创建者自动成为管理员
   */
  static async createFamily(
    userId: string,
    name: string,
    description?: string
  ): Promise<{ family: FamilyInfo; member: FamilyMemberInfo }> {
    // 检查用户是否已属于某个家庭
    const existingMember = await prisma.familyMember.findUnique({
      where: { userId },
    });
    if (existingMember) {
      throw new Error('用户已属于一个家庭，不能重复创建');
    }

    const result = await prisma.$transaction(async (tx) => {
      const family = await tx.family.create({
        data: {
          name,
          description: description || null,
          createdBy: userId,
        },
      });

      const member = await tx.familyMember.create({
        data: {
          userId,
          familyId: family.id,
          role: 'ADMIN',
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      return { family, member };
    });

    logger.info(`Family created: ${result.family.id} by user ${userId}`);
    return {
      family: result.family,
      member: result.member as FamilyMemberInfo,
    };
  }

  /**
   * 更新家庭名称
   */
  static async updateFamilyName(familyId: string, name: string): Promise<FamilyInfo> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) {
      throw new Error('家庭名称不能为空且不超过100个字符');
    }
    return prisma.family.update({
      where: { id: familyId },
      data: { name: trimmed },
    });
  }

  /**
   * 获取家庭信息
   */
  static async getFamily(familyId: string): Promise<FamilyInfo | null> {
    return prisma.family.findUnique({ where: { id: familyId } });
  }

  /**
   * 获取用户所属的家庭及其角色
   */
  static async getUserFamily(userId: string): Promise<{
    family: FamilyInfo;
    role: 'ADMIN' | 'MEMBER' | 'VIEWER';
    memberId: string;
  } | null> {
    const member = await prisma.familyMember.findUnique({
      where: { userId },
      include: { family: true },
    });
    if (!member) return null;
    return {
      family: member.family,
      role: member.role,
      memberId: member.id,
    };
  }

  // ==================== 成员管理 ====================

  /**
   * 获取家庭成员列表
   */
  static async getMembers(familyId: string): Promise<FamilyMemberInfo[]> {
    const members = await prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: [
        { role: 'asc' }, // ADMIN 在前
        { joinedAt: 'asc' },
      ],
    });
    return members as FamilyMemberInfo[];
  }

  /**
   * 更新成员角色（仅管理员可操作）
   */
  static async updateMemberRole(
    familyId: string,
    memberId: string,
    newRole: 'ADMIN' | 'MEMBER' | 'VIEWER',
    operatorId: string
  ): Promise<FamilyMemberInfo> {
    // 权限校验
    await this.checkPermission(operatorId, familyId, 'MANAGE_MEMBERS');

    // 不能修改自己的角色
    const targetMember = await prisma.familyMember.findUnique({
      where: { id: memberId },
    });
    if (!targetMember) {
      throw new Error('成员不存在');
    }
    if (targetMember.userId === operatorId) {
      throw new Error('不能修改自己的角色');
    }

    const updated = await prisma.familyMember.update({
      where: { id: memberId, familyId },
      data: { role: newRole },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    logger.info(`Member ${memberId} role updated to ${newRole} by ${operatorId}`);
    return updated as FamilyMemberInfo;
  }

  /**
   * 移除家庭成员（仅管理员可操作）
   */
  static async removeMember(
    familyId: string,
    memberId: string,
    operatorId: string
  ): Promise<void> {
    await this.checkPermission(operatorId, familyId, 'MANAGE_MEMBERS');

    const targetMember = await prisma.familyMember.findUnique({
      where: { id: memberId },
    });
    if (!targetMember) {
      throw new Error('成员不存在');
    }
    if (targetMember.userId === operatorId) {
      throw new Error('不能移除自己，请转让管理员后再退出');
    }

    await prisma.familyMember.delete({
      where: { id: memberId, familyId },
    });

    logger.info(`Member ${memberId} removed from family ${familyId} by ${operatorId}`);
  }

  /**
   * 离开家庭（非管理员自行退出）
   */
  static async leaveFamily(userId: string): Promise<void> {
    const member = await prisma.familyMember.findUnique({
      where: { userId },
    });
    if (!member) {
      throw new Error('未加入任何家庭');
    }
    if (member.role === 'ADMIN') {
      // 检查是否还有其他管理员
      const adminCount = await prisma.familyMember.count({
        where: { familyId: member.familyId, role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        throw new Error('你是唯一的管理员，请先转让管理员角色给其他成员');
      }
    }

    await prisma.familyMember.delete({ where: { id: member.id } });
    logger.info(`User ${userId} left family ${member.familyId}`);
  }

  // ==================== 邀请管理 ====================

  /**
   * 发送家庭邀请（仅管理员）
   */
  static async inviteMember(
    familyId: string,
    email: string,
    role: 'ADMIN' | 'MEMBER' | 'VIEWER',
    inviterId: string
  ): Promise<FamilyInvitationInfo> {
    await this.checkPermission(inviterId, familyId, 'MANAGE_MEMBERS');

    // 检查邮箱是否已是家庭成员
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.familyMember.findUnique({
        where: { userId: existingUser.id },
      });
      if (existingMember) {
        if (existingMember.familyId === familyId) {
          throw new Error('该用户已是家庭成员');
        }
        throw new Error('该用户已属于其他家庭');
      }
    }

    // 检查是否已有未过期的待处理邀请
    const existingInvitation = await prisma.familyInvitation.findFirst({
      where: {
        familyId,
        email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvitation) {
      throw new Error('已存在待处理的邀请，请等待对方回复或邀请过期后重试');
    }

    // 生成唯一邀请token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7天有效期

    const invitation = await prisma.familyInvitation.create({
      data: {
        familyId,
        email,
        role,
        inviterId,
        token,
        expiresAt,
      },
      include: {
        inviter: { select: { name: true, email: true } },
        family: { select: { name: true } },
      },
    });

    logger.info(`Invitation sent to ${email} for family ${familyId}`);
    return invitation as FamilyInvitationInfo;
  }

  /**
   * 获取家庭的邀请列表
   */
  static async getInvitations(familyId: string): Promise<FamilyInvitationInfo[]> {
    const invitations = await prisma.familyInvitation.findMany({
      where: { familyId },
      include: {
        inviter: { select: { name: true, email: true } },
        family: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invitations as FamilyInvitationInfo[];
  }

  /**
   * 获取用户收到的待处理邀请
   */
  static async getPendingInvitationsForUser(email: string): Promise<FamilyInvitationInfo[]> {
    const invitations = await prisma.familyInvitation.findMany({
      where: {
        email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        inviter: { select: { name: true, email: true } },
        family: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invitations as FamilyInvitationInfo[];
  }

  /**
   * 接受邀请
   */
  static async acceptInvitation(
    token: string,
    userId: string
  ): Promise<{ family: FamilyInfo; member: FamilyMemberInfo }> {
    const invitation = await prisma.familyInvitation.findUnique({
      where: { token },
      include: { family: true },
    });

    if (!invitation) {
      throw new Error('邀请不存在');
    }
    if (invitation.status !== 'PENDING') {
      throw new Error('邀请已被处理');
    }
    if (invitation.expiresAt < new Date()) {
      // 自动更新过期状态
      await prisma.familyInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new Error('邀请已过期');
    }

    // 校验用户邮箱匹配
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.email) {
      throw new Error('邀请邮箱与当前登录用户不匹配');
    }

    // 检查用户是否已属于家庭
    const existingMember = await prisma.familyMember.findUnique({
      where: { userId },
    });
    if (existingMember) {
      throw new Error('你已属于一个家庭，请先退出当前家庭');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 更新邀请状态
      await tx.familyInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      // 创建成员关系
      const member = await tx.familyMember.create({
        data: {
          userId,
          familyId: invitation.familyId,
          role: invitation.role,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      return member;
    });

    logger.info(`User ${userId} accepted invitation to family ${invitation.familyId}`);
    return {
      family: invitation.family,
      member: result as FamilyMemberInfo,
    };
  }

  /**
   * 拒绝邀请
   */
  static async rejectInvitation(token: string, userId: string): Promise<void> {
    const invitation = await prisma.familyInvitation.findUnique({ where: { token } });
    if (!invitation) {
      throw new Error('邀请不存在');
    }

    // 校验用户邮箱
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.email) {
      throw new Error('无权操作此邀请');
    }

    await prisma.familyInvitation.update({
      where: { id: invitation.id },
      data: { status: 'REJECTED' },
    });

    logger.info(`User ${userId} rejected invitation ${invitation.id}`);
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取汇率（与 PortfolioService 默认汇率一致）
   */
  private static async getExchangeRate(currency: string): Promise<number> {
    if (currency === 'CNY') return 1.0;
    try {
      const { exchangeRateService } = await import('@/lib/exchange-rate-service');
      return await exchangeRateService.getRate(currency, 'CNY');
    } catch {
      switch (currency) {
        case 'USD': return 7.27;
        case 'HKD': return 0.93;
        default: return 1.0;
      }
    }
  }

  // ==================== 权限校验 ====================

  /**
   * 通用权限校验
   *
   * 操作权限矩阵：
   * - VIEW_FAMILY:     ADMIN, MEMBER, VIEWER
   * - VIEW_MEMBER_DETAIL: ADMIN（查看任意成员明细）, MEMBER/VIEWER（仅自身）
   * - MANAGE_MEMBERS:  ADMIN only
   * - MANAGE_PROFILE:  ADMIN only
   */
  static async checkPermission(
    userId: string,
    familyId: string,
    action: 'VIEW_FAMILY' | 'VIEW_MEMBER_DETAIL' | 'MANAGE_MEMBERS' | 'MANAGE_PROFILE',
    targetUserId?: string
  ): Promise<{ role: 'ADMIN' | 'MEMBER' | 'VIEWER'; memberId: string }> {
    const member = await prisma.familyMember.findFirst({
      where: { userId, familyId },
    });

    if (!member) {
      throw new Error('你不是该家庭的成员');
    }

    const role = member.role;

    switch (action) {
      case 'VIEW_FAMILY':
        // 所有成员都可以查看家庭概览
        break;

      case 'VIEW_MEMBER_DETAIL':
        // 管理员可查看任意成员，其他只能查看自己
        if (role !== 'ADMIN' && targetUserId && targetUserId !== userId) {
          throw new Error('无权查看其他成员的资产明细');
        }
        break;

      case 'MANAGE_MEMBERS':
      case 'MANAGE_PROFILE':
        if (role !== 'ADMIN') {
          throw new Error('仅管理员可执行此操作');
        }
        break;
    }

    return { role, memberId: member.id };
  }

  // ==================== 家庭资产聚合 ====================

  /**
   * 获取家庭资产总览
   * 
   * 并行获取所有成员的 PortfolioOverview 和 LiabilityOverview，
   * 然后聚合计算家庭层面的数据。
   */
  static async getFamilyPortfolioOverview(familyId: string): Promise<FamilyPortfolioOverview> {
    const family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family) {
      throw new Error('家庭不存在');
    }

    const members = await prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    if (members.length === 0) {
      throw new Error('家庭没有成员');
    }

    // 并行获取所有成员的资产、负债、底层敞口、权益地区和二级分类数据
    const memberDataPromises = members.map(async (member) => {
      const [portfolio, liability, overviewGroups, equityByRegion, groupsSubCategories] = await Promise.all([
        PortfolioService.calculatePortfolioOverview(member.userId).catch((err) => {
          logger.warn(`Failed to get portfolio for user ${member.userId}: ${err.message}`);
          return null;
        }),
        LiabilityService.calculateLiabilityOverview(member.userId).catch((err) => {
          logger.warn(`Failed to get liability for user ${member.userId}: ${err.message}`);
          return null;
        }),
        PortfolioService.getPortfolioByOverviewGroup(member.userId).catch((err) => {
          logger.warn(`Failed to get overview groups for user ${member.userId}: ${err.message}`);
          return [];
        }),
        PortfolioService.getEquityByRegion(member.userId).catch((err) => {
          logger.warn(`Failed to get equity by region for user ${member.userId}: ${err.message}`);
          return null;
        }),
        PortfolioService.getAllGroupsSubCategories(member.userId).catch((err) => {
          logger.warn(`Failed to get groups sub categories for user ${member.userId}: ${err.message}`);
          return null;
        }),
      ]);

      return {
        member,
        portfolio,
        liability,
        overviewGroups,
        equityByRegion,
        groupsSubCategories,
      };
    });

    const memberData = await Promise.all(memberDataPromises);

    // 聚合计算
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalCash = 0;
    let totalInvestmentValue = 0;
    let totalCashAssets = 0;
    let totalOtherAssets = 0;
    let totalUnrealizedPnl = 0;
    let securitiesUnrealizedPnl = 0;
    let todayPnl = 0;
    let totalCostBasis = 0; // 用于计算总盈亏百分比
    let accountCount = 0;
    let holdingCount = 0;

    // 底层敞口分组聚合（与个人视角的 ASSET_OVERVIEW_GROUPS 一致）
    const groupAggregation: Record<string, { value: number; name: string; color: string }> = {};

    // ✨ 权益类按地区聚合
    const regionAggregation: Record<string, {
      regionCode: string;
      regionName: string;
      value: number;
      count: number;
      color: string;
      holdings: Array<{ symbol: string; name: string; marketValue: number; percentage: number }>;
    }> = {};
    let totalEquityValue = 0;
    let totalEquityCount = 0;

    // ✨ 各分组二级分类聚合
    const subCategoryAggregation: Record<string, {
      groupCode: string;
      groupName: string;
      total: number;
      count: number;
      bySubCategory: Record<string, {
        categoryCode: string;
        categoryName: string;
        value: number;
        count: number;
        color: string;
        items: Array<{ id: string; name: string; value: number; percentage: number }>;
      }>;
    }> = {};

    const memberBreakdown: MemberPortfolioBreakdown[] = [];

    for (const { member, portfolio, liability, overviewGroups, equityByRegion, groupsSubCategories } of memberData) {
      const memberAssets = portfolio?.totalAssets ?? 0;
      const memberLiabilities = liability?.totalLiabilities ?? 0;

      totalAssets += memberAssets;
      totalLiabilities += memberLiabilities;
      totalCash += portfolio?.totalCash ?? 0;
      totalInvestmentValue += portfolio?.totalInvestmentValue ?? 0;
      totalCashAssets += portfolio?.totalCashAssets ?? 0;
      totalOtherAssets += portfolio?.totalOtherAssets ?? 0;
      totalUnrealizedPnl += portfolio?.totalUnrealizedPnl ?? 0;
      securitiesUnrealizedPnl += portfolio?.securitiesUnrealizedPnl ?? 0;
      todayPnl += portfolio?.todayPnl ?? 0;
      accountCount += portfolio?.accountCount ?? 0;
      holdingCount += portfolio?.holdingCount ?? 0;

      // 聚合底层敞口分组数据
      for (const group of overviewGroups) {
        if (!groupAggregation[group.code]) {
          groupAggregation[group.code] = { value: 0, name: group.name, color: group.color };
        }
        groupAggregation[group.code].value += group.value;
      }

      // ✨ 聚合权益类按地区数据
      if (equityByRegion) {
        totalEquityValue += equityByRegion.total;
        totalEquityCount += equityByRegion.count;
        for (const region of equityByRegion.byRegion) {
          if (!regionAggregation[region.regionCode]) {
            regionAggregation[region.regionCode] = {
              regionCode: region.regionCode,
              regionName: region.regionName,
              value: 0,
              count: 0,
              color: region.color,
              holdings: [],
            };
          }
          regionAggregation[region.regionCode].value += region.value;
          regionAggregation[region.regionCode].count += region.count;
          regionAggregation[region.regionCode].holdings.push(...region.holdings);
        }
      }

      // ✨ 聚合各分组二级分类数据
      if (groupsSubCategories) {
        for (const [groupCode, groupData] of Object.entries(groupsSubCategories)) {
          if (!subCategoryAggregation[groupCode]) {
            subCategoryAggregation[groupCode] = {
              groupCode: groupData.groupCode,
              groupName: groupData.groupName,
              total: 0,
              count: 0,
              bySubCategory: {},
            };
          }
          subCategoryAggregation[groupCode].total += groupData.total;
          subCategoryAggregation[groupCode].count += groupData.count;
          for (const subCat of groupData.bySubCategory) {
            if (!subCategoryAggregation[groupCode].bySubCategory[subCat.categoryCode]) {
              subCategoryAggregation[groupCode].bySubCategory[subCat.categoryCode] = {
                categoryCode: subCat.categoryCode,
                categoryName: subCat.categoryName,
                value: 0,
                count: 0,
                color: subCat.color,
                items: [],
              };
            }
            const target = subCategoryAggregation[groupCode].bySubCategory[subCat.categoryCode];
            target.value += subCat.value;
            target.count += subCat.count;
            target.items.push(...subCat.items);
          }
        }
      }

      // 使用服务层直接返回的总成本（不再通过 totalAssets - totalUnrealizedPnl 反推，避免 brokerCash 等无盈亏项导致分母偏大）
      if (portfolio) {
        totalCostBasis += portfolio.totalCostBasis ?? 0;
      }

      memberBreakdown.push({
        userId: member.userId,
        userName: member.user.name,
        role: member.role,
        totalAssets: memberAssets,
        totalLiabilities: memberLiabilities,
        netWorth: memberAssets - memberLiabilities,
        percentage: 0, // 后面计算
        totalUnrealizedPnl: portfolio?.totalUnrealizedPnl ?? 0,
        totalUnrealizedPnlPercent: portfolio?.totalUnrealizedPnlPercent ?? 0,
        todayPnl: portfolio?.todayPnl ?? 0,
        todayPnlPercent: portfolio?.todayPnlPercent ?? 0,
      });
    }

    // 计算百分比
    if (totalAssets > 0) {
      for (const mb of memberBreakdown) {
        mb.percentage = Number(((mb.totalAssets / totalAssets) * 100).toFixed(2));
      }
    }

    const netWorth = totalAssets - totalLiabilities;
    const totalUnrealizedPnlPercent = totalCostBasis > 0
      ? Number(((totalUnrealizedPnl / totalCostBasis) * 100).toFixed(2))
      : 0;
    const securitiesCostBasis = totalInvestmentValue - securitiesUnrealizedPnl;
    const securitiesUnrealizedPnlPercent = securitiesCostBasis > 0
      ? Number(((securitiesUnrealizedPnl / securitiesCostBasis) * 100).toFixed(2))
      : 0;
    const todayPnlPercent = (totalAssets - todayPnl) > 0
      ? Number(((todayPnl / (totalAssets - todayPnl)) * 100).toFixed(2))
      : 0;

    // 资产分布 - 使用与个人视角一致的 ASSET_OVERVIEW_GROUPS 分类体系
    const { ASSET_OVERVIEW_GROUPS } = await import('@/lib/underlying-type');
    const groupTotalValue = Object.values(groupAggregation).reduce((sum, g) => sum + g.value, 0);
    const assetDistribution: FamilyAssetDistribution[] = ASSET_OVERVIEW_GROUPS
      .filter(group => groupAggregation[group.id.toUpperCase()])
      .map(group => {
        const agg = groupAggregation[group.id.toUpperCase()];
        return {
          category: group.id.toUpperCase(),
          categoryName: group.name,
          value: agg.value,
          percentage: groupTotalValue > 0 ? Number(((agg.value / groupTotalValue) * 100).toFixed(2)) : 0,
          color: group.color,
        };
      })
      .sort((a, b) => b.value - a.value);

    // ✨ 构建聚合后的权益类按地区数据
    const aggregatedEquityByRegion = totalEquityCount > 0 ? {
      total: totalEquityValue,
      count: totalEquityCount,
      byRegion: Object.values(regionAggregation)
        .map(region => ({
          ...region,
          percentage: totalEquityValue > 0 ? Number(((region.value / totalEquityValue) * 100).toFixed(1)) : 0,
          holdings: region.holdings
            .sort((a, b) => b.marketValue - a.marketValue)
            .map(h => ({
              ...h,
              percentage: totalEquityValue > 0 ? Number(((h.marketValue / totalEquityValue) * 100).toFixed(1)) : 0,
            })),
        }))
        .sort((a, b) => b.value - a.value),
    } : undefined;

    // ✨ 构建聚合后的各分组二级分类数据
    const aggregatedGroupsSubCategories: FamilyPortfolioOverview['groupsSubCategories'] = {};
    for (const [groupCode, groupData] of Object.entries(subCategoryAggregation)) {
      const bySubCategory = Object.values(groupData.bySubCategory)
        .map(subCat => ({
          ...subCat,
          percentage: groupData.total > 0 ? Number(((subCat.value / groupData.total) * 100).toFixed(1)) : 0,
          items: subCat.items
            .sort((a, b) => b.value - a.value)
            .map(item => ({
              ...item,
              percentage: groupData.total > 0 ? Number(((item.value / groupData.total) * 100).toFixed(1)) : 0,
            })),
        }))
        .sort((a, b) => b.value - a.value);
      
      if (bySubCategory.length > 0) {
        aggregatedGroupsSubCategories[groupCode] = {
          groupCode: groupData.groupCode,
          groupName: groupData.groupName,
          total: groupData.total,
          count: groupData.count,
          bySubCategory,
        };
      }
    }

    return {
      familyId,
      familyName: family.name,
      totalAssets,
      totalLiabilities,
      netWorth,
      totalCash,
      totalInvestmentValue,
      totalCashAssets,
      totalOtherAssets,
      totalUnrealizedPnl,
      totalUnrealizedPnlPercent,
      securitiesUnrealizedPnl,
      securitiesUnrealizedPnlPercent,
      todayPnl,
      todayPnlPercent,
      memberCount: members.length,
      accountCount,
      holdingCount,
      memberBreakdown,
      assetDistribution,
      equityByRegion: aggregatedEquityByRegion,
      groupsSubCategories: Object.keys(aggregatedGroupsSubCategories).length > 0 ? aggregatedGroupsSubCategories : undefined,
      calculatedAt: new Date(),
    };
  }

  /**
   * 获取指定成员的资产明细（管理员可查看任意成员）
   */
  static async getMemberAssets(
    familyId: string,
    targetUserId: string,
    operatorId: string
  ): Promise<{
    portfolio: PortfolioOverview;
    liability: LiabilityOverview;
    member: FamilyMemberInfo;
  }> {
    // 权限校验
    await this.checkPermission(operatorId, familyId, 'VIEW_MEMBER_DETAIL', targetUserId);

    // 确认目标用户是家庭成员
    const member = await prisma.familyMember.findFirst({
      where: { userId: targetUserId, familyId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
    if (!member) {
      throw new Error('该用户不是家庭成员');
    }

    const [portfolio, liability] = await Promise.all([
      PortfolioService.calculatePortfolioOverview(targetUserId),
      LiabilityService.calculateLiabilityOverview(targetUserId),
    ]);

    return {
      portfolio,
      liability,
      member: member as FamilyMemberInfo,
    };
  }

  // ==================== 跨成员资产转移 ====================

  /**
   * 跨成员转移资产
   * 
   * 支持四种类型：
   * - HOLDING：证券持仓（需指定目标账户）
   * - ASSET：通用资产（不动产、金首饰、现金等，整体所有权转移）
   * - CASH_ACCOUNT：现金账户余额（保留兼容）
   * - LIABILITY：负债（房贷、车贷等，整体所有权转移）
   */
  static async transferAsset(params: FamilyTransferParams): Promise<FamilyTransferResult> {
    const { familyId, fromUserId, toUserId, operatorId, assetType } = params;

    // 权限校验：仅管理员可执行跨成员转移
    await this.checkPermission(operatorId, familyId, 'MANAGE_MEMBERS');

    // 验证双方都是家庭成员
    const [fromMember, toMember] = await Promise.all([
      prisma.familyMember.findFirst({
        where: { userId: fromUserId, familyId },
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.familyMember.findFirst({
        where: { userId: toUserId, familyId },
        include: { user: { select: { id: true, name: true } } },
      }),
    ]);

    if (!fromMember) throw new Error('转出方不是家庭成员');
    if (!toMember) throw new Error('转入方不是家庭成员');
    if (fromUserId === toUserId) throw new Error('转出方和转入方不能是同一人');

    let result: FamilyTransferResult;

    switch (assetType) {
      case 'HOLDING':
        result = await this.transferHolding(params, fromMember.user, toMember.user);
        break;
      case 'ASSET':
        result = await this.transferGeneralAsset(params, fromMember.user, toMember.user);
        break;
      case 'CASH_ACCOUNT':
        result = await this.transferCashAccount(params, fromMember.user, toMember.user);
        break;
      case 'LIABILITY':
        result = await this.transferLiability(params, fromMember.user, toMember.user);
        break;
      default:
        throw new Error(`不支持的资产类型: ${assetType}`);
    }

    logger.info(`Family transfer completed: ${result.transferId} in family ${familyId}`);
    return result;
  }

  /**
   * 转移证券持仓（跨成员）
   */
  private static async transferHolding(
    params: FamilyTransferParams,
    fromUser: { id: string; name: string },
    toUser: { id: string; name: string }
  ): Promise<FamilyTransferResult> {
    const { familyId, holdingId, quantity, transferAll, targetAccountId, notes } = params;

    if (!holdingId) throw new Error('缺少持仓ID');
    if (!targetAccountId) throw new Error('缺少目标投资账户');

    // 获取源持仓
    const sourceHolding = await prisma.holding.findUnique({
      where: { id: holdingId },
      include: { security: true, account: true },
    });
    if (!sourceHolding) throw new Error('源持仓不存在');
    if (sourceHolding.userId !== fromUser.id) throw new Error('该持仓不属于转出方');

    // 验证目标账户属于转入方
    const targetAccount = await prisma.investmentAccount.findUnique({
      where: { id: targetAccountId },
    });
    if (!targetAccount) throw new Error('目标账户不存在');
    if (targetAccount.userId !== toUser.id) throw new Error('目标账户不属于转入方');
    if (!targetAccount.isActive) throw new Error('目标账户已停用');

    const transferQty = transferAll ? Number(sourceHolding.quantity) : (quantity || 0);
    if (transferQty <= 0) throw new Error('转移数量必须大于0');
    if (transferQty > Number(sourceHolding.quantity)) throw new Error('转移数量超过可用数量');

    const costBasis = Number(sourceHolding.averageCost);
    const currentPrice = Number(sourceHolding.currentPrice || 0);

    // 汇率
    const getRate = (currency: string) => {
      switch (currency) {
        case 'USD': return 7.2;
        case 'HKD': return 0.92;
        default: return 1.0;
      }
    };
    const targetRate = getRate(targetAccount.currency);
    const valueCny = transferQty * currentPrice * targetRate;

    const result = await prisma.$transaction(async (tx) => {
      // 1. 减少源持仓
      const remaining = Number(sourceHolding.quantity) - transferQty;
      if (remaining > 0) {
        const sourceRate = getRate(sourceHolding.account.currency);
        await tx.holding.update({
          where: { id: sourceHolding.id },
          data: {
            quantity: remaining,
            costBasis: remaining * costBasis,
            marketValueOriginal: remaining * currentPrice,
            marketValueCny: remaining * currentPrice * sourceRate,
            unrealizedPnl: (currentPrice - costBasis) * remaining,
            unrealizedPnlPercent: costBasis > 0 ? ((currentPrice - costBasis) / costBasis) * 100 : 0,
          },
        });
      } else {
        await tx.holding.delete({ where: { id: sourceHolding.id } });
      }

      // 2. 目标账户持仓处理
      const existingTarget = await tx.holding.findUnique({
        where: {
          userId_accountId_securityId: {
            userId: toUser.id,
            accountId: targetAccountId,
            securityId: sourceHolding.securityId,
          },
        },
      });

      if (existingTarget) {
        const totalQty = Number(existingTarget.quantity) + transferQty;
        const totalCost = Number(existingTarget.quantity) * Number(existingTarget.averageCost) + transferQty * costBasis;
        const newAvgCost = totalCost / totalQty;
        await tx.holding.update({
          where: { id: existingTarget.id },
          data: {
            quantity: totalQty,
            averageCost: newAvgCost,
            costBasis: totalCost,
            marketValueOriginal: totalQty * Number(existingTarget.currentPrice || 0),
            marketValueCny: totalQty * Number(existingTarget.currentPrice || 0) * targetRate,
            unrealizedPnl: (Number(existingTarget.currentPrice || 0) - newAvgCost) * totalQty,
            unrealizedPnlPercent: newAvgCost > 0 ? ((Number(existingTarget.currentPrice || 0) - newAvgCost) / newAvgCost) * 100 : 0,
          },
        });
      } else {
        await tx.holding.create({
          data: {
            userId: toUser.id,
            accountId: targetAccountId,
            securityId: sourceHolding.securityId,
            quantity: transferQty,
            averageCost: costBasis,
            currentPrice: sourceHolding.currentPrice,
            costBasis: transferQty * costBasis,
            marketValueOriginal: transferQty * currentPrice,
            marketValueCny: valueCny,
            unrealizedPnl: (currentPrice - costBasis) * transferQty,
            unrealizedPnlPercent: costBasis > 0 ? ((currentPrice - costBasis) / costBasis) * 100 : 0,
          },
        });
      }

      // 3. 记录转移
      const transfer = await tx.familyAssetTransfer.create({
        data: {
          familyId,
          fromUserId: fromUser.id,
          toUserId: toUser.id,
          assetType: 'HOLDING',
          holdingId,
          assetName: `${sourceHolding.security.symbol} - ${sourceHolding.security.name}`,
          quantity: transferQty,
          valueCny,
          notes,
        },
      });

      return transfer;
    });

    // 活动日志
    await ActivityLogService.log({
      userId: fromUser.id,
      assetType: 'HOLDING',
      assetId: holdingId,
      assetName: sourceHolding.security.name,
      assetSymbol: sourceHolding.security.symbol,
      action: 'TRANSFER',
      description: `家庭资产转移：${fromUser.name} → ${toUser.name}，${transferQty} 股 ${sourceHolding.security.name}`,
      previousValue: { owner: fromUser.name, quantity: Number(sourceHolding.quantity) },
      newValue: { owner: toUser.name, transferQuantity: transferQty },
      currency: sourceHolding.account.currency,
    });

    return {
      transferId: result.id,
      assetName: `${sourceHolding.security.symbol} - ${sourceHolding.security.name}`,
      assetType: 'HOLDING',
      fromUserName: fromUser.name,
      toUserName: toUser.name,
      quantity: transferQty,
      valueCny,
      transferredAt: result.transferredAt,
    };
  }

  /**
   * 转移通用资产（不动产、金首饰等）
   */
  private static async transferGeneralAsset(
    params: FamilyTransferParams,
    fromUser: { id: string; name: string },
    toUser: { id: string; name: string }
  ): Promise<FamilyTransferResult> {
    const { familyId, assetId, notes } = params;

    if (!assetId) throw new Error('缺少资产ID');

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { assetCategory: true },
    });
    if (!asset) throw new Error('资产不存在');
    if (asset.userId !== fromUser.id) throw new Error('该资产不属于转出方');

    // 计算人民币等值（考虑汇率）
    const assetValue = Number(asset.currentValue);
    const exchangeRate = await this.getExchangeRate(asset.currency);
    const valueCny = assetValue * exchangeRate;

    const result = await prisma.$transaction(async (tx) => {
      // 直接变更资产所有者
      await tx.asset.update({
        where: { id: assetId },
        data: { userId: toUser.id },
      });

      // 记录转移
      const transfer = await tx.familyAssetTransfer.create({
        data: {
          familyId,
          fromUserId: fromUser.id,
          toUserId: toUser.id,
          assetType: 'ASSET',
          assetId,
          assetName: asset.name,
          quantity: Number(asset.quantity),
          valueCny,
          notes,
        },
      });

      return transfer;
    });

    await ActivityLogService.log({
      userId: fromUser.id,
      assetType: 'OTHER_ASSET',
      assetId: assetId!,
      assetName: asset.name,
      action: 'TRANSFER',
      description: `家庭资产转移：${fromUser.name} → ${toUser.name}，${asset.name}（${asset.assetCategory.name}）`,
      previousValue: { owner: fromUser.name },
      newValue: { owner: toUser.name },
      currency: asset.currency,
    });

    return {
      transferId: result.id,
      assetName: asset.name,
      assetType: 'ASSET',
      fromUserName: fromUser.name,
      toUserName: toUser.name,
      quantity: Number(asset.quantity),
      valueCny,
      transferredAt: result.transferredAt,
    };
  }

  /**
   * 转移现金账户余额
   * 
   * 注意：quantity 是原币种金额（即数据库中 currentValue 的币种）
   * 前端应传入原币种金额，由服务层转换为 CNY 记录
   */
  private static async transferCashAccount(
    params: FamilyTransferParams,
    fromUser: { id: string; name: string },
    toUser: { id: string; name: string }
  ): Promise<FamilyTransferResult> {
    const { familyId, assetId, quantity, notes } = params;

    if (!assetId) throw new Error('缺少现金资产ID');
    if (!quantity || quantity <= 0) throw new Error('转移金额必须大于0');

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { assetCategory: true },
    });
    if (!asset) throw new Error('现金资产不存在');
    if (asset.userId !== fromUser.id) throw new Error('该资产不属于转出方');

    const currentVal = Number(asset.currentValue);
    const currencySymbol = asset.currency === 'USD' ? '$' : asset.currency === 'HKD' ? 'HK$' : '¥';
    if (quantity > currentVal) throw new Error(`转移金额超过可用余额（可用: ${currencySymbol}${currentVal.toFixed(2)}）`);

    // 计算人民币等值
    const exchangeRate = await this.getExchangeRate(asset.currency);
    const valueCny = quantity * exchangeRate;

    const result = await prisma.$transaction(async (tx) => {
      // 减少源账户
      const remaining = currentVal - quantity;
      if (remaining > 0) {
        await tx.asset.update({
          where: { id: assetId },
          data: {
            currentValue: remaining,
            // 对于货币基金等，purchasePrice 也需要按比例减少
            purchasePrice: Number(asset.purchasePrice) * (remaining / currentVal),
          },
        });
      } else {
        await tx.asset.update({
          where: { id: assetId },
          data: { currentValue: 0, quantity: 0, purchasePrice: 0 },
        });
      }

      // 查找目标用户同币种同分类的现金资产
      const targetAsset = await tx.asset.findFirst({
        where: {
          userId: toUser.id,
          assetCategoryId: asset.assetCategoryId,
          currency: asset.currency,
        },
      });

      if (targetAsset) {
        await tx.asset.update({
          where: { id: targetAsset.id },
          data: {
            currentValue: Number(targetAsset.currentValue) + quantity,
            purchasePrice: Number(targetAsset.purchasePrice) + quantity,
          },
        });
      } else {
        // 创建新资产时保留源资产的关键 metadata
        const sourceMetadata = (asset.metadata as Record<string, unknown>) || {};
        await tx.asset.create({
          data: {
            userId: toUser.id,
            assetCategoryId: asset.assetCategoryId,
            name: asset.name,
            description: asset.description,
            quantity: asset.assetCategory.code === 'CASH_MONEY_FUND' ? 0 : quantity,
            unitPrice: asset.unitPrice,
            purchasePrice: quantity,
            originalValue: quantity,
            currentValue: quantity,
            currency: asset.currency,
            underlyingType: asset.underlyingType,
            purchaseDate: new Date(),
            metadata: Object.keys(sourceMetadata).length > 0 ? (sourceMetadata as any) : undefined,
          },
        });
      }

      const transfer = await tx.familyAssetTransfer.create({
        data: {
          familyId,
          fromUserId: fromUser.id,
          toUserId: toUser.id,
          assetType: 'CASH_ACCOUNT',
          assetId,
          assetName: asset.name,
          quantity,
          valueCny,
          notes,
        },
      });

      return transfer;
    });

    await ActivityLogService.log({
      userId: fromUser.id,
      assetType: 'CASH_ASSET',
      assetId: assetId!,
      assetName: asset.name,
      action: 'TRANSFER',
      description: `家庭资产转移：${fromUser.name} → ${toUser.name}，${currencySymbol}${quantity.toFixed(2)}`,
      previousValue: { owner: fromUser.name, balance: currentVal, currency: asset.currency },
      newValue: { owner: toUser.name, transferAmount: quantity, currency: asset.currency },
      amountChange: -quantity,
      currency: asset.currency,
    });

    return {
      transferId: result.id,
      assetName: asset.name,
      assetType: 'CASH_ACCOUNT',
      fromUserName: fromUser.name,
      toUserName: toUser.name,
      quantity,
      valueCny,
      transferredAt: result.transferredAt,
    };
  }

  /**
   * 转移负债（房贷、车贷等，整体所有权转移）
   */
  private static async transferLiability(
    params: FamilyTransferParams,
    fromUser: { id: string; name: string },
    toUser: { id: string; name: string }
  ): Promise<FamilyTransferResult> {
    const { familyId, liabilityId, notes } = params;

    if (!liabilityId) throw new Error('缺少负债ID');

    const liability = await prisma.liability.findUnique({
      where: { id: liabilityId },
    });
    if (!liability) throw new Error('负债不存在');
    if (liability.userId !== fromUser.id) throw new Error('该负债不属于转出方');

    // 计算人民币等值
    const balance = Number(liability.currentBalance);
    const exchangeRate = await this.getExchangeRate(liability.currency);
    const valueCny = balance * exchangeRate;

    const result = await prisma.$transaction(async (tx) => {
      // 整体转移：只变更所有者
      await tx.liability.update({
        where: { id: liabilityId },
        data: { userId: toUser.id },
      });

      // 记录转移
      const transfer = await tx.familyAssetTransfer.create({
        data: {
          familyId,
          fromUserId: fromUser.id,
          toUserId: toUser.id,
          assetType: 'LIABILITY',
          liabilityId,
          assetName: liability.name,
          quantity: null,
          valueCny,
          notes,
        },
      });

      return transfer;
    });

    await ActivityLogService.log({
      userId: fromUser.id,
      assetType: 'OTHER_ASSET',
      assetId: liabilityId,
      assetName: liability.name,
      action: 'TRANSFER',
      description: `家庭负债转移：${fromUser.name} → ${toUser.name}，${liability.name}`,
      previousValue: { owner: fromUser.name },
      newValue: { owner: toUser.name },
      currency: liability.currency,
    });

    return {
      transferId: result.id,
      assetName: liability.name,
      assetType: 'LIABILITY',
      fromUserName: fromUser.name,
      toUserName: toUser.name,
      quantity: null,
      valueCny,
      transferredAt: result.transferredAt,
    };
  }

  /**
   * 获取家庭资产转移历史
   */
  static async getTransferHistory(
    familyId: string,
    operatorId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ records: FamilyTransferRecord[]; total: number }> {
    await this.checkPermission(operatorId, familyId, 'VIEW_FAMILY');

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const [records, total] = await Promise.all([
      prisma.familyAssetTransfer.findMany({
        where: { familyId },
        include: {
          fromUser: { select: { id: true, name: true } },
          toUser: { select: { id: true, name: true } },
        },
        orderBy: { transferredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.familyAssetTransfer.count({ where: { familyId } }),
    ]);

    return {
      records: records.map((r) => ({
        id: r.id,
        familyId: r.familyId,
        fromUser: r.fromUser,
        toUser: r.toUser,
        assetType: r.assetType,
        assetName: r.assetName,
        quantity: r.quantity ? Number(r.quantity) : null,
        valueCny: Number(r.valueCny),
        notes: r.notes,
        status: r.status,
        transferredAt: r.transferredAt,
      })),
      total,
    };
  }

  /**
   * 获取家庭成员可转移的资产列表（含负债）
   */
  static async getMemberTransferableAssets(
    familyId: string,
    targetUserId: string,
    operatorId: string
  ): Promise<{
    holdings: Array<{
      id: string;
      securityName: string;
      symbol: string;
      quantity: number;
      currentPrice: number;
      valueCny: number;
      accountName: string;
      accountId: string;
    }>;
    assets: Array<{
      id: string;
      name: string;
      categoryName: string;
      categoryId: string;
      currentValue: number;
      currency: string;
      isTransferable: boolean;
      isSplittable: boolean;
    }>;
    liabilities: Array<{
      id: string;
      name: string;
      type: string;
      currentBalance: number;
      principalAmount: number;
      currency: string;
      interestRate: number | null;
      monthlyPayment: number | null;
    }>;
  }> {
    await this.checkPermission(operatorId, familyId, 'MANAGE_MEMBERS');

    // 确认目标用户是家庭成员
    const member = await prisma.familyMember.findFirst({
      where: { userId: targetUserId, familyId },
    });
    if (!member) throw new Error('该用户不是家庭成员');

    // 并行获取用户持仓、通用资产、负债
    const [holdings, assets, liabilities] = await Promise.all([
      prisma.holding.findMany({
        where: { userId: targetUserId },
        include: {
          security: { select: { symbol: true, name: true } },
          account: { select: { accountName: true, currency: true } },
        },
      }),
      prisma.asset.findMany({
        where: { userId: targetUserId },
        include: {
          assetCategory: { select: { name: true, code: true } },
        },
      }),
      prisma.liability.findMany({
        where: { userId: targetUserId, isActive: true },
        orderBy: { currentBalance: 'desc' },
      }),
    ]);

    return {
      holdings: holdings.map((h) => ({
        id: h.id,
        securityName: h.security.name,
        symbol: h.security.symbol,
        quantity: Number(h.quantity),
        currentPrice: Number(h.currentPrice || 0),
        valueCny: Number(h.marketValueCny || 0),
        accountName: h.account.accountName,
        accountId: h.accountId,
      })),
      // 所有资产统一走整体所有权转移（只变更 userId）
      assets: assets.map((a) => ({
        id: a.id,
        name: a.name,
        categoryName: a.assetCategory.name,
        categoryId: a.assetCategoryId,
        currentValue: Number(a.currentValue),
        currency: a.currency,
        isTransferable: true,
        isSplittable: false,
      })),
      liabilities: liabilities.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        currentBalance: Number(l.currentBalance),
        principalAmount: Number(l.principalAmount),
        currency: l.currency,
        interestRate: l.interestRate ? Number(l.interestRate) : null,
        monthlyPayment: l.monthlyPayment ? Number(l.monthlyPayment) : null,
      })),
    };
  }
}
