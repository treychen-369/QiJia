import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parseExcelFile, validateExcelData } from '@/lib/excel-parser'
import { importExcelData } from '@/lib/import-service'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:ExcelImport')

// 文件上传配置
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv' // .csv
]

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
    const options = formData.get('options') ? JSON.parse(formData.get('options') as string) : {}

    logger.debug('处理文件上传', { fileName: file?.name, size: file?.size })

    // 验证文件
    if (!file) {
      return NextResponse.json(
        { success: false, error: '未选择文件' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `文件大小超过限制 (${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '不支持的文件类型，请上传 Excel (.xlsx, .xls) 或 CSV 文件' },
        { status: 400 }
      )
    }

    // 解析Excel文件
    logger.debug('开始解析文件', { fileName: file.name })
    const parseResult = await parseExcelFile(file)

    if (!parseResult.success) {
      logger.warn('文件解析失败', { fileName: file.name })
      return NextResponse.json({
        success: false,
        error: '文件解析失败',
        details: {
          parseResult,
          summary: parseResult.summary
        }
      }, { status: 400 })
    }

    // 验证解析后的数据
    const validation = validateExcelData(parseResult.data!)
    
    if (!validation.isValid) {
      logger.warn('数据验证失败')
      return NextResponse.json({
        success: false,
        error: '数据验证失败',
        details: {
          parseResult,
          validation,
          summary: parseResult.summary
        }
      }, { status: 400 })
    }

    // 如果只是预览模式，返回解析结果
    if (options.previewOnly) {
      return NextResponse.json({
        success: true,
        message: '文件解析成功',
        data: {
          parseResult,
          validation,
          preview: {
            accountBalances: parseResult.data!.accountBalances.slice(0, 5),
            assetDetails: parseResult.data!.assetDetails.slice(0, 10),
            investmentPlans: parseResult.data!.investmentPlans.slice(0, 3),
            marketDetails: parseResult.data!.marketDetails.slice(0, 5),
            strategyOutputs: parseResult.data!.strategyOutputs.slice(0, 5)
          }
        }
      })
    }

    // 导入数据到数据库
    logger.info('开始导入数据')
    const importOptions = {
      overwrite: options.overwrite === true || options.overwrite === 'true'
    }
    
    const importResult = await importExcelData(session.user.id, parseResult, importOptions)
    logger.info('导入完成', { success: importResult.success })

    return NextResponse.json({
      success: importResult.success,
      message: importResult.message,
      data: {
        parseResult,
        importResult,
        summary: {
          parsing: parseResult.summary,
          importing: importResult.summary
        }
      }
    })

  } catch (error) {
    logger.error('Excel导入错误', error)
    
    // 生产环境不返回堆栈信息
    const isDev = process.env.NODE_ENV === 'development'
    return NextResponse.json(
      { 
        success: false, 
        error: '服务器内部错误',
        details: error instanceof Error ? error.message : '未知错误',
        ...(isDev && { stack: error instanceof Error ? error.stack : null })
      },
      { status: 500 }
    )
  }
}

// 获取导入历史
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // 这里可以添加导入历史记录的查询
    // 暂时返回空数据
    return NextResponse.json({
      success: true,
      data: {
        imports: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      }
    })

  } catch (error) {
    logger.error('获取导入历史错误', error)
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    )
  }
}
