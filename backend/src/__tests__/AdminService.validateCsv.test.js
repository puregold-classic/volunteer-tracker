// src/__tests__/AdminService.validateCsv.test.js
//
// v3.7: dry-run 校验 CSV 导入 —— 提交前逐行检出格式问题（部门不存在 / 省份不规范 /
// 必填缺失 / 邮箱占用等），不写库。

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    department: { findMany: vi.fn() },
    account: { findMany: vi.fn() },
  },
}));

vi.mock('../utils/prismaClient.js', () => ({ default: mockPrisma }));

import { validateVolunteersCsv } from '../services/AdminService.js';

const HEADER = 'chineseName,englishName,status,region,province,departmentId,email,role';

describe('AdminService.validateVolunteersCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.department.findMany.mockResolvedValue([
      { id: 'TECH', name: '技术部' },
      { id: 'BY_PROJECT', name: '笔译项目管理' },
      { id: 'NET_TECH', name: '网络技术部' },
    ]);
    mockPrisma.account.findMany.mockResolvedValue([{ email: 'taken@vt.local' }]);
  });

  const run = (lines) => validateVolunteersCsv({ csvText: [HEADER, ...lines].join('\n') });

  it('noData when csv is empty', async () => {
    expect(await validateVolunteersCsv({ csvText: '' })).toEqual({ noData: true });
  });

  it('passes a fully valid row', async () => {
    const r = await run(['张三,Zhang San,在职,中国大陆,辽宁省,TECH,ok@vt.local,user']);
    expect(r.validCount).toBe(1);
    expect(r.invalidCount).toBe(0);
    expect(r.rows[0].ok).toBe(true);
  });

  it('flags a non-existent department', async () => {
    const r = await run(['李四,Li Si,在职,中国大陆,北京市,NOPE,a@vt.local,user']);
    expect(r.rows[0].ok).toBe(false);
    expect(r.rows[0].errors.join()).toMatch(/部门不存在/);
  });

  it('flags a non-canonical province (辽宁 → needs 辽宁省)', async () => {
    const r = await run(['王五,Wang Wu,在职,中国大陆,辽宁,TECH,b@vt.local,user']);
    expect(r.rows[0].ok).toBe(false);
    expect(r.rows[0].errors.join()).toMatch(/省份不规范/);
  });

  it('flags missing englishName, bad role, and taken/duplicate email', async () => {
    const r = await run([
      '赵六,,在职,中国大陆,北京市,TECH,c@vt.local,user',      // no englishName
      '钱七,Qian Qi,在职,中国大陆,北京市,TECH,taken@vt.local,user', // email taken
      '孙八,Sun Ba,在职,中国大陆,北京市,TECH,dup@vt.local,boss',   // bad role
      '周九,Zhou Jiu,在职,中国大陆,北京市,TECH,dup@vt.local,user', // dup within batch
    ]);
    expect(r.invalidCount).toBe(4);
    expect(r.rows[0].errors.join()).toMatch(/英文姓名必填/);
    expect(r.rows[1].errors.join()).toMatch(/已被占用/);
    expect(r.rows[2].errors.join()).toMatch(/角色不规范/);
    expect(r.rows[3].errors.join()).toMatch(/重复/);
  });

  it('requires province for 中国台湾 to be exactly 台湾省', async () => {
    const r = await run(['林一,Lin Yi,在职,中国台湾,台北市,TECH,tw@vt.local,user']);
    expect(r.rows[0].ok).toBe(false);
    expect(r.rows[0].errors.join()).toMatch(/台湾省/);
  });

  // v3.7: Excel 直接粘贴 = Tab 分隔 + 无表头 + 部门写中文名
  it('accepts a headerless, TAB-separated Excel paste with department by name', async () => {
    const r = await validateVolunteersCsv({
      csvText: '张书语\twill\t在职\t中国大陆\t辽宁省\t网络技术部\t2441192638@qq.com\tuser',
    });
    expect(r.total).toBe(1);
    expect(r.rows[0].ok).toBe(true);
  });

  it('flags an unknown department name in an Excel paste', async () => {
    const r = await validateVolunteersCsv({
      csvText: '李四\tLi Si\t在职\t中国大陆\t北京市\t不存在的部门\tx@vt.local\tuser',
    });
    expect(r.rows[0].ok).toBe(false);
    expect(r.rows[0].errors.join()).toMatch(/部门不存在/);
  });
});
