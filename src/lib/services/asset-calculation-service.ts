import { exchangeRateService } from '@/lib/exchange-rate-service'
import { goldPriceService } from '@/lib/gold-price-service'

/**
 * 资产计算服务
 * 将 /api/assets 中的实时计算逻辑提取为可复用的服务方法
 * 用于个人视角和家庭视角的资产计算
 */
export class AssetCalculationService {
  /**
   * 对原始资产数据进行实时计算（汇率转换、收益计算、不动产指标等）
   * @param assets - 从数据库查询的原始 Asset 记录数组（含 assetCategory + parent）
   * @returns 计算后的资产数组，包含 CNY 市值、盈亏、汇率等
   */
  static async calculateAssets(assets: any[]): Promise<any[]> {
    return Promise.all(assets.map(async (asset) => {
      const assetType = asset.assetCategory?.code || '';
      const metadata = asset.metadata as any || {};

      // 1. 获取实时汇率
      const exchangeRate = await exchangeRateService.getRate(asset.currency, 'CNY');

      // 2. 原币种金额
      const originalValue = asset.originalValue != null ? Number(asset.originalValue) : Number(asset.purchasePrice);

      // 3. 计算 CNY 本金
      const purchasePriceCny = originalValue * exchangeRate;

      // 4. 实时计算收益和市值
      let currentValueCny = purchasePriceCny;
      let unrealizedPnl = 0;
      let unrealizedPnlPercent = 0;

      // 货币基金
      if (assetType === 'CASH_MONEY_FUND' && metadata.yield7Day && asset.purchaseDate) {
        try {
          const yield7Day = parseFloat(metadata.yield7Day);
          const daysSincePurchase = Math.floor(
            (Date.now() - new Date(asset.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (yield7Day > 0 && daysSincePurchase > 0) {
            unrealizedPnl = (purchasePriceCny * yield7Day / 100 / 365) * daysSincePurchase;
            currentValueCny = purchasePriceCny + unrealizedPnl;
            unrealizedPnlPercent = purchasePriceCny > 0 ? (unrealizedPnl / purchasePriceCny) * 100 : 0;
          }
        } catch (error) {
          console.error('货币基金收益计算失败:', error);
        }
      }
      // 定期存款
      else if (assetType === 'CASH_FIXED' && metadata.interestRate && asset.purchaseDate && asset.maturityDate) {
        try {
          const interestRate = parseFloat(metadata.interestRate);
          const startDate = new Date(asset.purchaseDate);
          const maturityDate = new Date(asset.maturityDate);
          const now = new Date();
          const totalDays = Math.floor((maturityDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const elapsedDays = Math.min(
            Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
            totalDays
          );
          if (interestRate > 0 && elapsedDays > 0) {
            unrealizedPnl = (purchasePriceCny * interestRate / 100 / 365) * elapsedDays;
            currentValueCny = purchasePriceCny + unrealizedPnl;
            unrealizedPnlPercent = purchasePriceCny > 0 ? (unrealizedPnl / purchasePriceCny) * 100 : 0;
          }
        } catch (error) {
          console.error('定期存款收益计算失败:', error);
        }
      }
      // 固定收益类
      else if (['FIXED_BOND', 'FIXED_CONVERTIBLE', 'FIXED_WEALTH'].includes(assetType) && metadata.annualYield !== undefined && asset.purchaseDate) {
        try {
          const annualYield = parseFloat(metadata.annualYield);
          const daysSincePurchase = Math.floor(
            (Date.now() - new Date(asset.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (annualYield >= 0 && daysSincePurchase >= 0) {
            unrealizedPnl = (purchasePriceCny * annualYield / 100 / 365) * daysSincePurchase;
            currentValueCny = purchasePriceCny + unrealizedPnl;
            unrealizedPnlPercent = purchasePriceCny > 0 ? (unrealizedPnl / purchasePriceCny) * 100 : 0;
          }
        } catch (error) {
          console.error('固定收益计算失败:', error);
        }
      }
      // 不动产类
      else if (['RE_RESIDENTIAL', 'RE_COMMERCIAL', 'RE_REITS'].includes(assetType)) {
        try {
          // currentValue 数据库中已存储为 CNY，无需再乘汇率
          // purchasePrice 数据库中存储为原币种，需要乘汇率
          const purchaseValue = Number(asset.purchasePrice);
          const purchaseCost = purchaseValue * exchangeRate;
          currentValueCny = asset.currentValue != null ? Number(asset.currentValue) : purchaseCost;
          unrealizedPnl = currentValueCny - purchaseCost;
          unrealizedPnlPercent = purchaseCost > 0 ? (unrealizedPnl / purchaseCost) * 100 : 0;

          const monthlyRent = Number(metadata.rentalIncome || metadata.monthlyRent || 0);
          const vacancyRate = Number(metadata.vacancyRate || 0);
          const annualExpenses = Number(metadata.annualExpenses || 0);
          const area = Number(metadata.area || 0);

          const annualRent = monthlyRent * 12;
          const grossRentalYield = currentValueCny > 0 ? (annualRent / currentValueCny) * 100 : 0;
          const effectiveAnnualRent = annualRent * (1 - vacancyRate / 100);
          const netAnnualIncome = effectiveAnnualRent - annualExpenses;
          const netRentalYield = currentValueCny > 0 ? (netAnnualIncome / currentValueCny) * 100 : 0;
          const priceToRentRatio = annualRent > 0 ? currentValueCny / annualRent : 0;
          const pricePerSqm = area > 0 ? currentValueCny / area : 0;
          const rentPerSqm = area > 0 ? monthlyRent / area : 0;

          let accumulatedRent = 0;
          let holdingMonths = 0;
          if (asset.purchaseDate && monthlyRent > 0) {
            const purchaseDate = new Date(asset.purchaseDate);
            const now = new Date();
            holdingMonths = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
            accumulatedRent = monthlyRent * Math.max(0, holdingMonths) * (1 - vacancyRate / 100);
          }

          const holdingYears = holdingMonths / 12;
          const annualizedAppreciation = holdingYears > 0 ? unrealizedPnlPercent / holdingYears : unrealizedPnlPercent;
          const totalAnnualYield = annualizedAppreciation + netRentalYield;
          const totalReturn = unrealizedPnl + accumulatedRent;
          const totalReturnPercent = (purchaseValue * exchangeRate) > 0 ? (totalReturn / (purchaseValue * exchangeRate)) * 100 : 0;

          metadata._realEstateMetrics = {
            grossRentalYield: parseFloat(grossRentalYield.toFixed(2)),
            netRentalYield: parseFloat(netRentalYield.toFixed(2)),
            priceToRentRatio: parseFloat(priceToRentRatio.toFixed(1)),
            pricePerSqm: parseFloat(pricePerSqm.toFixed(0)),
            rentPerSqm: parseFloat(rentPerSqm.toFixed(2)),
            monthlyRent,
            annualRent,
            effectiveAnnualRent: parseFloat(effectiveAnnualRent.toFixed(2)),
            netAnnualIncome: parseFloat(netAnnualIncome.toFixed(2)),
            accumulatedRent: parseFloat(accumulatedRent.toFixed(2)),
            annualizedAppreciation: parseFloat(annualizedAppreciation.toFixed(2)),
            totalAnnualYield: parseFloat(totalAnnualYield.toFixed(2)),
            totalReturn: parseFloat(totalReturn.toFixed(2)),
            totalReturnPercent: parseFloat(totalReturnPercent.toFixed(2)),
            holdingMonths,
            holdingYears: parseFloat(holdingYears.toFixed(1)),
            vacancyRate,
            annualExpenses,
          };
        } catch (error) {
          console.error('不动产价值计算失败:', error);
        }
      }
      // 贵金属
      else if (assetType === 'ALT_GOLD') {
        try {
          const weight = metadata.weight != null ? Number(metadata.weight) : (asset.quantity != null ? Number(asset.quantity) : 1);
          const purchaseUnitPrice = metadata.unitPrice != null ? Number(metadata.unitPrice) : (asset.unitPrice != null ? Number(asset.unitPrice) : 0);
          const metalType = metadata.metalType || 'gold';
          const goldCategory = metadata.goldCategory || 'investment';
          const jewelryBrand = metadata.jewelryBrand || '';

          const currentUnitPrice = goldPriceService.getCurrentPrice(metalType, goldCategory, jewelryBrand);
          const purchaseTotalCny = weight * purchaseUnitPrice;
          const currentTotalCny = weight * currentUnitPrice;

          currentValueCny = currentTotalCny;
          unrealizedPnl = currentTotalCny - purchaseTotalCny;
          unrealizedPnlPercent = purchaseTotalCny > 0 ? (unrealizedPnl / purchaseTotalCny) * 100 : 0;
        } catch (error) {
          console.error('贵金属价值计算失败:', error);
        }
      }
      // 其他另类投资
      else if (['ALT_CRYPTO', 'ALT_COMMODITY', 'ALT_COLLECTIBLE'].includes(assetType)) {
        try {
          const currentPrice = metadata.currentPrice;
          const quantity = asset.quantity != null ? Number(asset.quantity) : 1;
          if (currentPrice) {
            const marketValueOriginal = Number(currentPrice) * quantity;
            currentValueCny = marketValueOriginal * exchangeRate;
            unrealizedPnl = currentValueCny - purchasePriceCny;
            unrealizedPnlPercent = purchasePriceCny > 0 ? (unrealizedPnl / purchasePriceCny) * 100 : 0;
          } else {
            currentValueCny = purchasePriceCny;
            unrealizedPnl = 0;
            unrealizedPnlPercent = 0;
          }
        } catch (error) {
          console.error('另类投资价值计算失败:', error);
        }
      }
      // 实物资产
      else if (assetType === 'ALT_PHYSICAL') {
        try {
          const estimatedValue = metadata.estimatedValue != null ? Number(metadata.estimatedValue) :
            metadata.currentMarketPrice != null ? Number(metadata.currentMarketPrice) :
            metadata.appraisalValue != null ? Number(metadata.appraisalValue) :
            purchasePriceCny / exchangeRate;

          currentValueCny = estimatedValue * exchangeRate;
          unrealizedPnl = currentValueCny - purchasePriceCny;
          unrealizedPnlPercent = purchasePriceCny > 0 ? (unrealizedPnl / purchasePriceCny) * 100 : 0;
        } catch (error) {
          console.error('实物资产价值计算失败:', error);
          currentValueCny = purchasePriceCny;
          unrealizedPnl = 0;
          unrealizedPnlPercent = 0;
        }
      }
      // 活期存款 / 券商余额：当前价值 = 本金 × 汇率（无利息计算）
      else if (['CASH_DEMAND', 'CASH_BROKER'].includes(assetType)) {
        currentValueCny = purchasePriceCny;
        unrealizedPnl = 0;
        unrealizedPnlPercent = 0;
      }
      // 其他
      else {
        currentValueCny = Number(asset.currentValue);
        unrealizedPnl = Number(asset.unrealizedPnl ?? 0);
        unrealizedPnlPercent = Number(asset.unrealizedPnlPercent ?? 0);
      }

      return {
        ...asset,
        quantity: Number(asset.quantity),
        unitPrice: Number(asset.unitPrice),
        purchasePrice: Number(asset.purchasePrice),
        purchasePriceCny,
        currentValue: currentValueCny,
        originalValue: originalValue,
        unrealizedPnl: unrealizedPnl,
        unrealizedPnlPercent: unrealizedPnlPercent,
        exchangeRate,
      };
    }));
  }
}
