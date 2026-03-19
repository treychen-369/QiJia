import * as XLSX from 'xlsx'
import { safeNumber, isValidNumber } from '@/lib/utils'

// Excel数据解析结果类型
export interface ParsedExcelData {
  accountBalances: AccountBalanceData[]
  assetDetails: AssetDetailData[]
  investmentPlans: InvestmentPlanData[]
  marketDetails: MarketDetailData[]
  strategyOutputs: StrategyOutputData[]
}

// 各个数据表的类型定义
export interface AccountBalanceData {
  date: string
  accountName: string
  currency: string
  currentValueOriginal: number
  exchangeRate: number
  currentValueCny: number
  cashBalanceOriginal: number
  investableRatio: number
  investableAmountCny: number
  holdings: string
  totalRatio: number
  notes: string
}

export interface AssetDetailData {
  date: string
  assetCategory: string
  region: string
  security: string
  valueOriginal: number
  valueCny: number
  sourceAccount: string
  ratio: number
}

export interface InvestmentPlanData {
  date: string
  planName: string
  targetAmount: number
  currentProgress: string
  expectedReturn: string
  riskLevel: string
  executionStatus: string
}

export interface MarketDetailData {
  indexName: string
  type: string
  code: string
  currentLevel: number
  peRatio: number
  historicalPeMedian: number
  valuationPercentile: number
  status: string
  signalWeight: number
  dataSource: string
}

export interface StrategyOutputData {
  assetCategory: string
  currentValue: number
  currentRatio: number
  targetRatio: number
  deviation: number
  recommendedAction: string
  notes: string
}

// Excel解析错误类型
export interface ParseError {
  sheet: string
  row: number
  column: string
  field: string
  value: any
  message: string
}

// Excel解析结果
export interface ExcelParseResult {
  success: boolean
  data?: ParsedExcelData
  errors: ParseError[]
  warnings: string[]
  summary: {
    totalSheets: number
    processedSheets: number
    totalRows: number
    processedRows: number
    errorRows: number
  }
}

/**
 * Excel文件解析器类
 */
export class ExcelParser {
  private workbook: XLSX.WorkBook | null = null
  private errors: ParseError[] = []
  private warnings: string[] = []

  /**
   * 从文件解析Excel
   */
  async parseFromFile(file: File): Promise<ExcelParseResult> {
    try {
      const buffer = await file.arrayBuffer()
      return this.parseFromBuffer(buffer)
    } catch (error) {
      return {
        success: false,
        errors: [{
          sheet: 'FILE',
          row: 0,
          column: '',
          field: 'file',
          value: file.name,
          message: `文件读取失败: ${error instanceof Error ? error.message : '未知错误'}`
        }],
        warnings: [],
        summary: {
          totalSheets: 0,
          processedSheets: 0,
          totalRows: 0,
          processedRows: 0,
          errorRows: 0
        }
      }
    }
  }

  /**
   * 从Buffer解析Excel
   */
  parseFromBuffer(buffer: ArrayBuffer): ExcelParseResult {
    this.errors = []
    this.warnings = []

    try {
      // 读取Excel文件
      this.workbook = XLSX.read(buffer, { 
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false
      })

      const data: ParsedExcelData = {
        accountBalances: [],
        assetDetails: [],
        investmentPlans: [],
        marketDetails: [],
        strategyOutputs: []
      }

      let totalRows = 0
      let processedRows = 0
      let errorRows = 0

      // 解析各个工作表
      for (const sheetName of this.workbook.SheetNames) {
        const worksheet = this.workbook.Sheets[sheetName]
        if (!worksheet) {
          this.warnings.push(`工作表 "${sheetName}" 不存在`)
          continue
        }
        const sheetData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '',
          raw: false
        }) as any[][]

        if (sheetData.length === 0) {
          this.warnings.push(`工作表 "${sheetName}" 为空`)
          continue
        }

        totalRows += sheetData.length - 1 // 减去标题行

        // 根据工作表名称或内容判断数据类型
        const result = this.parseSheetData(sheetName, sheetData)
        
        if (result.type === 'account_balance') {
          data.accountBalances.push(...result.data)
        } else if (result.type === 'asset_details') {
          data.assetDetails.push(...result.data)
        } else if (result.type === 'investment_plan') {
          data.investmentPlans.push(...result.data)
        } else if (result.type === 'market_details') {
          data.marketDetails.push(...result.data)
        } else if (result.type === 'strategy_output') {
          data.strategyOutputs.push(...result.data)
        }

        processedRows += result.processedRows
        errorRows += result.errorRows
      }

