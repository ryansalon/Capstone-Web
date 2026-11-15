/* Barangay Health Worker portal behaviour (login, dashboard, search, citizen
 * record, audit trail, reports). All API calls go through API.apiFetch. */
(function () {
  "use strict";

  var U = API.UI;
  var dashboardCharts = {};
  var onLangRefresh = null;

  /* Full BHW / Admin Staff Portal localization (EN / Bisaya / Tagalog). */
  var BHW_I18N = {
    en: {
      skipToMain: "Skip to main content",
      navDashboard: "Dashboard",
      navFindCitizens: "Find citizens",
      navAuditTrail: "Audit trail",
      navReports: "Reports",
      navLogout: "Log out",
      navDockCitizens: "Citizens",
      navDockAudit: "Audit",
      roleBhw: "Health Worker",
      roleAdmin: "Staff Admin",
      roleAdminBadge: "Administrator",
      roleCitizen: "Citizen",

      /* Staff Login */
      authRoleCitTitle: "Citizen",
      authRoleCitDesc: "Residents & Patients",
      authRoleBhwTitle: "Health Worker",
      authRoleBhwDesc: "BHW & Clinic Staff",
      bhwLoginHeading: "Staff Sign In",
      bhwLoginLede: "Authorized health worker access to monitor vitals and manage records.",
      loginExpired: "Your session expired — please sign in again.",
      lblUsername: "Username",
      phBhwUsername: "Staff username",
      lblPassword: "Password",
      phBhwPassword: "Staff password",
      bhwStaffHint: "Forgot staff credentials? Contact the RHU IT Administrator.",
      btnSignIn: "Sign in",
      btnSigningIn: "Signing in…",
      bhwAreYouResident: "Are you a resident?",
      bhwGoCitizenPortal: "Go to citizen portal",
      bhwLoginErrRequired: "Enter your username and password.",
      bhwLoginErrRole: "This portal is for Barangay Health Workers. Citizens sign in through the citizen portal.",
      bhwLoginFooterRa: "All record access is written to an append-only audit trail per RA 10173.",

      /* Dashboard */
      dashEyebrow: "Public Health Operations",
      dashTitle: "Barangay Health Desk",
      dashLede: "Live community epidemiology aggregates — individual names are protected per RA 10173.",
      dashPeriodLabel: "Period",
      optToday: "Today",
      opt7d: "Last 7 days",
      opt30d: "Last 30 days",
      opt90d: "Last 90 days",
      optAll: "All time",
      dashAutoRefresh: "Auto-refresh",
      dashAutoShort: "Auto",
      dashAtAGlance: "At a glance",
      dashInThisPeriod: "In this period",
      dashCheckingLatest: "Checking the latest reading…",
      dashTrendHeading: "Community trend",
      dashLive: "Live ({s}s)",
      dashPaused: "Paused",
      dashPausedHidden: "Paused (hidden tab)",
      dashBtnRefresh: "Refresh",
      dashToastRefreshed: "Dashboard refreshed",
      dashUpdating: "Updating…",
      dashUpdatedStamp: "Updated {time}",
      dashRangeAllTime: "All time",
      dashRangeToday: "Today ({day})",
      dashRangeLast: "Last {n} days ({from} – {to})",
      dashCommunityTotals: "Community totals",
      dashAllTimeRegistry: "Registry (all time)",
      dashChartsHeading: "Measurements by category",
      dashChartsLede: "Classification breakdowns for all measurements recorded in the selected period.",
      dashFeverHeading: "Fever trend (temperature ≥ 37.9 °C)",
      dashFeverLede: "Daily count of elevated temperature readings detected at the barangay kiosk.",
      dashConcernsHeading: "What's driving alerts",
      dashConcernsLede: "Derived from this period's category counts — a guide for follow-up, not a per-alert breakdown.",
      dashConcernsEmpty: "No concerns recorded in this period.",
      dashConsentDonutHeading: "Consent coverage",
      dashConsentDonutLede: "Percentage of registered citizens sharing records with health staff.",
      dashConsentCoverageLabel: "Loading coverage…",
      dashKioskFreshnessHeading: "Kiosk freshness",
      dashKioskFreshnessLede: "Status of the most recent vital sign telemetry synced from the station.",
      dashQuickLinksHeading: "Quick actions",
      dashQLSearchSub: "Search the registry and open records",
      dashQLExportSub: "Summary, alerts and printable output",
      dashQLAuditSub: "Who viewed what, and when",
      dashPrivacyHtml: "<strong>Aggregates only:</strong> Individual records and names are never shown on this dashboard. Readings of citizens who have not granted consent are counted in statistical aggregates, but individual identities remain protected under the Philippine Data Privacy Act (RA 10173).",
      dashFoot: "Aggregates only — readings of citizens without consent are counted but never named.",
      totMeasurements: "Measurements",
      totMeasurementsSub: "Recorded in period",
      totActiveCitizens: "Active kiosk citizens",
      totActiveCitizensSub: "Individual visits",
      totGuestMeas: "Guest measurements",
      totGuestMeasSub: "Anonymous check-ins",
      totAlerts: "Alerts",
      totAlertsSubActive: "Require clinical review",
      totAlertsSubNone: "No active alerts",
      totReviewCitizens: "Review citizens →",
      totConsentGrants: "Consent grants (period)",
      totConsentGrantsSub: "New authorizations",
      totRegisteredUsers: "Registered users",
      totRegisteredUsersSub: "All-time community registry",
      dashEmptyAll: "No measurements recorded yet. Check that the health kiosk is online and syncing.",
      dashEmptyPeriod: "No measurements in this period. Try a longer period, or check that the health kiosk is online and syncing.",
      distBmi: "BMI categories",
      distBp: "Blood pressure categories",
      distSpo2: "SpO2 categories",
      tblCategory: "Category",
      tblCount: "Count",
      tblShare: "Share",
      dashFeverEmpty: "No fever-range readings in this period.",
      dashFeverUnavailable: "Chart library unavailable — fever counts: ",
      dashConsentSummaryCount: "{granted} of {total} citizens have granted consent ({pct}%).",
      dashConsentSummaryEmpty: "No registered citizens yet.",
      dashCoverageUnavailable: "Coverage unavailable right now — try Refresh.",
      dashFreshnessUnavailable: "Freshness unavailable right now",
      dashNoKioskReadings: "No kiosk readings yet",
      dashKioskNoneSub: "The health kiosk has not uploaded any measurements.",
      dashLastReading: "Last reading {age}",
      dashFromKiosk: "{dt} · from the barangay kiosk",
      lblConsented: "Consented",
      lblNotConsented: "Not consented",
      lblFeverReadings: "Fever readings",

      /* Search */
      searchEyebrow: "Registry Directory · RA 10173 Gated",
      searchTitle: "Find a citizen",
      searchLede: "Search by name or username. You can only open health records for citizens who have granted consent.",
      searchLabel: "Name or username",
      searchPlaceholder: "Type a name or leave blank to list all",
      searchBtn: "Search",
      chipAll: "All citizens",
      chipConsented: "Consented only",
      chipWithVisits: "With kiosk visits",
      chipNoVisits: "No visits yet",
      searchFoot: "Opening a record without consent is blocked by the server.",
      searchLoading: "Searching citizens…",
      searchNoMatchPrefix: "No citizens found matching “{q}”.",
      searchNoFilterMatch: "No citizens match this filter.",
      searchEmptyHint: "Try clearing the search query or switching back to all citizens.",
      btnShowAllCitizens: "Show all citizens",
      btnClearSearch: "Clear search term",
      colName: "Name",
      colUsername: "Username",
      colBirthdate: "Birthdate",
      colVisits: "Kiosk visits",
      colLastMeas: "Last measurement (PHT)",
      colConsent: "Consent",
      colActions: "Actions",
      visitSingle: "visit",
      visitPlural: "visits",
      noReadingsYet: "No readings",
      consentGranted: "Granted",
      consentNotGranted: "Not granted",
      btnOpenRecord: "Open record →",

      /* Citizen View */
      cvBackToSearch: "← Back to search",
      cvTitleFallback: "Citizen record",
      cvLede: "This access is recorded in the audit trail.",
      cvEyebrow: "Barangay Resident · Kiosk Record",
      cvProfileHeading: "Citizen Profile",
      cvPrintReferral: "Print Referral Slip",
      cvReferBtn: "Refer to RHU",
      cvResetPwBtn: "Reset Password",
      cvConsentTitle: "Consent Active & Verified",
      cvConsentBadge: "RA 10173 Protected",
      cvReadingsHeading: "Readings & Telemetry",
      cvReadingsSubtext: "Vital measurements recorded from the Barangay Health Kiosk.",
      cvNotesHeading: "Health Worker Notes & Guidance",
      cvNotesSubtext: "Share follow-up instructions with the resident, or uncheck sharing to keep an entry staff-only.",
      cvAddNoteLabel: "Add a note",
      cvTemplatesLabel: "Clinical templates:",
      chipBpFollowup: "BP follow-up",
      chipDiet: "Dietary counseling",
      chipRoutine: "Routine normal",
      chipRefer: "Refer to RHU",
      chipFever: "Fever guidance",
      cvNotePlaceholder: "Follow-up plan, observations, referrals…",
      cvShareToggle: "Share with resident on their portal",
      cvNoteHintDefault: "Visible on the resident's dashboard for their reference and follow-up. Uncheck to keep private for BHW staff only.",
      cvNoteHintStaffOnly: "Staff only — hidden from the resident's dashboard.",
      cvSaveNoteBtn: "Save note",
      cvFoot: "Notes and record views are audited. RA 10173 applies.",
      cvNoCitizenErr: "No citizen selected. Open a record from the search page.",
      cvLoadingRecord: "Loading citizen record…",
      cvConsentBlockedTitle: "Citizen has not granted consent",
      cvConsentBlockedBody: "This citizen has not granted consent to share individual records. Their readings are included only in anonymous community totals. Ask the citizen to grant consent from the Citizen Portal if access is clinically needed.",
      cvConsentAuthLine: "Consent authorized on {dt} · Individual health telemetry accessible by authorized BHW staff.",
      cvCheckinsOnFileSingle: "1 Check-in on file",
      cvCheckinsOnFilePlural: "{n} Check-ins on file",
      cvCheckinsOnRecordSingle: "1 Check-in on record",
      cvCheckinsOnRecordPlural: "{n} Check-ins on record",
      cvProfileFullName: "Full name",
      cvProfileUsername: "Username",
      cvProfileUsernameSub: "Kiosk Login ID",
      cvProfileBirthdate: "Birthdate",
      cvProfileGender: "Gender",
      cvProfileGenderSub: "Self-reported",
      cvProfileVisits: "Total kiosk visits",
      cvVisitRecordedSingle: "1 visit recorded",
      cvVisitRecordedPlural: "{n} visits recorded",
      cvLatestAge: "Latest: {age}",
      cvNoCheckinsYet: "No check-ins yet",
      cvProfileAccess: "Data access",
      cvAuthorized: "Authorized",
      cvYearsOld: "{age} years old",
      cvYrsBorn: "{age} yrs old · Born {date}",
      cvBorn: "Born {date}",
      cvNoNotes: "No notes yet for this citizen.",
      badgeShared: "Shared with resident",
      badgeStaffOnly: "Staff only",
      btnMakeStaffOnly: "Make staff-only",
      btnShareResident: "Share with resident",
      referModalTitle: "Refer to Rural Health Unit",
      referReasonLabel: "Reason for referral (required)",
      referReasonErr: "Please enter a reason for the referral.",
      btnCancel: "Cancel",
      btnRefer: "Refer",
      noteSavedShared: "Note saved and shared with resident.",
      noteSavedStaffOnly: "Staff-only note saved.",
      noteSavedToast: "Note saved successfully",
      cvSnapshotEyebrow: "Most Recent Check-in",
      cvSnapshotTitle: "Latest Clinical Vitals",
      cvSnapshotRecorded: "Recorded {dt} ({age})",
      cvHistTitle: "Telemetry Log History",
      cvReadingsEmpty: "No vital readings recorded for this citizen yet. When the citizen checks in at the Barangay Health Kiosk, their clinical telemetry will appear here automatically.",
      cvLegendNormal: "Normal range",
      cvLegendWarn: "Outside normal limits (warn)",
      cvLegendBad: "Clinical attention required (fever / critical)",
      cvNotRecorded: "Not recorded",
      cvNotTaken: "Not taken at kiosk",
      cvVitalBp: "Blood pressure",
      cvVitalPulse: "Pulse rate",
      cvVitalSpo2: "SpO2 (Oxygen)",
      cvVitalTemp: "Temperature",
      cvVitalBmi: "Body mass index",
      cvRefBp: "Target: <120/80 mmHg",
      cvRefPulse: "Resting: 60–100 bpm",
      cvRefSpo2: "Normal: 95–100%",
      cvRefTemp: "Normal: 36.5–37.5 °C",
      cvBadgeOptimal: "Optimal",
      cvBadgeFever: "Fever",
      cvBadgeLowPulse: "Low pulse",
      cvBadgeLowSpo2: "Low SpO2",

      /* Audit Trail */
      auditEyebrow: "RA 10173 Compliance · Security Log",
      auditTitle: "Audit Trail",
      auditLede: "Comprehensive ledger of health data access, consent enforcement, and staff activity.",
      auditExportCsv: "Export CSV",
      auditPrint: "Print",
      auditPrintLog: "Print log",
      repPresets: "Presets",
      kpiTotalLabel: "Total Logged Events",
      kpiTotalSub: "Matching active filters",
      kpiViewsLabel: "Health Records Viewed",
      kpiViewsSub: "Consented accesses",
      kpiInterventionsLabel: "Clinical Interventions",
      kpiInterventionsSub: "Notes & RHU referrals",
      kpiBlockedLabel: "Security Flags",
      kpiBlockedSub: "Blocked (no consent)",
      auditPresetToday: "Today",
      auditPreset7d: "Last 7d",
      auditPreset30d: "Last 30d",
      auditPresetAll: "All time",
      auditLblFrom: "From date",
      auditLblTo: "To date",
      auditLblBhw: "Health worker",
      auditPhBhw: "Filter by name",
      auditLblCitizen: "Citizen",
      auditPhCitizen: "Filter by name",
      auditLblAction: "Action",
      auditOptAllActions: "All actions",
      auditActViewHealth: "Viewed health records",
      auditActViewNotes: "Viewed clinical notes",
      auditActAddNote: "Added clinical note",
      auditActUpdateVis: "Updated note visibility",
      auditActRefer: "Referred to RHU",
      auditActUnauthorized: "Blocked: No Consent",
      auditActExport: "Exported Report",
      auditActStaffLogin: "Staff Login",
      auditActSelfPw: "Self Password Reset",
      auditActStaffPw: "Staff Password Reset",
      auditLblStatus: "Status",
      auditOptAllStatus: "All statuses",
      auditOptAuthorized: "Authorized",
      auditOptBlocked: "Blocked (No Consent)",
      auditBtnApply: "Apply filters",
      auditBtnClear: "Clear",
      auditFoot: "Timestamps are shown in Philippine time (PHT); hover a timestamp for the UTC original.",
      auditLoading: "Loading audit entries…",
      auditEmpty: "No audit entries match these filters.",
      auditColTime: "Time (PHT)",
      auditColBhw: "Health worker",
      auditColCitizen: "Citizen accessed",
      auditColAction: "Action taken",
      auditColStatus: "Status",
      auditColDetails: "Details",
      auditColIp: "IP address",
      statusAuthorizedBadge: "Authorized ✓",
      statusBlockedBadge: "Blocked 🚫",

      /* Reports */
      repEyebrow: "RA 10173 · Official Documentation",
      repTitle: "Reports",
      repLede: "Download CSV spreadsheets or open a printable report.",
      repLblType: "Report type",
      repOptSummary: "Summary — community health metrics",
      repOptConsent: "Consent — compliance and grant rate",
      repOptAudit: "Audit — data access log",
      repOptAlerts: "Alerts — high fever, BP, low SpO2",
      repPresetToday: "Today",
      repPreset7d: "Last 7d",
      repPreset30d: "Last 30d",
      repPresetAll: "All time",
      repLblFrom: "From date",
      repLblTo: "To date",
      repBtnCsv: "Download CSV",
      repBtnPrint: "Open printable report",
      repHintEmpty: "Leave the dates empty to include all recorded data.",
      repFoot: "Citizens without consent are labelled “Withheld (no consent)” in alert reports.",
      repRangeErr: "The From date must be on or before the To date.",
      repPreparingCsv: "Preparing the CSV download…",
      repPreparingPrint: "Preparing the printable report…",
      repModalPrint: "Print report",
      repModalClose: "Close",

      /* Shared Categories & Concerns */
      catNormal: "Normal",
      catUnderweight: "Underweight",
      catOverweight: "Overweight",
      catObese: "Obese",
      catElevated: "Elevated",
      catStage1: "Stage 1",
      catStage2: "Stage 2",
      catCrisis: "Crisis",
      catLow: "Low",
      catCritical: "Critical",
      conStage2: "Stage 2 Hypertension",
      conCrisis: "BP Crisis",
      conHighFever: "High Fever",
      conCriticalSpo2: "Critical SpO2",
      conObese: "Obese",
      conStage1: "Stage 1 Hypertension",
      conElevatedBp: "Elevated BP",
      conLowSpo2: "Low SpO2",
      conOverweight: "Overweight",
      conUnderweight: "Underweight",
    },
    ceb: {
      skipToMain: "Laktaw ngadto sa nag-unang sulod",
      navDashboard: "Dashboard",
      navFindCitizens: "Pangita og lumulupyo",
      navAuditTrail: "Talaan sa Audit",
      navReports: "Mga Report",
      navLogout: "Log out",
      navDockCitizens: "Mga Lumulupyo",
      navDockAudit: "Audit",
      roleBhw: "Health Worker",
      roleAdmin: "Tagdumala (Admin)",
      roleAdminBadge: "Tagdumala (Admin)",
      roleCitizen: "Lumulupyo",

      authRoleCitTitle: "Lumulupyo",
      authRoleCitDesc: "Mga Residente ug Pasyente",
      authRoleBhwTitle: "Health Worker",
      authRoleBhwDesc: "BHW ug Staff sa Klinika",
      bhwLoginHeading: "Pag-sign In sa Staff",
      bhwLoginLede: "Awtorisadong pag-access alang sa health worker aron magbantay sa sukod ug rekord.",
      loginExpired: "Na-expire ang imong sesyon — palihug pag-sign in pag-usab.",
      lblUsername: "Username",
      phBhwUsername: "Username sa staff",
      lblPassword: "Password",
      phBhwPassword: "Password sa staff",
      bhwStaffHint: "Nakalimot sa kredensyal sa staff? Kontaka ang RHU IT Administrator.",
      btnSignIn: "Sign in",
      btnSigningIn: "Nag-sign in…",
      bhwAreYouResident: "Lumulupyo ka ba?",
      bhwGoCitizenPortal: "Adto sa citizen portal",
      bhwLoginErrRequired: "Isulat ang imong username ug password.",
      bhwLoginErrRole: "Alang lamang kini sa Barangay Health Workers. Ang mga lumulupyo mag-sign in sa Citizen Portal.",
      bhwLoginFooterRa: "Tanang pag-access sa rekord gisulat sa append-only audit trail ubos sa RA 10173.",

      dashEyebrow: "Operasyon sa Panglawas sa Komunidad",
      dashTitle: "Talaan sa Panglawas sa Barangay",
      dashLede: "Live nga kinatibuk-ang datos sa komunidad — giprotektahan ang ngalan ubos sa RA 10173.",
      dashPeriodLabel: "Panahon",
      optToday: "Karon",
      opt7d: "Katapusang 7 ka adlaw",
      opt30d: "Katapusang 30 ka adlaw",
      opt90d: "Katapusang 90 ka adlaw",
      optAll: "Tanang panahon",
      dashAutoRefresh: "Auto-refresh",
      dashAutoShort: "Auto",
      dashAtAGlance: "Sa usa ka pagtan-aw",
      dashInThisPeriod: "Niining panahona",
      dashCheckingLatest: "Gisusi ang pinakabag-ong sukod…",
      dashTrendHeading: "Dagan sa Komunidad",
      dashLive: "Live ({s}s)",
      dashPaused: "Gihunong",
      dashPausedHidden: "Gihunong (nakatago nga tab)",
      dashBtnRefresh: "I-refresh",
      dashToastRefreshed: "Na-refresh na ang dashboard",
      dashUpdating: "Gi-update…",
      dashUpdatedStamp: "Gi-update {time}",
      dashRangeAllTime: "Tanang panahon",
      dashRangeToday: "Karon ({day})",
      dashRangeLast: "Katapusang {n} ka adlaw ({from} – {to})",
      dashCommunityTotals: "Kinatibuk-an sa komunidad",
      dashAllTimeRegistry: "Rehistro (tanang panahon)",
      dashChartsHeading: "Mga Sukod matag Kategorya",
      dashChartsLede: "Klasipikasyon sa tanang mga sukod nga narekord sa gipiling panahon.",
      dashFeverHeading: "Dagan sa hilanat (temperatura ≥ 37.9 °C)",
      dashFeverLede: "Adlaw-adlaw nga ihap sa taas nga temperatura nga nasukod sa kiosk sa barangay.",
      dashConcernsHeading: "Nag-unang hinungdan sa mga alerto",
      dashConcernsLede: "Gikan sa ihap sa kategorya niining panahona — giya alang sa follow-up.",
      dashConcernsEmpty: "Walay kabalaka nga narekord niining panahona.",
      dashConsentDonutHeading: "Sakop sa pagtugot",
      dashConsentDonutLede: "Porsyento sa mga rehistradong lumulupyo nga mitugot nga makita sa staff ang ilang rekord.",
      dashConsentCoverageLabel: "Nagkarga sa sakop…",
      dashKioskFreshnessHeading: "Kabag-o sa Kiosk",
      dashKioskFreshnessLede: "Kahimtang sa pinakabag-ong sukod nga gipadala gikan sa estasyon.",
      dashQuickLinksHeading: "Dali nga mga aksyon",
      dashQLSearchSub: "Pangitaa ang rehistro ug ablihi ang mga rekord",
      dashQLExportSub: "Summary, mga alerto ug ma-print nga report",
      dashQLAuditSub: "Kinsa ang mitan-aw, ug kanus-a",
      dashPrivacyHtml: "<strong>Kinatibuk-an lamang:</strong> Walay indibidwal nga rekord o ngalan ang ipakita niini nga dashboard. Ang sukod sa mga walay pagtugot gilakip sa estadistika apan nagpabiling pribado ubos sa RA 10173.",
      dashFoot: "Kinatibuk-an lamang — ang sukod sa walay pagtugot giihap apan dili hinganlan.",
      totMeasurements: "Mga Sukod",
      totMeasurementsSub: "Narekord sa panahon",
      totActiveCitizens: "Aktibong lumulupyo sa kiosk",
      totActiveCitizensSub: "Indibidwal nga pagbisita",
      totGuestMeas: "Sukod sa mga bisita",
      totGuestMeasSub: "Dili mailhan nga check-in",
      totAlerts: "Mga Alerto",
      totAlertsSubActive: "Kinahanglan og klinikal nga pagsusi",
      totAlertsSubNone: "Walay aktibong alerto",
      totReviewCitizens: "Susiha ang mga lumulupyo →",
      totConsentGrants: "Bag-ong pagtugot (panahon)",
      totConsentGrantsSub: "Bag-ong awtorisasyon",
      totRegisteredUsers: "Rehistradong tiggamit",
      totRegisteredUsersSub: "Tibuok rehistro sa komunidad",
      dashEmptyAll: "Walay sukod nga narekord pa. Susiha kon online ba ug nag-sync ang health kiosk.",
      dashEmptyPeriod: "Walay sukod niining panahona. Sulayi ang mas taas nga panahon o susiha ang kiosk.",
      distBmi: "Kategorya sa BMI",
      distBp: "Kategorya sa presyon sa dugo",
      distSpo2: "Kategorya sa SpO2",
      tblCategory: "Kategorya",
      tblCount: "Ihap",
      tblShare: "Bahin",
      dashFeverEmpty: "Walay hilanat nga narekord niining panahona.",
      dashFeverUnavailable: "Walay library sa tsart — ihap sa hilanat: ",
      dashConsentSummaryCount: "{granted} sa {total} ka lumulupyo ang mihatag og pagtugot ({pct}%).",
      dashConsentSummaryEmpty: "Walay rehistradong lumulupyo pa.",
      dashCoverageUnavailable: "Dili makuha ang sakop karon — sulayi ang I-refresh.",
      dashFreshnessUnavailable: "Dili makuha ang kabag-o sa datos karon",
      dashNoKioskReadings: "Walay sukod sa kiosk pa",
      dashKioskNoneSub: "Wala pa nakapadala og sukod ang health kiosk.",
      dashLastReading: "Katapusang sukod {age}",
      dashFromKiosk: "{dt} · gikan sa barangay kiosk",
      lblConsented: "Mitugot",
      lblNotConsented: "Wala mitugot",
      lblFeverReadings: "Mga sukod sa hilanat",

      searchEyebrow: "Direktoryo sa Rehistro · RA 10173",
      searchTitle: "Pangita og lumulupyo",
      searchLede: "Pangitaa gamit ang ngalan o username. Maablihan lang ang rekord kon mitugot ang lumulupyo.",
      searchLabel: "Ngalan o username",
      searchPlaceholder: "Isulat ang ngalan o biyaing blangko aron makita tanan",
      searchBtn: "Pangita",
      chipAll: "Tanang lumulupyo",
      chipConsented: "Mitugot lang",
      chipWithVisits: "Adunay pagbisita sa kiosk",
      chipNoVisits: "Wala pay pagbisita",
      searchFoot: "Gibabagan sa server ang pag-abli sa rekord nga walay pagtugot.",
      searchLoading: "Nangita sa mga lumulupyo…",
      searchNoMatchPrefix: "Walay nakit-ang lumulupyo nga motakdo sa “{q}”.",
      searchNoFilterMatch: "Walay lumulupyo nga motakdo niini nga filter.",
      searchEmptyHint: "Sulayi paghawan ang gipangita o ibalik sa tanang lumulupyo.",
      btnShowAllCitizens: "Ipakita tanang lumulupyo",
      btnClearSearch: "Hawanon ang gipangita",
      colName: "Ngalan",
      colUsername: "Username",
      colBirthdate: "Petsa sa pagkatawo",
      colVisits: "Pagbisita sa kiosk",
      colLastMeas: "Katapusang sukod (PHT)",
      colConsent: "Pagtugot",
      colActions: "Mga Aksyon",
      visitSingle: "pagbisita",
      visitPlural: "ka pagbisita",
      noReadingsYet: "Walay sukod pa",
      consentGranted: "Gitugotan",
      consentNotGranted: "Wala gitugotan",
      btnOpenRecord: "Ablihi ang rekord →",

      cvBackToSearch: "← Balik sa pagpangita",
      cvTitleFallback: "Rekord sa lumulupyo",
      cvLede: "Kini nga pag-access irekord sa talaan sa audit.",
      cvEyebrow: "Residente sa Barangay · Rekord sa Kiosk",
      cvProfileHeading: "Profile sa Lumulupyo",
      cvPrintReferral: "I-print ang Referral Slip",
      cvReferBtn: "I-refer sa RHU",
      cvResetPwBtn: "I-reset ang Password",
      cvConsentTitle: "Aktibo ug Nakumpirmang Pagtugot",
      cvConsentBadge: "Protektado sa RA 10173",
      cvReadingsHeading: "Mga Sukod ug Telemetry",
      cvReadingsSubtext: "Mga sukod sa panglawas gikan sa Barangay Health Kiosk.",
      cvNotesHeading: "Mga Nota ug Giya sa Health Worker",
      cvNotesSubtext: "Ipaambit ang mga tugon sa residente, o tangtanga ang tsek aron alang sa staff lang.",
      cvAddNoteLabel: "Pagdugang og nota",
      cvTemplatesLabel: "Mga template:",
      chipBpFollowup: "Follow-up sa BP",
      chipDiet: "Tambag sa pagkaon",
      chipRoutine: "Normal nga check-up",
      chipRefer: "I-refer sa RHU",
      chipFever: "Giya sa hilanat",
      cvNotePlaceholder: "Plano sa follow-up, obserbasyon, referral…",
      cvShareToggle: "Ipaambit sa residente sa ilang portal",
      cvNoteHintDefault: "Makita sa dashboard sa residente. Tangtanga ang tsek kon alang lang sa BHW staff.",
      cvNoteHintStaffOnly: "Alang sa staff lang — gitago gikan sa dashboard sa residente.",
      cvSaveNoteBtn: "I-save ang nota",
      cvFoot: "Ang mga nota ug pagtan-aw sa rekord gi-audit ubos sa RA 10173.",
      cvNoCitizenErr: "Walay gipiling lumulupyo. Pag-abli og rekord gikan sa pagpangita.",
      cvLoadingRecord: "Nagkarga sa rekord sa lumulupyo…",
      cvConsentBlockedTitle: "Wala mihatag og pagtugot ang lumulupyo",
      cvConsentBlockedBody: "Kini nga lumulupyo wala mihatag og pagtugot sa pagpaambit sa indibidwal nga rekord. Ang ilang mga sukod gilakip lang sa kinatibuk-ang ihap sa komunidad.",
      cvConsentAuthLine: "Gihatag ang pagtugot niadtong {dt} · Ma-access sa awtorisado nga BHW staff.",
      cvCheckinsOnFileSingle: "1 ka Check-in sa rekord",
      cvCheckinsOnFilePlural: "{n} ka Check-in sa rekord",
      cvCheckinsOnRecordSingle: "1 ka Check-in sa rekord",
      cvCheckinsOnRecordPlural: "{n} ka Check-in sa rekord",
      cvProfileFullName: "Tibuok ngalan",
      cvProfileUsername: "Username",
      cvProfileUsernameSub: "Kiosk Login ID",
      cvProfileBirthdate: "Petsa sa pagkatawo",
      cvProfileGender: "Sekso",
      cvProfileGenderSub: "Gideklara mismo",
      cvProfileVisits: "Kinatibuk-ang pagbisita",
      cvVisitRecordedSingle: "1 ka pagbisita narekord",
      cvVisitRecordedPlural: "{n} ka pagbisita narekord",
      cvLatestAge: "Pinakabag-o: {age}",
      cvNoCheckinsYet: "Walay check-in pa",
      cvProfileAccess: "Pag-access sa datos",
      cvAuthorized: "Awtorisado",
      cvYearsOld: "{age} ka tuig ang panuigon",
      cvYrsBorn: "{age} ka tuig · Natawo {date}",
      cvBorn: "Natawo {date}",
      cvNoNotes: "Walay nota pa alang niini nga lumulupyo.",
      badgeShared: "Gipaambit sa residente",
      badgeStaffOnly: "Alang sa staff lang",
      btnMakeStaffOnly: "Himoa nga alang sa staff lang",
      btnShareResident: "Ipaambit sa residente",
      referModalTitle: "I-refer sa Rural Health Unit",
      referReasonLabel: "Rason sa referral (gikinahanglan)",
      referReasonErr: "Palihug isulat ang rason sa referral.",
      btnCancel: "Kanselahon",
      btnRefer: "I-refer",
      noteSavedShared: "Na-save ug napaambit na sa residente ang nota.",
      noteSavedStaffOnly: "Na-save na ang nota alang sa staff lang.",
      noteSavedToast: "Malampusong na-save ang nota",
      cvSnapshotEyebrow: "Pinakabag-ong Check-in",
      cvSnapshotTitle: "Pinakabag-ong Klinikal nga Sukod",
      cvSnapshotRecorded: "Narekord {dt} ({age})",
      cvHistTitle: "Kasaysayan sa mga Sukod",
      cvReadingsEmpty: "Walay sukod nga narekord pa alang niini nga lumulupyo.",
      cvLegendNormal: "Normal nga sukod",
      cvLegendWarn: "Gawas sa normal nga limit (pasidaan)",
      cvLegendBad: "Nagkinahanglan og klinikal nga pagtagad (hilanat / kritikal)",
      cvNotRecorded: "Walay sukod",
      cvNotTaken: "Wala nakuha sa kiosk",
      cvVitalBp: "Presyon sa dugo",
      cvVitalPulse: "Pulso",
      cvVitalSpo2: "SpO2 (Oksiheno)",
      cvVitalTemp: "Temperatura",
      cvVitalBmi: "Body mass index (BMI)",
      cvRefBp: "Tumong: <120/80 mmHg",
      cvRefPulse: "Normal: 60–100 bpm",
      cvRefSpo2: "Normal: 95–100%",
      cvRefTemp: "Normal: 36.5–37.5 °C",
      cvBadgeOptimal: "Maayo kaayo",
      cvBadgeFever: "Hilanat",
      cvBadgeLowPulse: "Ubos nga pulso",
      cvBadgeLowSpo2: "Ubos nga SpO2",

      auditEyebrow: "Pagsunod sa RA 10173 · Talaan sa Seguridad",
      auditTitle: "Talaan sa Audit",
      auditLede: "Kompleto nga listahan sa pag-access sa datos, pagpatuman sa pagtugot, ug kalihokan sa staff.",
      auditExportCsv: "I-export ang CSV",
      auditPrint: "I-print",
      auditPrintLog: "I-print ang talaan",
      repPresets: "Mga Preset",
      kpiTotalLabel: "Kinatibuk-ang Narekord",
      kpiTotalSub: "Motakdo sa filter",
      kpiViewsLabel: "Mga Rekord nga Gitan-aw",
      kpiViewsSub: "May pagtugot nga access",
      kpiInterventionsLabel: "Klinikal nga Aksyon",
      kpiInterventionsSub: "Mga nota ug referral sa RHU",
      kpiBlockedLabel: "Mga Flag sa Seguridad",
      kpiBlockedSub: "Gibabagan (walay pagtugot)",
      auditPresetToday: "Karon",
      auditPreset7d: "7 ka adlaw",
      auditPreset30d: "30 ka adlaw",
      auditPresetAll: "Tanan",
      auditLblFrom: "Gikan sa petsa",
      auditLblTo: "Hangtod sa petsa",
      auditLblBhw: "Health worker",
      auditPhBhw: "Salaa gamit ang ngalan",
      auditLblCitizen: "Lumulupyo",
      auditPhCitizen: "Salaa gamit ang ngalan",
      auditLblAction: "Aksyon",
      auditOptAllActions: "Tanang aksyon",
      auditActViewHealth: "Mitan-aw sa rekord sa panglawas",
      auditActViewNotes: "Mitan-aw sa klinikal nga nota",
      auditActAddNote: "Midugang og klinikal nga nota",
      auditActUpdateVis: "Gi-update ang pagka-pribado sa nota",
      auditActRefer: "Gi-refer sa RHU",
      auditActUnauthorized: "Gibabagan: Walay Pagtugot",
      auditActExport: "Nag-export og Report",
      auditActStaffLogin: "Pag-login sa Staff",
      auditActSelfPw: "Kaugalingong Pag-reset sa Password",
      auditActStaffPw: "Pag-reset sa Password pinaagi sa Staff",
      auditLblStatus: "Kahimtang",
      auditOptAllStatus: "Tanang kahimtang",
      auditOptAuthorized: "Awtorisado",
      auditOptBlocked: "Gibabagan (Walay Pagtugot)",
      auditBtnApply: "Ipatuman ang filter",
      auditBtnClear: "Hawanon",
      auditFoot: "Ang oras gipakita sa Philippine time (PHT); itutok ang cursor aron makita ang UTC.",
      auditLoading: "Nagkarga sa mga talaan sa audit…",
      auditEmpty: "Walay talaan sa audit nga motakdo sa filter.",
      auditColTime: "Oras (PHT)",
      auditColBhw: "Health worker",
      auditColCitizen: "Lumulupyo nga gitan-aw",
      auditColAction: "Gihimo nga aksyon",
      auditColStatus: "Kahimtang",
      auditColDetails: "Mga Detalye",
      auditColIp: "IP address",
      statusAuthorizedBadge: "Awtorisado ✓",
      statusBlockedBadge: "Gibabagan 🚫",

      repEyebrow: "RA 10173 · Opisyal nga Dokumentasyon",
      repTitle: "Mga Report",
      repLede: "Pag-download og CSV spreadsheet o pag-abli og ma-print nga report.",
      repLblType: "Klase sa report",
      repOptSummary: "Summary — kinatibuk-ang ihap sa panglawas",
      repOptConsent: "Pagtugot — pagsunod ug gidaghanon sa pagtugot",
      repOptAudit: "Audit — talaan sa pag-access sa datos",
      repOptAlerts: "Mga Alerto — taas nga hilanat, BP, ubos nga SpO2",
      repPresetToday: "Karon",
      repPreset7d: "7 ka adlaw",
      repPreset30d: "30 ka adlaw",
      repPresetAll: "Tanan",
      repLblFrom: "Gikan sa petsa",
      repLblTo: "Hangtod sa petsa",
      repBtnCsv: "I-download ang CSV",
      repBtnPrint: "Ablihi ang ma-print nga report",
      repHintEmpty: "Biyaing blangko ang mga petsa aron malakip ang tanang datos.",
      repFoot: "Ang mga lumulupyo nga walay pagtugot markahan og “Withheld (no consent)” sa mga report.",
      repRangeErr: "Ang petsa nga Gikan kinahanglan mas sayo o pareho sa petsa nga Hangtod.",
      repPreparingCsv: "Giandam ang CSV download…",
      repPreparingPrint: "Giandam ang ma-print nga report…",
      repModalPrint: "I-print ang report",
      repModalClose: "Isira",

      catNormal: "Normal",
      catUnderweight: "Ubos sa timbang",
      catOverweight: "Sobra sa timbang",
      catObese: "Obese",
      catElevated: "Medyo Taas",
      catStage1: "Stage 1",
      catStage2: "Stage 2",
      catCrisis: "Kritikal (Crisis)",
      catLow: "Ubos",
      catCritical: "Kritikal",
      conStage2: "Stage 2 Hypertension",
      conCrisis: "BP Crisis",
      conHighFever: "Taas nga Hilanat",
      conCriticalSpo2: "Kritikal nga SpO2",
      conObese: "Obese",
      conStage1: "Stage 1 Hypertension",
      conElevatedBp: "Taas gamay nga BP",
      conLowSpo2: "Ubos nga SpO2",
      conOverweight: "Sobra sa timbang",
      conUnderweight: "Ubos sa timbang",
    },
    tl: {
      skipToMain: "Lumaktaw sa pangunahing nilalaman",
      navDashboard: "Dashboard",
      navFindCitizens: "Maghanap ng mamamayan",
      navAuditTrail: "Audit Trail",
      navReports: "Mga Ulat",
      navLogout: "Mag-log out",
      navDockCitizens: "Mamamayan",
      navDockAudit: "Audit",
      roleBhw: "Health Worker",
      roleAdmin: "Tagapamahala (Admin)",
      roleAdminBadge: "Tagapamahala (Admin)",
      roleCitizen: "Mamamayan",

      authRoleCitTitle: "Mamamayan",
      authRoleCitDesc: "Mga Residente at Pasyente",
      authRoleBhwTitle: "Health Worker",
      authRoleBhwDesc: "BHW at Staff ng Klinika",
      bhwLoginHeading: "Pag-sign In ng Staff",
      bhwLoginLede: "Awtorisadong pag-access para sa health worker upang masubaybayan ang sukat at rekord.",
      loginExpired: "Nag-expire ang iyong sesyon — pakisign in muli.",
      lblUsername: "Username",
      phBhwUsername: "Username ng staff",
      lblPassword: "Password",
      phBhwPassword: "Password ng staff",
      bhwStaffHint: "Nakalimutan ang kredensyal ng staff? Makipag-ugnayan sa RHU IT Administrator.",
      btnSignIn: "Mag-sign in",
      btnSigningIn: "Nagsa-sign in…",
      bhwAreYouResident: "Isa ka bang residente?",
      bhwGoCitizenPortal: "Pumunta sa citizen portal",
      bhwLoginErrRequired: "Ilagay ang iyong username at password.",
      bhwLoginErrRole: "Ang portal na ito ay para sa Barangay Health Workers. Ang mamamayan ay sa Citizen Portal.",
      bhwLoginFooterRa: "Lahat ng pag-access sa rekord ay itinatala sa append-only audit trail alinsunod sa RA 10173.",

      dashEyebrow: "Operasyon sa Kalusugang Pampubliko",
      dashTitle: "Tanggapan ng Kalusugan sa Barangay",
      dashLede: "Pinagsama-samang datos ng komunidad — pinoprotektahan ang pagkakakilanlan ayon sa RA 10173.",
      dashPeriodLabel: "Panahon",
      optToday: "Ngayong araw",
      opt7d: "Huling 7 araw",
      opt30d: "Huling 30 araw",
      opt90d: "Huling 90 araw",
      optAll: "Lahat ng panahon",
      dashAutoRefresh: "Auto-refresh",
      dashAutoShort: "Auto",
      dashAtAGlance: "Sa isang tingin",
      dashInThisPeriod: "Sa panahong ito",
      dashCheckingLatest: "Sinusuri ang pinakabagong sukat…",
      dashTrendHeading: "Takbo sa Komunidad",
      dashLive: "Live ({s}s)",
      dashPaused: "Naka-pause",
      dashPausedHidden: "Naka-pause (nakatagong tab)",
      dashBtnRefresh: "I-refresh",
      dashToastRefreshed: "Na-refresh na ang dashboard",
      dashUpdating: "Ina-update…",
      dashUpdatedStamp: "Na-update {time}",
      dashRangeAllTime: "Lahat ng panahon",
      dashRangeToday: "Ngayon ({day})",
      dashRangeLast: "Huling {n} araw ({from} – {to})",
      dashCommunityTotals: "Kabuuan ng komunidad",
      dashAllTimeRegistry: "Rehistro (lahat ng panahon)",
      dashChartsHeading: "Mga Sukat ayon sa Kategorya",
      dashChartsLede: "Mga kategorya ng lahat ng sukat na naitala sa napiling panahon.",
      dashFeverHeading: "Takbo ng lagnat (temperatura ≥ 37.9 °C)",
      dashFeverLede: "Araw-araw na bilang ng mataas na temperatura na naitala sa kiosk ng barangay.",
      dashConcernsHeading: "Mga sanhi ng alerto",
      dashConcernsLede: "Batay sa bilang ng kategorya sa panahong ito — gabay para sa follow-up.",
      dashConcernsEmpty: "Walang naitalang alalahanin sa panahong ito.",
      dashConsentDonutHeading: "Sakop ng pahintulot",
      dashConsentDonutLede: "Porsyento ng mga rehistradong mamamayan na nagbabahagi ng rekord sa staff.",
      dashConsentCoverageLabel: "Ikinakarga ang sakop…",
      dashKioskFreshnessHeading: "Kasalukuyang Estado ng Kiosk",
      dashKioskFreshnessLede: "Katayuan ng pinakabagong sukat na ipinadala mula sa istasyon.",
      dashQuickLinksHeading: "Mabilisang aksyon",
      dashQLSearchSub: "Maghanap sa rehistro at magbukas ng rekord",
      dashQLExportSub: "Summary, mga alerto at napi-print na ulat",
      dashQLAuditSub: "Kung sino ang tumingin, at kailan",
      dashPrivacyHtml: "<strong>Pinagsama-sama lamang:</strong> Walang indibidwal na rekord o pangalan ang ipinapakita sa dashboard na ito. Ang sukat ng walang pahintulot ay kasama sa estadistika ngunit nananatiling pribado sa ilalim ng RA 10173.",
      dashFoot: "Pinagsama-sama lamang — binibilang ngunit hindi pinapangalanan ang walang pahintulot.",
      totMeasurements: "Mga Sukat",
      totMeasurementsSub: "Naitala sa panahon",
      totActiveCitizens: "Aktibong mamamayan sa kiosk",
      totActiveCitizensSub: "Mga indibidwal na bisita",
      totGuestMeas: "Sukat ng bisita",
      totGuestMeasSub: "Anonymous na check-in",
      totAlerts: "Mga Alerto",
      totAlertsSubActive: "Kailangan ng klinikal na pagsusuri",
      totAlertsSubNone: "Walang aktibong alerto",
      totReviewCitizens: "Suriin ang mga mamamayan →",
      totConsentGrants: "Bagong pahintulot (panahon)",
      totConsentGrantsSub: "Bagong awtorisasyon",
      totRegisteredUsers: "Rehistradong user",
      totRegisteredUsersSub: "Kabuuan sa rehistro ng komunidad",
      dashEmptyAll: "Wala pang naitalang sukat. Suriin kung online at nagsi-sync ang health kiosk.",
      dashEmptyPeriod: "Walang sukat sa panahong ito. Subukan ang mas mahabang panahon o suriin ang kiosk.",
      distBmi: "Kategorya ng BMI",
      distBp: "Kategorya ng presyon ng dugo",
      distSpo2: "Kategorya ng SpO2",
      tblCategory: "Kategorya",
      tblCount: "Bilang",
      tblShare: "Bahagi",
      dashFeverEmpty: "Walang naitalang lagnat sa panahong ito.",
      dashFeverUnavailable: "Hindi magagamit ang tsart — bilang ng lagnat: ",
      dashConsentSummaryCount: "{granted} sa {total} mamamayan ang nagbigay ng pahintulot ({pct}%).",
      dashConsentSummaryEmpty: "Wala pang rehistradong mamamayan.",
      dashCoverageUnavailable: "Hindi makuha ang sakop ngayon — subukan ang I-refresh.",
      dashFreshnessUnavailable: "Hindi makuha ang katayuan ngayon",
      dashNoKioskReadings: "Wala pang sukat mula sa kiosk",
      dashKioskNoneSub: "Hindi pa nakakapagpadala ng sukat ang health kiosk.",
      dashLastReading: "Huling sukat {age}",
      dashFromKiosk: "{dt} · mula sa barangay kiosk",
      lblConsented: "May pahintulot",
      lblNotConsented: "Walang pahintulot",
      lblFeverReadings: "Mga sukat ng lagnat",

      searchEyebrow: "Direktoryo ng Rehistro · RA 10173",
      searchTitle: "Maghanap ng mamamayan",
      searchLede: "Maghanap ayon sa pangalan o username. Mabubuksan lamang ang rekord ng mga may pahintulot.",
      searchLabel: "Pangalan o username",
      searchPlaceholder: "Mag-type ng pangalan o iwanang blangko para ilista lahat",
      searchBtn: "Hanapin",
      chipAll: "Lahat ng mamamayan",
      chipConsented: "May pahintulot lang",
      chipWithVisits: "May bisita sa kiosk",
      chipNoVisits: "Wala pang bisita",
      searchFoot: "Hinaharangan ng server ang pagbukas ng rekord nang walang pahintulot.",
      searchLoading: "Naghahanap ng mamamayan…",
      searchNoMatchPrefix: "Walang nakitang mamamayan na tumutugma sa “{q}”.",
      searchNoFilterMatch: "Walang mamamayang tumutugma sa filter na ito.",
      searchEmptyHint: "Subukang burahin ang hinahanap o ibalik sa lahat ng mamamayan.",
      btnShowAllCitizens: "Ipakita lahat ng mamamayan",
      btnClearSearch: "Burahin ang hinahanap",
      colName: "Pangalan",
      colUsername: "Username",
      colBirthdate: "Petsa ng kapanganakan",
      colVisits: "Bisita sa kiosk",
      colLastMeas: "Huling sukat (PHT)",
      colConsent: "Pahintulot",
      colActions: "Mga Aksyon",
      visitSingle: "bisita",
      visitPlural: "mga bisita",
      noReadingsYet: "Walang sukat pa",
      consentGranted: "May pahintulot",
      consentNotGranted: "Walang pahintulot",
      btnOpenRecord: "Buksan ang rekord →",

      cvBackToSearch: "← Bumalik sa paghahanap",
      cvTitleFallback: "Rekord ng mamamayan",
      cvLede: "Ang pagtingin na ito ay nakatala sa audit trail.",
      cvEyebrow: "Residente ng Barangay · Rekord sa Kiosk",
      cvProfileHeading: "Profile ng Mamamayan",
      cvPrintReferral: "I-print ang Referral Slip",
      cvReferBtn: "I-refer sa RHU",
      cvResetPwBtn: "I-reset ang Password",
      cvConsentTitle: "Aktibo at Beripikadong Pahintulot",
      cvConsentBadge: "Protektado ng RA 10173",
      cvReadingsHeading: "Mga Sukat at Telemetry",
      cvReadingsSubtext: "Mga sukat ng kalusugan na naitala mula sa Barangay Health Kiosk.",
      cvNotesHeading: "Mga Tala at Gabay ng Health Worker",
      cvNotesSubtext: "Ibahagi ang mga tagubilin sa residente, o alisin ang tsek para gawing para sa staff lamang.",
      cvAddNoteLabel: "Magdagdag ng tala",
      cvTemplatesLabel: "Mga template:",
      chipBpFollowup: "Follow-up sa BP",
      chipDiet: "Payo sa pagkain",
      chipRoutine: "Normal na check-up",
      chipRefer: "I-refer sa RHU",
      chipFever: "Gabay sa lagnat",
      cvNotePlaceholder: "Plano sa follow-up, obserbasyon, referral…",
      cvShareToggle: "Ibahagi sa residente sa kanilang portal",
      cvNoteHintDefault: "Makikita sa dashboard ng residente. Alisin ang tsek kung para sa BHW staff lamang.",
      cvNoteHintStaffOnly: "Para sa staff lamang — nakatago sa dashboard ng residente.",
      cvSaveNoteBtn: "I-save ang tala",
      cvFoot: "Ang mga tala at pagtingin ng rekord ay naka-audit sa ilalim ng RA 10173.",
      cvNoCitizenErr: "Walang napiling mamamayan. Magbukas ng rekord mula sa paghahanap.",
      cvLoadingRecord: "Ikinakarga ang rekord ng mamamayan…",
      cvConsentBlockedTitle: "Walang ibinigay na pahintulot ang mamamayan",
      cvConsentBlockedBody: "Hindi nagbigay ng pahintulot ang mamamayang ito na ibahagi ang indibidwal na rekord. Kasama lamang ang kanilang sukat sa pinagsama-samang datos ng komunidad.",
      cvConsentAuthLine: "Pinahintulutan noong {dt} · Maaaring buksan ng awtorisadong BHW staff.",
      cvCheckinsOnFileSingle: "1 Check-in sa rekord",
      cvCheckinsOnFilePlural: "{n} Check-in sa rekord",
      cvCheckinsOnRecordSingle: "1 Check-in sa rekord",
      cvCheckinsOnRecordPlural: "{n} Check-in sa rekord",
      cvProfileFullName: "Buong pangalan",
      cvProfileUsername: "Username",
      cvProfileUsernameSub: "Kiosk Login ID",
      cvProfileBirthdate: "Petsa ng kapanganakan",
      cvProfileGender: "Kasarian",
      cvProfileGenderSub: "Sariling ulat",
      cvProfileVisits: "Kabuuang bisita sa kiosk",
      cvVisitRecordedSingle: "1 bisita naitala",
      cvVisitRecordedPlural: "{n} bisita naitala",
      cvLatestAge: "Pinakabago: {age}",
      cvNoCheckinsYet: "Wala pang check-in",
      cvProfileAccess: "Pag-access sa datos",
      cvAuthorized: "Awtorisado",
      cvYearsOld: "{age} taong gulang",
      cvYrsBorn: "{age} taon · Ipinanganak {date}",
      cvBorn: "Ipinanganak {date}",
      cvNoNotes: "Wala pang tala para sa mamamayang ito.",
      badgeShared: "Ibinahagi sa residente",
      badgeStaffOnly: "Para sa staff lamang",
      btnMakeStaffOnly: "Gawing para sa staff lamang",
      btnShareResident: "Ibahagi sa residente",
      referModalTitle: "I-refer sa Rural Health Unit",
      referReasonLabel: "Dahilan ng referral (kailangan)",
      referReasonErr: "Pakilagay ang dahilan ng referral.",
      btnCancel: "Kanselahin",
      btnRefer: "I-refer",
      noteSavedShared: "Na-save at naibahagi na sa residente ang tala.",
      noteSavedStaffOnly: "Na-save na ang tala para sa staff lamang.",
      noteSavedToast: "Matagumpay na na-save ang tala",
      cvSnapshotEyebrow: "Pinakabagong Check-in",
      cvSnapshotTitle: "Pinakabagong Klinikal na Sukat",
      cvSnapshotRecorded: "Naitala {dt} ({age})",
      cvHistTitle: "Kasaysayan ng mga Sukat",
      cvReadingsEmpty: "Wala pang naitalang sukat para sa mamamayang ito.",
      cvLegendNormal: "Normal na saklaw",
      cvLegendWarn: "Lampas sa normal (babala)",
      cvLegendBad: "Kailangan ng atensyong medikal (lagnat / kritikal)",
      cvNotRecorded: "Walang sukat",
      cvNotTaken: "Hindi nakuha sa kiosk",
      cvVitalBp: "Presyon ng dugo",
      cvVitalPulse: "Bilis ng pulso",
      cvVitalSpo2: "SpO2 (Oksiheno)",
      cvVitalTemp: "Temperatura",
      cvVitalBmi: "Body mass index (BMI)",
      cvRefBp: "Target: <120/80 mmHg",
      cvRefPulse: "Pahinga: 60–100 bpm",
      cvRefSpo2: "Normal: 95–100%",
      cvRefTemp: "Normal: 36.5–37.5 °C",
      cvBadgeOptimal: "Pinakamainam",
      cvBadgeFever: "May Lagnat",
      cvBadgeLowPulse: "Mababang pulso",
      cvBadgeLowSpo2: "Mababang SpO2",

      auditEyebrow: "Pagsunod sa RA 10173 · Talaan ng Seguridad",
      auditTitle: "Audit Trail",
      auditLede: "Kumpletong talaan ng pag-access sa datos, pagpapatupad ng pahintulot, at aktibidad ng staff.",
      auditExportCsv: "I-export ang CSV",
      auditPrint: "I-print",
      auditPrintLog: "I-print ang talaan",
      repPresets: "Mga Preset",
      kpiTotalLabel: "Kabuuang Naitalang Kaganapan",
      kpiTotalSub: "Tumutugma sa filter",
      kpiViewsLabel: "Mga Rekord na Tiningnan",
      kpiViewsSub: "May pahintulot na pag-access",
      kpiInterventionsLabel: "Mga Klinikal na Aksyon",
      kpiInterventionsSub: "Mga tala at referral sa RHU",
      kpiBlockedLabel: "Mga Flag sa Seguridad",
      kpiBlockedSub: "Hinarang (walang pahintulot)",
      auditPresetToday: "Ngayon",
      auditPreset7d: "Huling 7a",
      auditPreset30d: "Huling 30a",
      auditPresetAll: "Lahat",
      auditLblFrom: "Mula sa petsa",
      auditLblTo: "Hanggang sa petsa",
      auditLblBhw: "Health worker",
      auditPhBhw: "Salain sa pangalan",
      auditLblCitizen: "Mamamayan",
      auditPhCitizen: "Salain sa pangalan",
      auditLblAction: "Aksyon",
      auditOptAllActions: "Lahat ng aksyon",
      auditActViewHealth: "Tiningnan ang rekord sa kalusugan",
      auditActViewNotes: "Tiningnan ang klinikal na tala",
      auditActAddNote: "Nagdagdag ng klinikal na tala",
      auditActUpdateVis: "In-update ang privacy ng tala",
      auditActRefer: "Ini-refer sa RHU",
      auditActUnauthorized: "Hinarang: Walang Pahintulot",
      auditActExport: "Nag-export ng Ulat",
      auditActStaffLogin: "Pag-login ng Staff",
      auditActSelfPw: "Sariling Pag-reset ng Password",
      auditActStaffPw: "Pag-reset ng Password ng Staff",
      auditLblStatus: "Katayuan",
      auditOptAllStatus: "Lahat ng katayuan",
      auditOptAuthorized: "Awtorisado",
      auditOptBlocked: "Hinarang (Walang Pahintulot)",
      auditBtnApply: "Ilapat ang mga filter",
      auditBtnClear: "Burahin",
      auditFoot: "Ang oras ay ipinapakita sa Philippine time (PHT); itutok ang cursor para makita ang UTC.",
      auditLoading: "Ikinakarga ang mga tala ng audit…",
      auditEmpty: "Walang tala ng audit na tumutugma sa mga filter na ito.",
      auditColTime: "Oras (PHT)",
      auditColBhw: "Health worker",
      auditColCitizen: "Mamamayang binuksan",
      auditColAction: "Ginawang aksyon",
      auditColStatus: "Katayuan",
      auditColDetails: "Mga Detalye",
      auditColIp: "IP address",
      statusAuthorizedBadge: "Awtorisado ✓",
      statusBlockedBadge: "Hinarang 🚫",

      repEyebrow: "RA 10173 · Opisyal na Dokumentasyon",
      repTitle: "Mga Ulat",
      repLede: "Mag-download ng CSV spreadsheet o magbukas ng napi-print na ulat.",
      repLblType: "Uri ng ulat",
      repOptSummary: "Summary — pangkalahatang sukat ng komunidad",
      repOptConsent: "Pahintulot — pagsunod at antas ng pagpayag",
      repOptAudit: "Audit — talaan ng pag-access sa datos",
      repOptAlerts: "Mga Alerto — mataas na lagnat, BP, mababang SpO2",
      repPresetToday: "Ngayon",
      repPreset7d: "Huling 7a",
      repPreset30d: "Huling 30a",
      repPresetAll: "Lahat",
      repLblFrom: "Mula sa petsa",
      repLblTo: "Hanggang sa petsa",
      repBtnCsv: "I-download ang CSV",
      repBtnPrint: "Buksan ang napi-print na ulat",
      repHintEmpty: "Iwanang blangko ang mga petsa upang isama ang lahat ng nakatalang datos.",
      repFoot: "Ang mga mamamayang walang pahintulot ay minamarkahang “Withheld (no consent)” sa mga ulat ng alerto.",
      repRangeErr: "Ang petsa na Mula ay dapat mas maaga o kapareho ng petsa na Hanggang.",
      repPreparingCsv: "Inihahanda ang pag-download ng CSV…",
      repPreparingPrint: "Inihahanda ang napi-print na ulat…",
      repModalPrint: "I-print ang ulat",
      repModalClose: "Isara",

      catNormal: "Normal",
      catUnderweight: "Kuláng sa timbang",
      catOverweight: "Sobra sa timbang",
      catObese: "Obese",
      catElevated: "Medyo Mataas",
      catStage1: "Stage 1",
      catStage2: "Stage 2",
      catCrisis: "Kritikal (Crisis)",
      catLow: "Mababa",
      catCritical: "Kritikal",
      conStage2: "Stage 2 Hypertension",
      conCrisis: "BP Crisis",
      conHighFever: "Mataas na Lagnat",
      conCriticalSpo2: "Kritikal na SpO2",
      conObese: "Obese",
      conStage1: "Stage 1 Hypertension",
      conElevatedBp: "Bahagyang Mataas na BP",
      conLowSpo2: "Mababang SpO2",
      conOverweight: "Sobra sa timbang",
      conUnderweight: "Kuláng sa timbang",
    },
  };

  function getBhwLang() {
    var lang = API.getLang();
    return BHW_I18N[lang] ? lang : "en";
  }

  function bt(key, vars) {
    var dict = BHW_I18N[getBhwLang()] || BHW_I18N.en;
    var val = dict[key] !== undefined ? dict[key] : BHW_I18N.en[key];
    if (typeof val !== "string") return val !== undefined ? val : key;
    if (!vars) return val;
    return val.replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, k) {
      return vars[k] !== undefined ? String(vars[k]) : "";
    });
  }

  function btCat(cat) {
    var map = {
      "Normal": "catNormal",
      "Underweight": "catUnderweight",
      "Overweight": "catOverweight",
      "Obese": "catObese",
      "Elevated": "catElevated",
      "Stage 1": "catStage1",
      "Stage 2": "catStage2",
      "Crisis": "catCrisis",
      "Low": "catLow",
      "Critical": "catCritical",
    };
    return map[cat] ? bt(map[cat]) : (cat || "");
  }

  function btConcern(concern) {
    var map = {
      "Stage 2 Hypertension": "conStage2",
      "BP Crisis": "conCrisis",
      "High Fever": "conHighFever",
      "Critical SpO2": "conCriticalSpo2",
      "Obese": "conObese",
      "Stage 1 Hypertension": "conStage1",
      "Elevated BP": "conElevatedBp",
      "Low SpO2": "conLowSpo2",
      "Overweight": "conOverweight",
      "Underweight": "conUnderweight",
    };
    return map[concern] ? bt(map[concern]) : (concern || "");
  }

  function applyBhwI18n() {
    API.applyI18nDOM(bt);
    var navMap = [
      ["/bhw/dashboard.html", "navDashboard"],
      ["/bhw/search.html", "navFindCitizens"],
      ["/bhw/audit-trail.html", "navAuditTrail"],
      ["/bhw/reports.html", "navReports"],
    ];
    navMap.forEach(function (pair) {
      document.querySelectorAll('.sidenav a[href="' + pair[0] + '"] span')
        .forEach(function (span) { span.textContent = bt(pair[1]); });
    });
    var adminBadge = document.querySelector(".badge-admin");
    if (adminBadge) adminBadge.textContent = bt("roleAdminBadge");
  }

  function bindBhwLangDropdowns() {
    API.bindLangDropdowns(bt, function () {
      applyBhwI18n();
      if (typeof onLangRefresh === "function") onLangRefresh();
    });
    applyBhwI18n();
  }

  /* ---------------- helpers ---------------- */

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = label || "Please wait…";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  function showNote(node, message, isError) {
    if (!node) return;
    U.clear(node);
    node.appendChild(
      U.el(
        "div",
        {
          class: "notice" + (isError ? " warn" : ""),
          role: isError ? "alert" : "status",
        },
        message
      )
    );
  }

  function fieldValue(id) {
    var node = document.getElementById(id);
    return node ? node.value.trim() : "";
  }

  function formatDateISO(d) {
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function bindDatePresets(formOrContainer, fromId, toId, onApply) {
    if (!formOrContainer) return;
    var fromInput = document.getElementById(fromId);
    var toInput = document.getElementById(toId);
    if (!fromInput || !toInput) return;
    var presetBtns = formOrContainer.querySelectorAll(".date-preset-btn");
    presetBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var range = btn.getAttribute("data-range");
        var now = new Date();
        var todayStr = formatDateISO(now);
        if (range === "today") {
          fromInput.value = todayStr;
          toInput.value = todayStr;
        } else if (range === "7d") {
          var d7 = new Date();
          d7.setDate(now.getDate() - 7);
          fromInput.value = formatDateISO(d7);
          toInput.value = todayStr;
        } else if (range === "30d") {
          var d30 = new Date();
          d30.setDate(now.getDate() - 30);
          fromInput.value = formatDateISO(d30);
          toInput.value = todayStr;
        } else if (range === "all") {
          fromInput.value = "";
          toInput.value = "";
        }
        presetBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        if (typeof onApply === "function") {
          onApply();
        }
      });
    });
  }

  function setEmptyRow(wrap, message) {
    U.empty(wrap, message);
  }

  /* ---------------- login ---------------- */

  function initBhwLogin() {
    var form = document.getElementById("loginForm");
    if (!form) return;
    var errorNode = document.getElementById("loginError");
    var submit = document.getElementById("loginSubmit");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      errorNode.textContent = "";
      var username = fieldValue("username");
      var password = document.getElementById("password").value;
      if (!username || !password) {
        errorNode.textContent = bt("bhwLoginErrRequired");
        return;
      }
      setBusy(submit, true, bt("btnSigningIn"));
      try {
        var data = await API.apiFetch("/api/login", {
          method: "POST",
          body: { username: username, password: password },
        });
        if (data.role !== "bhw" && data.role !== "admin") {
          errorNode.textContent = bt("bhwLoginErrRole");
          setBusy(submit, false);
          return;
        }
        API.saveSession(data.token, data.role, data.full_name, data.privacy_acknowledged);
        location.href = "/bhw/dashboard.html";
      } catch (error) {
        errorNode.textContent = error.message;
        setBusy(submit, false);
      }
    });
  }

  /* ---------------- dashboard ---------------- */

  function totalCard(label, value, options) {
    options = options || {};
    var card = U.el("div", { class: "total" + (options.tone ? " " + options.tone : "") });
    card.appendChild(U.el("div", { class: "label" }, label));
    card.appendChild(U.el("div", { class: "value" }, String(value)));
    if (options.subtext) {
      card.appendChild(U.el("div", { class: "subtext" }, options.subtext));
    }
    if (options.link) {
      card.appendChild(U.el("a", { class: "total-link", href: options.link.href }, options.link.text));
    }
    return card;
  }

  function destroyChart(key) {
    if (dashboardCharts[key]) {
      dashboardCharts[key].destroy();
      delete dashboardCharts[key];
    }
  }

  function distributionTable(keys, data, total) {
    var wrap = U.el("div");
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    headRow.appendChild(U.el("th", { scope: "col" }, bt("tblCategory")));
    headRow.appendChild(U.el("th", { class: "num", scope: "col" }, bt("tblCount")));
    headRow.appendChild(U.el("th", { class: "num", scope: "col" }, bt("tblShare")));
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = U.el("tbody");
    keys.forEach(function (key) {
      var row = U.el("tr");
      row.appendChild(U.el("td", { class: "cell-name", style: "font-weight:600; text-align:left;" }, btCat(key)));
      row.appendChild(U.el("td", { class: "num" }, String(data[key])));
      var pct = total > 0 ? Math.round((data[key] / total) * 100) : 0;
      row.appendChild(U.el("td", { class: "num" }, pct + "%"));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  var DIST_ORDER = {
    bmi: ["Underweight", "Normal", "Overweight", "Obese"],
    bp: ["Normal", "Elevated", "Stage 1", "Stage 2", "Crisis"],
    spo2: ["Normal", "Low", "Critical"],
  };

  var DIST_COLORS = {
    Underweight: "#8a5a00",
    Normal: "#0f6b53",
    Overweight: "#b9761b",
    Obese: "#a5271d",
    Elevated: "#b9761b",
    "Stage 1": "#c26a12",
    "Stage 2": "#a5271d",
    Crisis: "#7d1a13",
    Low: "#b9761b",
    Critical: "#a5271d",
  };

  /* Inline per-chart plugin: draws "count (xx%)" at the end of each
   * horizontal bar so values are readable without hovering. Positions come
   * from the scales (not bar element geometry) to stay exact. */
  function valueLabelPlugin(total) {
    return {
      id: "valueLabels",
      afterDatasetsDraw: function (chart) {
        var xScale = chart.scales.x;
        var yScale = chart.scales.y;
        if (!xScale || !yScale) return;
        var ctx = chart.ctx;
        ctx.save();
        ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = "#14332b";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        chart.data.datasets.forEach(function (dataset, datasetIndex) {
          var meta = chart.getDatasetMeta(datasetIndex);
          if (meta.hidden) return;
          dataset.data.forEach(function (value, index) {
            if (value === null || value === undefined) return;
            var pct = total > 0 ? Math.round((value / total) * 100) : 0;
            var bar = meta.data && meta.data[index];
            var xPos = bar ? bar.x : xScale.getPixelForValue(value);
            var yPos = bar ? bar.y : (yScale.getPixelForValue ? yScale.getPixelForValue(index) : 0);
            ctx.fillText(value + " (" + pct + "%)", xPos + 6, yPos);
          });
        });
        ctx.restore();
      },
    };
  }

  function renderDistribution(container, key, title, data, animate) {
    var box = U.el("div", { class: "chart-box" });
    box.appendChild(U.el("h2", null, title));
    var order = DIST_ORDER[key] || [];
    var keys = order.filter(function (name) {
      return data[name] !== undefined && data[name] > 0;
    });
    Object.keys(data).forEach(function (name) {
      if (keys.indexOf(name) === -1 && data[name] > 0) keys.push(name);
    });

    if (!keys.length) {
      box.appendChild(U.el("div", { class: "status empty" }, bt("dashEmptyPeriod")));
      container.appendChild(box);
      return;
    }

    var total = keys.reduce(function (sum, name) {
      return sum + data[name];
    }, 0);
    box.appendChild(
      U.el("p", { class: "chart-caption muted" }, "n = " + total)
    );

    if (window.Chart) {
      var canvas = U.el("canvas", {
        role: "img",
        "aria-label": title + ": " + keys.map(function (name) {
          return btCat(name) + " " + data[name];
        }).join(", "),
      });
      box.appendChild(canvas);
      container.appendChild(box);
      destroyChart("dist-" + key);
      var chartOptions = {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.8,
        layout: { padding: { right: 72 } },
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { ticks: { autoSkip: false } },
        },
      };
      // Auto-refresh ticks redraw without animation to avoid flicker.
      if (animate === false || prefersReducedMotion()) chartOptions.animation = false;
      dashboardCharts["dist-" + key] = new window.Chart(canvas, {
        type: "bar",
        data: {
          labels: keys.map(btCat),
          datasets: [
            {
              data: keys.map(function (name) {
                return data[name];
              }),
              backgroundColor: keys.map(function (name) {
                return DIST_COLORS[name] || "#0f6b53";
              }),
              borderRadius: 6,
            },
          ],
        },
        options: chartOptions,
        plugins: [valueLabelPlugin(total)],
      });
      return;
    }

    var wrap = U.el("div", { class: "table-wrap", style: "box-shadow:none" });
    wrap.appendChild(distributionTable(keys, data, total));
    box.appendChild(wrap);
    container.appendChild(box);
  }

  function renderFeverChart(trend, animate) {
    var note = document.getElementById("feverFallback");
    var canvas = document.getElementById("feverChart");
    U.clear(note);
    destroyChart("fever");

    if (!trend || !trend.length) {
      if (canvas) canvas.hidden = true;
      U.empty(note, bt("dashFeverEmpty"));
      return;
    }
    if (!window.Chart) {
      if (canvas) canvas.hidden = true;
      U.empty(note, bt("dashFeverUnavailable") +
        trend.map(function (item) {
          return item[0] + ": " + item[1];
        }).join(", "));
      return;
    }
    canvas.hidden = false;
    var feverOptions = {
      responsive: true,
      maintainAspectRatio: true,
      // Full-width hero panel: wider aspect on desktop, taller on phones.
      aspectRatio: window.innerWidth < 640 ? 1.5 : 3,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 8, maxRotation: 0 } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    };
    // Auto-refresh ticks redraw without animation to avoid flicker.
    if (animate === false || prefersReducedMotion()) feverOptions.animation = false;
    dashboardCharts.fever = new window.Chart(canvas, {
      type: "line",
      data: {
        labels: trend.map(function (item) {
          var d = new Date(item[0] + "T00:00:00Z");
          return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" }).format(d);
        }),
        datasets: [
          {
            label: bt("lblFeverReadings"),
            data: trend.map(function (item) {
              return item[1];
            }),
            borderColor: "#a5271d",
            backgroundColor: "rgba(165, 39, 29, 0.12)",
            fill: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: feverOptions,
    });
  }

  /* Severity tone per concern label (aligned with DIST_COLORS). */
  var CONCERN_TONE = {
    "Stage 2 Hypertension": "tone-red",
    "BP Crisis": "tone-red",
    "High Fever": "tone-red",
    "Critical SpO2": "tone-red",
    "Obese": "tone-red",
    "Stage 1 Hypertension": "tone-amber",
    "Elevated BP": "tone-amber",
    "Low SpO2": "tone-amber",
    "Overweight": "tone-amber",
    "Underweight": "tone-amber",
  };

  function renderConcerns(concerns) {
    var list = document.getElementById("concerns");
    var emptyNode = document.getElementById("concernsEmpty");
    U.clear(list);
    if (!concerns.length) {
      emptyNode.hidden = false;
      return;
    }
    emptyNode.hidden = true;
    var max = 1;
    concerns.forEach(function (item) {
      if (item[1] > max) max = item[1];
    });
    var frag = document.createDocumentFragment();
    concerns.forEach(function (item) {
      var row = U.el("li");
      var head = U.el("div", { class: "concern-head" });
      head.appendChild(U.el("span", null, btConcern(item[0])));
      head.appendChild(U.el("span", { class: "count" }, String(item[1])));
      row.appendChild(head);
      var track = U.el("div", { class: "concern-track" });
      var bar = U.el("div", {
        class: ("concern-bar " + (CONCERN_TONE[item[0]] || "")).trim(),
      });
      bar.style.width = Math.max(4, Math.round((item[1] / max) * 100)) + "%";
      track.appendChild(bar);
      row.appendChild(track);
      frag.appendChild(row);
    });
    list.appendChild(frag);
  }

  /* Resolved date range for the period select (shown next to the filter). */
  function fmtDay(date, withYear) {
    var opts = { timeZone: "Asia/Manila", month: "short", day: "numeric" };
    if (withYear) opts.year = "numeric";
    return new Intl.DateTimeFormat("en-PH", opts).format(date);
  }

  function rangeLabelFor(days) {
    if (days === "all") return bt("dashRangeAllTime");
    var end = new Date();
    var start = new Date(end.getTime() - Number(days) * 86400000);
    var withYear = start.getFullYear() !== end.getFullYear();
    return fmtDay(start, withYear) + " – " + fmtDay(end, true) + " PHT";
  }

  function nowPht() {
    return (
      new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date()) + " PHT"
    );
  }

  /* Chart animation is skipped for reduced-motion users (mirrors the CSS
   * prefers-reduced-motion block) as well as for auto-refresh ticks. */
  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /* At-a-glance context: consent coverage + kiosk freshness, computed
   * client-side from the existing /api/bhw/citizens payload — counts and
   * timestamps only; names never reach this dashboard. Failures degrade to
   * a quiet note and never touch the main dashboard (this runs outside
   * loadDashboard's try/catch). Loaded once at startup and on manual
   * refresh — not on the 30s tick, to avoid needless churn. */
  async function loadContext() {
    var donutNode = document.getElementById("consentDonut");
    var summaryNode = document.getElementById("consentDonutText");
    var freshnessNode = document.getElementById("kioskFreshness");
    if (!donutNode || !summaryNode || !freshnessNode) return;

    var data;
    try {
      data = await API.apiFetch("/api/bhw/citizens");
    } catch (error) {
      U.empty(summaryNode, bt("dashCoverageUnavailable"));
      U.clear(freshnessNode);
      freshnessNode.appendChild(
        U.el("p", { class: "freshness none" }, bt("dashFreshnessUnavailable"))
      );
      return;
    }

    var citizens = data.citizens || [];
    var granted = citizens.filter(function (citizen) {
      return Boolean(citizen.consent);
    }).length;
    var total = citizens.length;
    var pct = total > 0 ? Math.round((granted / total) * 100) : 0;

    // Consent coverage donut (falls back to the summary line without Chart.js).
    destroyChart("consentDonut");
    if (window.Chart && total > 0) {
      donutNode.hidden = false;
      dashboardCharts.consentDonut = new window.Chart(donutNode, {
        type: "doughnut",
        data: {
          labels: [bt("lblConsented"), bt("lblNotConsented")],
          datasets: [
            {
              data: [granted, total - granted],
              backgroundColor: ["#14876a", "#e6efeb"],
              borderColor: "#ffffff",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.7,
          cutout: "66%",
          animation: prefersReducedMotion() ? false : undefined,
          plugins: { legend: { position: "bottom" } },
        },
      });
    } else {
      donutNode.hidden = true;
    }
    U.empty(
      summaryNode,
      total > 0
        ? bt("dashConsentSummaryCount", { granted: granted, total: total, pct: pct })
        : bt("dashConsentSummaryEmpty")
    );

    // Kiosk freshness: newest last_measurement across the registry.
    var latestRaw = null;
    var latestMs = null;
    citizens.forEach(function (citizen) {
      var raw = citizen.last_measurement;
      if (!raw) return;
      var ms = Date.parse(String(raw).replace(" ", "T") + "Z");
      if (!isNaN(ms) && (latestMs === null || ms > latestMs)) {
        latestMs = ms;
        latestRaw = raw;
      }
    });

    U.clear(freshnessNode);
    if (!latestRaw) {
      freshnessNode.appendChild(U.el("p", { class: "freshness none" }, bt("dashNoKioskReadings")));
      freshnessNode.appendChild(
        U.el("p", { class: "freshness-sub" }, bt("dashKioskNoneSub"))
      );
      return;
    }
    var hours = (Date.now() - latestMs) / 3600000;
    var tone = hours < 24 ? "" : hours < 72 ? " warn" : " stale";
    freshnessNode.appendChild(
      U.el("p", { class: ("freshness" + tone).trim() }, bt("dashLastReading", { age: U.fmtAge(latestRaw) }))
    );
    freshnessNode.appendChild(
      U.el("p", { class: "freshness-sub" }, bt("dashFromKiosk", { dt: U.fmtDT(latestRaw) }))
    );
  }

  async function loadDashboard(options) {
    // animate:false is used by the 30s auto-refresh tick to avoid flicker.
    var animate = !options || options.animate !== false;
    var periodNode = document.getElementById("period");
    var statusNode = document.getElementById("status");
    var totalsNode = document.getElementById("totals");
    var registryNode = document.getElementById("registryTotals");
    var distNode = document.getElementById("distributions");
    var days = periodNode.value;

    // Stale-while-revalidate: keep current content visible while fetching,
    // show only a subtle "Updating…" indicator, and swap content on success.
    U.clear(statusNode);
    statusNode.appendChild(
      U.el("span", { class: "muted", style: "font-size:0.85rem;" }, bt("dashUpdating"))
    );

    try {
      var data = await API.apiFetch("/api/bhw/dashboard?days=" + encodeURIComponent(days));
      U.clear(statusNode);

      // Resolved date range + last-updated stamp.
      var rangeNode = document.getElementById("rangeLabel");
      if (rangeNode) rangeNode.textContent = rangeLabelFor(days);
      var updatedNode = document.getElementById("lastUpdated");
      if (updatedNode) updatedNode.textContent = bt("dashUpdatedStamp", { time: nowPht() });

      var totals = data.totals || {};
      var alerts = totals.alerts || 0;

      // Period-scoped totals.
      U.clear(totalsNode);
      totalsNode.appendChild(totalCard(bt("totMeasurements"), totals.measurements || 0, { subtext: bt("totMeasurementsSub") }));
      totalsNode.appendChild(totalCard(bt("totActiveCitizens"), totals.active_citizens || 0, { subtext: bt("totActiveCitizensSub") }));
      totalsNode.appendChild(totalCard(bt("totGuestMeas"), totals.guest_measurements || 0, { subtext: bt("totGuestMeasSub") }));
      totalsNode.appendChild(
        totalCard(bt("totAlerts"), alerts, {
          tone: alerts > 0 ? "alert" : null,
          subtext: alerts > 0 ? bt("totAlertsSubActive") : bt("totAlertsSubNone"),
          link: { href: "/bhw/search.html", text: bt("totReviewCitizens") },
        })
      );
      totalsNode.appendChild(totalCard(bt("totConsentGrants"), totals.consent_grants || 0, { subtext: bt("totConsentGrantsSub") }));

      // Registry totals are all-time and never change with the period filter,
      // so they live in their own labelled group.
      U.clear(registryNode);
      registryNode.appendChild(totalCard(bt("totRegisteredUsers"), totals.users || 0, { subtext: bt("totRegisteredUsersSub") }));

      // An empty period gets an explanation instead of only bare zeros.
      var emptyNode = document.getElementById("emptyState");
      U.clear(emptyNode);
      if (!totals.measurements) {
        emptyNode.appendChild(
          U.el(
            "div",
            { class: "status empty" },
            days === "all" ? bt("dashEmptyAll") : bt("dashEmptyPeriod")
          )
        );
      }

      var distributions = data.distributions || {};
      U.clear(distNode);
      renderDistribution(distNode, "bmi", bt("distBmi"), distributions.bmi || {}, animate);
      renderDistribution(distNode, "bp", bt("distBp"), distributions.bp || {}, animate);
      renderDistribution(distNode, "spo2", bt("distSpo2"), distributions.spo2 || {}, animate);

      renderFeverChart(data.fever_trend || [], animate);
      renderConcerns(data.top_concerns || []);
      return true;
    } catch (error) {
      // Keep the stale content visible; surface the error with a Retry button.
      U.error(statusNode, error.message, loadDashboard);
      return false;
    }
  }

  var refreshTimer = null;

  function initDashboard() {
    if (!API.requireRole("bhw")) return;
    var periodSelect = document.getElementById("period");
    var rememberedPeriod = U.remember("bhw_period");
    if (rememberedPeriod && periodSelect) {
      periodSelect.value = rememberedPeriod;
    }
    periodSelect.addEventListener("change", function () {
      U.remember("bhw_period", periodSelect.value);
      loadDashboard({ animate: true });
    });
    document.getElementById("refreshBtn").addEventListener("click", async function () {
      // Only report success when the fetch actually succeeded — otherwise the
      // user would see "Dashboard refreshed" over an error state.
      var ok = await loadDashboard({ animate: true });
      if (ok) U.toast(bt("dashToastRefreshed"), "success");
      loadContext(); // context panels refresh alongside the manual refresh
    });

    var toggle = document.getElementById("autoRefreshToggle");
    var liveText = document.getElementById("liveText");
    var secondsLeft = 30;
    var paused = false;

    function updateLiveText() {
      if (paused) {
        if (liveText) liveText.textContent = bt("dashPausedHidden");
      } else if (toggle && toggle.checked) {
        if (liveText) liveText.textContent = bt("dashLive", { s: secondsLeft });
      } else {
        if (liveText) liveText.textContent = bt("dashPaused");
      }
    }

    function startTimer() {
      if (refreshTimer) clearInterval(refreshTimer);
      secondsLeft = 30;
      updateLiveText();
      refreshTimer = setInterval(function () {
        if (paused || !toggle || !toggle.checked) return;
        secondsLeft--;
        updateLiveText();
        if (secondsLeft <= 0) {
          secondsLeft = 30;
          // Timer ticks redraw without animation so the page never flickers.
          loadDashboard({ animate: false });
        }
      }, 1000);
    }

    document.addEventListener("visibilitychange", function () {
      paused = document.hidden;
      updateLiveText();
      if (!paused && toggle && toggle.checked) startTimer();
    });

    if (toggle) {
      toggle.addEventListener("change", function () {
        if (toggle.checked) {
          startTimer();
        } else {
          if (refreshTimer) clearInterval(refreshTimer);
          updateLiveText();
        }
      });
      startTimer();
    }

    loadDashboard({ animate: true });
    loadContext(); // consent donut + kiosk freshness (isolated failures)

    onLangRefresh = function () {
      updateLiveText();
      loadDashboard({ animate: false });
      loadContext();
    };

    API.initRealtimeSync({
      onReading: function () {
        loadDashboard({ animate: false });
        loadContext();
      },
    });
  }

  /* ---------------- search ---------------- */

  var searchState = { allCitizens: [], filter: "all", query: "" };

  function consentBadge(granted) {
    return U.el(
      "span",
      { class: "badge " + (granted ? "badge-ok" : "badge-no") },
      granted ? bt("consentGranted") : bt("consentNotGranted")
    );
  }

  function updateSearchChipCounts() {
    var all = searchState.allCitizens;
    var countAll = document.getElementById("countAll");
    var countConsented = document.getElementById("countConsented");
    var countActive = document.getElementById("countActive");
    var countNoVisit = document.getElementById("countNoVisit");

    if (countAll) countAll.textContent = all.length;
    if (countConsented) countConsented.textContent = all.filter(function (c) { return Boolean(c.consent); }).length;
    if (countActive) countActive.textContent = all.filter(function (c) { return (c.visit_count || 0) > 0; }).length;
    if (countNoVisit) countNoVisit.textContent = all.filter(function (c) { return (c.visit_count || 0) === 0; }).length;
  }

  function applySearchFilter() {
    var list = searchState.allCitizens;
    if (searchState.filter === "consented") {
      list = list.filter(function (c) { return Boolean(c.consent); });
    } else if (searchState.filter === "active") {
      list = list.filter(function (c) { return (c.visit_count || 0) > 0; });
    } else if (searchState.filter === "novisit") {
      list = list.filter(function (c) { return (c.visit_count || 0) === 0; });
    }
    renderCitizens(list, searchState.query);
  }

  function renderCitizens(citizens, query) {
    var results = document.getElementById("results");
    U.clear(results);
    if (!citizens.length) {
      var q = query || fieldValue("searchInput");
      var emptyBox = U.el("div", { class: "empty-search-state" });
      var icon = U.el("div", { class: "empty-icon" });
      icon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
      emptyBox.appendChild(icon);

      var isFilterActive = searchState.filter !== "all";
      var titleText = isFilterActive
        ? bt("searchNoFilterMatch")
        : (q ? bt("searchNoMatchPrefix", { q: q }) : bt("searchNoFilterMatch"));
      var descText = bt("searchEmptyHint");

      emptyBox.appendChild(U.el("h3", { class: "empty-title" }, titleText));
      emptyBox.appendChild(U.el("p", { class: "empty-desc" }, descText));

      var btnRow = U.el("div", { style: "display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap; margin-top:0.6rem;" });
      if (isFilterActive) {
        var clearFilterBtn = U.el("button", { class: "btn btn-secondary", type: "button" }, bt("btnShowAllCitizens"));
        clearFilterBtn.addEventListener("click", function () {
          searchState.filter = "all";
          var chips = document.querySelectorAll("#searchTriageChips button.chip");
          chips.forEach(function (c) {
            c.classList.toggle("is-active", (c.getAttribute("data-filter") || "all") === "all");
          });
          applySearchFilter();
        });
        btnRow.appendChild(clearFilterBtn);
      }
      if (q) {
        var clearSearchBtn = U.el("button", { class: "btn btn-secondary", type: "button" }, bt("btnClearSearch"));
        clearSearchBtn.addEventListener("click", function () {
          var input = document.getElementById("searchInput");
          if (input) input.value = "";
          searchCitizens();
        });
        btnRow.appendChild(clearSearchBtn);
      }
      if (btnRow.children.length > 0) {
        emptyBox.appendChild(btnRow);
      }
      results.appendChild(emptyBox);
      return;
    }
    var tableWrap = U.el("div", { class: "table-wrap" });
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    [bt("colName"), bt("colUsername"), bt("colBirthdate"), bt("colVisits"), bt("colLastMeas"), bt("colConsent"), bt("colActions")].forEach(function (label, index) {
      headRow.appendChild(
        U.el("th", index === 6 ? { style: "text-align:right;", scope: "col" } : { scope: "col" }, label)
      );
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    var rowsFrag = document.createDocumentFragment();
    citizens.forEach(function (citizen) {
      var row = U.el("tr");
      if (citizen.consent) {
        row.style.background = "#fafdfb";
      }
      var tdName = U.el("td", { class: "cell-name", style: "font-weight:600; text-align:left;" });
      U.highlight(tdName, citizen.full_name, query);
      row.appendChild(tdName);

      var tdUser = U.el("td", { class: "muted" });
      U.highlight(tdUser, citizen.username, query);
      row.appendChild(tdUser);

      var tdBirth = U.el("td", { class: "nowrap" }, citizen.birthdate || "—");
      tdBirth.setAttribute("data-sort", citizen.birthdate || "");
      row.appendChild(tdBirth);

      var visitsCell = U.el("td", { class: "nowrap" });
      var vCount = citizen.visit_count || 0;
      visitsCell.setAttribute("data-sort", String(vCount));
      if (vCount > 0) {
        var vBadge = U.el(
          "span",
          { class: "badge badge-ok", style: "font-weight:700;" },
          vCount + " " + (vCount === 1 ? bt("visitSingle") : bt("visitPlural"))
        );
        visitsCell.appendChild(vBadge);
      } else {
        visitsCell.appendChild(U.el("span", { class: "muted" }, "0 " + bt("visitPlural")));
      }
      row.appendChild(visitsCell);

      var measCell = U.el("td", { class: "nowrap" }, citizen.last_measurement ? U.fmtDT(citizen.last_measurement) : bt("noReadingsYet"));
      measCell.setAttribute("data-sort", citizen.last_measurement || "");
      row.appendChild(measCell);

      var consentCell = U.el("td");
      consentCell.setAttribute("data-sort", citizen.consent ? "1" : "0");
      consentCell.appendChild(consentBadge(Boolean(citizen.consent)));
      row.appendChild(consentCell);

      var actionCell = U.el("td", { style: "text-align:right;" });
      var button = U.el("button", {
        class: citizen.consent ? "btn btn-primary" : "btn btn-secondary",
        type: "button",
        style: "min-height:2.1rem; padding:0.35rem 0.8rem; font-size:0.85rem;"
      }, bt("btnOpenRecord"));
      button.addEventListener("click", function () {
        location.href = "/bhw/citizen-view.html?id=" + encodeURIComponent(citizen.id);
      });
      actionCell.appendChild(button);
      row.appendChild(actionCell);
      rowsFrag.appendChild(row);
    });
    tbody.appendChild(rowsFrag);
    table.appendChild(tbody);
    U.makeSortable(table, { skip: [6] });
    tableWrap.appendChild(table);
    results.appendChild(tableWrap);
    U.addScrollCue(tableWrap);
  }

  async function searchCitizens() {
    var statusNode = document.getElementById("status");
    var query = fieldValue("searchInput");
    U.remember("bhw_search", query);
    U.loading(statusNode, bt("searchLoading"));
    var results = document.getElementById("results");
    U.clear(results);
    results.appendChild(U.tableSkeleton([bt("colName"), bt("colUsername"), bt("colBirthdate"), bt("colVisits"), bt("colLastMeas"), bt("colConsent"), bt("colActions")], 3));
    try {
      var data = await API.apiFetch(
        "/api/bhw/citizens?search=" + encodeURIComponent(query)
      );
      U.clear(statusNode);
      searchState.allCitizens = data.citizens || [];
      searchState.query = query;
      updateSearchChipCounts();
      applySearchFilter();
    } catch (error) {
      U.clear(document.getElementById("results"));
      U.error(statusNode, error.message, searchCitizens);
    }
  }

  function initSearch() {
    if (!API.requireRole("bhw")) return;
    var input = document.getElementById("searchInput");
    var remembered = U.remember("bhw_search");
    if (remembered && input) {
      input.value = remembered;
    }
    document.getElementById("searchForm").addEventListener("submit", function (event) {
      event.preventDefault();
      searchCitizens();
    });

    var chips = document.querySelectorAll("#searchTriageChips button.chip");
    chips.forEach(function (btn) {
      btn.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("is-active"); });
        btn.classList.add("is-active");
        searchState.filter = btn.getAttribute("data-filter") || "all";
        applySearchFilter();
      });
    });

    searchCitizens();
    onLangRefresh = function () {
      applySearchFilter();
    };
  }

  /* ---------------- citizen record ---------------- */

  function bmiCategory(value) {
    if (value === null || value === undefined) return null;
    if (value < 18.5) return "Underweight";
    if (value < 25) return "Normal";
    if (value < 30) return "Overweight";
    return "Obese";
  }

  function bpCategory(systolic, diastolic) {
    if (systolic === null || systolic === undefined) return null;
    if (diastolic === null || diastolic === undefined) return null;
    if (systolic >= 180 || diastolic >= 120) return "Crisis";
    if (systolic >= 140 || diastolic >= 90) return "Stage 2";
    if (systolic >= 130 || diastolic >= 80) return "Stage 1";
    if (systolic >= 120) return "Elevated";
    return "Normal";
  }

  function spo2Category(value) {
    if (value === null || value === undefined) return null;
    if (value < 90) return "Critical";
    if (value < 95) return "Low";
    return "Normal";
  }

  function isMissing(value) {
    return value === null || value === undefined;
  }

  function cellTone(kind, log) {
    switch (kind) {
      case "bp": {
        var c = bpCategory(log.systolic_bp, log.diastolic_bp);
        if (!c || c === "Normal") return "";
        return c === "Elevated" || c === "Stage 1" ? "cell-warn" : "cell-bad";
      }
      case "spo2": {
        var s = spo2Category(log.spo2);
        return s === "Critical" ? "cell-bad" : s === "Low" ? "cell-warn" : "";
      }
      case "temp":
        if (isMissing(log.temperature)) return "";
        if (Number(log.temperature) >= 37.9) return "cell-bad";
        return Number(log.temperature) < 35.5 ? "cell-warn" : "";
      case "pulse":
        if (isMissing(log.pulse_rate)) return "";
        return log.pulse_rate < 60 || log.pulse_rate > 100 ? "cell-warn" : "";
      case "bmi": {
        var b = bmiCategory(log.bmi);
        return b && b !== "Normal" ? "cell-warn" : "";
      }
      default:
        return "";
    }
  }

  function calculateAge(birthdateStr) {
    if (!birthdateStr) return null;
    var birth = new Date(birthdateStr);
    if (isNaN(birth.getTime())) return null;
    var today = new Date();
    var age = today.getFullYear() - birth.getFullYear();
    var m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  }

  function readingsTable(logs) {
    var wrap = U.el("div", { class: "readings-dashboard" });
    if (!logs || !logs.length) {
      wrap.appendChild(
        U.el(
          "div",
          { class: "status empty", style: "margin:0.5rem 0 1rem;" },
          bt("cvReadingsEmpty")
        )
      );
      return wrap;
    }

    // 1. Latest Vitals Snapshot Panel (Clinical Overview)
    var latest = logs[0];
    var snapshotPanel = U.el("div", { class: "readings-snapshot-panel" });
    
    var snapHead = U.el("div", { class: "readings-snapshot-header" });
    var snapHeadLeft = U.el("div");
    snapHeadLeft.appendChild(U.el("span", { class: "readings-snapshot-eyebrow" }, bt("cvSnapshotEyebrow")));
    snapHeadLeft.appendChild(U.el("h3", { class: "readings-snapshot-title" }, bt("cvSnapshotTitle")));
    snapHead.appendChild(snapHeadLeft);
    snapHead.appendChild(
      U.el("span", { class: "readings-snapshot-time" }, bt("cvSnapshotRecorded", { dt: U.fmtDT(latest.timestamp), age: U.fmtAge(latest.timestamp) }))
    );
    snapshotPanel.appendChild(snapHead);

    var cardsGrid = U.el("div", { class: "cards readings-vitals-cards" });

    function addSnapshotCard(label, valStr, unitStr, badge, refStr, tone) {
      var missingVal = String(valStr) === "—";
      var cardCls = "card" + (tone ? " " + tone : missingVal ? " missing" : "");
      var card = U.el("div", { class: cardCls });
      var topRow = U.el("div", { class: "card-top-row" });
      topRow.appendChild(U.el("div", { class: "label" }, label));
      var effectiveBadge = badge || (missingVal ? { text: bt("cvNotRecorded"), tone: "neutral" } : null);
      if (effectiveBadge) {
        topRow.appendChild(U.el("span", { class: "vital-badge badge-" + (effectiveBadge.tone || "neutral") }, effectiveBadge.text));
      }
      card.appendChild(topRow);

      var valRow = U.el("div", { class: "value-row" });
      valRow.appendChild(U.el("span", { class: "value" }, String(valStr)));
      if (unitStr && !missingVal) {
        valRow.appendChild(U.el("span", { class: "unit" }, unitStr));
      }
      card.appendChild(valRow);

      if (refStr || missingVal) {
        var metaRow = U.el("div", { class: "card-meta" });
        metaRow.appendChild(U.el("span", { class: "ref-range" }, missingVal ? bt("cvNotTaken") : refStr));
        card.appendChild(metaRow);
      }
      cardsGrid.appendChild(card);
    }

    // BP
    var bpCat = bpCategory(latest.systolic_bp, latest.diastolic_bp);
    var bpBadge = isMissing(latest.systolic_bp) || isMissing(latest.diastolic_bp)
      ? null
      : bpCat === "Normal"
        ? { text: bt("catNormal"), tone: "good" }
        : bpCat === "Elevated"
          ? { text: bt("catElevated"), tone: "warn" }
          : { text: btCat(bpCat), tone: "danger" };
    addSnapshotCard(
      bt("cvVitalBp"),
      isMissing(latest.systolic_bp) || isMissing(latest.diastolic_bp) ? "—" : latest.systolic_bp + "/" + latest.diastolic_bp,
      "mmHg",
      bpBadge,
      bt("cvRefBp"),
      bpCat && bpCat !== "Normal" ? (bpCat === "Elevated" ? "attention" : "abnormal") : ""
    );

    // Pulse
    var pulseBadge = isMissing(latest.pulse_rate)
      ? null
      : (latest.pulse_rate >= 60 && latest.pulse_rate <= 100)
        ? { text: bt("catNormal"), tone: "good" }
        : { text: latest.pulse_rate < 60 ? bt("cvBadgeLowPulse") : bt("catElevated"), tone: "warn" };
    addSnapshotCard(
      bt("cvVitalPulse"),
      isMissing(latest.pulse_rate) ? "—" : latest.pulse_rate,
      "bpm",
      pulseBadge,
      bt("cvRefPulse"),
      latest.pulse_rate && (latest.pulse_rate < 60 || latest.pulse_rate > 100) ? "attention" : ""
    );

    // SpO2
    var spo2Cat = spo2Category(latest.spo2);
    var spo2Badge = isMissing(latest.spo2)
      ? null
      : spo2Cat === "Normal"
        ? { text: bt("cvBadgeOptimal"), tone: "good" }
        : spo2Cat === "Low"
          ? { text: bt("cvBadgeLowSpo2"), tone: "warn" }
          : { text: bt("catCritical"), tone: "danger" };
    addSnapshotCard(
      bt("cvVitalSpo2"),
      isMissing(latest.spo2) ? "—" : latest.spo2,
      "%",
      spo2Badge,
      bt("cvRefSpo2"),
      spo2Cat && spo2Cat !== "Normal" ? (spo2Cat === "Critical" ? "abnormal" : "attention") : ""
    );

    // Temperature
    var hasFever = !isMissing(latest.temperature) && Number(latest.temperature) >= 37.9;
    var tempBadge = isMissing(latest.temperature)
      ? null
      : hasFever
        ? { text: bt("cvBadgeFever"), tone: "danger" }
        : { text: bt("catNormal"), tone: "good" };
    addSnapshotCard(
      bt("cvVitalTemp"),
      isMissing(latest.temperature) ? "—" : U.fmtNum(latest.temperature, 1),
      "°C",
      tempBadge,
      bt("cvRefTemp"),
      hasFever ? "abnormal" : ""
    );

    // BMI
    var bmiCat = bmiCategory(latest.bmi);
    var bmiBadge = isMissing(latest.bmi)
      ? null
      : bmiCat === "Normal"
        ? { text: bt("catNormal"), tone: "good" }
        : { text: btCat(bmiCat), tone: "warn" };
    var heightFt = U.fmtHeightFtIn(latest.height);
    var heightDisplay = U.fmtNum(latest.height, 1, "cm") + (heightFt ? " (" + heightFt + ")" : "");
    var heightWeightStr = (!isMissing(latest.height) || !isMissing(latest.weight))
      ? heightDisplay + " · " + U.fmtNum(latest.weight, 1, "kg")
      : bt("catNormal") + ": 18.5–24.9";
    addSnapshotCard(
      bt("cvVitalBmi"),
      isMissing(latest.bmi) ? "—" : U.fmtNum(latest.bmi, 1),
      "BMI",
      bmiBadge,
      heightWeightStr,
      bmiCat && bmiCat !== "Normal" ? "attention" : ""
    );

    snapshotPanel.appendChild(cardsGrid);
    wrap.appendChild(snapshotPanel);

    // 2. Historical Telemetry Log Table
    var histPanel = U.el("div", { class: "readings-history-panel" });
    var histHead = U.el("div", { class: "readings-history-header" });
    histHead.appendChild(U.el("h3", { class: "readings-history-title" }, bt("cvHistTitle")));
    histHead.appendChild(
      U.el("span", { class: "readings-count-pill" }, logs.length === 1 ? bt("cvCheckinsOnRecordSingle") : bt("cvCheckinsOnRecordPlural", { n: logs.length }))
    );
    histPanel.appendChild(histHead);

    var tableWrap = U.el("div", { class: "table-wrap" });
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    [bt("auditColTime"), "Weight (kg)", "Height (cm)", "BMI", "Temp (°C)", "Pulse (bpm)", "SpO2 (%)", bt("cvVitalBp")].forEach(function (label, index) {
      headRow.appendChild(U.el("th", index === 0 ? { scope: "col" } : { class: "num", scope: "col" }, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    var rowsFrag = document.createDocumentFragment();
    logs.forEach(function (log) {
      var row = U.el("tr");
      var tdTime = U.el("td", { class: "cell-time nowrap", title: U.fmtUTC(log.timestamp), style: "font-weight:600; text-align:left;" }, U.fmtDT(log.timestamp));
      tdTime.setAttribute("data-sort", log.timestamp || "");
      row.appendChild(tdTime);
      [
        [U.fmtNum(log.weight, 1), log.weight, ""],
        [U.fmtNum(log.height, 1), log.height, ""],
        [U.fmtNum(log.bmi, 1), log.bmi, cellTone("bmi", log)],
        [U.fmtNum(log.temperature, 1), log.temperature, cellTone("temp", log)],
        [U.fmtNum(log.pulse_rate, 0), log.pulse_rate, cellTone("pulse", log)],
        [U.fmtNum(log.spo2, 0), log.spo2, cellTone("spo2", log)],
        [
          isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
            ? "—"
            : log.systolic_bp + "/" + log.diastolic_bp,
          log.systolic_bp || "",
          cellTone("bp", log)
        ],
      ].forEach(function (triple) {
        var tone = triple[2];
        var td = U.el("td", { class: "num" + (tone ? " " + tone : "") });
        td.appendChild(document.createTextNode(triple[0]));
        if (triple[1] !== null && triple[1] !== undefined) td.setAttribute("data-sort", String(triple[1]));
        if (tone) {
          td.appendChild(U.el("span", { class: "sr-only" }, tone === "cell-bad" ? " (needs attention)" : " (outside normal range)"));
        }
        row.appendChild(td);
      });
      rowsFrag.appendChild(row);
    });
    tbody.appendChild(rowsFrag);
    table.appendChild(tbody);
    U.makeSortable(table);
    tableWrap.appendChild(table);
    var views = U.wrapCheckinViews(logs, tableWrap, cellTone);
    histPanel.appendChild(views.container);

    // 3. Clinical Telemetry Legend
    var legend = U.el("div", { class: "cell-legend", style: "margin-top:0.75rem;" });
    var legNormal = U.el("div", { class: "cell-legend-item" });
    legNormal.appendChild(U.el("span", { class: "swatch", style: "background:#ffffff; border-color:#dce5e0;" }));
    legNormal.appendChild(U.el("span", null, bt("cvLegendNormal")));
    legend.appendChild(legNormal);

    var legWarn = U.el("div", { class: "cell-legend-item" });
    legWarn.appendChild(U.el("span", { class: "swatch cell-warn" }));
    legWarn.appendChild(U.el("span", null, bt("cvLegendWarn")));
    legend.appendChild(legWarn);

    var legBad = U.el("div", { class: "cell-legend-item" });
    legBad.appendChild(U.el("span", { class: "swatch cell-bad" }));
    legBad.appendChild(U.el("span", null, bt("cvLegendBad")));
    legend.appendChild(legBad);

    histPanel.appendChild(legend);
    wrap.appendChild(histPanel);
    return wrap;
  }

  var activeNotesCitizenId = null;

  var activeNotesList = [];

  function renderNotes(notes, citizenId) {
    if (citizenId) activeNotesCitizenId = citizenId;
    activeNotesList = notes || [];
    var targetCitizenId = citizenId || activeNotesCitizenId;
    var area = document.getElementById("notesArea");
    U.clear(area);
    if (!activeNotesList.length) {
      U.empty(area, bt("cvNoNotes"));
      return;
    }
    var list = U.el("ul", { class: "notes-list" });
    activeNotesList.forEach(function (note) {
      var isShared = Number(note.visible_to_citizen) === 1;
      var item = U.el("li", isShared ? null : { class: "is-staff-only" });
      var head = U.el("div", { class: "note-item-head" });
      head.appendChild(
        U.el(
          "span",
          { class: "badge " + (isShared ? "badge-ok" : "badge-neutral") },
          isShared ? bt("badgeShared") : bt("badgeStaffOnly")
        )
      );
      if (note.id && targetCitizenId) {
        var visBtn = U.el(
          "button",
          {
            type: "button",
            class: "btn btn-ghost btn-sm note-vis-btn",
          },
          isShared ? bt("btnMakeStaffOnly") : bt("btnShareResident")
        );
        visBtn.addEventListener("click", async function () {
          setBusy(visBtn, true, "Updating…");
          try {
            var res = await API.apiFetch(
              "/api/bhw/citizen/" +
                encodeURIComponent(targetCitizenId) +
                "/notes/" +
                encodeURIComponent(note.id),
              {
                method: "PATCH",
                body: { visible_to_citizen: !isShared },
              }
            );
            renderNotes(res.notes || [], targetCitizenId);
            U.toast(
              isShared ? "Note set to staff-only" : "Note shared with resident",
              "success"
            );
          } catch (error) {
            U.toast(error.message, "error");
            setBusy(visBtn, false);
          }
        });
        head.appendChild(visBtn);
      }
      item.appendChild(head);
      item.appendChild(U.el("div", { class: "text" }, note.note));
      item.appendChild(
        U.el(
          "div",
          { class: "meta" },
          "By " + note.bhw + " · " + U.fmtDT(note.timestamp)
        )
      );
      list.appendChild(item);
    });
    area.appendChild(list);
  }

  function currentCitizenId() {
    var params = new URLSearchParams(location.search);
    var raw = params.get("id");
    if (!raw || !/^\d+$/.test(raw)) return null;
    return raw;
  }

  async function loadNotes(citizenId) {
    var notesData = await API.apiFetch(
      "/api/bhw/citizen/" + encodeURIComponent(citizenId) + "/notes"
    );
    renderNotes(notesData.notes || [], citizenId);
  }

  function showConsentBlocked() {
    var panel = document.getElementById("consentBlocked");
    U.clear(panel);
    var box = U.el("div", { class: "consent-panel" });
    box.appendChild(U.el("h2", null, bt("cvConsentBlockedTitle")));
    box.appendChild(
      U.el(
        "p",
        null,
        bt("cvConsentBlockedBody")
      )
    );
    var link = U.el("a", { class: "btn btn-secondary", href: "/bhw/search.html" }, bt("cvBackToSearch"));
    box.appendChild(link);
    panel.appendChild(box);
    document.getElementById("record").hidden = true;
  }

  function showReferralSlipModal(citizen, log, reason) {
    document.body.classList.add("printing-referral");
    var backdrop = U.el("div", { class: "modal-backdrop" });
    var card = U.el("div", { class: "modal-card", style: "max-width: 680px;" });

    var header = U.el("div", { class: "modal-header" });
    header.appendChild(U.el("h3", null, "Official Clinical Referral Slip"));
    var closeBtn = U.el("button", { class: "btn btn-ghost", type: "button", "aria-label": "Close" }, "✕");
    header.appendChild(closeBtn);
    card.appendChild(header);

    var body = U.el("div", { class: "modal-body" });
    var slip = U.el("div", { class: "referral-slip-card" });

    var pHead = U.el("div", { class: "referral-header" });
    var pLogos = U.el("div", { class: "referral-logos", style: "display:flex; align-items:center; justify-content:center; gap:1.25rem; margin-bottom:0.6rem;" });
    pLogos.appendChild(U.el("img", { src: "/img/cpsc-logo.png", alt: "CPSC", width: "48", height: "48", style: "object-fit:contain;" }));
    pLogos.appendChild(U.el("img", { src: "/img/rhu-logo.png", alt: "RHU Mahinog", width: "48", height: "48", style: "object-fit:contain;" }));
    pHead.appendChild(pLogos);
    pHead.appendChild(U.el("div", { style: "font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#0b3d30;" }, "Republic of the Philippines · Province of Camiguin"));
    pHead.appendChild(U.el("h2", { style: "margin:0.25rem 0; font-size:1.3rem; color:#0b3d30;" }, "Clinical Referral Slip (RHU Mahinog)"));
    pHead.appendChild(U.el("p", { style: "margin:0; font-size:0.82rem; color:#4a655a;" }, "Municipality of Mahinog · Barangay Health Station & Rural Health Unit"));
    slip.appendChild(pHead);

    var infoDl = U.el("dl", { class: "kv", style: "margin-bottom:0.85rem;" });
    function addInfo(lbl, val) {
      var item = U.el("div", { class: "kv-item" });
      item.appendChild(U.el("dt", null, lbl));
      item.appendChild(U.el("dd", null, val || "—"));
      infoDl.appendChild(item);
    }
    addInfo("Patient Name", citizen.full_name || "—");
    addInfo("Username / ID", citizen.username || "—");
    addInfo("Birthdate", citizen.birthdate || "—");
    addInfo("Gender", citizen.gender ? citizen.gender.toUpperCase() : "—");
    slip.appendChild(infoDl);

    var reasonBox = U.el("div", { class: "referral-reason-box" });
    reasonBox.appendChild(U.el("div", { style: "font-weight:700; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--green-900); margin-bottom:0.25rem;" }, "Reason for Referral & Clinical Findings:"));
    reasonBox.appendChild(U.el("div", { style: "line-height:1.45; white-space:pre-wrap;" }, reason || "Patient referred for medical evaluation, diagnosis, and prescription management at the Rural Health Unit."));
    slip.appendChild(reasonBox);

    var vitalsTitle = U.el("h4", { style: "margin:0.75rem 0 0.35rem 0; font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:#0b3d30;" }, "Latest Vital Signs (Barangay Health Kiosk)");
    slip.appendChild(vitalsTitle);

    var grid = U.el("div", { class: "passport-grid" });
    function addStat(lbl, val, sub) {
      var box = U.el("div", { class: "passport-stat" });
      box.appendChild(U.el("div", { class: "lbl" }, lbl));
      box.appendChild(U.el("div", { class: "val" }, val));
      if (sub) box.appendChild(U.el("div", { class: "sub", style: "font-size:0.75rem; color:#4b6b62;" }, sub));
      grid.appendChild(box);
    }

    if (log) {
      var hasBp = (log.systolic_bp !== null && log.systolic_bp !== undefined && log.diastolic_bp !== null && log.diastolic_bp !== undefined);
      var bpVal = hasBp ? (log.systolic_bp + "/" + log.diastolic_bp + " mmHg") : "—";
      var bpSub = (log.systolic_bp >= 140 || log.diastolic_bp >= 90) ? "Stage 2 HTN Alert" : (log.systolic_bp >= 130 || log.diastolic_bp >= 80 ? "Stage 1 HTN" : "Normal BP");
      addStat("Blood Pressure", bpVal, bpSub);
      var refHeightFt = U.fmtHeightFtIn(log.height);
      addStat(
        "Body Mass Index",
        U.fmtNum(log.bmi, 1),
        log.weight
          ? (U.fmtNum(log.weight, 1, "kg") + " / " + U.fmtNum(log.height, 1, "cm") + (refHeightFt ? " (" + refHeightFt + ")" : ""))
          : ""
      );
      addStat("Blood Oxygen (SpO2)", U.fmtNum(log.spo2, 0, "%"), (log.spo2 && log.spo2 < 95) ? "Attention required" : "Normal");
      addStat("Body Temperature", U.fmtNum(log.temperature, 1, "°C"), (log.temperature >= 37.9) ? "Fever alert" : "Normothermic");
      addStat("Pulse / Heart Rate", U.fmtNum(log.pulse_rate, 0, "bpm"), "Resting pulse");
      addStat("Measurement Time", U.fmtDT(log.timestamp), "Kiosk Station");
    } else {
      grid.appendChild(U.el("p", { class: "muted" }, "No vital readings recorded yet."));
    }
    slip.appendChild(grid);

    var sigBlock = U.el("div", { class: "official-signature-block", style: "margin-top:1.5rem;" });
    var sigFlex = U.el("div", { style: "display:flex; justify-content:space-between; gap:1rem;" });
    
    var sig1 = U.el("div");
    sig1.appendChild(U.el("div", { style: "border-bottom:1.5px solid #000; width:220px; height:1.4rem;" }));
    sig1.appendChild(U.el("div", { style: "font-size:0.75rem; margin-top:0.3rem; font-weight:600;" }, "Referring BHW / Health Worker"));
    sig1.appendChild(U.el("div", { style: "font-size:0.72rem; color:#4a655a;" }, API.getName() || "Barangay Health Worker"));
    sigFlex.appendChild(sig1);

    var sig2 = U.el("div");
    sig2.appendChild(U.el("div", { style: "border-bottom:1.5px solid #000; width:220px; height:1.4rem;" }));
    sig2.appendChild(U.el("div", { style: "font-size:0.75rem; margin-top:0.3rem; font-weight:600;" }, "Receiving RHU Doctor / Nurse"));
    sig2.appendChild(U.el("div", { style: "font-size:0.72rem; color:#4a655a;" }, "Rural Health Unit Mahinog"));
    sigFlex.appendChild(sig2);

    sigBlock.appendChild(sigFlex);
    slip.appendChild(sigBlock);

    var foot = U.el("div", { class: "referral-footer", style: "margin-top:1.1rem; border-top:1px dashed var(--line-strong); padding-top:0.45rem; display:flex; justify-content:space-between; font-size:0.72rem; color:#4a655a;" });
    foot.appendChild(U.el("span", null, "Generated: " + nowPht()));
    foot.appendChild(U.el("span", { style: "font-weight:700; color:#0b3d30;" }, "OFFICIAL RHU REFERRAL · RA 10173 AUDITED"));
    slip.appendChild(foot);

    body.appendChild(slip);
    card.appendChild(body);

    var mFoot = U.el("div", { class: "modal-footer" });
    var dismissBtn = U.el("button", { class: "btn btn-secondary", type: "button" }, "Close");
    var printBtn = U.el("button", { class: "btn btn-primary", type: "button" }, "Print / Save PDF");
    printBtn.onclick = function () {
      document.body.classList.add("printing-referral");
      var clearPrint = function () {
        document.body.classList.remove("printing-referral");
        window.removeEventListener("afterprint", clearPrint);
      };
      window.addEventListener("afterprint", clearPrint);
      window.print();
      setTimeout(clearPrint, 30000);
    };

    mFoot.appendChild(dismissBtn);
    mFoot.appendChild(printBtn);
    card.appendChild(mFoot);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    var closeDialog = U.openDialog(backdrop, closeBtn);
    var handleClose = function () {
      document.body.classList.remove("printing-referral");
      closeDialog();
    };
    closeBtn.onclick = handleClose;
    dismissBtn.onclick = handleClose;
  }

  async function initCitizenView() {
    if (!API.requireRole("bhw")) return;
    var statusNode = document.getElementById("status");
    var citizenId = currentCitizenId();
    if (!citizenId) {
      U.error(statusNode, bt("cvNoCitizenErr"));
      document.getElementById("record").hidden = true;
      return;
    }

    U.loading(statusNode, bt("cvLoadingRecord"));
    var data;
    try {
      data = await API.apiFetch(
        "/api/bhw/citizen/" + encodeURIComponent(citizenId) + "/health-logs"
      );
    } catch (error) {
      if (error.status === 403) {
        U.clear(statusNode);
        showConsentBlocked();
        onLangRefresh = showConsentBlocked;
        return;
      }
      U.error(statusNode, error.message);
      document.getElementById("record").hidden = true;
      return;
    }

    U.clear(statusNode);
    U.clear(document.getElementById("consentBlocked"));
    var record = document.getElementById("record");
    record.hidden = false;

    var citizen = data.citizen || {};
    var logs = data.logs || [];
    var consent = data.consent || {};
    var age = calculateAge(citizen.birthdate);
    var logsCount = logs.length;

    function renderCitizenDetails() {
      document.getElementById("pageTitle").textContent = citizen.full_name || bt("cvTitleFallback");
      var profileHeading = document.getElementById("profileHeading");
      if (profileHeading) profileHeading.textContent = citizen.full_name || bt("cvProfileHeading");

      var avatar = document.getElementById("patientAvatar");
      if (avatar) {
        var initials = (citizen.full_name || "Citizen")
          .split(" ")
          .map(function (n) { return n.charAt(0); })
          .filter(function (c) { return c && /[a-zA-Z]/.test(c); })
          .slice(0, 2)
          .join("")
          .toUpperCase() || "CR";
        avatar.textContent = initials;
      }

      var tagsNode = document.getElementById("patientTags");
      if (tagsNode) {
        U.clear(tagsNode);
        if (citizen.username) {
          tagsNode.appendChild(U.el("span", { class: "patient-tag" }, "ID: " + citizen.username));
        }
        if (citizen.gender) {
          var gText = citizen.gender.charAt(0).toUpperCase() + citizen.gender.slice(1);
          tagsNode.appendChild(U.el("span", { class: "patient-tag" }, gText));
        }
        if (age !== null) {
          tagsNode.appendChild(U.el("span", { class: "patient-tag" }, bt("cvYrsBorn", { age: age, date: citizen.birthdate || "—" })));
        } else if (citizen.birthdate) {
          tagsNode.appendChild(U.el("span", { class: "patient-tag" }, bt("cvBorn", { date: citizen.birthdate })));
        }
        tagsNode.appendChild(
          U.el("span", { class: "patient-tag patient-tag-highlight" }, logsCount === 1 ? bt("cvCheckinsOnFileSingle") : bt("cvCheckinsOnFilePlural", { n: logsCount }))
        );
      }

      var kv = document.getElementById("profileKv");
      U.clear(kv);
      function addPair(term, value, subtext) {
        var item = U.el("div", { class: "kv-item" });
        item.appendChild(U.el("dt", null, term));
        item.appendChild(U.el("dd", null, value || "—"));
        if (subtext) {
          item.appendChild(U.el("span", { class: "kv-sub" }, subtext));
        }
        kv.appendChild(item);
      }
      addPair(bt("cvProfileFullName"), citizen.full_name);
      addPair(bt("cvProfileUsername"), citizen.username, bt("cvProfileUsernameSub"));
      addPair(bt("cvProfileBirthdate"), citizen.birthdate, age !== null ? bt("cvYearsOld", { age: age }) : "");
      var formattedGender = citizen.gender ? (citizen.gender.charAt(0).toUpperCase() + citizen.gender.slice(1)) : "—";
      addPair(bt("cvProfileGender"), formattedGender, bt("cvProfileGenderSub"));
      addPair(
        bt("cvProfileVisits"),
        logsCount === 1 ? bt("cvVisitRecordedSingle") : bt("cvVisitRecordedPlural", { n: logsCount }),
        logsCount > 0 ? bt("cvLatestAge", { age: U.fmtAge(logs[0].timestamp) }) : bt("cvNoCheckinsYet")
      );
      addPair(bt("cvProfileAccess"), bt("cvAuthorized"), bt("cvConsentBadge"));

      var consentLine = document.getElementById("consentLine");
      if (consentLine) {
        consentLine.textContent = bt("cvConsentAuthLine", { dt: U.fmtDT(consent.timestamp) });
      }

      var countBadge = document.getElementById("readingsCountBadge");
      if (countBadge) {
        countBadge.textContent = logsCount === 1 ? bt("cvCheckinsOnRecordSingle") : bt("cvCheckinsOnRecordPlural", { n: logsCount });
      }

      var readings = document.getElementById("readings");
      U.clear(readings);
      readings.appendChild(readingsTable(logs));
    }

    renderCitizenDetails();

    try {
      await loadNotes(citizenId);
    } catch (error) {
      U.error(document.getElementById("notesArea"), error.message);
    }

    var chipsContainer = document.getElementById("noteChips");
    if (chipsContainer) {
      var chips = chipsContainer.querySelectorAll(".chip");
      chips.forEach(function (btn) {
        btn.onclick = function () {
          var val = btn.getAttribute("data-chip");
          var textarea = document.getElementById("noteText");
          if (textarea) {
            textarea.value = textarea.value ? (textarea.value + " " + val) : val;
            textarea.focus();
          }
        };
      });
    }

    var noteForm = document.getElementById("noteForm");
    var noteVisibleToggle = document.getElementById("noteVisibleToggle");
    var noteHint = document.getElementById("noteHint");
    function syncNoteHint() {
      if (!noteHint || !noteVisibleToggle) return;
      noteHint.textContent = noteVisibleToggle.checked
        ? bt("cvNoteHintDefault")
        : bt("cvNoteHintStaffOnly");
    }
    onLangRefresh = function () {
      renderCitizenDetails();
      renderNotes(activeNotesList, citizenId);
      syncNoteHint();
    };
    if (noteVisibleToggle) {
      noteVisibleToggle.addEventListener("change", syncNoteHint);
      syncNoteHint();
    }

    noteForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var errorNode = document.getElementById("noteError");
      var feedback = document.getElementById("noteFeedback");
      errorNode.textContent = "";
      feedback.textContent = "";
      var text = document.getElementById("noteText").value.trim();
      if (!text) {
        errorNode.textContent = "Write a note before saving.";
        return;
      }
      var visibleToCitizen = noteVisibleToggle ? noteVisibleToggle.checked : true;
      var submit = document.getElementById("noteSubmit");
      setBusy(submit, true, "Saving…");
      try {
        var result = await API.apiFetch(
          "/api/bhw/citizen/" + encodeURIComponent(citizenId) + "/notes",
          {
            method: "POST",
            body: { note: text, visible_to_citizen: visibleToCitizen },
          }
        );
        document.getElementById("noteText").value = "";
        if (noteVisibleToggle) {
          noteVisibleToggle.checked = true;
          syncNoteHint();
        }
        renderNotes(result.notes || [], citizenId);
        feedback.textContent = visibleToCitizen
          ? bt("noteSavedShared")
          : bt("noteSavedStaffOnly");
        U.toast(bt("noteSavedToast"), "success");
      } catch (error) {
        errorNode.textContent = error.message;
        U.toast(error.message, "error");
      } finally {
        setBusy(submit, false);
      }
    });

    document.getElementById("referBtn").addEventListener("click", async function () {
      var citizenId = currentCitizenId();
      if (!citizenId) return;

      var backdrop = U.el("div", { class: "modal-backdrop" });
      var card = U.el("div", { class: "modal-card" });

      var header = U.el("div", { class: "modal-header" });
      header.appendChild(U.el("h3", null, bt("referModalTitle")));
      var closeBtn = U.el("button", { class: "btn btn-ghost", type: "button", "aria-label": "Close" }, "✕");
      header.appendChild(closeBtn);
      card.appendChild(header);

      var body = U.el("div", { class: "modal-body" });
      body.appendChild(U.el("label", { style: "display:block; font-weight:600; margin-bottom:0.35rem;" }, bt("referReasonLabel")));
      var reason = U.el("textarea", { name: "reason", required: true, style: "width:100%; min-height:90px; padding:0.55rem 0.65rem; font:inherit; font-size:0.95rem; border:1px solid #b9cdc6; border-radius:8px;" });
      body.appendChild(reason);
      var reasonErr = U.el("p", { style: "color:#a5271d; font-size:0.85rem; margin-top:0.35rem; display:none;" }, bt("referReasonErr"));
      body.appendChild(reasonErr);
      card.appendChild(body);

      var footer = U.el("div", { class: "modal-footer" });
      var cancelBtn = U.el("button", { class: "btn btn-secondary", type: "button" }, bt("btnCancel"));
      var referBtnEl = U.el("button", { class: "btn btn-primary", type: "button" }, bt("btnRefer"));
      footer.appendChild(cancelBtn);
      footer.appendChild(referBtnEl);
      card.appendChild(footer);

      backdrop.appendChild(card);
      document.body.appendChild(backdrop);

      var closeDialog = U.openDialog(backdrop, reason);
      closeBtn.onclick = closeDialog;
      cancelBtn.onclick = closeDialog;

      referBtnEl.onclick = async function () {
        var value = reason.value.trim();
        if (!value) {
          reasonErr.style.display = "block";
          reason.focus();
          return;
        }
        reasonErr.style.display = "none";
        closeDialog();
        setBusy(document.getElementById("referBtn"), true, "Referring…");
        try {
          await API.apiFetch(
            "/api/bhw/citizen/" + encodeURIComponent(citizenId) + "/refer",
            { method: "POST", body: { note: value } }
          );
          await loadNotes(citizenId);
          var notice = U.el("p", { class: "notice", id: "referFeedback", role: "status" },
            "Referral to the Rural Health Unit recorded.");
          var consentLine = document.getElementById("consentLine");
          if (consentLine) consentLine.after(notice);
          U.toast("Referral to RHU submitted", "success");
          var logs = data.logs || [];
          var latest = logs.length ? logs[0] : null;
          showReferralSlipModal(citizen, latest, value);
        } catch (error) {
          U.error(statusNode, error.message);
          U.toast(error.message, "error");
        } finally {
          setBusy(document.getElementById("referBtn"), false);
        }
      };
    });

    var printReferralBtn = document.getElementById("printReferralBtn");
    if (printReferralBtn) {
      printReferralBtn.addEventListener("click", function () {
        var logs = data.logs || [];
        var latest = logs.length ? logs[0] : null;
        showReferralSlipModal(citizen, latest, "");
      });
    }

    var resetPwBtn = document.getElementById("resetCitizenPwBtn");
    if (resetPwBtn) {
      resetPwBtn.addEventListener("click", function () {
        var citizenId = currentCitizenId();
        if (!citizenId) return;

        var backdrop = U.el("div", { class: "modal-backdrop" });
        var card = U.el("div", { class: "modal-card", style: "max-width: 480px; width: 100%;" });

        var header = U.el("div", { class: "modal-header" });
        header.appendChild(U.el("h3", null, "Reset Citizen Password"));
        var closeBtn = U.el("button", { class: "btn btn-ghost", type: "button", "aria-label": "Close" }, "✕");
        header.appendChild(closeBtn);
        card.appendChild(header);

        var body = U.el("div", { class: "modal-body" });
        var citizenName = (citizen && citizen.full_name) ? citizen.full_name : "this citizen";
        body.appendChild(U.el("p", { style: "margin-bottom: 0.85rem;" }, "Issue a temporary password for " + citizenName + ". Ensure you have verified their resident or government ID in person."));
        body.appendChild(U.el("label", { style: "display:block; font-weight:600; font-size:0.88rem; margin-bottom:0.35rem;" }, "Custom temporary password (optional, min 8 chars):"));
        var pwInput = U.el("input", { type: "text", placeholder: "Leave blank for auto-generated password", style: "width:100%; padding:0.5rem 0.65rem; border:1px solid #b9cdc6; border-radius:8px; font-size:0.92rem;" });
        body.appendChild(pwInput);
        card.appendChild(body);

        var footer = U.el("div", { class: "modal-footer" });
        var cancelBtn = U.el("button", { class: "btn btn-secondary", type: "button" }, "Cancel");
        var confirmBtn = U.el("button", { class: "btn btn-primary", type: "button" }, "Reset Password");
        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);
        card.appendChild(footer);

        backdrop.appendChild(card);
        document.body.appendChild(backdrop);

        var closeDialog = U.openDialog(backdrop, confirmBtn);
        closeBtn.onclick = closeDialog;
        cancelBtn.onclick = closeDialog;

        confirmBtn.onclick = async function () {
          var customVal = pwInput.value.trim();
          if (customVal && customVal.length < 8) {
            alert("Custom password must be at least 8 characters long.");
            pwInput.focus();
            return;
          }
          setBusy(confirmBtn, true, "Resetting…");
          try {
            var res = await API.apiFetch("/api/bhw/citizen/" + encodeURIComponent(citizenId) + "/reset-password", {
              method: "POST",
              body: customVal ? { password: customVal } : {},
            });
            closeDialog();

            var resBackdrop = U.el("div", { class: "modal-backdrop" });
            var resCard = U.el("div", { class: "modal-card", style: "max-width: 480px; width: 100%; text-align:center;" });
            var resHeader = U.el("div", { class: "modal-header" });
            resHeader.appendChild(U.el("h3", null, "New Temporary Password"));
            var resClose = U.el("button", { class: "btn btn-ghost", type: "button", "aria-label": "Close" }, "✕");
            resHeader.appendChild(resClose);
            resCard.appendChild(resHeader);

            var resBody = U.el("div", { class: "modal-body", style: "padding: 1.5rem 1rem;" });
            var p1 = U.el("p", { style: "margin-bottom:0.75rem;" });
            p1.appendChild(document.createTextNode("Temporary password generated for "));
            p1.appendChild(U.el("strong", null, citizenName));
            p1.appendChild(document.createTextNode(":"));
            resBody.appendChild(p1);
            var codeBox = U.el("div", { style: "font-size:1.35rem; font-family:monospace; font-weight:700; color:#0f6b53; background:#eaf4f0; padding:0.75rem; border-radius:8px; border:1px solid #b0c4bc; margin-bottom:1rem; user-select:all;" }, res.temporary_password);
            resBody.appendChild(codeBox);
            resBody.appendChild(U.el("p", { style: "font-size:0.85rem; color:var(--ink-soft);" }, "Please write this down or hand it to the citizen. They should sign in and update their password on their profile."));
            resCard.appendChild(resBody);

            var resFooter = U.el("div", { class: "modal-footer", style: "justify-content:center;" });
            var doneBtn = U.el("button", { class: "btn btn-primary", type: "button" }, "Done");
            resFooter.appendChild(doneBtn);
            resCard.appendChild(resFooter);

            resBackdrop.appendChild(resCard);
            document.body.appendChild(resBackdrop);

            var closeResDialog = U.openDialog(resBackdrop, doneBtn);
            resClose.onclick = closeResDialog;
            doneBtn.onclick = closeResDialog;

            U.toast("Citizen password reset successfully", "success");
          } catch (err) {
            alert("Error: " + (err.message || "Failed to reset password"));
            setBusy(confirmBtn, false);
          }
        };
      });
    }
  }

  /* ---------------- audit trail ---------------- */

  var AUDIT_ACTION_KEY = {
    view_health_data: { key: "auditActViewHealth", cls: "badge-ok" },
    view_notes: { key: "auditActViewNotes", cls: "badge-admin" },
    add_note: { key: "auditActAddNote", cls: "badge-ok" },
    update_note_visibility: { key: "auditActUpdateVis", cls: "badge-info" },
    refer_to_rhu: { key: "auditActRefer", cls: "badge-warn" },
    unauthorized_access: { key: "auditActUnauthorized", cls: "badge-danger" },
    export_report: { key: "auditActExport", cls: "badge-info" },
    staff_login: { key: "auditActStaffLogin", cls: "badge-admin" },
    self_password_reset: { key: "auditActSelfPw", cls: "badge-info" },
    staff_password_reset: { key: "auditActStaffPw", cls: "badge-warn" },
  };

  var currentAuditRows = [];

  function renderActionBadge(action, status) {
    if (status === "blocked" || action === "unauthorized_access") {
      return U.el("span", { class: "badge badge-danger" }, bt("auditActUnauthorized"));
    }
    var meta = AUDIT_ACTION_KEY[action];
    if (meta) {
      return U.el("span", { class: "badge " + meta.cls }, bt(meta.key));
    }
    return U.el("span", { class: "badge badge-no" }, (action || "—").replace(/_/g, " "));
  }

  function renderStatusBadge(status) {
    if (status === "blocked") {
      return U.el("span", { class: "badge badge-danger" }, bt("statusBlockedBadge"));
    }
    return U.el("span", { class: "badge badge-ok" }, bt("statusAuthorizedBadge"));
  }

  function renderAuditMetrics(metrics) {
    if (!metrics) return;
    var elTotal = document.getElementById("kpiTotal");
    var elViews = document.getElementById("kpiViews");
    var elInterventions = document.getElementById("kpiInterventions");
    var elBlocked = document.getElementById("kpiBlocked");
    var cardBlocked = document.getElementById("kpiBlockedCard");

    if (elTotal) elTotal.textContent = metrics.total !== undefined ? metrics.total : "—";
    if (elViews) elViews.textContent = metrics.views !== undefined ? metrics.views : "—";
    if (elInterventions) elInterventions.textContent = metrics.interventions !== undefined ? metrics.interventions : "—";
    if (elBlocked) {
      elBlocked.textContent = metrics.blocked !== undefined ? metrics.blocked : "0";
      if (cardBlocked) {
        cardBlocked.classList.toggle("has-alerts", (metrics.blocked || 0) > 0);
      }
    }
  }

  function showAuditDetailsModal(entry) {
    var backdrop = U.el("div", { class: "modal-backdrop" });
    var card = U.el("div", {
      class: "modal-card",
      style: "max-width: 600px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);",
    });

    var isBlocked = entry.status === "blocked" || entry.action === "unauthorized_access";

    var header = U.el("div", {
      class: "modal-header",
      style: isBlocked ? "background: #7f1d1d;" : "",
    });
    var headerTitle = U.el("div");
    headerTitle.appendChild(
      U.el("h3", { style: "margin:0; font-size:1.15rem; color:#fff;" }, "Audit Log Inspector #" + (entry.id || "—"))
    );
    headerTitle.appendChild(
      U.el("small", { style: "color: rgba(255,255,255,0.85); font-weight: 500;" }, "RA 10173 Compliance Verification")
    );
    header.appendChild(headerTitle);

    var closeBtn = U.el(
      "button",
      { class: "btn btn-ghost", type: "button", "aria-label": "Close" },
      "✕"
    );
    header.appendChild(closeBtn);
    card.appendChild(header);

    var body = U.el("div", {
      class: "modal-body",
      style: "padding: 1.25rem; font-size: 0.92rem; max-height: 70vh; overflow-y: auto;",
    });

    var dl = U.el("dl", { class: "audit-detail-list" });
    function addDetailItem(label, valueNode) {
      var row = U.el("div", { class: "audit-detail-item" });
      row.appendChild(U.el("dt", null, label));
      var dd = U.el("dd");
      if (typeof valueNode === "string") dd.textContent = valueNode;
      else dd.appendChild(valueNode);
      row.appendChild(dd);
      dl.appendChild(row);
    }

    addDetailItem(
      "Event Status",
      U.el(
        "span",
        { class: isBlocked ? "badge badge-danger" : "badge badge-ok" },
        isBlocked ? "Blocked / Security Flag" : "Authorized / Verified"
      )
    );
    addDetailItem("Action Performed", U.el("strong", null, (entry.action || "—").replace(/_/g, " ")));

    var actorFrag = document.createDocumentFragment();
    actorFrag.appendChild(document.createTextNode((entry.bhw_name || "—") + " "));
    actorFrag.appendChild(U.el("span", { style: "color:var(--ink-soft); font-size:0.8rem;" }, "(ID: " + (entry.bhw || "—") + ")"));
    addDetailItem("Health Worker / Actor", actorFrag);

    var citFrag = document.createDocumentFragment();
    citFrag.appendChild(document.createTextNode(entry.citizen_name || "All Citizens / System"));
    if (entry.citizen) {
      citFrag.appendChild(document.createTextNode(" "));
      citFrag.appendChild(U.el("span", { style: "color:var(--ink-soft); font-size:0.8rem;" }, "(ID: " + entry.citizen + ")"));
    }
    addDetailItem("Citizen Subject", citFrag);

    var phtFrag = document.createDocumentFragment();
    phtFrag.appendChild(document.createTextNode(U.fmtDT(entry.time) + " "));
    phtFrag.appendChild(U.el("span", { style: "color:var(--ink-soft); font-size:0.8rem;" }, "(" + U.fmtAge(entry.time) + ")"));
    addDetailItem("Timestamp (PHT)", phtFrag);

    addDetailItem("Timestamp (UTC)", U.el("code", null, (entry.time || "—") + "Z"));
    addDetailItem("Event Details", entry.details || "Standard operational record access");
    addDetailItem("Origin IP Address", U.el("code", null, entry.ip || "—"));
    addDetailItem(
      "Client User Agent",
      U.el("span", { style: "font-size:0.82rem; word-break:break-all; color:var(--ink-soft); font-family:monospace;" }, entry.user_agent || "Standard Browser Client")
    );

    body.appendChild(dl);

    var legalBox = U.el("div", {
      style:
        "margin-top:1rem; padding:0.75rem 1rem; border-radius:8px; background:var(--green-50, #f0fdf4); border:1px solid #bbf7d0; font-size:0.82rem; color:#14532d; display:flex; align-items:center; gap:0.5rem;",
    });
    legalBox.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
      "<span>Logged in accordance with the <strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong>. Record is immutable and append-only.</span>";
    body.appendChild(legalBox);
    card.appendChild(body);

    var footer = U.el("div", {
      class: "modal-footer",
      style: "display:flex; justify-content:space-between; align-items:center;",
    });
    if (entry.citizen) {
      var viewCitizenLink = U.el(
        "a",
        {
          href: "/bhw/citizen-view.html?id=" + entry.citizen,
          class: "btn btn-secondary",
          style: "font-size:0.88rem;",
        },
        "Open Citizen Record →"
      );
      footer.appendChild(viewCitizenLink);
    } else {
      footer.appendChild(U.el("span"));
    }

    var dismissBtn = U.el("button", { class: "btn btn-primary", type: "button" }, "Done");
    footer.appendChild(dismissBtn);
    card.appendChild(footer);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    function close() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape" || e.key === "Esc") close();
    }

    closeBtn.onclick = close;
    dismissBtn.onclick = close;
    backdrop.onclick = function (e) {
      if (e.target === backdrop) close();
    };
    document.addEventListener("keydown", onKey);
    dismissBtn.focus();
  }

  function exportAuditToCsv(rows) {
    if (!rows || !rows.length) {
      U.toast("No audit records to export", "info");
      return;
    }
    var headers = [
      "Log ID",
      "Timestamp (UTC)",
      "Timestamp (PHT)",
      "Health Worker",
      "Citizen",
      "Action",
      "Status",
      "Details",
      "IP Address",
    ];
    function sanitizeCell(val) {
      var str = String(val == null ? "" : val);
      if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
      return '"' + str.replace(/"/g, '""') + '"';
    }
    var csvLines = [headers.join(",")];
    rows.forEach(function (r) {
      var line = [
        r.id || "",
        r.time || "",
        sanitizeCell(U.fmtDT(r.time)),
        sanitizeCell(r.bhw_name),
        sanitizeCell(r.citizen_name),
        sanitizeCell(r.action),
        sanitizeCell(r.status || "success"),
        sanitizeCell(r.details),
        sanitizeCell(r.ip),
      ];
      csvLines.push(line.join(","));
    });
    var blob = new Blob(["\uFEFF" + csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "audit-trail-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    U.toast("Audit trail exported as CSV", "success");
  }

  function renderAudit(rows) {
    currentAuditRows = rows || [];
    var results = document.getElementById("results");
    U.clear(results);
    if (!rows.length) {
      setEmptyRow(results, bt("auditEmpty"));
      return;
    }
    var tableWrap = U.el("div", { class: "table-wrap" });
    var table = U.el("table", { class: "table-clickable audit-table" });
    var thead = U.el("thead");
    var headRow = U.el("tr");
    [
      bt("auditColTime"),
      bt("auditColBhw"),
      bt("auditColCitizen"),
      bt("auditColAction"),
      bt("auditColStatus"),
      bt("auditColDetails"),
      bt("auditColIp"),
    ].forEach(function (label) {
      headRow.appendChild(U.el("th", { scope: "col" }, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    var rowsFrag = document.createDocumentFragment();
    rows.forEach(function (entry) {
      var isBlocked = entry.status === "blocked" || entry.action === "unauthorized_access";
      var row = U.el("tr", {
        class: "audit-row" + (isBlocked ? " audit-row-blocked" : ""),
        tabindex: "0",
        role: "button",
        "aria-label": "Inspect audit record #" + entry.id,
      });
      row.title = "Click to inspect complete audit details & compliance trace";

      var tdTime = U.el(
        "td",
        {
          class: "cell-time nowrap",
          style: "font-weight:600; text-align:left;",
        },
        U.fmtDT(entry.time)
      );
      tdTime.setAttribute("data-sort", entry.time || "");
      row.appendChild(tdTime);

      row.appendChild(U.el("td", { style: "font-weight:500;" }, entry.bhw_name));

      var citizenColor = entry.citizen ? "var(--green-900)" : "var(--ink-soft)";
      row.appendChild(
        U.el("td", { style: "font-weight:600; color:" + citizenColor + ";" }, entry.citizen_name)
      );

      var actionCell = U.el("td");
      actionCell.appendChild(renderActionBadge(entry.action, entry.status));
      row.appendChild(actionCell);

      var statusCell = U.el("td");
      statusCell.appendChild(renderStatusBadge(entry.status));
      row.appendChild(statusCell);

      var detailsText = entry.details || "—";
      var tdDetails = U.el(
        "td",
        {
          style:
            "max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.86rem; color:var(--ink-soft);",
          title: detailsText,
        },
        detailsText
      );
      row.appendChild(tdDetails);

      row.appendChild(
        U.el(
          "td",
          { style: "color:var(--ink-soft); font-size:0.85rem; font-family:monospace;" },
          entry.ip || "—"
        )
      );

      row.addEventListener("click", function () {
        showAuditDetailsModal(entry);
      });
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          showAuditDetailsModal(entry);
        }
      });

      rowsFrag.appendChild(row);
    });
    tbody.appendChild(rowsFrag);
    table.appendChild(tbody);
    U.makeSortable(table);
    tableWrap.appendChild(table);
    results.appendChild(tableWrap);
    U.addScrollCue(tableWrap);
  }

  async function loadAudit() {
    var statusNode = document.getElementById("status");
    var params = new URLSearchParams();
    var from = fieldValue("fromDate");
    var to = fieldValue("toDate");
    var bhw = fieldValue("bhwName");
    var citizen = fieldValue("citizenName");
    var action = fieldValue("actionType");
    var status = fieldValue("statusFilter");
    U.remember("bhw_audit_filters", {
      from: from,
      to: to,
      bhw: bhw,
      citizen: citizen,
      action: action,
      status: status,
    });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (bhw) params.set("bhw", bhw);
    if (citizen) params.set("citizen", citizen);
    if (action) params.set("action", action);
    if (status) params.set("status", status);

    U.loading(statusNode, bt("auditLoading"));
    var results = document.getElementById("results");
    U.clear(results);
    results.appendChild(
      U.tableSkeleton(
        [
          bt("auditColTime"),
          bt("auditColBhw"),
          bt("auditColCitizen"),
          bt("auditColAction"),
          bt("auditColStatus"),
          bt("auditColDetails"),
          bt("auditColIp"),
        ],
        4
      )
    );
    try {
      var data = await API.apiFetch("/api/bhw/audit-trail?" + params.toString());
      U.clear(statusNode);
      renderAudit(data.audit || []);
      renderAuditMetrics(data.metrics);
    } catch (error) {
      U.clear(document.getElementById("results"));
      U.error(statusNode, error.message, loadAudit);
    }
  }

  function initAudit() {
    if (!API.requireRole("bhw")) return;
    var form = document.getElementById("filterForm");
    var remembered = U.remember("bhw_audit_filters");
    if (remembered) {
      if (remembered.from) document.getElementById("fromDate").value = remembered.from;
      if (remembered.to) document.getElementById("toDate").value = remembered.to;
      if (remembered.bhw) document.getElementById("bhwName").value = remembered.bhw;
      if (remembered.citizen) document.getElementById("citizenName").value = remembered.citizen;
      if (remembered.action) document.getElementById("actionType").value = remembered.action;
      if (remembered.status && document.getElementById("statusFilter")) {
        document.getElementById("statusFilter").value = remembered.status;
      }
    }
    bindDatePresets(form, "fromDate", "toDate", loadAudit);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      loadAudit();
    });
    document.getElementById("clearBtn").addEventListener("click", function () {
      form.reset();
      U.remember("bhw_audit_filters", null);
      form.querySelectorAll(".date-preset-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      loadAudit();
    });

    var exportCsvBtn = document.getElementById("exportAuditCsvBtn");
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", function () {
        exportAuditToCsv(currentAuditRows);
      });
    }

    var printBtn = document.getElementById("printAuditBtn");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        window.print();
      });
    }

    loadAudit();
    onLangRefresh = function () {
      renderAudit(currentAuditRows);
    };

    // Live sync for audit trail
    API.initRealtimeSync({
      onReading: function () {
        loadAudit();
      },
    });
  }

  /* ---------------- reports ---------------- */

  function reportPath() {
    var type = document.getElementById("reportType").value;
    var from = fieldValue("fromDate");
    var to = fieldValue("toDate");
    var params = new URLSearchParams();
    params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return { type: type, path: "/api/bhw/reports?" + params.toString() };
  }

  function validateRange(statusNode) {
    var from = fieldValue("fromDate");
    var to = fieldValue("toDate");
    if (from && to && from > to) {
      U.error(statusNode, bt("repRangeErr"));
      return false;
    }
    return true;
  }

  function initReports() {
    if (!API.requireRole("bhw")) return;
    var form = document.getElementById("reportForm");
    bindDatePresets(form, "fromDate", "toDate", null);
    var statusNode = document.getElementById("status");

    document.getElementById("csvBtn").addEventListener("click", async function () {
      if (!validateRange(statusNode)) return;
      var target = reportPath();
      U.loading(statusNode, bt("repPreparingCsv"));
      try {
        var response = await API.apiFetchRaw(target.path);
        var blob = await response.blob();
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = target.type + "_report.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1500);
        showNote(statusNode, "Download started: " + target.type + "_report.csv");
      } catch (error) {
        U.error(statusNode, error.message);
      }
    });

    function showReportModal(reportType, reportHtml) {
      var backdrop = U.el("div", { class: "modal-backdrop" });
      var card = U.el("div", { class: "modal-card" });

      var header = U.el("div", { class: "modal-header" });
      header.appendChild(U.el("h3", null, "Printable " + reportType.toUpperCase() + " Report Preview"));
      var closeBtn = U.el("button", { class: "btn btn-ghost", type: "button", "aria-label": "Close" }, "✕");
      header.appendChild(closeBtn);
      card.appendChild(header);

      var body = U.el("div", {
        class: "modal-body",
        style: "padding:0; height:min(500px, 62vh); min-height:260px;",
      });
      // srcdoc + sandbox instead of document.write(): the preview renders in
      // an isolated frame (no popups/top-navigation/forms), gets a title for
      // screen readers, and a failed render can no longer fail silently.
      var iframe = U.el("iframe", {
        title: reportType.charAt(0).toUpperCase() + reportType.slice(1) + " report preview",
        sandbox: "allow-scripts allow-modals allow-same-origin",
        style: "width:100%; height:100%; border:none; background:#ffffff;",
      });
      body.appendChild(iframe);
      card.appendChild(body);

      // Dedicated node for failure notes (showNote clears its target, so it
      // must never be the iframe's container).
      var noteNode = U.el("div", { style: "padding:0 1.25rem;" });
      card.appendChild(noteNode);

      var footer = U.el("div", { class: "modal-footer" });
      var dismiss = U.el("button", { class: "btn btn-secondary", type: "button" }, bt("repModalClose"));
      var print = U.el("button", { class: "btn btn-primary", type: "button" }, bt("repModalPrint"));
      print.onclick = function () {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }
        } catch (printError) {
          // Sandboxed frames can refuse print(); tell the user instead of
          // failing silently — the report has its own Print button.
          showNote(
            noteNode,
            "The browser blocked printing from the preview. Use the Print button inside the report.",
            true
          );
        }
      };
      footer.appendChild(dismiss);
      footer.appendChild(print);
      card.appendChild(footer);

      backdrop.appendChild(card);
      document.body.appendChild(backdrop);

      iframe.srcdoc = reportHtml;

      // Accessible dialog: Escape / backdrop click close, focus restored.
      var closeDialog = U.openDialog(backdrop, closeBtn);
      closeBtn.onclick = closeDialog;
      dismiss.onclick = closeDialog;
    }

    document.getElementById("printBtn").addEventListener("click", async function () {
      if (!validateRange(statusNode)) return;
      var target = reportPath();
      U.loading(statusNode, bt("repPreparingPrint"));
      try {
        var response = await API.apiFetchRaw(target.path + "&format=print");
        var reportHtml = await response.text();
        U.clearStatus(statusNode);
        showReportModal(target.type, reportHtml);
      } catch (error) {
        U.error(statusNode, error.message);
      }
    });
  }

  /* ---------------- statutory privacy oath (RA 10173) ---------------- */

  function showStaffPenaltiesModal(onAcknowledged) {
    if (document.getElementById("staffPenaltiesModalBackdrop")) return;

    var backdrop = U.el("div", {
      id: "staffPenaltiesModalBackdrop",
      class: "modal-backdrop",
    });
    var card = U.el("div", {
      class: "modal-card staff-penalties-modal",
      style: "max-width: 720px;",
    });

    var header = U.el("div", {
      class: "modal-header",
      style: "background: var(--red-700, #b91c1c);",
    });
    var headerLeft = U.el("div");
    var warningBadge = U.el(
      "span",
      {
        class: "badge",
        style:
          "display:inline-block; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; background:#fee2e2; color:#991b1b; margin-bottom:0.25rem;",
      },
      "Statutory Compliance Notice · Republic Act No. 10173"
    );
    headerLeft.appendChild(warningBadge);
    headerLeft.appendChild(
      U.el(
        "h3",
        { style: "margin:0; font-size:1.15rem; color:#fff;" },
        "Health Worker Fiduciary Duty & Penalties Undertaking"
      )
    );
    header.appendChild(headerLeft);
    card.appendChild(header);

    var body = U.el("div", {
      class: "modal-body",
      style: "font-size:0.92rem; line-height:1.55;",
    });

    var intro = U.el("p", { style: "margin-top:0; color:var(--ink-base);" });
    intro.innerHTML =
      "As an authorized <strong>Barangay Health Worker or Clinic Administrator</strong>, " +
      "you have access to <strong>Sensitive Personal Information (SPI)</strong> under Section 3(l) of " +
      "<strong>Republic Act No. 10173 (Philippine Data Privacy Act of 2012)</strong>. " +
      "You are bound by strict legal, ethical, and administrative fiduciary duties.";
    body.appendChild(intro);

    var dutiesBox = U.el("div", {
      style:
        "background:var(--sand-050, #fcfbf9); border:1px solid var(--line); border-radius:6px; padding:0.85rem 1rem; margin-bottom:1rem;",
    });
    dutiesBox.appendChild(
      U.el(
        "h4",
        {
          style:
            "margin:0 0 0.45rem 0; font-size:0.9rem; font-weight:700; color:var(--green-900);",
        },
        "Mandatory Confidentiality & Fiduciary Duties"
      )
    );
    var dutiesList = U.el("ul", {
      style: "margin:0; padding-left:1.2rem; font-size:0.86rem; color:var(--ink-soft);",
    });
    dutiesList.appendChild(
      U.el(
        "li",
        null,
        "Consent-Gated Access: You may only review vitals and clinical notes of residents who have explicitly granted consent."
      )
    );
    dutiesList.appendChild(
      U.el(
        "li",
        null,
        "Strict Non-Disclosure: Do not disclose, discuss, or forward resident records to unauthorized persons, family members, or third parties."
      )
    );
    dutiesList.appendChild(
      U.el(
        "li",
        null,
        "No Unauthorized Copying: Taking phone photos, unsanctioned screenshots, or printing confidential patient files without clinical authorization is strictly prohibited."
      )
    );
    dutiesList.appendChild(
      U.el(
        "li",
        null,
        "Full Auditability: Every citizen lookup, note addition, password reset, and report export is permanently recorded with your name, real IP address, and timestamp."
      )
    );
    dutiesBox.appendChild(dutiesList);
    body.appendChild(dutiesBox);

    var penaltyBox = U.el("div", {
      class: "statutory-penalties-callout",
      style:
        "background:#fff5f5; border:1.5px solid #f87171; border-radius:6px; padding:0.85rem 1rem; margin-bottom:1rem;",
    });
    penaltyBox.appendChild(
      U.el(
        "h4",
        {
          style:
            "margin:0 0 0.45rem 0; font-size:0.9rem; font-weight:700; color:#991b1b; display:flex; align-items:center; gap:0.4rem;",
        },
        "⚠️ Statutory Criminal Liabilities & Sanctions (RA 10173 Chapter VIII)"
      )
    );

    var penaltyList = U.el("ul", {
      style: "margin:0; padding-left:1.2rem; font-size:0.84rem; color:#7f1d1d;",
    });
    penaltyList.appendChild(
      U.el(
        "li",
        null,
        "Section 25 (Unauthorized Processing of SPI): Imprisonment of 3 to 6 years and fine of ₱500,000 to ₱4,000,000."
      )
    );
    penaltyList.appendChild(
      U.el(
        "li",
        null,
        "Section 26 (Accessing Due to Negligence): Imprisonment of 2 to 4 years and fine of ₱500,000 to ₱2,000,000."
      )
    );
    penaltyList.appendChild(
      U.el(
        "li",
        null,
        "Section 31 & 32 (Malicious or Unauthorized Disclosure): Imprisonment of 1 to 5 years and fine of ₱500,000 to ₱1,000,000, plus immediate administrative termination and permanent disqualification from public office."
      )
    );
    penaltyBox.appendChild(penaltyList);
    body.appendChild(penaltyBox);

    var oathP = U.el("p", {
      style:
        "font-size:0.82rem; color:var(--ink-muted); margin:0; line-height:1.4;",
    });
    oathP.innerHTML =
      "By proceeding, you attest that you understand these statutory obligations and penalties. " +
      "Your acknowledgment will be timestamped and recorded in the audit trail. Declining will sign you out.";
    body.appendChild(oathP);

    card.appendChild(body);

    var mFoot = U.el("div", {
      class: "modal-footer",
      style: "display:flex; justify-content:space-between; align-items:center;",
    });
    var declineBtn = U.el(
      "button",
      {
        class: "btn btn-secondary",
        type: "button",
        style: "color:var(--red-700, #b91c1c);",
      },
      "Decline & Log Out"
    );
    var acceptBtn = U.el(
      "button",
      { class: "btn btn-primary", type: "button" },
      "I Acknowledge & Agree to Comply"
    );
    mFoot.appendChild(declineBtn);
    mFoot.appendChild(acceptBtn);
    card.appendChild(mFoot);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    var closeDialog = U.openDialog(backdrop, acceptBtn, { persistent: true });

    function doDecline() {
      closeDialog();
      API.logout();
    }

    declineBtn.onclick = doDecline;

    // Enforce logout if closed without acknowledging
    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        if (!document.body.contains(backdrop)) {
          observer.disconnect();
          if (API.getPrivacyAcknowledged() !== true) {
            API.logout();
          }
        }
      });
      observer.observe(document.body, { childList: true });
    }

    acceptBtn.onclick = async function () {
      acceptBtn.disabled = true;
      declineBtn.disabled = true;
      try {
        await API.apiFetch("/api/bhw/acknowledge-oath", { method: "POST" });
        API.setPrivacyAcknowledged(true);
        closeDialog();
        if (typeof onAcknowledged === "function") {
          onAcknowledged();
        }
        U.toast(
          "Statutory undertaking acknowledged. Clinic operations unlocked.",
          "success"
        );
      } catch (err) {
        acceptBtn.disabled = false;
        declineBtn.disabled = false;
        U.toast("Failed to record oath: " + err.message, "error");
      }
    };
  }

  async function checkStaffPrivacyOath(callback) {
    if (!API.getToken()) return;
    if (API.getPrivacyAcknowledged() === true) {
      if (typeof callback === "function") callback();
      return;
    }
    try {
      var me = await API.apiFetch("/api/me");
      if (me && me.privacy_acknowledged) {
        API.setPrivacyAcknowledged(true);
        if (typeof callback === "function") callback();
        return;
      }
    } catch (_) {
      return;
    }
    showStaffPenaltiesModal(callback);
  }

  /* ---------------- router ---------------- */

  document.addEventListener("DOMContentLoaded", function () {
    // Administrator badge next to the signed-in name. The backend gives the
    // admin role identical permissions to a BHW, so the board is shared —
    // the badge is the only visible difference. Guarded: pages without a
    // #whoami (login) simply skip it.
    if (API.getRole() === "admin") {
      var whoami = document.getElementById("whoami");
      if (whoami && !document.querySelector(".badge-admin")) {
        whoami.insertAdjacentElement(
          "afterend",
          U.el("span", { class: "badge badge-admin" }, "Administrator")
        );
      }
    }

    var page = document.body.getAttribute("data-page");
    if (page === "bhw-login") {
      bindBhwLangDropdowns();
      initBhwLogin();
      return;
    }

    checkStaffPrivacyOath();

    if (page === "bhw-dashboard") initDashboard();
    else if (page === "bhw-search") initSearch();
    else if (page === "bhw-citizen-view") initCitizenView();
    else if (page === "bhw-audit") initAudit();
    else if (page === "bhw-reports") initReports();

    bindBhwLangDropdowns();
  });
})();
