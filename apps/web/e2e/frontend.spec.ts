import {test,expect} from '@playwright/test';
test('核心卡片、取消领取、确认领取和移动端布局',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'体验部分结算',exact:true}).click();
 await expect(page.getByText('虚构交互预览',{exact:true})).toBeVisible();
 await expect(page.getByTestId('tenant')).toContainText('700');await expect(page.getByTestId('landlord')).toContainText('100');await expect(page.getByTestId('disputed')).toContainText('200');
 await page.getByRole('link',{name:'结算与导出',exact:true}).click();await page.getByRole('button',{name:'领取 700 MockUSD',exact:true}).click();
 await page.getByRole('button',{name:'取消',exact:true}).click();await expect(page.getByTestId('tenant')).toContainText('700');
 await page.getByRole('button',{name:'领取 700 MockUSD',exact:true}).click();await page.getByRole('button',{name:'确认领取 700 MockUSD',exact:true}).click();await expect(page.getByTestId('paid')).toContainText('700');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('授权与存入分开，切换角色清除未提交表单',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'体验部分结算',exact:true}).click();await page.getByLabel('虚构快照',{exact:true}).selectOption('funding');await page.getByRole('link',{name:'条款与存入',exact:true}).click();
 await page.getByRole('button',{name:'接受此份条款',exact:true}).click();await page.getByRole('button',{name:'确认接受此份条款',exact:true}).click();
 await page.getByRole('button',{name:'授权 1,000 MockUSD',exact:true}).click();await page.getByRole('button',{name:'确认授权 1,000 MockUSD',exact:true}).click();await expect(page.getByText('未存入。退出或取消不会自动进行下一步。',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'存入 1,000 MockUSD',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'存入 1,000 MockUSD',exact:true})).toBeEnabled();
 await page.getByLabel('虚构快照',{exact:true}).selectOption('claims');await page.getByRole('link',{name:'扣款与回应',exact:true}).click();await page.getByLabel('异议说明',{exact:true}).fill('PRIVATE UNSENT DRAFT');await page.getByLabel('预览身份',{exact:true}).selectOption('landlord');await expect(page.getByText('PRIVATE UNSENT DRAFT')).toHaveCount(0);
});
test('真实接口失败不加载虚构租约，非法邀请不获得角色',async({page})=>{
 await page.goto('/leases');await expect(page.getByRole('heading',{name:'等待真实服务接入'})).toBeVisible();await expect(page.getByText('后端接口尚未接入，当前没有真实业务数据')).toBeVisible();await expect(page.getByTestId('tenant')).toHaveCount(0);
 await page.goto('/');await page.getByRole('button',{name:'体验部分结算',exact:true}).click();await page.goto('/invite/not-a-real-token');await expect(page.getByTestId('tenant')).toHaveCount(0);
});
test('备用未升级无材料，成熟主结果分配正确',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'体验部分结算',exact:true}).click();await page.getByLabel('预览身份',{exact:true}).selectOption('fallback');await expect(page.getByRole('heading',{name:'当前没有授权案件'})).toBeVisible();
 await page.getByLabel('预览身份',{exact:true}).selectOption('tenant');await page.getByLabel('虚构快照',{exact:true}).selectOption('mature');await page.getByRole('link',{name:'争议处理',exact:true}).click();await page.getByRole('button',{name:'使主结果生效',exact:true}).click();await page.getByRole('button',{name:'确认使主结果生效',exact:true}).click();await page.getByRole('link',{name:'结算与导出',exact:true}).click();await expect(page.getByTestId('tenant')).toContainText('850');await expect(page.getByTestId('landlord')).toContainText('150');
});
