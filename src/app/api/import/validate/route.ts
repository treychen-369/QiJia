import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parseExcelFile, validateExcelData } from '@/lib/excel-parser'

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    // 解析表单数据
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: '未选择文件' },
        { status: 400 }
      )
    }

    // 解析文件
    const parseResult = await parseExcelFile(file)
    
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: '文件解析失败',
        parseResult
      })
    }

    // 验证数据
    const validation = validateExcelData(parseResult.data!)

    // 生成数据预览 - 增加预览条数
    const preview = {
      accountBalances: parseResult.data!.accountBalances.slice(0, 10),
      assetDetails: parseResult.data!.assetDetails.slice(0, 20),
      investmentPlans: parseResult.data!.investmentPlans.slice(0, 5),
      marketDetails: parseResult.data!.marketDetails.slice(0, 10),
      strategyOutputs: parseResult.data!.strategyOutputs.slice(0, 10)
    }

    return NextResponse.json({
      success: true,
      data: {
        validation,
        preview,
        summary: parseResult.summary,
        isValid: validation.isValid,
        canImport: validation.isValid && parseResult.success
      }
    })

  } catch (error) {
    console.error('文件验证错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '文件验证失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}