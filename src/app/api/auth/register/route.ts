import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';
import { z } from 'zod';

// 注册数据验证schema
const registerSchema = z.object({
  name: z.string()
    .min(2, '姓名至少2个字符')
    .max(50, '姓名不能超过50个字符')
    .trim(),
  email: z.string()
    .email('请输入有效的邮箱地址')
    .toLowerCase(),
  password: z.string()
    .min(6, '密码至少6位')
    .max(100, '密码不能超过100位'),
  familyName: z.string()
    .min(2, '家庭名称至少2个字符')
    .max(50, '家庭名称不能超过50个字符')
    .trim()
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证请求数据
    const validatedData = registerSchema.parse(body);
    
    // 注册用户
    const user = await registerUser(validatedData);
    
    return NextResponse.json(
      {
        success: true,
        message: '注册成功',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
    
  } catch (error: any) {
    console.error('Registration error:', error);
    
    // 处理Zod验证错误
    if (error.name === 'ZodError') {
      const firstError = error.errors[0];
      return NextResponse.json(
        {
          success: false,
          message: firstError.message,
          field: firstError.path[0],
        },
        { status: 400 }
      );
    }
    
    // 处理Prisma错误
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          success: false,
          message: '该邮箱已被注册',
          field: 'email',
        },
        { status: 409 }
      );
    }
    
    // 处理其他已知错误
    if (error.message) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 }
      );
    }
    
    // 处理未知错误
    return NextResponse.json(
      {
        success: false,
        message: '注册失败，请稍后重试',
      },
      { status: 500 }
    );
  }
}