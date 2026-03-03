import React from 'react';
import { AdminAccountItem } from '@services/authService';

interface AdminCenterProps {
  accountId?: string;
  adminLoading: boolean;
  adminSubmitting: boolean;
  adminError: string;
  adminActionMessage: string;
  adminAccounts: AdminAccountItem[];
  adminImportCsvText: string;
  adminImportCreateAccounts: boolean;
  adminDefaultPassword: string;
  adminFormChineseName: string;
  adminFormEnglishName: string;
  adminFormStatus: '在职' | '不在职';
  adminFormRegion: '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他';
  adminFormProvince: string;
  adminFormServices: string;
  adminFormUsername: string;
  adminFormEmail: string;
  adminNewAccountName: string;
  adminNewAccountEmail: string;
  adminNewAccountPassword: string;
  adminNewAccountRole: 'user' | 'b_admin' | 'a_admin' | 'admin';
  adminNewAccountVolunteerId: string;
  adminDetailAccountId: string;
  adminDetailLoading: boolean;
  adminDetailForm: {
    accountName: string;
    accountEmail: string;
    role: 'user' | 'b_admin' | 'a_admin' | 'admin';
    isActive: boolean;
    volunteerId: string;
    volunteerChineseName: string;
    volunteerEnglishName: string;
    volunteerStatus: '在职' | '不在职';
    volunteerRegion: '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他';
    volunteerProvince: string;
    volunteerServices: string;
    volunteerPhone: string;
    volunteerEmail: string;
  };
  onRefresh: () => void;
  onResetSystem: () => void;
  onCreateSingle: () => void;
  onImport: () => void;
  onGenerateAccounts: () => void;
  onCreateAccount: () => void;
  onOpenDetail: (item: AdminAccountItem) => void;
  onSaveDetail: () => void;
  onDeleteAccount: (accountId: string) => void;
  setAdminImportCsvText: (v: string) => void;
  setAdminImportCreateAccounts: (v: boolean) => void;
  setAdminDefaultPassword: (v: string) => void;
  setAdminFormChineseName: (v: string) => void;
  setAdminFormEnglishName: (v: string) => void;
  setAdminFormStatus: (v: '在职' | '不在职') => void;
  setAdminFormRegion: (v: '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他') => void;
  setAdminFormProvince: (v: string) => void;
  setAdminFormServices: (v: string) => void;
  setAdminFormUsername: (v: string) => void;
  setAdminFormEmail: (v: string) => void;
  setAdminNewAccountName: (v: string) => void;
  setAdminNewAccountEmail: (v: string) => void;
  setAdminNewAccountPassword: (v: string) => void;
  setAdminNewAccountRole: (v: 'user' | 'b_admin' | 'a_admin' | 'admin') => void;
  setAdminNewAccountVolunteerId: (v: string) => void;
  setAdminDetailForm: React.Dispatch<
    React.SetStateAction<{
      accountName: string;
      accountEmail: string;
      role: 'user' | 'b_admin' | 'a_admin' | 'admin';
      isActive: boolean;
      volunteerId: string;
      volunteerChineseName: string;
      volunteerEnglishName: string;
      volunteerStatus: '在职' | '不在职';
      volunteerRegion: '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他';
      volunteerProvince: string;
      volunteerServices: string;
      volunteerPhone: string;
      volunteerEmail: string;
    }>
  >;
}

