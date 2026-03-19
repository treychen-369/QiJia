/**
 * 单个再平衡任务操作 API
 *
 * PATCH: 更新任务状态（完成/跳过）或修改金额/备注
 * POST:  新增自定义任务（planId 从 body 获取）
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { RebalanceService } from '@/lib/services/rebalance-service'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { taskId } = params
    const body = await request.json()
    const { action, actualAmount, targetAmount, notes } = body

    let task
    if (action === 'complete') {
      task = await RebalanceService.completeTask(taskId, actualAmount)
    } else if (action === 'skip') {
      task = await RebalanceService.skipTask(taskId, notes)
    } else if (action === 'update') {
      task = await RebalanceService.updateTask(taskId, { targetAmount, notes })
    } else {
      return NextResponse.json({ error: '无效的 action，支持: complete, skip, update' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: task })
  } catch (error) {
    console.error('[API错误] PATCH /api/rebalance/task:', error)
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // taskId 在此场景中作为 planId 使用（路由复用，POST 用于添加自定义任务）
    const planId = params.taskId
    const body = await request.json()

    const task = await RebalanceService.addCustomTask(planId, {
      periodNumber: body.periodNumber,
      categoryCode: body.categoryCode,
      categoryName: body.categoryName,
      action: body.action,
      targetAmount: body.targetAmount,
      dueDate: body.dueDate,
      notes: body.notes,
    })

    return NextResponse.json({ success: true, data: task, message: '自定义任务已添加' })
  } catch (error) {
    console.error('[API错误] POST /api/rebalance/task:', error)
    return NextResponse.json({ error: '添加任务失败' }, { status: 500 })
  }
}