      return {
        success: this.errors.length === 0,
        data,
        errors: this.errors,
        warnings: this.warnings,
        summary: {
          totalSheets: this.workbook.SheetNames.length,
          processedSheets: this.workbook.SheetNames.length,
          totalRows,
          processedRows,
          errorRows
        }
      }

    } catch (error) {
      return {
        success: false,
        errors: [{
          sheet: 'WORKBOOK',
          row: 0,
          column: '',
          field: 'workbook',
          value: '',
          message: `Excel文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`
        }],
        warnings: this.warnings,
        summary: {
          totalSheets: 0,
          processedSheets: 0,
          totalRows: 0,
          processedRows: 0,
          errorRows: 0
        }
      }
    }
  }

  /**
   * 解析单个工作表数据
   */
  private parseSheetData(sheetName: string, sheetData: any[][]): {
    type: string
    data: any[]
    processedRows: number
    errorRows: number
  } {
    if (sheetData.length < 2) {
      return { type: 'unknown', data: [], processedRows: 0, errorRows: 0 }
    }

    const headers = sheetData[0]?.map((h: any) => String(h).trim()) || []
    const dataRows = sheetData.slice(1)

    // 根据标题判断数据类型
    const sheetType = this.detectSheetType(sheetName, headers)
    
    let processedRows = 0
    let errorRows = 0
    const parsedData: any[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const rowIndex = i + 2 // Excel行号（从1开始，加上标题行）

      try {
        let parsedRow: any = null

        switch (sheetType) {
          case 'account_balance':
            parsedRow = this.parseAccountBalanceRow(headers, row || [], sheetName, rowIndex)
            break
          case 'asset_details':
            parsedRow = this.parseAssetDetailRow(headers, row || [], sheetName, rowIndex)
            break
          case 'investment_plan':
            parsedRow = this.parseInvestmentPlanRow(headers, row || [], sheetName, rowIndex)
            break
          case 'market_details':
            parsedRow = this.parseMarketDetailRow(headers, row || [], sheetName, rowIndex)
            break
          case 'strategy_output':
            parsedRow = this.parseStrategyOutputRow(headers, row || [], sheetName, rowIndex)
            break
          default:
            this.warnings.push(`未识别的工作表类型: ${sheetName}`)
            continue
        }

        if (parsedRow) {
          parsedData.push(parsedRow)
          processedRows++
        }
      } catch (error) {
        errorRows++
        this.errors.push({
          sheet: sheetName,
          row: rowIndex,
          column: '',
          field: 'row',
          value: row,
          message: `行解析失败: ${error instanceof Error ? error.message : '未知错误'}`
        })
      }
    }

    return {
      type: sheetType,
      data: parsedData,
      processedRows,
      errorRows
    }
  }

  /**
   * 检测工作表类型
   */
  private detectSheetType(sheetName: string, headers: string[]): string {
    const name = sheetName.toLowerCase()
    const headerStr = headers.join('|').toLowerCase()

    // 优先检查工作表名称
    if (name.includes('账户余额') || name === 'account_balance') {
      return 'account_balance'
    }
    if (name.includes('资产详情') || name.includes('资产明细') || name === 'asset_details') {
      return 'asset_details'
    }
    if (name.includes('投资计划') || name === 'investment_plan') {
      return 'investment_plan'
    }
    if (name.includes('市场数据') || name.includes('市场详情') || name === 'market_details') {
      return 'market_details'
    }
    if (name.includes('策略输出') || name.includes('策略') || name === 'strategy_output') {
      return 'strategy_output'
    }

    // 然后检查标题内容（作为备用方案）
    if (headerStr.includes('资产类别') && headerStr.includes('标的')) {
      return 'asset_details'
    }
    if ((headerStr.includes('账户') && (headerStr.includes('余额') || headerStr.includes('市值'))) && 
        !headerStr.includes('资产类别') && !headerStr.includes('资产类型')) {
      return 'account_balance'
    }
    if (headerStr.includes('计划名称') && headerStr.includes('目标金额')) {
      return 'investment_plan'
    }
    if (headerStr.includes('指数名称') && headerStr.includes('市盈率')) {
      return 'market_details'
    }
    if (headerStr.includes('策略名称') && headerStr.includes('建议操作')) {
      return 'strategy_output'
    }

    return 'unknown'
  }

  /**
   * 解析账户余额行
   */
  private parseAccountBalanceRow(headers: string[], row: any[], sheetName: string, rowIndex: number): AccountBalanceData | null {
    const getValue = (field: string, defaultValue: any = '') => {
      // 优先精确匹配
      let index = headers.findIndex(h => h === field)
      if (index >= 0) return row[index]
      
      // 然后尝试包含匹配
      index = headers.findIndex(h => 
        h.includes(field) || 
        field.includes(h) ||
        this.fuzzyMatch(h, field)
      )
      return index >= 0 ? row[index] : defaultValue
    }

    // 跳过空行或合计行
    if (!row || row.length === 0 || String(row[0]).includes('合计')) {
      return null
    }

    // 跳过可用资金行（这些不是账户余额）
    const accountType = String(getValue('账户类型') || getValue('账户', '')).trim()
    if (accountType.includes('可取资金') || accountType.includes('可用资金')) {
      return null
    }

    try {
      return {
        date: this.parseDate(getValue('更新时间') || getValue('日期')),
        accountName: accountType,
        currency: String(getValue('币种', 'CNY')).trim(),
        currentValueOriginal: safeNumber(getValue('余额') || getValue('当前市值（原币）')),
        exchangeRate: safeNumber(getValue('汇率'), 1),
        currentValueCny: safeNumber(getValue('当前市值(¥)') || getValue('余额')), // 如果没有人民币值，先用原币值
        cashBalanceOriginal: safeNumber(getValue('现金余额') || getValue('余额')),
        investableRatio: this.parsePercentage(getValue('可投资比例')),
        investableAmountCny: safeNumber(getValue('可投资金额')),
        holdings: String(getValue('已持仓标的', '')).trim(),
        totalRatio: this.parsePercentage(getValue('总体占比')),
        notes: String(getValue('备注', '')).trim()
      }
    } catch (error) {
      this.addError(sheetName, rowIndex, '', 'account_balance', row, `账户余额数据解析失败: ${error}`)
      return null
    }
  }

  /**
   * 解析资产明细行
   */
  private parseAssetDetailRow(headers: string[], row: any[], sheetName: string, rowIndex: number): AssetDetailData | null {
    const getValue = (field: string, defaultValue: any = '') => {
      // 优先精确匹配
      let index = headers.findIndex(h => h === field)
      if (index >= 0) return row[index]
      
      // 然后尝试包含匹配，但避免部分匹配冲突
      index = headers.findIndex(h => 
        h.includes(field) && h.length === field.length
      )
      if (index >= 0) return row[index]
      
      // 最后尝试模糊匹配
      index = headers.findIndex(h => 
        h.includes(field) || 
        field.includes(h) ||
        this.fuzzyMatch(h, field)
      )
      return index >= 0 ? row[index] : defaultValue
    }

    if (!row || row.length === 0) {
      return null
    }

    try {
      return {
        date: this.parseDate(getValue('日期')),
        assetCategory: String(getValue('资产类别', '')).trim(),
        region: String(getValue('标的地区', '')).trim(),
        security: String(getValue('标的', '')).trim(),
        valueOriginal: safeNumber(getValue('市值（原值）')),
        valueCny: safeNumber(getValue('市值（人民币）')),
        sourceAccount: String(getValue('来源账户', '')).trim(),
        ratio: this.parsePercentage(getValue('占比'))
      }
    } catch (error) {
      this.addError(sheetName, rowIndex, '', 'asset_detail', row, `资产明细数据解析失败: ${error}`)
      return null
    }
  }

  /**
   * 解析投资计划行
   */
  private parseInvestmentPlanRow(headers: string[], row: any[], sheetName: string, rowIndex: number): InvestmentPlanData | null {
    const getValue = (field: string, defaultValue: any = '') => {
      const index = headers.findIndex(h => 
        h.includes(field) || 
        field.includes(h) ||
        this.fuzzyMatch(h, field)
      )
      return index >= 0 ? row[index] : defaultValue
    }

    if (!row || row.length === 0) {
      return null
    }

    try {
      return {
        date: this.parseDate(getValue('日期')),
        planName: String(getValue('计划名称', '')).trim(),
        targetAmount: safeNumber(getValue('目标金额')),
        currentProgress: String(getValue('当前进度') || getValue('当前进度(%)') || '').trim(),
        expectedReturn: String(getValue('预期收益率') || getValue('预期收益率(%)') || '').trim(),
        riskLevel: String(getValue('风险等级', '')).trim(),
        executionStatus: String(getValue('执行状态', '')).trim()
      }
    } catch (error) {
      this.addError(sheetName, rowIndex, '', 'investment_plan', row, `投资计划数据解析失败: ${error}`)
      return null
    }
  }

  /**
   * 解析市场数据行
   */
  private parseMarketDetailRow(headers: string[], row: any[], sheetName: string, rowIndex: number): MarketDetailData | null {
    const getValue = (field: string, defaultValue: any = '') => {
      const index = headers.findIndex(h => 
        h.includes(field) || 
        field.includes(h) ||
        this.fuzzyMatch(h, field)
      )
      return index >= 0 ? row[index] : defaultValue
    }

    if (!row || row.length === 0) {
      return null
    }

    try {
      return {
        indexName: String(getValue('指数名称', '')).trim(),
        type: String(getValue('类型', '')).trim(),
        code: String(getValue('代码', '')).trim(),
        currentLevel: safeNumber(getValue('当前点位')),
        peRatio: safeNumber(getValue('PE（市盈率）')),
        historicalPeMedian: safeNumber(getValue('历史PE（中位数）')),
        valuationPercentile: this.parsePercentage(getValue('估值百分位')),
        status: String(getValue('状态', '')).trim(),
        signalWeight: safeNumber(getValue('信号权重'), 1),
        dataSource: String(getValue('数据来源', '')).trim()
      }
    } catch (error) {
      this.addError(sheetName, rowIndex, '', 'market_detail', row, `市场数据解析失败: ${error}`)
      return null
    }
  }

  /**
   * 解析策略输出行
   */
  private parseStrategyOutputRow(headers: string[], row: any[], sheetName: string, rowIndex: number): StrategyOutputData | null {
    const getValue = (field: string, defaultValue: any = '') => {
      const index = headers.findIndex(h => 
        h.includes(field) || 
        field.includes(h) ||
        this.fuzzyMatch(h, field)
      )
      return index >= 0 ? row[index] : defaultValue
    }

    if (!row || row.length === 0 || String(row[0]).includes('合计')) {
      return null
    }

    try {
      return {
        assetCategory: String(getValue('策略名称') || getValue('资产类别') || '').trim(),
        currentValue: safeNumber(getValue('目标价格') || getValue('当前市值')),
        currentRatio: this.parsePercentage(getValue('预期收益') || getValue('预期收益(%)') || getValue('当前占比')),
        targetRatio: this.parsePercentage(getValue('目标占比')),
        deviation: this.parsePercentage(getValue('偏离')),
        recommendedAction: String(getValue('建议操作', '')).trim(),
        notes: String(getValue('风险提示') || getValue('备注') || '').trim()
      }
    } catch (error) {
      this.addError(sheetName, rowIndex, '', 'strategy_output', row, `策略输出数据解析失败: ${error}`)
      return null
    }
  }

  /**
   * 解析日期
   */
  private parseDate(value: any): string {
    if (!value) return new Date().toISOString().split('T')[0] || ''
    
    if (value instanceof Date) {
      return value.toISOString().split('T')[0] || ''
    }
    
    const str = String(value).trim()
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return str
    }
    
    // 尝试解析其他日期格式
    const date = new Date(str)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0] || ''
    }
    
    return new Date().toISOString().split('T')[0] || ''
  }

  /**
   * 解析百分比
   */
  private parsePercentage(value: any): number {
    if (!value) return 0
    
    const str = String(value).replace(/[%％\s]/g, '')
    const num = parseFloat(str)
    
    if (isNaN(num)) return 0
    
    // 如果数值大于1，认为是百分比形式（如50%），需要除以100
    return num > 1 ? num / 100 : num
  }

  /**
   * 模糊匹配字段名
   */
  private fuzzyMatch(str1: string, str2: string): boolean {
    const normalize = (str: string) => str.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '')
    const s1 = normalize(str1)
    const s2 = normalize(str2)
    
    return s1.includes(s2) || s2.includes(s1)
  }

  /**
   * 添加错误
   */
  private addError(sheet: string, row: number, column: string, field: string, value: any, message: string) {
    this.errors.push({
      sheet,
      row,
      column,
      field,
      value,
      message
    })
  }
}

/**
 * 便捷的Excel解析函数
 */
export async function parseExcelFile(file: File): Promise<ExcelParseResult> {
  const parser = new ExcelParser()
  return await parser.parseFromFile(file)
}

/**
 * 验证Excel数据
 */
export function validateExcelData(data: ParsedExcelData): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // 验证账户余额数据
  if (data.accountBalances.length === 0) {
    warnings.push('未找到账户余额数据')
  } else {
    data.accountBalances.forEach((item, index) => {
      if (!item.accountName) {
        errors.push(`账户余额第${index + 1}行：账户名称不能为空`)
      }
      if (!isValidNumber(item.currentValueCny)) {
        errors.push(`账户余额第${index + 1}行：当前市值无效`)
      }
    })
  }

  // 验证资产明细数据
  if (data.assetDetails.length === 0) {
    warnings.push('未找到资产明细数据')
  } else {
    data.assetDetails.forEach((item, index) => {
      if (!item.security) {
        errors.push(`资产明细第${index + 1}行：标的名称不能为空`)
      }
      if (!isValidNumber(item.valueCny)) {
        errors.push(`资产明细第${index + 1}行：市值无效`)
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}