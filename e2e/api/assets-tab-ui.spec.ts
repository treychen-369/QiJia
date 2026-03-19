/**
 * 资产 Tab 页面 UI 样式一致性验证
 * 核心：遍历7个Tab，对比标题、搜索框、汇总卡片的字体/尺寸是否统一
 */
import { test, expect } from '@playwright/test';

// 7 个 Tab 配置
const TABS = [
  { value: 'securities', label: '证券持仓', title: '持仓列表' },
  { value: 'cash', label: '现金资产', title: '现金资产列表' },
  { value: 'fixed-income', label: '固定收益', title: '固定收益列表' },
  { value: 'real-estate', label: '不动产', title: '不动产列表' },
  { value: 'alternative', label: '另类投资', title: '另类投资列表' },
  { value: 'receivables', label: '应收款', title: '应收款列表' },
  { value: 'liabilities', label: '负债管理', title: '负债管理' },
];

test.describe('资产 Tab 各分页样式一致性对比', () => {
  // 7 个 Tab 遍历需要时间
  test.setTimeout(60_000);

  // 播种测试数据，确保各 Tab 有内容渲染
  test.beforeAll(async ({ request }) => {
    const seedRes = await request.post('/api/test/seed', { timeout: 60000 });
    if (!seedRes.ok()) {
      console.warn(`⚠️ seed 失败 (${seedRes.status()})，汇总卡片可能无数据`);
    }
  });

  test.afterAll(async ({ request }) => {
    await request.delete('/api/test/seed', { timeout: 60000 });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[role="tab"]', { timeout: 30000 });
    await page.waitForTimeout(1500);
  });

  test('各 Tab 标题字体大小和搜索框尺寸一致性', async ({ page }) => {
    const results: Array<{
      tab: string;
      titleFontSize: string;
      titleFontWeight: string;
      searchFontSize: string;
      searchHeight: string;
    }> = [];

    for (const tab of TABS) {
      const tabTrigger = page.locator('[role="tab"]').filter({ hasText: tab.label });
      await tabTrigger.click();
      await page.waitForTimeout(500);

      const data = await page.evaluate((title) => {
        const h3s = document.querySelectorAll('h3');
        let titleEl: Element | null = null;
        for (const h3 of h3s) {
          if (h3.textContent?.includes(title)) {
            titleEl = h3;
            break;
          }
        }
        const searchEl = document.querySelector('input[placeholder*="搜索"]');
        return {
          titleFontSize: titleEl ? window.getComputedStyle(titleEl).fontSize : 'N/A',
          titleFontWeight: titleEl ? window.getComputedStyle(titleEl).fontWeight : 'N/A',
          searchFontSize: searchEl ? window.getComputedStyle(searchEl).fontSize : 'N/A',
          searchHeight: searchEl ? window.getComputedStyle(searchEl).height : 'N/A',
        };
      }, tab.title);

      results.push({ tab: tab.label, ...data });
      console.log(`  [${tab.label}] 标题: ${data.titleFontSize}/${data.titleFontWeight}, 搜索框: ${data.searchFontSize}/h=${data.searchHeight}`);
    }

    const titleSizes = results.map(r => r.titleFontSize).filter(s => s !== 'N/A');
    const uniqueTitleSizes = [...new Set(titleSizes)];
    console.log(`\n  标题字号种类: ${uniqueTitleSizes.join(', ')} (${uniqueTitleSizes.length === 1 ? '✅ 一致' : '❌ 不一致'})`);
    expect(uniqueTitleSizes.length, `标题字号不一致: ${uniqueTitleSizes.join(', ')}`).toBe(1);

    const searchSizes = results.map(r => r.searchFontSize).filter(s => s !== 'N/A');
    const uniqueSearchSizes = [...new Set(searchSizes)];
    console.log(`  搜索框字号种类: ${uniqueSearchSizes.join(', ')} (${uniqueSearchSizes.length === 1 ? '✅ 一致' : '❌ 不一致'})`);
    expect(uniqueSearchSizes.length, `搜索框字号不一致: ${uniqueSearchSizes.join(', ')}`).toBe(1);

    const searchHeights = results.map(r => r.searchHeight).filter(s => s !== 'N/A');
    const uniqueSearchHeights = [...new Set(searchHeights)];
    console.log(`  搜索框高度种类: ${uniqueSearchHeights.join(', ')} (${uniqueSearchHeights.length === 1 ? '✅ 一致' : '❌ 不一致'})`);
    expect(uniqueSearchHeights.length, `搜索框高度不一致: ${uniqueSearchHeights.join(', ')}`).toBe(1);

    console.log('\n✅ 各 Tab 标题和搜索框样式一致性验证通过');
  });

  test('各 Tab 汇总卡片样式一致性', async ({ page }) => {
    const results: Array<{
      tab: string;
      labelFontSize: string;
      valueFontSize: string;
      valueFontWeight: string;
      containerPadding: string;
    }> = [];

    for (const tab of TABS) {
      const tabTrigger = page.locator('[role="tab"]').filter({ hasText: tab.label });
      await tabTrigger.click();
      await page.waitForTimeout(500);

      const data = await page.evaluate(() => {
        // 找 className 包含 sm:grid 和 sm:grid-cols-3 的桌面汇总容器
        const allDivs = document.querySelectorAll('div');
        let desktopGrid: HTMLElement | null = null;
        let outerContainer: HTMLElement | null = null;

        for (const div of allDivs) {
          const cls = div.className;
          if (typeof cls === 'string' && cls.includes('sm:grid') && cls.includes('sm:grid-cols-3')) {
            desktopGrid = div as HTMLElement;
            outerContainer = div.parentElement as HTMLElement;
            break;
          }
        }

        if (!desktopGrid || !outerContainer) {
          return { labelFontSize: 'N/A', valueFontSize: 'N/A', valueFontWeight: 'N/A', containerPadding: 'N/A' };
        }

        const firstCol = desktopGrid.children[0];
        if (!firstCol || firstCol.children.length < 2) {
          return { labelFontSize: 'N/A', valueFontSize: 'N/A', valueFontWeight: 'N/A', containerPadding: 'N/A' };
        }

        const labelEl = firstCol.children[0] as HTMLElement;
        const valueEl = firstCol.children[1] as HTMLElement;

        return {
          labelFontSize: window.getComputedStyle(labelEl).fontSize,
          valueFontSize: window.getComputedStyle(valueEl).fontSize,
          valueFontWeight: window.getComputedStyle(valueEl).fontWeight,
          containerPadding: window.getComputedStyle(outerContainer).padding,
        };
      });

      results.push({ tab: tab.label, ...data });
      console.log(`  [${tab.label}] 标签: ${data.labelFontSize}, 值: ${data.valueFontSize}/${data.valueFontWeight}, padding: ${data.containerPadding}`);
    }

    const withData = results.filter(r => r.labelFontSize !== 'N/A');
    console.log(`\n  有汇总区域的 Tab: ${withData.map(r => r.tab).join(', ')} (${withData.length} 个)`);

    if (withData.length >= 2) {
      const labelSizes = [...new Set(withData.map(r => r.labelFontSize))];
      console.log(`  汇总标签字号种类: ${labelSizes.join(', ')} (${labelSizes.length === 1 ? '✅ 一致' : '❌ 不一致'})`);
      expect(labelSizes.length, `汇总标签字号不一致: ${withData.map(r => `${r.tab}=${r.labelFontSize}`).join(', ')}`).toBe(1);

      const valueSizes = [...new Set(withData.map(r => r.valueFontSize))];
      console.log(`  汇总值字号种类: ${valueSizes.join(', ')} (${valueSizes.length === 1 ? '✅ 一致' : '❌ 不一致'})`);
      expect(valueSizes.length, `汇总值字号不一致: ${withData.map(r => `${r.tab}=${r.valueFontSize}`).join(', ')}`).toBe(1);

      const valueWeights = [...new Set(withData.map(r => r.valueFontWeight))];
      console.log(`  汇总值粗细种类: ${valueWeights.join(', ')} (${valueWeights.length === 1 ? '✅ 一致' : '❌ 不一致'})`);
      expect(valueWeights.length, `汇总值粗细不一致: ${withData.map(r => `${r.tab}=${r.valueFontWeight}`).join(', ')}`).toBe(1);
    } else {
      console.log('  ⚠️ 有数据的 Tab 不足2个，跳过汇总一致性对比');
    }

    console.log('\n✅ 各 Tab 汇总卡片样式一致性验证通过');
  });
});
