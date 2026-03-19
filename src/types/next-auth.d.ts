import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      familyId?: string;
      familyRole?: string;  // Phase 4: 家庭角色 (ADMIN/MEMBER/VIEWER)
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: string;
    familyId?: string;
    familyRole?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role: string;
    familyId?: string;
    familyRole?: string;
  }
}