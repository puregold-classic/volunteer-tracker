import React from 'react';
import AdminCenter from '@components/AdminCenter';
import MeCenter from '@components/MeCenter';
import type { Account, AdminAccountItem } from '@services/authService';
import type { NonProjectServiceRecord } from '@services/serviceRecordService';
import type { MyApplicationRecord } from '@services/applicationService';
import type { Volunteer } from '@services/types';

interface MePageProps {
  isSystemAdmin: boolean;
  account: Account | null;
  homeTotalVolunteers: number;
  meVolunteer: Volunteer | null;
  mePanelLoading: boolean;
  mePanelError: string;
  meServices: NonProjectServiceRecord[];
  meHasMoreServices: boolean;
  meServicesLoadingMore: boolean;
  myApplications: MyApplicationRecord[];
  myApplicationsLoading: boolean;
  myApplicationsDeactivating: boolean;
  meApplicationDate: string;
  meApplicationType: '翻译' | '校对' | '管理' | '技术';
  meApplicationDuration: string;
  meApplicationDescription: string;
  meApplicationSubmitting: boolean;
  meApplicationMessage: string;
  showMeApplicationForm: boolean;
  meEditingServiceId: string | null;
  meEditDate: string;
  meEditType: '翻译' | '校对' | '管理' | '技术';
  meEditDuration: string;
  meEditDescription: string;
  meRecordActionSubmitting: boolean;
  meRecordActionMessage: string;
  onFetchAdminCenter: () => Promise<void> | void;
  onHandleAdminResetSystem: () => Promise<void> | void;
  onHandleAdminCreateSingle: () => Promise<void> | void;
  onHandleAdminImport: () => Promise<void> | void;
  onHandleAdminGenerateAccounts: () => Promise<void> | void;
  onHandleAdminCreateAccount: () => Promise<void> | void;
  onOpenAdminDetail: (item: AdminAccountItem) => Promise<void> | void;
  onHandleAdminSaveDetail: () => Promise<void> | void;
  onHandleAdminDeleteAccount: (id: string) => Promise<void> | void;
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
  adminFormStatus: string;
  adminFormRegion: string;
  adminFormProvince: string;
  adminFormServices: string;
  adminFormUsername: string;
  adminFormEmail: string;
  adminNewAccountName: string;
  adminNewAccountEmail: string;
  adminNewAccountPassword: string;
  adminNewAccountRole: string;
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
  setAdminImportCsvText: (value: string) => void;
  setAdminImportCreateAccounts: (value: boolean) => void;
  setAdminDefaultPassword: (value: string) => void;
  setAdminFormChineseName: (value: string) => void;
  setAdminFormEnglishName: (value: string) => void;
  setAdminFormStatus: (value: string) => void;
  setAdminFormRegion: (value: string) => void;
  setAdminFormProvince: (value: string) => void;
  setAdminFormServices: (value: string) => void;
  setAdminFormUsername: (value: string) => void;
  setAdminFormEmail: (value: string) => void;
  setAdminNewAccountName: (value: string) => void;
  setAdminNewAccountEmail: (value: string) => void;
  setAdminNewAccountPassword: (value: string) => void;
  setAdminNewAccountRole: (value: string) => void;
  setAdminNewAccountVolunteerId: (value: string) => void;
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
  onFetchMePanel: () => Promise<void> | void;
  onVolunteerDetail: (id: string) => Promise<void> | void;
  onBackHome: () => void;
  onLogout: () => Promise<void> | void;
  onLoadMoreMeServices: () => Promise<void> | void;
  onWithdrawMyApplication: (applicationId: string) => Promise<void> | void;
  onDeactivateAllMyApplications: () => Promise<void> | void;
  onResubmitApplication: (application: MyApplicationRecord) => void;
  onToggleApplicationForm: () => void;
  onSubmitMeApplication: () => Promise<void> | void;
  onStartMeEdit: (record: NonProjectServiceRecord) => void;
  onCancelMeEdit: () => void;
  onSubmitMeUpdateApplication: (record: NonProjectServiceRecord) => Promise<void> | void;
  onSubmitMeDeleteApplication: (record: NonProjectServiceRecord) => Promise<void> | void;
  setMeApplicationDate: (value: string) => void;
  setMeApplicationType: (value: '翻译' | '校对' | '管理' | '技术') => void;
  setMeApplicationDuration: (value: string) => void;
  setMeApplicationDescription: (value: string) => void;
  setMeEditDate: (value: string) => void;
  setMeEditType: (value: '翻译' | '校对' | '管理' | '技术') => void;
  setMeEditDuration: (value: string) => void;
  setMeEditDescription: (value: string) => void;
}

