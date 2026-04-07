import { useEffect } from 'react';
import './MePage.scss';
import AdminCenter from '@components/AdminCenter';
import MeCenter from '@components/MeCenter';
import useAdminCenter from '@/hooks/useAdminCenter';
import useMeCenter from '@/hooks/useMeCenter';
import { useAuth } from '@/context/AuthContext';
import type { MyApplicationRecord } from '@services/applicationService';

const NPS_PAGE_SIZE = 8;

interface MePageProps {
  homeTotalVolunteers: number;
  onVolunteerDetail: (id: string) => void;
  onBackHome: () => void;
}

function MePage({ homeTotalVolunteers, onVolunteerDetail, onBackHome }: MePageProps) {
  const { account, isAuthenticated, logout } = useAuth();
  const isSystemAdmin = account?.role === 'admin';

  const {
    adminAccounts,
    adminLoading,
    adminError,
    adminImportCsvText,
    adminImportCreateAccounts,
    adminDefaultPassword,
    adminActionMessage,
    adminSubmitting,
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
    fetchAdminCenter,
    handleAdminImport,
    handleAdminCreateSingle,
    handleAdminGenerateAccounts,
    handleAdminResetSystem,
    handleAdminCreateAccount,
    openAdminDetail,
    handleAdminSaveDetail,
    handleAdminDeleteAccount,
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
  } = useAdminCenter();

  const {
    meVolunteer,
    mePanelLoading,
    mePanelError,
    meServices,
    meHasMoreServices,
    meServicesLoadingMore,
    myApplications,
    myApplicationsLoading,
    myApplicationsDeactivating,
    fetchMePanel,
    loadMoreMeServices,
    showMeApplicationForm,
    meApplicationDate,
    meApplicationType,
    meApplicationDuration,
    meApplicationDescription,
    meApplicationSubmitting,
    meApplicationMessage,
    setMeApplicationDate,
    setMeApplicationType,
    setMeApplicationDuration,
    setMeApplicationDescription,
    toggleMeApplicationForm,
    submitMeNpsApplication,
    meEditingServiceId,
    meEditDate,
    meEditType,
    meEditDuration,
    meEditDescription,
    meRecordActionSubmitting,
    meRecordActionMessage,
    setMeEditDate,
    setMeEditType,
    setMeEditDuration,
    setMeEditDescription,
    startMeEdit,
    cancelMeEdit,
    submitMeUpdateApplication,
    submitMeDeleteApplication,
    handleWithdrawMyApplication,
    handleDeactivateAllMyApplications,
    prefillMeApplicationFromRecord,
  } = useMeCenter(account?.volunteerId, 'me', isAuthenticated, isSystemAdmin, NPS_PAGE_SIZE);

  useEffect(() => {
    if (!isAuthenticated || !isSystemAdmin) return;
    void fetchAdminCenter();
  }, [isAuthenticated, isSystemAdmin]);

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
          onRefresh={() => void fetchAdminCenter()}
          onResetSystem={() => void handleAdminResetSystem()}
          onCreateSingle={() => void handleAdminCreateSingle()}
          onImport={() => void handleAdminImport()}
          onGenerateAccounts={() => void handleAdminGenerateAccounts()}
          onCreateAccount={() => void handleAdminCreateAccount()}
          onOpenDetail={(item) => void openAdminDetail(item)}
          onSaveDetail={() => void handleAdminSaveDetail()}
          onDeleteAccount={(id) => void handleAdminDeleteAccount(id)}
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
          onRefresh={() => void fetchMePanel()}
          onVolunteerDetail={(id) => void onVolunteerDetail(id)}
          onBackHome={onBackHome}
          onLogout={() => void logout()}
          onLoadMore={() => void loadMoreMeServices()}
          onWithdrawApplication={(applicationId) => void handleWithdrawMyApplication(applicationId)}
          onDeactivateAllMyApplications={() => void handleDeactivateAllMyApplications()}
          onResubmitApplication={(application: MyApplicationRecord) => prefillMeApplicationFromRecord(application)}
          onToggleApplicationForm={toggleMeApplicationForm}
          onSubmitApplication={() => void submitMeNpsApplication()}
          onStartEdit={startMeEdit}
          onCancelEdit={cancelMeEdit}
          onSubmitEdit={(record) => void submitMeUpdateApplication(record)}
          onSubmitDelete={(record) => void submitMeDeleteApplication(record)}
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