const AdminCenter: React.FC<AdminCenterProps> = (props) => {
  const {
    accountId,
    adminLoading,
    adminSubmitting,
    adminError,
    adminActionMessage,
    adminAccounts,
    adminImportCsvText,
    adminImportCreateAccounts,
    adminDefaultPassword,
    adminFormChineseName,
    adminFormEnglishName,
    adminFormStatus,
    adminFormRegion,
    adminFormProvince,
    adminFormServices,
    adminFormUsername,
    adminFormEmail,
    adminNewAccountName,
    adminNewAccountEmail,
    adminNewAccountPassword,
    adminNewAccountRole,
    adminNewAccountVolunteerId,
    adminDetailAccountId,
    adminDetailLoading,
    adminDetailForm,
    onRefresh,
    onResetSystem,
    onCreateSingle,
    onImport,
    onGenerateAccounts,
    onCreateAccount,
    onOpenDetail,
    onSaveDetail,
    onDeleteAccount,
    setAdminImportCsvText,
    setAdminImportCreateAccounts,
    setAdminDefaultPassword,
    setAdminFormChineseName,
    setAdminFormEnglishName,
    setAdminFormStatus,
    setAdminFormRegion,
    setAdminFormProvince,
    setAdminFormServices,
    setAdminFormUsername,
    setAdminFormEmail,
    setAdminNewAccountName,
    setAdminNewAccountEmail,
    setAdminNewAccountPassword,
    setAdminNewAccountRole,
    setAdminNewAccountVolunteerId,
    setAdminDetailForm
  } = props;

  if (adminLoading) {
    return <p className="center-empty">正在加载管理中心数据...</p>;
  }

  return (
    <div className="admin-center">
      <div className="center-panel__head">
        <h2>系统管理中心</h2>
        <button type="button" className="filter-reset" onClick={onRefresh}>刷新数据</button>
      </div>

      <section className="quick-actions-panel">
        <h3>系统清理</h3>
        <p>该操作会删除志愿者、服务记录、申请、审计及非系统管理员账号。</p>
        <button type="button" className="action-chip" onClick={onResetSystem} disabled={adminSubmitting}>
          清空数据并仅保留系统管理员
        </button>
      </section>

      <section className="nps-panel">
        <h3>单条录入（自动生成ID）</h3>
        <div className="admin-single-grid">
          <input type="text" value={adminFormChineseName} onChange={(e) => setAdminFormChineseName(e.target.value)} placeholder="中文姓名 *" />
          <input type="text" value={adminFormEnglishName} onChange={(e) => setAdminFormEnglishName(e.target.value)} placeholder="英文姓名" />
          <select value={adminFormStatus} onChange={(e) => setAdminFormStatus(e.target.value as '在职' | '不在职')}>
            <option value="在职">在职</option>
            <option value="不在职">不在职</option>
          </select>
          <select value={adminFormRegion} onChange={(e) => setAdminFormRegion(e.target.value as '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他')}>
            <option value="中国大陆">中国大陆</option>
            <option value="中国台湾">中国台湾</option>
            <option value="东南亚">东南亚</option>
            <option value="美国">美国</option>
            <option value="欧洲">欧洲</option>
            <option value="其他">其他</option>
          </select>
          <input type="text" value={adminFormProvince} onChange={(e) => setAdminFormProvince(e.target.value)} placeholder="省份（大陆/台湾必填）" />
          <input type="text" value={adminFormServices} onChange={(e) => setAdminFormServices(e.target.value)} placeholder="服务方向（如：翻译,校对）" />
          <input type="text" value={adminFormUsername} onChange={(e) => setAdminFormUsername(e.target.value)} placeholder="用户名（用于默认邮箱）" />
          <input type="text" value={adminFormEmail} onChange={(e) => setAdminFormEmail(e.target.value)} placeholder="邮箱（可留空）" />
        </div>
        <div className="quick-actions-row">
          <button type="button" className="action-chip" onClick={onCreateSingle} disabled={adminSubmitting}>
            {adminSubmitting ? '提交中...' : '新增1条志愿者+账号'}
          </button>
        </div>
        {adminActionMessage && <p className="nps-msg">{adminActionMessage}</p>}
      </section>

      <section className="nps-panel">
        <h3>CSV批量导入（自动生成ID）</h3>
        <p className="nps-msg">CSV首行可用字段：chineseName,englishName,status,region,province,services,username,email,phone,role</p>
        <textarea
          className="admin-csv-input"
          value={adminImportCsvText}
          onChange={(e) => setAdminImportCsvText(e.target.value)}
          placeholder={`chineseName,englishName,status,region,province,services,username,email,role\n张三,Zhang San,在职,中国大陆,上海市,翻译|校对,zhangsan,zhangsan@example.com,user`}
        />
        <div className="admin-form-row">
          <label>
            默认密码
            <input type="text" value={adminDefaultPassword} onChange={(e) => setAdminDefaultPassword(e.target.value)} />
          </label>
          <label className="admin-checkbox">
            <input type="checkbox" checked={adminImportCreateAccounts} onChange={(e) => setAdminImportCreateAccounts(e.target.checked)} />
            导入后自动创建账号
          </label>
        </div>
        <div className="quick-actions-row">
          <button type="button" className="action-chip" onClick={onImport} disabled={adminSubmitting}>开始导入</button>
          <button type="button" className="action-chip" onClick={onGenerateAccounts} disabled={adminSubmitting}>为已有志愿者补全账号</button>
        </div>
        {adminActionMessage && <p className="nps-msg">{adminActionMessage}</p>}
        {adminError && <p className="auth-form-error">{adminError}</p>}
      </section>

      <section className="nps-panel">
        <h3>账号权限管理</h3>
        <div className="admin-single-grid">
          <input type="text" value={adminNewAccountName} onChange={(e) => setAdminNewAccountName(e.target.value)} placeholder="账号姓名 *" />
          <input type="email" value={adminNewAccountEmail} onChange={(e) => setAdminNewAccountEmail(e.target.value)} placeholder="账号邮箱 *" />
          <input type="text" value={adminNewAccountPassword} onChange={(e) => setAdminNewAccountPassword(e.target.value)} placeholder="初始密码 *" />
          <select value={adminNewAccountRole} onChange={(e) => setAdminNewAccountRole(e.target.value as 'user' | 'b_admin' | 'a_admin' | 'admin')}>
            <option value="user">user</option>
            <option value="b_admin">b_admin</option>
            <option value="a_admin">a_admin</option>
            <option value="admin">admin</option>
          </select>
          <input type="text" value={adminNewAccountVolunteerId} onChange={(e) => setAdminNewAccountVolunteerId(e.target.value)} placeholder="绑定志愿者ID（可选）" />
        </div>
        <div className="quick-actions-row">
          <button type="button" className="action-chip" onClick={onCreateAccount} disabled={adminSubmitting}>新增账号</button>
        </div>

        {adminAccounts.length === 0 ? (
          <p className="center-empty">暂无账号数据</p>
        ) : (
          <div className="admin-simple-list">
            {adminAccounts.map((item) => (
              <article key={item.id} className="admin-simple-card">
                <p><strong>ID:</strong> {item.volunteerId || item.id}</p>
                <p>
                  <strong>姓名:</strong>{' '}
                  <button type="button" className="admin-name-link" onClick={() => onOpenDetail(item)}>
                    {item.name}
                  </button>
                </p>
                <p><strong>权限:</strong> {item.role}</p>
              </article>
            ))}
          </div>
        )}

        {adminDetailAccountId && (
          <div className="admin-detail-panel">
            <h4>用户详情编辑</h4>
            {adminDetailLoading ? (
              <p className="center-empty">正在加载详情...</p>
            ) : (
              <>
                <div className="admin-single-grid">
                  <input
                    type="text"
                    value={adminDetailForm.accountName}
                    onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, accountName: e.target.value }))}
                    placeholder="账号姓名"
                    disabled={adminDetailAccountId === accountId}
                  />
                  <input
                    type="email"
                    value={adminDetailForm.accountEmail}
                    onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, accountEmail: e.target.value }))}
                    placeholder="账号邮箱"
                    disabled={adminDetailAccountId === accountId}
                  />
                  <select
                    value={adminDetailForm.role}
                    onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, role: e.target.value as 'user' | 'b_admin' | 'a_admin' | 'admin' }))}
                    disabled={adminDetailAccountId === accountId}
                  >
                    <option value="user">user</option>
                    <option value="b_admin">b_admin</option>
                    <option value="a_admin">a_admin</option>
                    <option value="admin">admin</option>
                  </select>
                  <select
                    value={adminDetailForm.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, isActive: e.target.value === 'active' }))}
                    disabled={adminDetailAccountId === accountId}
                  >
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                </div>

                {adminDetailForm.volunteerId && (
                  <>
                    <p className="nps-msg">志愿者ID: {adminDetailForm.volunteerId}</p>
                    <div className="admin-single-grid">
                      <input type="text" value={adminDetailForm.volunteerChineseName} onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerChineseName: e.target.value }))} placeholder="中文姓名" />
                      <input type="text" value={adminDetailForm.volunteerEnglishName} onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerEnglishName: e.target.value }))} placeholder="英文姓名" />
                      <select value={adminDetailForm.volunteerStatus} onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerStatus: e.target.value as '在职' | '不在职' }))}>
                        <option value="在职">在职</option>
                        <option value="不在职">不在职</option>
                      </select>
                      <select value={adminDetailForm.volunteerRegion} onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerRegion: e.target.value as '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他' }))}>
                        <option value="中国大陆">中国大陆</option>
                        <option value="中国台湾">中国台湾</option>
                        <option value="东南亚">东南亚</option>
                        <option value="美国">美国</option>
                        <option value="欧洲">欧洲</option>
                        <option value="其他">其他</option>
                      </select>
                      <input type="text" value={adminDetailForm.volunteerProvince} onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerProvince: e.target.value }))} placeholder="省份" />
                      <input type="text" value={adminDetailForm.volunteerServices} onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerServices: e.target.value }))} placeholder="服务方向（逗号分隔）" />
                      <input type="text" value={adminDetailForm.volunteerPhone} onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerPhone: e.target.value }))} placeholder="电话" />
                      <input type="email" value={adminDetailForm.volunteerEmail} onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerEmail: e.target.value }))} placeholder="志愿者邮箱" />
                    </div>
                  </>
                )}

                <div className="quick-actions-row">
                  <button type="button" className="action-chip" disabled={adminSubmitting || adminDetailAccountId === accountId} onClick={onSaveDetail}>
                    保存修改
                  </button>
                  <button
                    type="button"
                    className="action-chip"
                    disabled={adminSubmitting || adminDetailAccountId === accountId}
                    onClick={() => onDeleteAccount(adminDetailAccountId)}
                  >
                    删除用户
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminCenter;
