/**
 * 再平衡计划 API
 *
 * GET:    获取当前活跃计划（含任务列表和进度）
 * POST:   基于最新 AI 建议生成新计划
 * DELETE: 取消计划
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { RebalanceService } from '@/lib/services/rebalance-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope')
    const history = searchParams.get('history')

    const userId = session.user.id
    const familyId = scope === 'family' ? session.user.familyId : undefined

    if (history === 'true') {
      const plans = await RebalanceService.getPlanHistory(userId, familyId || undefined)
      return NextResponse.json({ success: true, data: plans })
    }

    const plan = await RebalanceService.getActivePlan(userId, familyId || undefined)
    return NextResponse.json({
      success: true,
      data: plan,
      hasPlan: plan !== null,
    })
  } catch (error) {
    console.error('[API错误] GET /api/rebalance/plan:', error)
    return NextResponse.json({ error: '获取计划失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const scope = body.scope
    const userId = session.user.id
    const familyId = scope === 'family' ? session.user.familyId : undefined

    const plan = await RebalanceService.generatePlan({
      userId,
      familyId: familyId || undefined,
      adviceId: body.adviceId || undefined,
      name: body.name || undefined,
    })

    return NextResponse.json({
      success: true,
      data: plan,
      message: '再平衡计划已生成',
    })
  } catch (error: any) {
    console.error('[API错误] POST /api/rebalance/plan:', error)
    const message = error?.message || '生成计划失败'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('planId')

    if (!planId) {
      return NextResponse.json({ error: '缺少 planId' }, { status: 400 })
    }

    await RebalanceService.cancelPlan(planId)
    return NextResponse.json({ success: true, message: '计划已取消' })
  } catch (error) {
    console.error('[API错误] DELETE /api/rebalance/plan:', error)
    return NextResponse.json({ error: '取消计划失败' }, { status: 500 })
  }
}