function MePage(props: MePageProps) {
  const {
    isSystemAdmin,
    account,
    homeTotalVolunteers,
    meVolunteer,
    mePanelLoading,
    mePanelError,
    meServices,
    meHasMoreServices,
    meServicesLoadingMore,
    myApplications,
    myApplicationsLoading,
    myApplicationsDeactivating,
    meApplicationDate,
    meApplicationType,
    meApplicationDuration,
    meApplicationDescription,
    meApplicationSubmitting,
    meApplicationMessage,
    showMeApplicationForm,
    meEditingServiceId,
    meEditDate,
    meEditType,
    meEditDuration,
    meEditDescription,
    meRecordActionSubmitting,
    meRecordActionMessage,
    onFetchAdminCenter,
    onHandleAdminResetSystem,
    onHandleAdminCreateSingle,
    onHandleAdminImport,
    onHandleAdminGenerateAccounts,
    onHandleAdminCreateAccount,
    onOpenAdminDetail,
    onHandleAdminSaveDetail,
    onHandleAdminDeleteAccount,
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
    setAdminDetailForm,
    onFetchMePanel,
    onVolunteerDetail,
    onBackHome,
    onLogout,
    onLoadMoreMeServices,
    onWithdrawMyApplication,
    onDeactivateAllMyApplications,
    onResubmitApplication,
    onToggleApplicationForm,
    onSubmitMeApplication,
    onStartMeEdit,
    onCancelMeEdit,
    onSubmitMeUpdateApplication,
    onSubmitMeDeleteApplication,
    setMeApplicationDate,
    setMeApplicationType,
    setMeApplicationDuration,
    setMeApplicationDescription,
    setMeEditDate,
    setMeEditType,
    setMeEditDuration,
    setMeEditDescription
  } = props;

  return (
    <section className="center-panel">
      {isSystemAdmin ? (
        <AdminCenter
          accountId={account?.id}
          adminLoading={adminLoading}
          adminSubmitting={adminSubmitting}
          adminError={adminError}
          adminActionMessage={adminActionMessage}
          adminAccounts={adminAccounts}
          adminImportCsvText={adminImportCsvText}
          adminImportCreateAccounts={adminImportCreateAccounts}
          adminDefaultPassword={adminDefaultPassword}
          adminFormChineseName={adminFormChineseName}
          adminFormEnglishName={adminFormEnglishName}
          adminFormStatus={adminFormStatus}
          adminFormRegion={adminFormRegion}
          adminFormProvince={adminFormProvince}
          adminFormServices={adminFormServices}
          adminFormUsername={adminFormUsername}
          adminFormEmail={adminFormEmail}
          adminNewAccountName={adminNewAccountName}
          adminNewAccountEmail={adminNewAccountEmail}
          adminNewAccountPassword={adminNewAccountPassword}
          adminNewAccountRole={adminNewAccountRole}
          adminNewAccountVolunteerId={adminNewAccountVolunteerId}
          adminDetailAccountId={adminDetailAccountId}
          adminDetailLoading={adminDetailLoading}
          adminDetailForm={adminDetailForm}
          onRefresh={() => void onFetchAdminCenter()}
          onResetSystem={() => void onHandleAdminResetSystem()}
          onCreateSingle={() => void onHandleAdminCreateSingle()}
          onImport={() => void onHandleAdminImport()}
          onGenerateAccounts={() => void onHandleAdminGenerateAccounts()}
          onCreateAccount={() => void onHandleAdminCreateAccount()}
          onOpenDetail={(item) => void onOpenAdminDetail(item)}
          onSaveDetail={() => void onHandleAdminSaveDetail()}
          onDeleteAccount={(id) => void onHandleAdminDeleteAccount(id)}
          setAdminImportCsvText={setAdminImportCsvText}
          setAdminImportCreateAccounts={setAdminImportCreateAccounts}
          setAdminDefaultPassword={setAdminDefaultPassword}
          setAdminFormChineseName={setAdminFormChineseName}
          setAdminFormEnglishName={setAdminFormEnglishName}
          setAdminFormStatus={setAdminFormStatus}
          setAdminFormRegion={setAdminFormRegion}
          setAdminFormProvince={setAdminFormProvince}
          setAdminFormServices={setAdminFormServices}
          setAdminFormUsername={setAdminFormUsername}
          setAdminFormEmail={setAdminFormEmail}
          setAdminNewAccountName={setAdminNewAccountName}
          setAdminNewAccountEmail={setAdminNewAccountEmail}
          setAdminNewAccountPassword={setAdminNewAccountPassword}
          setAdminNewAccountRole={setAdminNewAccountRole}
          setAdminNewAccountVolunteerId={setAdminNewAccountVolunteerId}
          setAdminDetailForm={setAdminDetailForm}
        />
      ) : (
        <MeCenter
          account={account}
          homeTotalVolunteers={homeTotalVolunteers}
          meVolunteer={meVolunteer}
          mePanelLoading={mePanelLoading}
          mePanelError={mePanelError}
          meServices={meServices}
          meHasMoreServices={meHasMoreServices}
          meServicesLoadingMore={meServicesLoadingMore}
          myApplications={myApplications}
          myApplicationsLoading={myApplicationsLoading}
          myApplicationsDeactivating={myApplicationsDeactivating}
          meApplicationDate={meApplicationDate}
          meApplicationType={meApplicationType}
          meApplicationDuration={meApplicationDuration}
          meApplicationDescription={meApplicationDescription}
          meApplicationSubmitting={meApplicationSubmitting}
          meApplicationMessage={meApplicationMessage}
          showMeApplicationForm={showMeApplicationForm}
          meEditingServiceId={meEditingServiceId}
          meEditDate={meEditDate}
          meEditType={meEditType}
          meEditDuration={meEditDuration}
          meEditDescription={meEditDescription}
          meRecordActionSubmitting={meRecordActionSubmitting}
          meRecordActionMessage={meRecordActionMessage}
          onRefresh={() => void onFetchMePanel()}
          onVolunteerDetail={(id) => void onVolunteerDetail(id)}
          onBackHome={onBackHome}
          onLogout={() => void onLogout()}
          onLoadMore={() => void onLoadMoreMeServices()}
          onWithdrawApplication={(applicationId) => void onWithdrawMyApplication(applicationId)}
          onDeactivateAllMyApplications={() => void onDeactivateAllMyApplications()}
          onResubmitApplication={onResubmitApplication}
          onToggleApplicationForm={onToggleApplicationForm}
          onSubmitApplication={() => void onSubmitMeApplication()}
          onStartEdit={onStartMeEdit}
          onCancelEdit={onCancelMeEdit}
          onSubmitEdit={(record) => void onSubmitMeUpdateApplication(record)}
          onSubmitDelete={(record) => void onSubmitMeDeleteApplication(record)}
          setMeApplicationDate={setMeApplicationDate}
          setMeApplicationType={setMeApplicationType}
          setMeApplicationDuration={setMeApplicationDuration}
          setMeApplicationDescription={setMeApplicationDescription}
          setMeEditDate={setMeEditDate}
          setMeEditType={setMeEditType}
          setMeEditDuration={setMeEditDuration}
          setMeEditDescription={setMeEditDescription}
        />
      )}
    </section>
  );
}

export default MePage;
