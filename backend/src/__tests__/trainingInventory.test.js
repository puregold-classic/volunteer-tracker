import { describe, it, expect } from 'vitest';
import { summarizeTrainingInventory } from '../services/TrainingInventoryService.js';
import { parseTrainingNames } from '../services/TrainingService.js';

const record = (id, extras = {}) => ({ id, supportId: `PS-${id}`, volunteerId: id, submittedById: 'entry', serviceItemId: 'training', serviceItem: { category: 'TRAINING_ATTENDANCE' }, serviceDate: new Date('2026-09-01'), duration: 2, description: '翻译培训内容', status: 'ACTIVE', tagAttachments: [{ tag: { id: 't1', name: '培训', groupId: 'g1' } }], ...extras });
describe('training inventory and names', () => {
  it('retains single-column paste separators, CRLF, and spaces inside English names', () => {
    expect(parseTrainingNames(' 张三\r\n\r\n李四，王五、赵六;钱七；孙八\tAlice Smith ')).toEqual(['张三', '李四', '王五', '赵六', '钱七', '孙八', 'Alice Smith']);
    expect(() => parseTrainingNames(Array(501).fill('张三').join('\n'))).toThrow('500');
  });
  it('reports coherent sessions but never infers training from managed mode alone', () => {
    const report = summarizeTrainingInventory([record('v1'), record('v2'), record('v3', { serviceItem: { category: 'PROJECT_SUPPORT' }, tagAttachments: [{ tag: { id: 't2', groupId: 'g2', name: '普通分类' } }] })], []);
    expect(report.candidates).toHaveLength(1);
    expect(report.summary.activeTrainingHours).toBe(4);
  });
  it('quarantines mixed dates, repeated people, multi-tag links and untagged records', () => {
    const report = summarizeTrainingInventory([record('v1'), record('r2', { volunteerId: 'v1', serviceDate: new Date('2026-09-02') }), record('v3', { tagAttachments: [] }), record('v4', { tagAttachments: [{ tag: { id: 't1' } }, { tag: { id: 't2' } }] })], [{ id: 'g1', name: '旧范围', boundServiceItemIds: [] }]);
    expect(report.candidates).toHaveLength(0);
    expect(report.review[0].reasons).toEqual(expect.arrayContaining(['日期、类型、时长或内容不一致', '同人多条记录（含历史状态）', '记录有多重标签关联，需确认场次来源']));
    expect(report.untagged).toHaveLength(1);
    expect(report.emptyScopeGroups).toHaveLength(1);
  });
});
