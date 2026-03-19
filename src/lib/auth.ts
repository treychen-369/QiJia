import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { createLogger } from './logger';

const logger = createLogger('Auth');

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // 暂时注释掉OAuth提供商，避免缺少环境变量导致的错误
    // Google OAuth
    // GoogleProvider({
    //   clientId: process.env.GOOGLE_CLIENT_ID!,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    //   authorization: {
    //     params: {
    //       prompt: "consent",
    //       access_type: "offline",
    //       response_type: "code"
    //     }
    //   }
    // }),
    
    // GitHub OAuth
    // GitHubProvider({
    //   clientId: process.env.GITHUB_ID!,
    //   clientSecret: process.env.GITHUB_SECRET!,
    // }),
    
    // 邮箱密码登录
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { 
          label: 'Email', 
          type: 'email',
          placeholder: 'your-email@example.com'
        },
        password: { 
          label: 'Password', 
          type: 'password' 
        }
      },
      async authorize(credentials) {
        logger.debug('认证请求开始');
        
        if (!credentials?.email || !credentials?.password) {
          logger.debug('缺少认证凭据');
          return null;
        }

        try {
          // 查找用户
          logger.debug('查找用户', { email: credentials.email });
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            }
          });

          if (!user || !user.password) {
            logger.debug('用户不存在或无密码');
            return null;
          }

          // 验证密码
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            logger.debug('密码验证失败');
            return null;
          }

          // 返回用户信息
          logger.info('用户登录成功', { userId: user.id });
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatarUrl,
            role: user.role,
          };
        } catch (error) {
          logger.error('认证错误', error);
          return null;
        }
      }
    })
  ],
  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax', // 开发环境允许跨域
        path: '/',
        // 使用环境变量控制 secure，HTTP 模式下设置 COOKIE_SECURE=false
        secure: process.env.COOKIE_SECURE === 'true',
      },
    },
  },
  
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      // 首次登录时，将用户信息添加到token
      if (user) {
        token.role = user.role;
        
        // 如果是OAuth登录，创建或更新用户信息
        if (account?.provider !== 'credentials') {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! }
          });
          
          if (existingUser) {
            token.role = existingUser.role;
          }
        }
      }
      
      // 查询家庭信息（首次登录 或 session update 触发时刷新）
      if (user || trigger === 'update') {
        const userId = token.sub;
        if (userId) {
          try {
            const familyMember = await prisma.familyMember.findUnique({
              where: { userId },
              select: { familyId: true, role: true },
            });
            token.familyId = familyMember?.familyId || undefined;
            token.familyRole = familyMember?.role || undefined;
          } catch (err) {
            logger.warn('查询家庭信息失败', err);
          }
        }
      }
      
      return token;
    },
    
    async session({ session, token }) {
      // 将token信息传递给session
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.familyId = token.familyId as string | undefined;
        session.user.familyRole = token.familyRole as string | undefined;
      }
      
      return session;
    },
    
    async signIn({ user, account, profile }) {
      // OAuth登录时的处理逻辑
      if (account?.provider === 'google' || account?.provider === 'github') {
        try {
          // 检查用户是否已存在
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! }
          });
          
          // 如果用户不存在，创建新用户
          if (!existingUser) {
            await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || profile?.name || 'Unknown',
                avatarUrl: user.image || profile?.image,
                role: 'USER',
              }
            });
          }
          
          return true;
        } catch (error) {
          logger.error('OAuth登录错误', error);
          return false;
        }
      }
      
      return true;
    },
  },
  
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  
  events: {
    async signIn({ user, account }) {
      logger.info('用户登录', { userId: user.id, provider: account?.provider });
    },
    
    async signOut({ token }) {
      logger.info('用户登出', { userId: token?.sub });
    }
  },
  
  debug: process.env.NODE_ENV === 'development',
};

// 用户注册函数（支持可选创建家庭）
export async function registerUser(userData: {
  email: string;
  password: string;
  name: string;
  familyName?: string; // 可选：注册时同时创建家庭
}) {
  const { email, password, name, familyName } = userData;
  
  // 检查用户是否已存在
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  
  if (existingUser) {
    throw new Error('用户已存在');
  }
  
  // 加密密码
  const hashedPassword = await bcrypt.hash(password, 12);
  
  // 使用事务：创建用户 + 可选创建家庭
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'USER',
      }
    });

    let familyId: string | undefined;
    let familyRole: string | undefined;

    if (familyName && familyName.trim()) {
      const family = await tx.family.create({
        data: {
          name: familyName.trim(),
          createdBy: user.id,
        },
      });

      await tx.familyMember.create({
        data: {
          userId: user.id,
          familyId: family.id,
          role: 'ADMIN',
        },
      });

      familyId = family.id;
      familyRole = 'ADMIN';
      logger.info('注册时创建家庭', { userId: user.id, familyId: family.id });
    }

    return { user, familyId, familyRole };
  });
  
  return {
    id: result.user.id,
    email: result.user.email,
    name: result.user.name,
    familyId: result.familyId,
    familyRole: result.familyRole,
  };
}

