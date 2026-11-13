/* Citizen portal behaviour (login, register, dashboard, history, consent,
 * profile). All API calls go through API.apiFetch / API.apiFetchRaw. */
(function () {
  "use strict";

  var U = API.UI;
  var charts = {};
  var sparkCharts = [];

  /* Chart.js plugin that draws a horizontal fever threshold line at 37.9 °C. */
  var feverThresholdPlugin = {
    id: "feverThreshold",
    afterDraw: function (chart) {
      var ctx = chart.ctx;
      var yAxis = chart.scales.y;
      if (!yAxis) return;
      var y = yAxis.getPixelForValue(37.9);
      if (y === null || y === undefined) return;
      ctx.save();
      ctx.strokeStyle = "#a5271d";
      ctx.lineDash = [6, 4];
      ctx.lineWidth = 1.5;
      ctx.font = "11px var(--font, sans-serif)";
      ctx.fillStyle = "#a5271d";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.beginPath();
      ctx.moveTo(yAxis.left, y);
      ctx.lineTo(yAxis.right, y);
      ctx.stroke();
      ctx.fillText(t("feverThresholdLabel"), yAxis.right - 8, y - 6);
      ctx.restore();
    },
  };
  var thresholdRegistered = false;

  /* Full Citizen Portal localization (EN / Bisaya / Tagalog). */
  var CITIZEN_I18N = {
    en: {
      skipToMain: "Skip to main content",
      navDashboard: "Dashboard",
      navHistory: "History",
      navConsent: "Consent",
      navProfile: "Profile",
      navMyProfile: "My profile",
      navLogout: "Log out",
      footPht: "All dates and times are shown in Philippine Standard Time (PHT).",
      footConsent: "Consent changes take effect immediately for all health-worker access.",
      footProfile: "Your password is stored only as a bcrypt hash.",
      heroEyebrow: "Barangay Health Kiosk · Patient Station",
      btnClinicalGuide: "Clinical Guide",
      btnRefresh: "Refresh",
      btnRefreshing: "Refreshing…",
      btnPassport: "Print Health Passport",
      btnOpening: "Opening…",
      btnViewHistory: "View history",
      btnExportCsv: "Export CSV",
      toastRefreshed: "Dashboard refreshed",
      toastNewReading: "New kiosk measurement received!",
      headlineHeading: "Key vitals",
      supportHeading: "Your other measurements",
      trendsHeading: "Trends at a glance",
      bpTrendHeading: "Blood pressure — last 10 readings",
      weightBmiTrendHeading: "Weight & BMI — last 10 readings",
      hintsSummary: "What do these numbers mean?",
      hintBpDt: "Blood pressure",
      hintBpDd: "Normal below 120/80 mmHg · elevated 120–129/<80 · Stage 1 130–139 or 80–89 · Stage 2 140/90 or above · crisis 180/120 or above.",
      hintSpo2Dt: "SpO₂ (blood oxygen)",
      hintSpo2Dd: "95% and above is normal · 90–94% is low · below 90% is critical — proceed to the health station.",
      hintTempDt: "Temperature",
      hintTempDd: "37.9 °C or above counts as a fever. Rest, hydrate, and report to your health worker if it persists.",
      hintPulseDt: "Pulse rate",
      hintPulseDd: "A typical resting pulse for adults is 60–100 bpm.",
      hintBmiDt: "BMI",
      hintBmiDd: "Underweight below 18.5 · normal 18.5–24.9 · overweight 25–29.9 · obese 30 and above.",
      hintWhDt: "Weight & height",
      hintWhDd: "Measured at the barangay kiosk and used to work out your BMI.",
      greetingMorning: "Good morning",
      greetingAfternoon: "Good afternoon",
      greetingEvening: "Good evening",
      notRecorded: "Not recorded",
      notTaken: "Not taken at kiosk",
      statusNormal: "Normal",
      statusMonitor: "Monitor",
      statusAction: "Action required",
      normalSentence: "Your latest readings are all within the healthy range.",
      normalNext: "Next step: keep it up — take your next reading at the kiosk as usual.",
      attentionNext: "Next step: mention this at your next visit, and recheck at the kiosk in a few days.",
      actionNext: "Next step: contact your Barangay Health Worker or visit the health station today.",
      statusJoinAnd: " and ",
      statusLatestPrefix: "In your latest reading, {findings}.",
      findBpRange: "your blood pressure is in the {cat} range{bp}",
      findBpHigh: "your blood pressure is a little high{bp}",
      findSpo2Crit: "your blood oxygen is critically low ({val}%)",
      findSpo2Low: "your blood oxygen is a little low ({val}%)",
      findFever: "you have a fever ({val} °C)",
      findBmi: "your BMI is in the {cat} range ({val})",
      alertHeading: "Clinical Attention Required",
      alertBpCrisis: "Hypertensive Crisis Level ({bp} mmHg). Immediate clinical evaluation recommended.",
      alertBpStage2: "Stage 2 High Blood Pressure ({bp} mmHg). Please consult your Barangay Health Worker.",
      alertBpStage1: "Stage 1 High Blood Pressure ({bp} mmHg). Keep an eye on your readings and consult your Barangay Health Worker.",
      alertSpo2Crit: "Critical Low Oxygen Saturation ({val}%). Please proceed to the health station or nearest facility.",
      alertFever: "Fever ({val} °C). Rest, stay hydrated, and report to your health worker if symptoms persist.",
      loadingLatest: "Loading your latest reading…",
      latestMetaText: "Latest reading: {dt} · {age} · {visits}",
      checkinSingle: "1 check-in",
      checkinPlural: "{n} check-ins",
      ageDays: "{n} days ago",
      ageDay: "1 day ago",
      ageHours: "{n} h ago",
      ageMins: "{n} min ago",
      ageNow: "just now",
      catNormal: "Normal",
      catElevated: "Elevated",
      catStage1: "Stage 1",
      catStage2: "Stage 2",
      catCrisis: "Crisis",
      catLowSpo2: "Low SpO2",
      catLow: "Low",
      catCritical: "Critical",
      catFever: "Fever",
      catLowPulse: "Low pulse",
      catUnderweight: "Underweight",
      catOverweight: "Overweight",
      catObese: "Obese",
      targetBp: "Target: <120/80 mmHg",
      targetSpo2: "Normal: 95–100%",
      targetTemp: "Normal: 36.5–37.5 °C",
      targetPulse: "Resting: 60–100 bpm",
      targetBmi: "Normal: 18.5–24.9",
      targetWeight: "Recorded at kiosk",
      targetHeight: "Standing stature",
      gaugeBpLeft: "90 Normal",
      gaugeBpRight: "180+ High",
      gaugeSpo2Left: "85% Low",
      gaugeSpo2Right: "95%+ Normal",
      gaugeTempRight: "38.0°C+ Fever",
      gaugeBmiLeft: "18.5 Min",
      gaugeBmiRight: "30.0+ Obese",
      noReadingsPill: "No readings",
      noReadingsSentence: "No vital sign measurements are recorded yet for your account.",
      noReadingsNext: "Visit the barangay health kiosk to take your measurements. Your readings will appear here.",
      unavailPill: "Unavailable",
      unavailSentence: "We couldn't load your health data right now.",
      unavailNext: "Use Retry below, or check your connection and try again.",
      consentGranted: "Consent: Granted",
      consentNotGranted: "Consent: Not granted",
      consentTitleYes: "Barangay Health Workers can open your individual records. Change this on the Consent page.",
      consentTitleNo: "Barangay Health Workers only see anonymous totals. Change this on the Consent page.",
      consentExplainYes: "Barangay Health Workers can open your individual records — this is what you agreed to. ",
      consentExplainNo: "Barangay Health Workers only see anonymous totals; they cannot open your individual records. ",
      consentLink: "Change this on the Consent page",
      bhwNotesHeading: "Notes from Your Health Worker",
      bhwNotesSub: "Guidance and follow-up instructions shared by your Barangay Health Worker.",
      bhwNotesEmpty: "No health worker notes have been shared with you yet.",
      bhwNotesFrom: "From",
      bhwNotesRefBadge: "RHU Referral",
      feverThresholdLabel: "Fever ≥ 37.9 °C",
      chartsUnavailMini: "Charts unavailable (the Chart.js CDN is unreachable) — open History for the full table.",
      notEnoughBp: "Not enough blood pressure readings yet to show a trend.",
      notEnoughWeight: "Not enough weight readings yet to show a trend.",
      trendNoChange: "no change",
      trendUp: "up {diff}",
      trendDown: "down {diff}",
      trendMsg: "{label} went from {first} to {last}{unit} over {count} readings ({change}).",
      chartSystolic: "Systolic",
      chartDiastolic: "Diastolic",
      chartWeightKg: "Weight (kg)",
      chartBmi: "BMI",
      chartSpo2Pct: "SpO2 (%)",
      chartTempC: "Temperature (°C)",
      labels: {
        "Blood pressure": "Blood pressure",
        "SpO2 (Oxygen)": "SpO2 (Oxygen)",
        "Body temperature": "Body temperature",
        "Pulse rate": "Pulse rate",
        "Body mass index": "Body mass index",
        "Weight": "Weight",
        "Height": "Height",
      },
      /* Modals */
      btnClose: "Close",
      btnGotIt: "Got it",
      btnPrintPdf: "Print / Save as PDF",
      passportModalTitle: "Official Health Passport",
      passportRep: "Republic of the Philippines · Province of Camiguin",
      passportTitle: "Citizen Health Passport",
      passportSub: "Municipality of Mahinog · Camiguin Polytechnic State College & Rural Health Unit",
      passportName: "Citizen Name",
      passportUsername: "Username / ID",
      passportBirthdate: "Birthdate",
      passportGender: "Gender",
      passportVisits: "Total Kiosk Visits",
      passportStatBp: "Blood Pressure",
      passportStatBmi: "Body Mass Index",
      passportBmiCat: "BMI Category: {cat}",
      passportStatWh: "Weight & Height",
      passportStatSpo2: "Blood Oxygen",
      passportStatTemp: "Body Temperature",
      passportElevFever: "Elevated Fever",
      passportStatPulse: "Pulse Rate",
      passportRestPulse: "Resting pulse",
      passportNoVitals: "No vital readings recorded yet.",
      passportRecorded: "Recorded: {dt}",
      passportOfficialRec: "OFFICIAL RECORD · BARANGAY HEALTH KIOSK",
      passportSigBhw: "Attending Health Worker (Signature)",
      passportSigDate: "Date of Verification",
      guideTitle: "Clinical Vitals Reference Guide",
      guideIntro: "Standard clinical classification ranges used by the Barangay Health Station, Camiguin Rural Health Unit (RHU), and Department of Health (DOH).",
      guideSecBp: "Blood Pressure (Systolic / Diastolic mmHg)",
      guideSecBmi: "Body Mass Index (BMI — Asian / WHO-WPR)",
      guideSecSpo2: "Blood Oxygen (SpO2 %)",
      guideSecTemp: "Body Temperature (°C)",
      guideNoteHealthyOpt: "Healthy optimal range",
      guideNoteLifestyle: "Lifestyle counseling",
      guideNoteMonitorFu: "Monitor & follow-up",
      guideNoteRefReq: "Clinical referral required",
      guideNoteImmCare: "Immediate medical care",
      guideNoteNutri: "Nutritional review",
      guideNoteHealthyBase: "Healthy baseline",
      guideNoteWtMgmt: "Weight management",
      guideNoteHealthPlan: "Health plan recommended",
      guideNoteHealthyOxy: "Healthy oxygenation",
      guideNoteRestObs: "Rest and observation",
      guideNoteSeekCare: "Seek clinical care",
      guideNoteNormo: "Normothermic",
      guideNoteHydrate: "Hydration & monitoring",
      privBadge: "Data Privacy Act · Republic Act No. 10173",
      privTitle: "Patient Health Privacy Reminder",
      privIntroHtml: "Welcome to the <strong>Barangay Health Monitoring System</strong>. Under <strong>Republic Act No. 10173 (Philippine Data Privacy Act of 2012)</strong>, your health vitals (blood pressure, heart rate, oxygen saturation, temperature, height, weight, and BMI) are legally classified as <strong>Sensitive Personal Information (SPI)</strong>.",
      privBoxTitle: "How Your Health Data is Handled",
      privBullet1: "Primary Healthcare Triage: Immediate detection of elevated blood pressure, fever, and triage risks.",
      privBullet2: "Barangay Health Assistance: Clinical guidance, consultation scheduling, and RHU referral coordination.",
      privBullet3: "Community Epidemiology: Anonymous statistics for municipal health planning.",
      privRightsHtml: "<strong>Your Data Rights:</strong> Your consent preference was documented when you registered or checked in at the Barangay Health Kiosk. You retain full ownership of your data — you may inspect your history, export your logs as CSV, or adjust your health worker sharing settings anytime on the <strong>Consent</strong> page.",
      privBtnAck: "I Understand",
      privSaving: "Saving…",
      privErr: "Failed to save acknowledgment: {msg}",
      /* History */
      histEyebrow: "Records & Trends",
      histHeading: "My Measurement History",
      histLede: "Every reading saved for your account, newest first. Charts show the trend over time (oldest to newest).",
      chartTabKey: "Key vitals",
      chartTabAll: "All charts",
      chartTabBp: "Blood pressure",
      chartTabTemp: "Temperature",
      chartTabSpo2: "SpO₂",
      chartTabBody: "Weight & BMI",
      chartTempTitle: "Temperature (°C)",
      chartWeightTitle: "Weight (kg)",
      chartBmiTitle: "BMI",
      chartBpTitle: "Blood pressure (mmHg)",
      chartSpo2Title: "SpO2 (%)",
      allReadingsHeading: "All readings",
      outsideNormalLegend: "Outside normal range",
      needsAttentionLegend: "Needs attention",
      loadingReadings: "Loading your readings…",
      noReadingsHistory: "No readings yet. After your first kiosk measurement the table and charts will appear here.",
      chartsUnavailHistory: "Charts could not load (the Chart.js CDN is unreachable). The table below still lists every reading.",
      filterLabel: "Filter readings",
      filterPlaceholder: "Filter by date, BP, BMI…",
      rangeAll: "All time",
      range7: "Last 7 days",
      range30: "Last 30 days",
      range90: "Last 90 days",
      totalReadingsCount: "{n} total readings",
      showingReadingsCount: "Showing {shown} of {total} readings",
      noMatchFilter: "No readings match your filter.",
      thTime: "Time (PHT)",
      thWeight: "Weight (kg)",
      thHeight: "Height (cm)",
      thBmi: "BMI",
      thTemp: "Temp (°C)",
      thPulse: "Pulse (bpm)",
      thSpo2: "SpO2 (%)",
      thBp: "Blood pressure",
      pagerPrev: "← Previous",
      pagerNext: "Next →",
      pagerPageOf: "Page {page} of {total}",
      csvNone: "No measurement records to export.",
      csvDone: "Exported {n} health records to CSV",
      cardsBtn: "Cards",
      tableBtn: "Table",
      swipeCue: "Swipe table sideways to view all columns →",
      toastHistoryNew: "New measurement added to history!",
      /* Consent page */
      consEyebrow: "Privacy & Data Rights",
      consHeading: "Consent to share my records",
      consLedeHtml: "Barangay Health Workers can open your individual readings and notes <strong>only while your consent is granted</strong>. Without consent the kiosk still saves your readings for your own account, and health workers can only see your basic registry entry and anonymous community totals.",
      consCurrentHeading: "Current consent",
      btnGrantConsent: "Grant consent",
      btnRevokeConsent: "Revoke consent",
      consAuditHint: "Every grant or revoke is recorded in the consent history below and cannot be deleted.",
      consCompareHeading: "What health workers can see",
      consWithTitle: "With consent",
      consWithoutTitle: "Without consent",
      consCurrentTag: "Your current setting",
      consOn1: "Your name, birthdate and number of kiosk visits",
      consOn2: "Every reading: BP, SpO2, temperature, pulse, weight, BMI",
      consOn3: "Guidance notes & clinical notes written about your health",
      consOn4: "Referring you to the Rural Health Unit",
      consOn5: "Your name on alert reports",
      consOff1: "Your name, birthdate and number of kiosk visits",
      consOff2: "Your individual readings",
      consOff3: "Writing or opening health worker notes",
      consOff4: "Referrals to the Rural Health Unit",
      consOff5: 'Your name on alert reports (shown as "Withheld")',
      consFooterHint: "Either way, your readings are counted in anonymous community totals, and every time a health worker opens your record it is logged.",
      consHistoryHeading: "Consent history",
      consBadgeGranted: "Granted",
      consBadgeNotGranted: "Not granted",
      consBadgeRevoked: "Revoked",
      consStateYes: " — health workers at the barangay health center can open your individual records and notes.",
      consStateNo: " — health workers cannot open your individual records. Only anonymous totals are visible to them.",
      consHistoryEmpty: "No consent changes recorded yet.",
      consThAction: "Action",
      consThIp: "IP address",
      consChecking: "Checking your consent status…",
      consUnavail: "Consent status unavailable right now.",
      consGranting: "Granting consent…",
      consRevoking: "Revoking consent…",
      consToastGranted: "Consent granted to Barangay Health Workers",
      consToastRevoked: "Consent revoked - records are now private",
      consDlgGrantTitle: "Grant Health Worker Access",
      consDlgGrantMsg: "Allow authorized Barangay Health Workers to view your vital readings, notes, and create Rural Health Unit referrals?",
      consDlgGrantNote: "Every access to your record is logged in the audit trail per RA 10173, and you can revoke access anytime.",
      consDlgKeepPriv: "Keep private",
      consDlgRevokeTitle: "Revoke Health Worker Access?",
      consDlgRevokeMsg: "Barangay Health Workers will no longer be able to open your individual vitals, clinical notes, or submit RHU referrals.",
      consDlgRevokeNote: "Your readings remain saved for your own account and are still included only in anonymous community totals.",
      consDlgCancel: "Cancel",
      /* Profile page */
      profEyebrow: "Citizen Account",
      profHeading: "My Profile",
      profLede: "Keep your details up to date. Your username cannot be changed.",
      profDetailsHeading: "Personal details",
      lblUsername: "Username",
      lblFullName: "Full name",
      lblBirthdate: "Birthdate",
      lblGender: "Gender",
      optMale: "Male",
      optFemale: "Female",
      optOther: "Other",
      profSaveDetails: "Save details",
      profSaveChanges: "Save changes",
      profNoChanges: "No changes to save",
      profLoading: "Loading your profile…",
      profSavedAt: "Saved at {time}. Your details are up to date.",
      profToastUpdated: "Profile updated",
      profPasswordHeading: "Change password",
      lblCurrentPw: "Current password",
      lblNewPw: "New password",
      pwHintInitial: "At least 8 characters.",
      pwHintOk: "Length looks good ({len} characters).",
      pwHintNeedSingle: "1 more character needed.",
      pwHintNeedPlural: "{n} more characters needed.",
      lblConfirmNewPw: "Confirm new password",
      pwConfirmPlaceholder: "Re-enter your new password",
      profForgotLead: "Don't remember your current password?",
      profResetLink: "Reset it using your birthdate",
      btnUpdatePw: "Update password",
      btnUpdating: "Updating…",
      errCurrPw: "Enter your current password.",
      errNewPwLen: "New password must be at least 8 characters.",
      errConfirmPwReq: "Please confirm your new password.",
      errPwMismatch: "New passwords do not match.",
      errPwSame: "New password must be different from your current one.",
      pwUpdatedMsg: "Password updated. Use your new password next time you sign in.",
      pwToastUpdated: "Password updated",
      profSessionHeading: "Session",
      btnLogoutDevice: "Log out of this device",
    },
    ceb: {
      skipToMain: "Laktaw ngadto sa nag-unang sulod",
      navDashboard: "Dashboard",
      navHistory: "Kasaysayan",
      navConsent: "Pagtugot",
      navProfile: "Profile",
      navMyProfile: "Akong profile",
      navLogout: "Log out",
      footPht: "Tanang petsa ug oras gipakita sa Philippine Standard Time (PHT).",
      footConsent: "Ang mga kausaban sa pagtugot moepekto dayon alang sa tanang access sa health worker.",
      footProfile: "Ang imong password gitipigan lamang isip bcrypt hash.",
      heroEyebrow: "Barangay Health Kiosk · Estasyon sa Pasyente",
      btnClinicalGuide: "Giya sa Klinika",
      btnRefresh: "I-refresh",
      btnRefreshing: "Nag-refresh…",
      btnPassport: "I-print ang Health Passport",
      btnOpening: "Giablihan…",
      btnViewHistory: "Tan-awa ang kasaysayan",
      btnExportCsv: "I-export ang CSV",
      toastRefreshed: "Na-refresh na ang dashboard",
      toastNewReading: "Bag-ong sukod gikan sa kiosk ang nadawat!",
      headlineHeading: "Mga Importanteng Sukod",
      supportHeading: "Ubang mga Sukod",
      trendsHeading: "Lakbit nga Kausaban",
      bpTrendHeading: "Presyon sa dugo — katapusang 10 ka sukod",
      weightBmiTrendHeading: "Timbang ug BMI — katapusang 10 ka sukod",
      hintsSummary: "Unsay pasabot niining mga numero?",
      hintBpDt: "Presyon sa dugo (BP)",
      hintBpDd: "Normal ubos sa 120/80 mmHg · medyo taas 120–129/<80 · Stage 1 130–139 o 80–89 · Stage 2 140/90 o labaw pa · krisis 180/120 o labaw pa.",
      hintSpo2Dt: "SpO₂ (oksiheno sa dugo)",
      hintSpo2Dd: "95% ug pataas normal · 90–94% ubos · ubos sa 90% kritikal — adto dayon sa health station.",
      hintTempDt: "Temperatura",
      hintTempDd: "37.9 °C o labaw pa giisip nga hilanat. Pahulay, inom og tubig, ug pahibaloa ang BHW kung magpadayon.",
      hintPulseDt: "Pinitik sa pulso",
      hintPulseDd: "Ang kasagarang pinitik sa pulso sa hamtong samtang nagpahulay mao ang 60–100 bpm.",
      hintBmiDt: "BMI",
      hintBmiDd: "Ubos sa timbang < 18.5 · normal 18.5–24.9 · sobra sa timbang 25–29.9 · obese 30 pataas.",
      hintWhDt: "Timbang ug gitas-on",
      hintWhDd: "Gisukod sa barangay kiosk ug gigamit sa pagkwenta sa imong BMI.",
      greetingMorning: "Maayong buntag",
      greetingAfternoon: "Maayong hapon",
      greetingEvening: "Maayong gabii",
      notRecorded: "Walay sukod",
      notTaken: "Wala makuha sa kiosk",
      statusNormal: "Normal",
      statusMonitor: "Bantayan",
      statusAction: "Kinahanglan og pagtagad",
      normalSentence: "Ang imong pinakabag-ong mga sukod anaa tanan sa maayong kahimtang.",
      normalNext: "Sunod nga lakang: padayona kini — pagpasukod pag-usab sa kiosk sa naandan.",
      attentionNext: "Sunod nga lakang: isulti kini sa imong BHW sa sunod bisita, ug pagpasukod pag-usab sulod sa pipila ka adlaw.",
      actionNext: "Sunod nga lakang: kontaka ang imong Barangay Health Worker o adto sa health station karon dayon.",
      statusJoinAnd: " ug ",
      statusLatestPrefix: "Sa imong pinakabag-ong sukod, {findings}.",
      findBpRange: "ang imong presyon sa dugo anaa sa {cat}{bp}",
      findBpHigh: "medyo taas ang imong presyon sa dugo{bp}",
      findSpo2Crit: "kritikal nga ubos ang oksiheno sa imong dugo ({val}%)",
      findSpo2Low: "medyo ubos ang oksiheno sa imong dugo ({val}%)",
      findFever: "aduna kay hilanat ({val} °C)",
      findBmi: "ang imong BMI anaa sa {cat} ({val})",
      alertHeading: "Kinahanglan og Hinanaling Pagtagad",
      alertBpCrisis: "Grabe ka Taas ang Presyon sa Dugo ({bp} mmHg). Girekomenda ang hinanaling pagsusi sa klinika.",
      alertBpStage2: "Stage 2 Taas nga Presyon sa Dugo ({bp} mmHg). Palihug pakigkonsulta sa imong Barangay Health Worker.",
      alertBpStage1: "Stage 1 Taas nga Presyon sa Dugo ({bp} mmHg). Bantayi ang imong sukod ug konsultaha ang imong BHW.",
      alertSpo2Crit: "Kritikal nga Kaubos sa Oksiheno ({val}%). Palihug adto dayon sa health station o labing duol nga ospital.",
      alertFever: "Hilanat ({val} °C). Pahulay, pag-inom og daghang tubig, ug pahibaloa ang BHW kung magpadayon ang mga simtomas.",
      loadingLatest: "Nagkarga sa imong pinakabag-ong sukod…",
      latestMetaText: "Pinakabag-ong sukod: {dt} · {age} · {visits}",
      checkinSingle: "1 ka check-in",
      checkinPlural: "{n} ka check-in",
      ageDays: "{n} ka adlaw ang milabay",
      ageDay: "1 ka adlaw ang milabay",
      ageHours: "{n} ka oras ang milabay",
      ageMins: "{n} min ang milabay",
      ageNow: "bag-o lang",
      catNormal: "Normal",
      catElevated: "Medyo Taas",
      catStage1: "Stage 1",
      catStage2: "Stage 2",
      catCrisis: "Krisis",
      catLowSpo2: "Ubos nga SpO2",
      catLow: "Ubos",
      catCritical: "Kritikal",
      catFever: "Hilanat",
      catLowPulse: "Hinay nga pulso",
      catUnderweight: "Ubos sa timbang",
      catOverweight: "Sobra sa timbang",
      catObese: "Obese",
      targetBp: "Tumong: <120/80 mmHg",
      targetSpo2: "Normal: 95–100%",
      targetTemp: "Normal: 36.5–37.5 °C",
      targetPulse: "Nagpahulay: 60–100 bpm",
      targetBmi: "Normal: 18.5–24.9",
      targetWeight: "Narekord sa kiosk",
      targetHeight: "Gitas-on nga nagtindog",
      gaugeBpLeft: "90 Normal",
      gaugeBpRight: "180+ Taas",
      gaugeSpo2Left: "85% Ubos",
      gaugeSpo2Right: "95%+ Normal",
      gaugeTempRight: "38.0°C+ Hilanat",
      gaugeBmiLeft: "18.5 Ubos",
      gaugeBmiRight: "30.0+ Obese",
      noReadingsPill: "Walay sukod",
      noReadingsSentence: "Wala pay narekord nga vital signs alang sa imong account.",
      noReadingsNext: "Bisitaha ang barangay health kiosk aron masukod ang imong lawas. Makita nimo dinhi ang resulta.",
      unavailPill: "Dili ma-access",
      unavailSentence: "Dili pa nato ma-load ang imong health data karon.",
      unavailNext: "Gamita ang Retry sa ubos o susiha ang imong koneksyon.",
      consentGranted: "Pagtugot: Gisugtan",
      consentNotGranted: "Pagtugot: Wala gisugti",
      consentTitleYes: "Makaabli ang mga BHW sa imong indibidwal nga rekord. Usba kini sa Pagtugot page.",
      consentTitleNo: "Mga anonimo nga total ra ang makita sa mga BHW. Usba kini sa Pagtugot page.",
      consentExplainYes: "Makaabli ang mga BHW sa imong indibidwal nga rekord sumala sa imong pagtugot. ",
      consentExplainNo: "Mga anonimo nga total ra ang makita sa mga BHW; dili nila maabli ang imong indibidwal nga rekord. ",
      consentLink: "Usba kini sa Consent page",
      bhwNotesHeading: "Mga Pahimangno gikan sa Imong BHW",
      bhwNotesSub: "Mga giya ug pahimangno sa follow-up nga gipaambit sa imong Barangay Health Worker.",
      bhwNotesEmpty: "Wala pay mga pahimangno gikan sa BHW nga gipaambit kanimo.",
      bhwNotesFrom: "Gikan kang",
      bhwNotesRefBadge: "Referral sa RHU",
      feverThresholdLabel: "Hilanat ≥ 37.9 °C",
      chartsUnavailMini: "Dili ma-load ang mga chart — ablihi ang Kasaysayan alang sa tibuok talaan.",
      notEnoughBp: "Wala pay igong sukod sa presyon sa dugo aron makita ang kausaban.",
      notEnoughWeight: "Wala pay igong sukod sa timbang aron makita ang kausaban.",
      trendNoChange: "walay kausaban",
      trendUp: "misaka og {diff}",
      trendDown: "miubos og {diff}",
      trendMsg: "Ang {label} gikan sa {first} nahimong {last}{unit} sulod sa {count} ka sukod ({change}).",
      chartSystolic: "Systolic",
      chartDiastolic: "Diastolic",
      chartWeightKg: "Timbang (kg)",
      chartBmi: "BMI",
      chartSpo2Pct: "SpO2 (%)",
      chartTempC: "Temperatura (°C)",
      labels: {
        "Blood pressure": "Presyon sa dugo (BP)",
        "SpO2 (Oxygen)": "Oksiheno sa dugo (SpO₂)",
        "Body temperature": "Temperatura sa lawas",
        "Pulse rate": "Pinitik sa pulso",
        "Body mass index": "Body Mass Index (BMI)",
        "Weight": "Timbang",
        "Height": "Gitas-on",
      },
      btnClose: "Isira",
      btnGotIt: "Nasabtan",
      btnPrintPdf: "I-print / I-save nga PDF",
      passportModalTitle: "Opisyal nga Health Passport",
      passportRep: "Republika sa Pilipinas · Probinsya sa Camiguin",
      passportTitle: "Health Passport sa Lumulupyo",
      passportSub: "Munisipyo sa Mahinog · Camiguin Polytechnic State College & Rural Health Unit",
      passportName: "Ngalan sa Lumulupyo",
      passportUsername: "Username / ID",
      passportBirthdate: "Adlawng Natawhan",
      passportGender: "Sekso",
      passportVisits: "Kinatibuk-ang Bisita sa Kiosk",
      passportStatBp: "Presyon sa Dugo",
      passportStatBmi: "Body Mass Index",
      passportBmiCat: "Kategorya sa BMI: {cat}",
      passportStatWh: "Timbang ug Gitas-on",
      passportStatSpo2: "Oksiheno sa Dugo",
      passportStatTemp: "Temperatura sa Lawas",
      passportElevFever: "Taas nga Hilanat",
      passportStatPulse: "Pinitik sa Pulso",
      passportRestPulse: "Pulso sa pagpahulay",
      passportNoVitals: "Wala pay narekord nga vital signs.",
      passportRecorded: "Narekord: {dt}",
      passportOfficialRec: "OPISYAL NGA REKORD · BARANGAY HEALTH KIOSK",
      passportSigBhw: "Nag-atiman nga Health Worker (Pirma)",
      passportSigDate: "Petsa sa Pagpamatuod",
      guideTitle: "Giya sa Sukdanan sa Vital Signs",
      guideIntro: "Mga sumbanang sukdanan nga gigamit sa Barangay Health Station, Camiguin Rural Health Unit (RHU), ug Department of Health (DOH).",
      guideSecBp: "Presyon sa Dugo (Systolic / Diastolic mmHg)",
      guideSecBmi: "Body Mass Index (BMI — Asian / WHO-WPR)",
      guideSecSpo2: "Oksiheno sa Dugo (SpO2 %)",
      guideSecTemp: "Temperatura sa Lawas (°C)",
      guideNoteHealthyOpt: "Himsog nga lebel",
      guideNoteLifestyle: "Pagbag-o sa lifestyle",
      guideNoteMonitorFu: "Bantayi ug pag-follow-up",
      guideNoteRefReq: "Kinahanglan ang referral sa klinika",
      guideNoteImmCare: "Hinanaling medikal nga pagtagad",
      guideNoteNutri: "Pagsusi sa nutrisyon",
      guideNoteHealthyBase: "Maayong timbang",
      guideNoteWtMgmt: "Pagdumala sa timbang",
      guideNoteHealthPlan: "Girekomenda ang health plan",
      guideNoteHealthyOxy: "Maayong lebel sa oksiheno",
      guideNoteRestObs: "Pahulay ug pagbantay",
      guideNoteSeekCare: "Pakigkita dayon sa doktor/BHW",
      guideNoteNormo: "Normal nga temperatura",
      guideNoteHydrate: "Pag-inom og tubig ug pagbantay",
      privBadge: "Balaod sa Data Privacy · Republic Act No. 10173",
      privTitle: "Pahinumdom sa Pagkapribado sa Panglawas",
      privIntroHtml: "Maayong pag-abot sa <strong>Barangay Health Monitoring System</strong>. Ubos sa <strong>Republic Act No. 10173 (Philippine Data Privacy Act of 2012)</strong>, ang imong mga sukod sa lawas (BP, pulso, oksiheno, temperatura, gitas-on, timbang, ug BMI) giisip nga <strong>Sensitive Personal Information (SPI)</strong>.",
      privBoxTitle: "Giunsa Pag-atiman ang Imong Datos",
      privBullet1: "Unang Pagsusi sa Panglawas: Dali nga pagkahibalo sa taas nga BP, hilanat, ug mga risgo.",
      privBullet2: "Tabang sa Barangay Health: Medikal nga giya, eskedyul sa konsultasyon, ug referral sa RHU.",
      privBullet3: "Estadistika sa Komunidad: Anonimo nga ihap alang sa pagplano sa panglawas sa lungsod.",
      privRightsHtml: "<strong>Imong mga Katungod sa Datos:</strong> Ang imong pagtugot narekord sa imong pagrehistro o paggamit sa kiosk. Ikaw ang tag-iya sa imong datos — mahimo nimong susihon ang kasaysayan, i-export isip CSV, o usbon ang pagtugot sa <strong>Pagtugot</strong> page bisan kanus-a.",
      privBtnAck: "Nasabtan Ko",
      privSaving: "Nagtipig…",
      privErr: "Napakyas sa pagtipig: {msg}",
      histEyebrow: "Mga Rekord ug Kausaban",
      histHeading: "Akong Kasaysayan sa Sukod",
      histLede: "Tanang sukod nga natipig sa imong account, pinakabag-o una. Ang mga chart nagpakita sa dagan sa panahon.",
      chartTabKey: "Importanteng sukod",
      chartTabAll: "Tanang chart",
      chartTabBp: "Presyon sa dugo",
      chartTabTemp: "Temperatura",
      chartTabSpo2: "SpO₂",
      chartTabBody: "Timbang ug BMI",
      chartTempTitle: "Temperatura (°C)",
      chartWeightTitle: "Timbang (kg)",
      chartBmiTitle: "BMI",
      chartBpTitle: "Presyon sa dugo (mmHg)",
      chartSpo2Title: "SpO2 (%)",
      allReadingsHeading: "Tanang sukod",
      outsideNormalLegend: "Gawas sa normal",
      needsAttentionLegend: "Kinahanglan og pagtagad",
      loadingReadings: "Nagkarga sa imong mga sukod…",
      noReadingsHistory: "Wala pay mga sukod. Human sa imong unang pagsukod sa kiosk, makita dinhi ang talaan ug mga chart.",
      chartsUnavailHistory: "Dili ma-load ang mga chart. Makita gihapon sa talaan sa ubos ang matag sukod.",
      filterLabel: "Salain ang mga sukod",
      filterPlaceholder: "Pangitaa pinaagi sa petsa, BP, BMI…",
      rangeAll: "Tanang panahon",
      range7: "Katapusang 7 ka adlaw",
      range30: "Katapusang 30 ka adlaw",
      range90: "Katapusang 90 ka adlaw",
      totalReadingsCount: "{n} tanan nga sukod",
      showingReadingsCount: "Gipakita ang {shown} sa {total} ka sukod",
      noMatchFilter: "Walay sukod nga mitukma sa imong gipangita.",
      thTime: "Oras (PHT)",
      thWeight: "Timbang (kg)",
      thHeight: "Gitas-on (cm)",
      thBmi: "BMI",
      thTemp: "Temp (°C)",
      thPulse: "Pulso (bpm)",
      thSpo2: "SpO2 (%)",
      thBp: "Presyon sa dugo",
      pagerPrev: "← Miagi",
      pagerNext: "Sunod →",
      pagerPageOf: "Panid {page} sa {total}",
      csvNone: "Walay rekord sa sukod nga ma-export.",
      csvDone: "Na-export ang {n} ka rekord ngadto sa CSV",
      cardsBtn: "Mga Kard",
      tableBtn: "Talaan",
      swipeCue: "I-swipe pakilid ang talaan aron makita tanan →",
      toastHistoryNew: "Bag-ong sukod nadugang sa kasaysayan!",
      consEyebrow: "Pagkapribado ug Katungod sa Datos",
      consHeading: "Pagtugot sa pagpaambit sa akong rekord",
      consLedeHtml: "Makaabli ang mga Barangay Health Worker sa imong indibidwal nga sukod ug nota <strong>samtang gihatag lang ang imong pagtugot</strong>. Kung wala, matipig gihapon sa kiosk ang imong mga sukod alang kanimo, ug anonimo nga ihap lang ang makita nila.",
      consCurrentHeading: "Kasamtangang pagtugot",
      btnGrantConsent: "Ihatag ang pagtugot",
      btnRevokeConsent: "Bawion ang pagtugot",
      consAuditHint: "Ang matag paghatag o pagbawi irekord sa kasaysayan sa ubos ug dili mapapas.",
      consCompareHeading: "Unsay makita sa mga health worker",
      consWithTitle: "Kung may pagtugot",
      consWithoutTitle: "Kung walay pagtugot",
      consCurrentTag: "Imong kasamtangang setting",
      consOn1: "Imong ngalan, adlawng natawhan ug ihap sa bisita sa kiosk",
      consOn2: "Matag sukod: BP, SpO2, temperatura, pulso, timbang, BMI",
      consOn3: "Mga giya ug klinikal nga nota bahin sa imong panglawas",
      consOn4: "Pag-refer kanimo ngadto sa Rural Health Unit",
      consOn5: "Imong ngalan sa mga alert report",
      consOff1: "Imong ngalan, adlawng natawhan ug ihap sa bisita sa kiosk",
      consOff2: "Imong indibidwal nga mga sukod",
      consOff3: "Pagsulat o pag-abli sa mga nota sa health worker",
      consOff4: "Pag-refer ngadto sa Rural Health Unit",
      consOff5: 'Imong ngalan sa alert reports (gipakita nga "Withheld")',
      consFooterHint: "Bisan unsa pa, apil ang imong sukod sa anonimo nga ihap sa komunidad, ug girekord matag higayon nga ablihan sa BHW ang imong rekord.",
      consHistoryHeading: "Kasaysayan sa pagtugot",
      consBadgeGranted: "Gisugtan",
      consBadgeNotGranted: "Wala gisugti",
      consBadgeRevoked: "Gibawi",
      consStateYes: " — makaabli ang mga BHW sa barangay health center sa imong indibidwal nga rekord ug nota.",
      consStateNo: " — dili makaabli ang mga BHW sa imong indibidwal nga rekord. Anonimo nga ihap lang ang ilang makita.",
      consHistoryEmpty: "Wala pay natala nga kausaban sa pagtugot.",
      consThAction: "Lihok",
      consThIp: "IP address",
      consChecking: "Gisusi ang imong kahimtang sa pagtugot…",
      consUnavail: "Dili magamit ang kahimtang sa pagtugot karon.",
      consGranting: "Gihatag ang pagtugot…",
      consRevoking: "Gibawi ang pagtugot…",
      consToastGranted: "Gihatag na ang pagtugot sa mga Barangay Health Worker",
      consToastRevoked: "Gibawi na ang pagtugot — pribado na ang imong mga rekord",
      consDlgGrantTitle: "Hatagan og Access ang Health Worker?",
      consDlgGrantMsg: "Tugotan ba ang mga awtorisadong Barangay Health Worker nga motan-aw sa imong sukod, nota, ug mohimo og referral sa RHU?",
      consDlgGrantNote: "Ang matag pag-abli girekord sa audit trail sumala sa RA 10173, ug mahimo nimo kining bawion bisan kanus-a.",
      consDlgKeepPriv: "Pabiling pribado",
      consDlgRevokeTitle: "Bawion ang Access sa Health Worker?",
      consDlgRevokeMsg: "Dili na makaabli ang mga Barangay Health Worker sa imong indibidwal nga sukod, nota, o referral sa RHU.",
      consDlgRevokeNote: "Magpabiling luwas ang imong sukod alang kanimo ug sa anonimo nga ihap sa komunidad lang.",
      consDlgCancel: "Kanselahon",
      profEyebrow: "Account sa Lumulupyo",
      profHeading: "Akong Profile",
      profLede: "Ipadayon nga bag-o ang imong impormasyon. Dili na mausab ang imong username.",
      profDetailsHeading: "Personal nga detalye",
      lblUsername: "Username",
      lblFullName: "Tibuok ngalan",
      lblBirthdate: "Adlawng natawhan",
      lblGender: "Sekso",
      optMale: "Lalaki",
      optFemale: "Babaye",
      optOther: "Uban pa",
      profSaveDetails: "I-save ang detalye",
      profSaveChanges: "I-save ang mga kausaban",
      profNoChanges: "Walay kausaban nga i-save",
      profLoading: "Nagkarga sa imong profile…",
      profSavedAt: "Natipig sa {time}. Bag-o na ang imong detalye.",
      profToastUpdated: "Na-update na ang profile",
      profPasswordHeading: "Ilisan ang password",
      lblCurrentPw: "Kasamtangang password",
      lblNewPw: "Bag-ong password",
      pwHintInitial: "Labing menos 8 ka karakter.",
      pwHintOk: "Maayo ang gitas-on ({len} ka karakter).",
      pwHintNeedSingle: "Kinahanglan og 1 pa ka karakter.",
      pwHintNeedPlural: "Kinahanglan og {n} pa ka karakter.",
      lblConfirmNewPw: "Kumpirmaha ang bag-ong password",
      pwConfirmPlaceholder: "Isulat pag-usab ang bag-ong password",
      profForgotLead: "Nakalimot ka ba sa imong kasamtangang password?",
      profResetLink: "I-reset gamit ang imong adlawng natawhan",
      btnUpdatePw: "I-update ang password",
      btnUpdating: "Gi-update…",
      errCurrPw: "Isulat ang imong kasamtangang password.",
      errNewPwLen: "Ang bag-ong password kinahanglan labing menos 8 ka karakter.",
      errConfirmPwReq: "Palihug kumpirmaha ang bag-ong password.",
      errPwMismatch: "Wala magtugma ang bag-ong mga password.",
      errPwSame: "Ang bag-ong password kinahanglan lahi sa kasamtangan.",
      pwUpdatedMsg: "Na-update na ang password. Gamita ang bag-ong password sa sunod pag-sign in.",
      pwToastUpdated: "Na-update na ang password",
      profSessionHeading: "Sesyon",
      btnLogoutDevice: "Log out sa kini nga device",
    },
    tl: {
      skipToMain: "Lumaktaw sa pangunahing nilalaman",
      navDashboard: "Dashboard",
      navHistory: "Kasaysayan",
      navConsent: "Pahintulot",
      navProfile: "Profile",
      navMyProfile: "Aking profile",
      navLogout: "Mag-log out",
      footPht: "Lahat ng petsa at oras ay ipinapakita sa Philippine Standard Time (PHT).",
      footConsent: "Agad na magkakabisa ang mga pagbabago sa pahintulot para sa lahat ng health worker.",
      footProfile: "Ang iyong password ay nakaimbak lamang bilang bcrypt hash.",
      heroEyebrow: "Barangay Health Kiosk · Estasyon ng Pasyente",
      btnClinicalGuide: "Klinikal na Gabay",
      btnRefresh: "I-refresh",
      btnRefreshing: "Nagre-refresh…",
      btnPassport: "I-print ang Health Passport",
      btnOpening: "Binubuksan…",
      btnViewHistory: "Tingnan ang kasaysayan",
      btnExportCsv: "I-export ang CSV",
      toastRefreshed: "Na-refresh na ang dashboard",
      toastNewReading: "May bagong sukat na natanggap mula sa kiosk!",
      headlineHeading: "Mga Pangunahing Vital Signs",
      supportHeading: "Iba pang Sukat",
      trendsHeading: "Takbo ng Resulta",
      bpTrendHeading: "Presyon ng dugo — huling 10 sukat",
      weightBmiTrendHeading: "Timbang at BMI — huling 10 sukat",
      hintsSummary: "Ano ang ibig sabihin ng mga numerong ito?",
      hintBpDt: "Presyon ng dugo (BP)",
      hintBpDd: "Normal mababa sa 120/80 mmHg · bahagyang mataas 120–129/<80 · Stage 1 130–139 o 80–89 · Stage 2 140/90 pataas · krisis 180/120 pataas.",
      hintSpo2Dt: "SpO₂ (oxygen sa dugo)",
      hintSpo2Dd: "95% pataas ay normal · 90–94% ay mababa · mababa sa 90% ay kritikal — pumunta agad sa health station.",
      hintTempDt: "Temperatura",
      hintTempDd: "Ang 37.9 °C o higit pa ay lagnat. Magpahinga, uminom ng tubig, at magreport sa BHW kung magpatuloy.",
      hintPulseDt: "Bilis ng pulso",
      hintPulseDd: "Ang karaniwang pulso ng matanda habang nagpapahinga ay 60–100 bpm.",
      hintBmiDt: "BMI",
      hintBmiDd: "Kulang sa timbang < 18.5 · normal 18.5–24.9 · sobra sa timbang 25–29.9 · obese 30 pataas.",
      hintWhDt: "Timbang at taas",
      hintWhDd: "Sinukat sa barangay kiosk at ginagamit sa pagkwenta ng iyong BMI.",
      greetingMorning: "Magandang umaga",
      greetingAfternoon: "Magandang hapon",
      greetingEvening: "Magandang gabi",
      notRecorded: "Walang tala",
      notTaken: "Hindi nakuha sa kiosk",
      statusNormal: "Normal",
      statusMonitor: "Bantayan",
      statusAction: "Kailangan ng atensyon",
      normalSentence: "Nasa malusog at normal na antas ang iyong pinakahuling mga sukat.",
      normalNext: "Susunod na hakbang: ipagpatuloy ito — magpasukat muli sa kiosk ayon sa nakagawian.",
      attentionNext: "Susunod na hakbang: sabihin ito sa iyong BHW sa susunod na pagbisita at magpasukat muli pagkalipas ng ilang araw.",
      actionNext: "Susunod na hakbang: makipag-ugnayan sa iyong Barangay Health Worker o pumunta sa health station ngayon.",
      statusJoinAnd: " at ",
      statusLatestPrefix: "Sa iyong pinakahuling sukat, {findings}.",
      findBpRange: "nasa antas na {cat} ang iyong presyon ng dugo{bp}",
      findBpHigh: "bahagyang mataas ang iyong presyon ng dugo{bp}",
      findSpo2Crit: "kritikal na mababa ang iyong antas ng oxygen ({val}%)",
      findSpo2Low: "bahagyang mababa ang iyong antas ng oxygen ({val}%)",
      findFever: "ikaw ay may lagnat ({val} °C)",
      findBmi: "nasa antas na {cat} ang iyong BMI ({val})",
      alertHeading: "Kailangan ng Klinikal na Atensyon",
      alertBpCrisis: "Hypertensive Crisis ({bp} mmHg). Inirerekomenda ang agarang pagsusuri ng doktor.",
      alertBpStage2: "Stage 2 Mataas na Presyon ({bp} mmHg). Mangyaring kumonsulta sa iyong Barangay Health Worker.",
      alertBpStage1: "Stage 1 Mataas na Presyon ({bp} mmHg). Bantayan ang iyong mga sukat at kumonsulta sa BHW.",
      alertSpo2Crit: "Kritikal na Mababang Oxygen ({val}%). Mangyaring pumunta agad sa health station o pinakamalapit na pasilidad.",
      alertFever: "Lagnat ({val} °C). Magpahinga, uminom ng sapat na tubig, at sabihin sa BHW kung magpatuloy.",
      loadingLatest: "Nilo-load ang iyong pinakahuling sukat…",
      latestMetaText: "Pinakahuling sukat: {dt} · {age} · {visits}",
      checkinSingle: "1 check-in",
      checkinPlural: "{n} na check-in",
      ageDays: "{n} araw ang nakalipas",
      ageDay: "1 araw ang nakalipas",
      ageHours: "{n} oras ang nakalipas",
      ageMins: "{n} min ang nakalipas",
      ageNow: "ngayon lang",
      catNormal: "Normal",
      catElevated: "Bahagyang Mataas",
      catStage1: "Stage 1",
      catStage2: "Stage 2",
      catCrisis: "Krisis",
      catLowSpo2: "Mababang SpO2",
      catLow: "Mababa",
      catCritical: "Kritikal",
      catFever: "Lagnat",
      catLowPulse: "Mababang pulso",
      catUnderweight: "Kulang sa timbang",
      catOverweight: "Sobra sa timbang",
      catObese: "Obese",
      targetBp: "Target: <120/80 mmHg",
      targetSpo2: "Normal: 95–100%",
      targetTemp: "Normal: 36.5–37.5 °C",
      targetPulse: "Nagpapahinga: 60–100 bpm",
      targetBmi: "Normal: 18.5–24.9",
      targetWeight: "Naitala sa kiosk",
      targetHeight: "Taas na nakatayo",
      gaugeBpLeft: "90 Normal",
      gaugeBpRight: "180+ Mataas",
      gaugeSpo2Left: "85% Mababa",
      gaugeSpo2Right: "95%+ Normal",
      gaugeTempRight: "38.0°C+ Lagnat",
      gaugeBmiLeft: "18.5 Mababa",
      gaugeBmiRight: "30.0+ Obese",
      noReadingsPill: "Walang sukat",
      noReadingsSentence: "Wala pang naitalang vital signs para sa iyong account.",
      noReadingsNext: "Pumunta sa barangay health kiosk upang magpasukat. Lalabas dito ang iyong mga resulta.",
      unavailPill: "Hindi ma-load",
      unavailSentence: "Hindi ma-load ang iyong health data sa ngayon.",
      unavailNext: "Gamitin ang Retry sa ibaba o suriin ang iyong koneksyon.",
      consentGranted: "Pahintulot: Pinayagan",
      consentNotGranted: "Pahintulot: Hindi pinayagan",
      consentTitleYes: "Maaaring buksan ng mga BHW ang iyong indibidwal na rekord. Baguhin ito sa Pahintulot page.",
      consentTitleNo: "Mga anonimong kabuuan lamang ang nakikita ng mga BHW. Baguhin ito sa Pahintulot page.",
      consentExplainYes: "Maaaring buksan ng mga BHW ang iyong indibidwal na rekord ayon sa iyong pahintulot. ",
      consentExplainNo: "Mga anonimong kabuuan lamang ang nakikita ng mga BHW; hindi nila mabubuksan ang iyong rekord. ",
      consentLink: "Baguhin ito sa Consent page",
      bhwNotesHeading: "Mga Paalala mula sa Iyong BHW",
      bhwNotesSub: "Mga gabay at tagubilin sa follow-up na ibinahagi ng iyong Barangay Health Worker.",
      bhwNotesEmpty: "Wala pang mga tala mula sa BHW na ibinahagi sa iyo.",
      bhwNotesFrom: "Mula kay",
      bhwNotesRefBadge: "RHU Referral",
      feverThresholdLabel: "Lagnat ≥ 37.9 °C",
      chartsUnavailMini: "Hindi ma-load ang mga chart — buksan ang Kasaysayan para sa buong talahanayan.",
      notEnoughBp: "Wala pang sapat na sukat ng presyon ng dugo upang maipakita ang trend.",
      notEnoughWeight: "Wala pang sapat na sukat ng timbang upang maipakita ang trend.",
      trendNoChange: "walang pagbabago",
      trendUp: "tumaas nang {diff}",
      trendDown: "bumaba nang {diff}",
      trendMsg: "Ang {label} mula {first} ay naging {last}{unit} sa loob ng {count} sukat ({change}).",
      chartSystolic: "Systolic",
      chartDiastolic: "Diastolic",
      chartWeightKg: "Timbang (kg)",
      chartBmi: "BMI",
      chartSpo2Pct: "SpO2 (%)",
      chartTempC: "Temperatura (°C)",
      labels: {
        "Blood pressure": "Presyon ng dugo (BP)",
        "SpO2 (Oxygen)": "Antas ng oxygen (SpO₂)",
        "Body temperature": "Temperatura ng katawan",
        "Pulse rate": "Bilis ng pulso",
        "Body mass index": "Body Mass Index (BMI)",
        "Weight": "Timbang",
        "Height": "Taas",
      },
      btnClose: "Isara",
      btnGotIt: "Naintindihan",
      btnPrintPdf: "I-print / I-save bilang PDF",
      passportModalTitle: "Opisyal na Health Passport",
      passportRep: "Republika ng Pilipinas · Lalawigan ng Camiguin",
      passportTitle: "Health Passport ng Mamamayan",
      passportSub: "Bayan ng Mahinog · Camiguin Polytechnic State College & Rural Health Unit",
      passportName: "Pangalan",
      passportUsername: "Username / ID",
      passportBirthdate: "Kaarawan",
      passportGender: "Kasarian",
      passportVisits: "Kabuuang Pagbisita sa Kiosk",
      passportStatBp: "Presyon ng Dugo",
      passportStatBmi: "Body Mass Index",
      passportBmiCat: "Kategorya ng BMI: {cat}",
      passportStatWh: "Timbang at Taas",
      passportStatSpo2: "Oxygen sa Dugo",
      passportStatTemp: "Temperatura ng Katawan",
      passportElevFever: "Mataas na Lagnat",
      passportStatPulse: "Bilis ng Pulso",
      passportRestPulse: "Pulso sa pahinga",
      passportNoVitals: "Wala pang naitalang vital signs.",
      passportRecorded: "Naitala: {dt}",
      passportOfficialRec: "OPISYAL NA REKORD · BARANGAY HEALTH KIOSK",
      passportSigBhw: "Nag-asikasong Health Worker (Lagda)",
      passportSigDate: "Petsa ng Pagpapatunay",
      guideTitle: "Gabay sa Klinikal na Sukatan ng Vital Signs",
      guideIntro: "Mga karaniwang saklaw na ginagamit ng Barangay Health Station, Camiguin Rural Health Unit (RHU), at Department of Health (DOH).",
      guideSecBp: "Presyon ng Dugo (Systolic / Diastolic mmHg)",
      guideSecBmi: "Body Mass Index (BMI — Asian / WHO-WPR)",
      guideSecSpo2: "Oxygen sa Dugo (SpO2 %)",
      guideSecTemp: "Temperatura ng Katawan (°C)",
      guideNoteHealthyOpt: "Malusog na antas",
      guideNoteLifestyle: "Pagpapayo sa pamumuhay",
      guideNoteMonitorFu: "Bantayan at mag-follow-up",
      guideNoteRefReq: "Kailangan ng referral sa klinika",
      guideNoteImmCare: "Agarang medikal na atensyon",
      guideNoteNutri: "Pagsusuri sa nutrisyon",
      guideNoteHealthyBase: "Malusog na timbang",
      guideNoteWtMgmt: "Pamamahala ng timbang",
      guideNoteHealthPlan: "Inirerekomenda ang health plan",
      guideNoteHealthyOxy: "Malusog na antas ng oxygen",
      guideNoteRestObs: "Pahinga at pagbabantay",
      guideNoteSeekCare: "Magpatingin agad sa klinika",
      guideNoteNormo: "Normal na temperatura",
      guideNoteHydrate: "Uminom ng tubig at magbantay",
      privBadge: "Data Privacy Act · Republic Act No. 10173",
      privTitle: "Paalala sa Privacy ng Kalusugan ng Pasyente",
      privIntroHtml: "Maligayang pagdating sa <strong>Barangay Health Monitoring System</strong>. Sa ilalim ng <strong>Republic Act No. 10173 (Philippine Data Privacy Act of 2012)</strong>, ang iyong mga vital signs (BP, pulso, oxygen, temperatura, taas, timbang, at BMI) ay itinuturing na <strong>Sensitive Personal Information (SPI)</strong>.",
      privBoxTitle: "Paano Pinangangalagaan ang Iyong Datos",
      privBullet1: "Unang Pagsusuri (Triage): Agarang pagtukoy sa mataas na presyon, lagnat, at iba pang panganib.",
      privBullet2: "Tulong ng Barangay Health: Gabay sa kalusugan, iskedyul ng konsultasyon, at RHU referral.",
      privBullet3: "Estadistika ng Komunidad: Anonimong tala para sa pagpaplanong pangkalusugan ng bayan.",
      privRightsHtml: "<strong>Iyong mga Karapatan sa Datos:</strong> Naitala ang iyong pahintulot nang magrehistro o gumamit ka ng kiosk. Ikaw ang may-ari ng iyong datos — maaari mong tingnan ang kasaysayan, mag-export ng CSV, o baguhin ang iyong sharing settings anumang oras sa <strong>Pahintulot</strong> page.",
      privBtnAck: "Naiintindihan Ko",
      privSaving: "Sine-save…",
      privErr: "Hindi na-save ang pagkilala: {msg}",
      histEyebrow: "Mga Rekord at Trend",
      histHeading: "Aking Kasaysayan ng Sukat",
      histLede: "Lahat ng sukat na naka-save sa iyong account, pinakabago muna. Ipinapakita ng mga chart ang pagbabago sa paglipas ng panahon.",
      chartTabKey: "Mga pangunahin",
      chartTabAll: "Lahat ng chart",
      chartTabBp: "Presyon ng dugo",
      chartTabTemp: "Temperatura",
      chartTabSpo2: "SpO₂",
      chartTabBody: "Timbang at BMI",
      chartTempTitle: "Temperatura (°C)",
      chartWeightTitle: "Timbang (kg)",
      chartBmiTitle: "BMI",
      chartBpTitle: "Presyon ng dugo (mmHg)",
      chartSpo2Title: "SpO2 (%)",
      allReadingsHeading: "Lahat ng sukat",
      outsideNormalLegend: "Labas sa normal na saklaw",
      needsAttentionLegend: "Kailangan ng atensyon",
      loadingReadings: "Nilo-load ang iyong mga sukat…",
      noReadingsHistory: "Wala pang mga sukat. Pagkatapos ng iyong unang sukat sa kiosk, lalabas dito ang talahanayan at mga chart.",
      chartsUnavailHistory: "Hindi ma-load ang mga chart. Makikita pa rin sa talahanayan sa ibaba ang bawat sukat.",
      filterLabel: "Salain ang mga sukat",
      filterPlaceholder: "Salain ayon sa petsa, BP, BMI…",
      rangeAll: "Lahat ng oras",
      range7: "Huling 7 araw",
      range30: "Huling 30 araw",
      range90: "Huling 90 araw",
      totalReadingsCount: "{n} kabuuang sukat",
      showingReadingsCount: "Ipinapakita ang {shown} sa {total} na sukat",
      noMatchFilter: "Walang sukat na tumugma sa iyong hinahanap.",
      thTime: "Oras (PHT)",
      thWeight: "Timbang (kg)",
      thHeight: "Taas (cm)",
      thBmi: "BMI",
      thTemp: "Temp (°C)",
      thPulse: "Pulso (bpm)",
      thSpo2: "SpO2 (%)",
      thBp: "Presyon ng dugo",
      pagerPrev: "← Nakaraan",
      pagerNext: "Susunod →",
      pagerPageOf: "Pahina {page} ng {total}",
      csvNone: "Walang sukat na mae-export.",
      csvDone: "Na-export ang {n} na rekord sa CSV",
      cardsBtn: "Mga Kard",
      tableBtn: "Talahanayan",
      swipeCue: "I-swipe pakaliwa/pakanan upang makita lahat →",
      toastHistoryNew: "May bagong sukat na naidagdag sa kasaysayan!",
      consEyebrow: "Privacy at Karapatan sa Datos",
      consHeading: "Pahintulot na ibahagi ang aking rekord",
      consLedeHtml: "Maaaring buksan ng mga Barangay Health Worker ang iyong indibidwal na sukat at tala <strong>habang nakabukas lamang ang iyong pahintulot</strong>. Kung wala nito, sine-save pa rin ng kiosk ang iyong mga sukat para sa sarili mong account, at anonimong kabuuan lamang ang nakikita nila.",
      consCurrentHeading: "Kasalukuyang pahintulot",
      btnGrantConsent: "Magbigay ng pahintulot",
      btnRevokeConsent: "Bawiin ang pahintulot",
      consAuditHint: "Ang bawat pagbibigay o pagbawi ay naitatala sa kasaysayan sa ibaba at hindi maaaring burahin.",
      consCompareHeading: "Ano ang nakikita ng mga health worker",
      consWithTitle: "Kung may pahintulot",
      consWithoutTitle: "Kung walang pahintulot",
      consCurrentTag: "Iyong kasalukuyang setting",
      consOn1: "Iyong pangalan, kaarawan at bilang ng pagbisita sa kiosk",
      consOn2: "Bawat sukat: BP, SpO2, temperatura, pulso, timbang, BMI",
      consOn3: "Mga paalala at klinikal na tala tungkol sa iyong kalusugan",
      consOn4: "Pagre-refer sa iyo sa Rural Health Unit",
      consOn5: "Iyong pangalan sa mga alert report",
      consOff1: "Iyong pangalan, kaarawan at bilang ng pagbisita sa kiosk",
      consOff2: "Iyong indibidwal na mga sukat",
      consOff3: "Pagsusulat o pagbukas ng mga tala ng health worker",
      consOff4: "Mga referral sa Rural Health Unit",
      consOff5: 'Iyong pangalan sa alert reports (nakalagay bilang "Withheld")',
      consFooterHint: "Alinman dito, kasama pa rin ang iyong mga sukat sa anonimong kabuuan ng komunidad, at naitatala ang bawat pagbukas ng BHW sa iyong rekord.",
      consHistoryHeading: "Kasaysayan ng pahintulot",
      consBadgeGranted: "Pinayagan",
      consBadgeNotGranted: "Hindi pinayagan",
      consBadgeRevoked: "Binawi",
      consStateYes: " — maaaring buksan ng mga BHW sa barangay health center ang iyong indibidwal na rekord at mga tala.",
      consStateNo: " — hindi maaaring buksan ng mga BHW ang iyong indibidwal na rekord. Anonimong kabuuan lamang ang makikita nila.",
      consHistoryEmpty: "Wala pang naitalang pagbabago sa pahintulot.",
      consThAction: "Aksyon",
      consThIp: "IP address",
      consChecking: "Sinusuri ang estado ng iyong pahintulot…",
      consUnavail: "Hindi magamit ang estado ng pahintulot ngayon.",
      consGranting: "Ibinibigay ang pahintulot…",
      consRevoking: "Binabawi ang pahintulot…",
      consToastGranted: "Naibigay na ang pahintulot sa mga Barangay Health Worker",
      consToastRevoked: "Binawi na ang pahintulot — pribado na ang iyong mga rekord",
      consDlgGrantTitle: "Payagan ang Access ng Health Worker?",
      consDlgGrantMsg: "Payagan ang mga awtorisadong Barangay Health Worker na makita ang iyong vital signs, mga tala, at gumawa ng RHU referral?",
      consDlgGrantNote: "Ang bawat pagbukas sa iyong rekord ay nakatala sa audit trail alinsunod sa RA 10173, at maaari mo itong bawiin anumang oras.",
      consDlgKeepPriv: "Panatilihing pribado",
      consDlgRevokeTitle: "Bawiin ang Access ng Health Worker?",
      consDlgRevokeMsg: "Hindi na mabubuksan ng mga Barangay Health Worker ang iyong indibidwal na sukat, tala, o makapagsumite ng RHU referral.",
      consDlgRevokeNote: "Mananatiling naka-save ang iyong mga sukat para sa sarili mong account at kabilang lamang sa anonimong kabuuan.",
      consDlgCancel: "Kanselahin",
      profEyebrow: "Account ng Mamamayan",
      profHeading: "Aking Profile",
      profLede: "Panatilihing bago ang iyong mga detalye. Hindi na maaaring palitan ang iyong username.",
      profDetailsHeading: "Personal na detalye",
      lblUsername: "Username",
      lblFullName: "Buong pangalan",
      lblBirthdate: "Kaarawan",
      lblGender: "Kasarian",
      optMale: "Lalaki",
      optFemale: "Babaye",
      optOther: "Iba pa",
      profSaveDetails: "I-save ang detalye",
      profSaveChanges: "I-save ang pagbabago",
      profNoChanges: "Walang pagbabagong ise-save",
      profLoading: "Nilo-load ang iyong profile…",
      profSavedAt: "Na-save noong {time}. Napapanahon na ang iyong mga detalye.",
      profToastUpdated: "Na-update na ang profile",
      profPasswordHeading: "Palitan ang password",
      lblCurrentPw: "Kasalukuyang password",
      lblNewPw: "Bagong password",
      pwHintInitial: "Hindi bababa sa 8 karakter.",
      pwHintOk: "Maganda ang haba ({len} na karakter).",
      pwHintNeedSingle: "Kailangan pa ng 1 karakter.",
      pwHintNeedPlural: "Kailangan pa ng {n} karakter.",
      lblConfirmNewPw: "Kumpirmahin ang bagong password",
      pwConfirmPlaceholder: "Ilagay muli ang bagong password",
      profForgotLead: "Nakalimutan mo ba ang kasalukuyang password?",
      profResetLink: "I-reset gamit ang iyong kaarawan",
      btnUpdatePw: "I-update ang password",
      btnUpdating: "Ina-update…",
      errCurrPw: "Ilagay ang iyong kasalukuyang password.",
      errNewPwLen: "Ang bagong password ay dapat hindi bababa sa 8 karakter.",
      errConfirmPwReq: "Pakikumpirma ang iyong bagong password.",
      errPwMismatch: "Hindi magkatugma ang bagong mga password.",
      errPwSame: "Dapat naiiba ang bagong password sa kasalukuyan.",
      pwUpdatedMsg: "Na-update na ang password. Gamitin ang bagong password sa susunod na pag-sign in.",
      pwToastUpdated: "Na-update na ang password",
      profSessionHeading: "Sesyon",
      btnLogoutDevice: "Mag-log out sa device na ito",
    },
  };

  function getCitizenLang() {
    try {
      var saved = window.localStorage.getItem("hk_lang");
      return (saved && CITIZEN_I18N[saved]) ? saved : "en";
    } catch (e) {
      return "en";
    }
  }

  function setCitizenLang(lang) {
    if (!CITIZEN_I18N[lang]) lang = "en";
    try { window.localStorage.setItem("hk_lang", lang); } catch (e) {}
    return lang;
  }

  function t(key, vars) {
    var dict = CITIZEN_I18N[getCitizenLang()] || CITIZEN_I18N.en;
    var val = dict[key] !== undefined ? dict[key] : CITIZEN_I18N.en[key];
    if (typeof val !== "string" || !vars) return val;
    return val.replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, k) {
      return vars[k] !== undefined ? String(vars[k]) : "";
    });
  }

  function tLabel(label) {
    var dict = CITIZEN_I18N[getCitizenLang()] || CITIZEN_I18N.en;
    return (dict.labels && dict.labels[label]) || label;
  }

  function tCat(cat) {
    var map = {
      "Normal": "catNormal",
      "Elevated": "catElevated",
      "Stage 1": "catStage1",
      "Stage 2": "catStage2",
      "Crisis": "catCrisis",
      "Low": "catLow",
      "Critical": "catCritical",
      "Underweight": "catUnderweight",
      "Overweight": "catOverweight",
      "Obese": "catObese",
    };
    return map[cat] ? t(map[cat]) : (cat || "");
  }

  function fmtAgeLocal(value) {
    if (!value) return "—";
    var date = new Date(String(value).replace(" ", "T") + "Z");
    if (isNaN(date.getTime())) return "—";
    var diffMs = Math.max(0, Date.now() - date.getTime());
    var diffMin = Math.floor(diffMs / 60000);
    var diffHour = Math.floor(diffMs / 3600000);
    var diffDay = Math.floor(diffMs / 86400000);
    if (diffDay > 1) return t("ageDays", { n: diffDay });
    if (diffDay === 1) return t("ageDay");
    if (diffHour > 0) return t("ageHours", { n: diffHour });
    if (diffMin > 0) return t("ageMins", { n: diffMin });
    return t("ageNow");
  }

  function checkinViewsI18n() {
    return {
      cardsBtn: t("cardsBtn"),
      tableBtn: t("tableBtn"),
      swipeCue: t("swipeCue"),
      needsAttention: t("needsAttentionLegend"),
      monitor: t("statusMonitor"),
      normal: t("catNormal"),
      bp: tLabel("Blood pressure"),
      temp: t("chartTempTitle"),
      spo2: tLabel("SpO2 (Oxygen)"),
      pulse: tLabel("Pulse rate"),
      weight: tLabel("Weight"),
      bmi: tLabel("Body mass index"),
    };
  }

  function applyCitizenI18n() {
    var active = getCitizenLang();
    document.documentElement.lang = active;
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      var on = btn.dataset.lang === active;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    var skip = document.querySelector(".skip-link");
    if (skip) skip.textContent = t("skipToMain");
    var navMap = [
      ["/citizen/dashboard.html", "navDashboard"],
      ["/citizen/history.html", "navHistory"],
      ["/citizen/consent.html", "navConsent"],
      ["/citizen/profile.html", "navProfile"],
    ];
    navMap.forEach(function (pair) {
      document.querySelectorAll('.sidenav a[href="' + pair[0] + '"] span, .mobile-bottom-dock a[href="' + pair[0] + '"] span')
        .forEach(function (span) { span.textContent = t(pair[1]); });
    });
    var logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.textContent = t("navLogout");
  }

  function bindLangSwitchers(onChange) {
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      if (btn.dataset.langBound === "1") return;
      btn.dataset.langBound = "1";
      btn.addEventListener("click", function () {
        setCitizenLang(btn.dataset.lang);
        applyCitizenI18n();
        if (typeof onChange === "function") onChange();
      });
    });
    applyCitizenI18n();
  }

  /* ---------------- classification (display only) ---------------- */

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

  /* ---------------- shared form helpers ---------------- */

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

  function showFormError(node, message) {
    if (!node) return;
    node.textContent = message || "";
  }

  function fieldValue(id) {
    var node = document.getElementById(id);
    return node ? node.value.trim() : "";
  }

  /* ---------------- login / register ---------------- */

  function initLogin() {
    var form = document.getElementById("loginForm");
    if (!form) return;
    var errorNode = document.getElementById("loginError");
    var submit = document.getElementById("loginSubmit");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(errorNode, "");
      var username = fieldValue("username");
      var password = document.getElementById("password").value;
      if (!username || !password) {
        showFormError(errorNode, "Enter your username and password.");
        return;
      }
      setBusy(submit, true, "Signing in…");
      try {
        var data = await API.apiFetch("/api/login", {
          method: "POST",
          body: { username: username, password: password },
        });

        if (document.body.getAttribute("data-page") === "bhw-login") {
          if (data.role !== "bhw" && data.role !== "admin") {
            showFormError(
              errorNode,
              "This portal is for Barangay Health Workers. Citizens sign in through the citizen portal."
            );
            setBusy(submit, false);
            return;
          }
          API.saveSession(data.token, data.role, data.full_name, data.privacy_acknowledged);
          location.href = "/bhw/dashboard.html";
          return;
        }

        API.saveSession(data.token, data.role, data.full_name, data.privacy_acknowledged);
        location.href = API.homeForRole(data.role);
      } catch (error) {
        showFormError(errorNode, error.message);
        setBusy(submit, false);
      }
    });
  }

  function initRegister() {
    var form = document.getElementById("registerForm");
    if (!form) return;
    var errorNode = document.getElementById("registerError");
    var successNode = document.getElementById("registerSuccess");
    var submit = document.getElementById("registerSubmit");

    /* Per-field inline validation: show/clear an error line under a field. */
    function fieldError(id, message) {
      var node = document.getElementById(id);
      var existing = document.getElementById(id + "-error");
      if (existing) existing.remove();
      if (!node) return;
      if (!message) {
        node.removeAttribute("aria-invalid");
        return;
      }
      node.setAttribute("aria-invalid", "true");
      node.setAttribute("aria-describedby", id + "-error");
      var err = U.el("p", { id: id + "-error", class: "form-error", role: "alert" }, message);
      node.parentNode.insertBefore(err, node.nextSibling);
    }

    function clearFieldError(id) {
      var node = document.getElementById(id);
      if (node) {
        node.removeAttribute("aria-invalid");
      }
      var existing = document.getElementById(id + "-error");
      if (existing) existing.remove();
    }

    ["fullName", "username", "password", "confirmPassword", "birthdate"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.addEventListener("input", function () { clearFieldError(id); });
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(errorNode, "");
      U.clear(successNode);
      ["fullName", "username", "password", "confirmPassword", "birthdate"].forEach(clearFieldError);

      var fullName = fieldValue("fullName");
      var username = fieldValue("username");
      var password = document.getElementById("password").value;
      var confirm = document.getElementById("confirmPassword").value;
      var birthdate = fieldValue("birthdate");
      var gender = fieldValue("gender");
      var ok = true;

      if (!fullName) { fieldError("fullName", "Full name is required."); ok = false; }
      if (!username) { fieldError("username", "Username is required."); ok = false; }
      if (!password) { fieldError("password", "Password is required."); ok = false; }
      else if (password.length < 8) { fieldError("password", "Password must be at least 8 characters."); ok = false; }
      if (!confirm) { fieldError("confirmPassword", "Please confirm your password."); ok = false; }
      else if (password !== confirm) { fieldError("confirmPassword", "Passwords do not match."); ok = false; }
      if (!birthdate) { fieldError("birthdate", "Birthdate is required."); ok = false; }
      if (!gender) { fieldError("gender", "Please select a gender."); ok = false; }
      if (!ok) return;

      var payload = {
        full_name: fullName,
        username: username,
        password: password,
        birthdate: birthdate,
        gender: gender,
      };

      setBusy(submit, true, "Creating account…");
      try {
        await API.apiFetch("/api/register", { method: "POST", body: payload });
        form.reset();
        successNode.textContent = "Account created. ";
        var link = U.el("a", { href: "/citizen/login.html" }, "Sign in with your new account");
        successNode.appendChild(link);
        successNode.appendChild(document.createTextNode("."));
        setBusy(submit, false);
      } catch (error) {
        showFormError(errorNode, error.message);
        setBusy(submit, false);
      }
    });
  }

  /* ---------------- dashboard ---------------- */

  function createGauge(trackClass, percent, leftLabel, rightLabel) {
    var wrap = U.el("div", { class: "vitals-gauge" });
    var track = U.el("div", { class: "gauge-track " + trackClass });
    var clamped = Math.max(0, Math.min(100, percent));
    var pin = U.el("div", { class: "gauge-pin" });
    pin.style.left = clamped + "%";
    track.appendChild(pin);
    wrap.appendChild(track);
    var legend = U.el("div", { class: "gauge-legend" });
    legend.appendChild(U.el("span", null, leftLabel));
    legend.appendChild(U.el("span", null, rightLabel));
    wrap.appendChild(legend);
    return wrap;
  }

  function createDelta(diff, unit, lowerIsBetter, neutral, digits) {
    if (diff === null || diff === undefined || isNaN(diff)) return null;
    var places = digits === undefined ? 1 : digits;
    var epsilon = places === 0 ? 0.5 : 0.05;
    var sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
    var abs = Math.abs(diff);
    if (abs < epsilon) return U.el("span", { class: "delta neutral" }, "No change");
    var isGood = lowerIsBetter ? diff < 0 : diff > 0;
    var tone = neutral ? "neutral" : isGood ? "good" : "warn";
    var text = (diff > 0 ? "▲ " : "▼ ") + sign + abs.toFixed(places) + (unit ? " " + unit : "");
    return U.el("span", { class: "delta " + tone }, text);
  }

  function showHealthPassportModal(profile, log) {
    document.body.classList.add("printing-passport");
    var backdrop = U.el("div", { class: "modal-backdrop" });
    var card = U.el("div", { class: "modal-card health-passport-modal" });

    var header = U.el("div", { class: "modal-header" });
    header.appendChild(U.el("h3", null, t("passportModalTitle")));
    var closeBtn = U.el("button", { class: "btn btn-ghost", type: "button", "aria-label": t("btnClose") }, "✕");
    header.appendChild(closeBtn);
    card.appendChild(header);

    var body = U.el("div", { class: "modal-body" });
    var passport = U.el("div", { class: "passport-card" });

    var pHead = U.el("div", { class: "passport-header" });
    var pLogos = U.el("div", { class: "passport-logos", style: "display:flex; align-items:center; justify-content:center; gap:1.25rem; margin-bottom:0.6rem;" });
    pLogos.appendChild(U.el("img", { src: "/img/cpsc-logo.png", alt: "CPSC", width: "48", height: "48", style: "object-fit:contain;" }));
    pLogos.appendChild(U.el("img", { src: "/img/rhu-logo.png", alt: "RHU Mahinog", width: "48", height: "48", style: "object-fit:contain;" }));
    pHead.appendChild(pLogos);
    pHead.appendChild(U.el("div", { style: "font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#0b3d30;" }, t("passportRep")));
    pHead.appendChild(U.el("h2", { style: "margin:0.25rem 0; font-size:1.35rem;" }, t("passportTitle")));
    pHead.appendChild(U.el("p", { style: "margin:0; font-size:0.82rem; color:#4a655a;" }, t("passportSub")));
    passport.appendChild(pHead);

    var infoDl = U.el("dl", { class: "kv", style: "margin-bottom:1rem;" });
    function addInfo(lbl, val) {
      var item = U.el("div", { class: "kv-item" });
      item.appendChild(U.el("dt", null, lbl));
      item.appendChild(U.el("dd", null, val || "—"));
      infoDl.appendChild(item);
    }
    var gKey = profile.gender === "male" ? "optMale" : profile.gender === "female" ? "optFemale" : profile.gender ? "optOther" : null;
    addInfo(t("passportName"), profile.full_name || API.getName());
    addInfo(t("passportUsername"), profile.username || "—");
    addInfo(t("passportBirthdate"), profile.birthdate || "—");
    addInfo(t("passportGender"), gKey ? t(gKey) : "—");
    if (profile.visit_count !== undefined) {
      var vc = Number(profile.visit_count);
      addInfo(t("passportVisits"), vc === 1 ? t("checkinSingle") : t("checkinPlural", { n: vc }));
    }
    passport.appendChild(infoDl);

    var grid = U.el("div", { class: "passport-grid" });
    function addStat(lbl, val, sub) {
      var box = U.el("div", { class: "passport-stat" });
      box.appendChild(U.el("div", { class: "lbl" }, lbl));
      box.appendChild(U.el("div", { class: "val" }, val));
      if (sub) box.appendChild(U.el("div", { class: "sub", style: "font-size:0.75rem; color:#4b6b62;" }, sub));
      grid.appendChild(box);
    }

    if (log) {
      var bmiCat = bmiCategory(log.bmi);
      var bpCat = bpCategory(log.systolic_bp, log.diastolic_bp);
      var spo2Cat = spo2Category(log.spo2);

      addStat(t("passportStatBp"), (!isMissing(log.systolic_bp) && !isMissing(log.diastolic_bp)) ? (log.systolic_bp + "/" + log.diastolic_bp + " mmHg") : "—", bpCat ? tCat(bpCat) : "");
      addStat(t("passportStatBmi"), U.fmtNum(log.bmi, 1), bmiCat ? t("passportBmiCat", { cat: tCat(bmiCat) }) : "");
      addStat(t("passportStatWh"), U.fmtNum(log.weight, 1, "kg") + " / " + U.fmtNum(log.height, 1, "cm"), "");
      addStat(t("passportStatSpo2"), U.fmtNum(log.spo2, 0, "%"), spo2Cat ? tCat(spo2Cat) : "");
      addStat(t("passportStatTemp"), U.fmtNum(log.temperature, 1, "°C"), Number(log.temperature) >= 37.9 ? t("passportElevFever") : t("catNormal"));
      addStat(t("passportStatPulse"), U.fmtNum(log.pulse_rate, 0, "bpm"), t("passportRestPulse"));
    } else {
      grid.appendChild(U.el("p", { class: "muted" }, t("passportNoVitals")));
    }
    passport.appendChild(grid);

    var foot = U.el("div", { class: "passport-footer" });
    foot.appendChild(U.el("span", null, t("passportRecorded", { dt: log ? U.fmtDT(log.timestamp) : "—" })));
    foot.appendChild(U.el("span", { style: "font-weight:700; color:#0b3d30;" }, t("passportOfficialRec")));
    passport.appendChild(foot);

    var sigBlock = U.el("div", { class: "official-signature-block print-only" });
    var sigFlex = U.el("div", { style: "display:flex; justify-content:space-between; margin-top:2.2rem;" });
    var sig1 = U.el("div");
    sig1.appendChild(U.el("div", { style: "border-bottom:1.5px solid #000; width:220px; height:1.4rem;" }));
    sig1.appendChild(U.el("div", { style: "font-size:0.75rem; margin-top:0.3rem; font-weight:600;" }, t("passportSigBhw")));
    sigFlex.appendChild(sig1);
    var sig2 = U.el("div");
    sig2.appendChild(U.el("div", { style: "border-bottom:1.5px solid #000; width:160px; height:1.4rem;" }));
    sig2.appendChild(U.el("div", { style: "font-size:0.75rem; margin-top:0.3rem; font-weight:600;" }, t("passportSigDate")));
    sigFlex.appendChild(sig2);
    sigBlock.appendChild(sigFlex);
    passport.appendChild(sigBlock);

    body.appendChild(passport);
    card.appendChild(body);

    var mFoot = U.el("div", { class: "modal-footer" });
    var printBtn = U.el("button", { class: "btn btn-primary", type: "button" }, t("btnPrintPdf"));
    printBtn.onclick = function () {
      // body.printing-passport scopes the @media print rules to the passport
      // card only; without it Ctrl+P printed a blank page elsewhere too.
      document.body.classList.add("printing-passport");
      var clearPrintMode = function () {
        document.body.classList.remove("printing-passport");
        window.removeEventListener("afterprint", clearPrintMode);
      };
      window.addEventListener("afterprint", clearPrintMode);
      window.print();
      // Generous fallback for browsers that do not fire afterprint immediately
      setTimeout(clearPrintMode, 30000);
    };
    var dismissBtn = U.el("button", { class: "btn btn-secondary", type: "button" }, t("btnClose"));
    mFoot.appendChild(dismissBtn);
    mFoot.appendChild(printBtn);
    card.appendChild(mFoot);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    // Accessible dialog: role/aria-modal/aria-labelledby, Escape and
    // backdrop click close it, focus moves in and is restored on close.
    var closeDialog = U.openDialog(backdrop, closeBtn);
    var handleClose = function () {
      document.body.classList.remove("printing-passport");
      closeDialog();
    };
    closeBtn.onclick = handleClose;
    dismissBtn.onclick = handleClose;
  }

  function showVitalsGuideModal() {
    var backdrop = U.el("div", { class: "modal-backdrop" });
    var card = U.el("div", { class: "modal-card vitals-guide-modal", style: "max-width: 640px;" });

    var header = U.el("div", { class: "modal-header" });
    header.appendChild(U.el("h3", null, t("guideTitle")));
    var closeBtn = U.el("button", { class: "btn btn-ghost", type: "button", "aria-label": t("btnClose") }, "✕");
    header.appendChild(closeBtn);
    card.appendChild(header);

    var body = U.el("div", { class: "modal-body" });
    var intro = U.el("p", { class: "lede", style: "font-size:0.9rem; margin-bottom:1rem;" },
      t("guideIntro")
    );
    body.appendChild(intro);

    function addSection(title, rows) {
      var sec = U.el("div", { style: "margin-bottom:1.1rem;" });
      sec.appendChild(U.el("h4", { style: "font-size:0.95rem; font-weight:700; color:var(--green-900); margin-bottom:0.4rem;" }, title));
      var table = U.el("table", { class: "vitals-guide-table", style: "width:100%; font-size:0.85rem;" });
      var tbody = U.el("tbody");
      rows.forEach(function (r) {
        var tr = U.el("tr");
        var tdLabel = U.el("td", { style: "font-weight:600; width:40%; padding:0.35rem 0.5rem;" });
        if (r.badge) {
          tdLabel.appendChild(U.el("span", { class: "vital-badge badge-" + r.badge, style: "margin-right:0.35rem;" }, r.status));
        } else {
          tdLabel.textContent = r.status;
        }
        tr.appendChild(tdLabel);
        tr.appendChild(U.el("td", { style: "width:30%; padding:0.35rem 0.5rem; color:var(--ink-soft);" }, r.range));
        tr.appendChild(U.el("td", { style: "width:30%; padding:0.35rem 0.5rem; color:var(--ink-muted); font-size:0.8rem;" }, r.note));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      sec.appendChild(table);
      body.appendChild(sec);
    }

    addSection(t("guideSecBp"), [
      { status: t("catNormal"), range: "< 120 / < 80", note: t("guideNoteHealthyOpt"), badge: "ok" },
      { status: t("catElevated"), range: "120–129 / < 80", note: t("guideNoteLifestyle"), badge: "warn" },
      { status: t("catStage1"), range: "130–139 / 80–89", note: t("guideNoteMonitorFu"), badge: "warn" },
      { status: t("catStage2"), range: "≥ 140 / ≥ 90", note: t("guideNoteRefReq"), badge: "alert" },
      { status: t("catCrisis"), range: "≥ 180 / ≥ 120", note: t("guideNoteImmCare"), badge: "alert" }
    ]);

    addSection(t("guideSecBmi"), [
      { status: t("catUnderweight"), range: "< 18.5", note: t("guideNoteNutri"), badge: "warn" },
      { status: t("catNormal"), range: "18.5 – 24.9", note: t("guideNoteHealthyBase"), badge: "ok" },
      { status: t("catOverweight"), range: "25.0 – 29.9", note: t("guideNoteWtMgmt"), badge: "warn" },
      { status: t("catObese"), range: "≥ 30.0", note: t("guideNoteHealthPlan"), badge: "alert" }
    ]);

    addSection(t("guideSecSpo2"), [
      { status: t("catNormal"), range: "95% – 100%", note: t("guideNoteHealthyOxy"), badge: "ok" },
      { status: t("catLow"), range: "90% – 94%", note: t("guideNoteRestObs"), badge: "warn" },
      { status: t("catCritical"), range: "< 90%", note: t("guideNoteSeekCare"), badge: "alert" }
    ]);

    addSection(t("guideSecTemp"), [
      { status: t("catNormal"), range: "36.5°C – 37.5°C", note: t("guideNoteNormo"), badge: "ok" },
      { status: t("catFever"), range: "≥ 37.9°C", note: t("guideNoteHydrate"), badge: "alert" }
    ]);

    card.appendChild(body);

    var mFoot = U.el("div", { class: "modal-footer" });
    var dismissBtn = U.el("button", { class: "btn btn-primary", type: "button" }, t("btnGotIt"));
    mFoot.appendChild(dismissBtn);
    card.appendChild(mFoot);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    var closeDialog = U.openDialog(backdrop, closeBtn);
    closeBtn.onclick = closeDialog;
    dismissBtn.onclick = closeDialog;
  }

  function showCitizenConsentModal(onDismiss) {
    if (document.getElementById("citizenConsentModalBackdrop")) return;

    var backdrop = U.el("div", {
      id: "citizenConsentModalBackdrop",
      class: "modal-backdrop",
    });
    var card = U.el("div", {
      class: "modal-card privacy-consent-modal",
      style: "max-width: 620px;",
    });

    var header = U.el("div", { class: "modal-header" });
    var headerLeft = U.el("div");
    var badge = U.el(
      "span",
      {
        class: "badge badge-ok",
        style:
          "display:inline-block; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.25rem;",
      },
      t("privBadge")
    );
    headerLeft.appendChild(badge);
    headerLeft.appendChild(
      U.el(
        "h3",
        { style: "margin:0; font-size:1.15rem; color:#fff;" },
        t("privTitle")
      )
    );
    header.appendChild(headerLeft);
    card.appendChild(header);

    var body = U.el("div", {
      class: "modal-body",
      style: "font-size:0.92rem; line-height:1.55;",
    });

    var introP = U.el("p", { style: "margin-top:0; color:var(--ink-base);" });
    introP.innerHTML = t("privIntroHtml");
    body.appendChild(introP);

    var calloutBox = U.el("div", {
      class: "statutory-callout",
      style:
        "background:var(--green-050); border-left:4px solid var(--green-600); padding:0.85rem 1rem; border-radius:6px; margin:0.9rem 0;",
    });
    calloutBox.appendChild(
      U.el(
        "h4",
        {
          style:
            "margin:0 0 0.4rem 0; font-size:0.92rem; color:var(--green-900); font-weight:700;",
        },
        t("privBoxTitle")
      )
    );
    var calloutList = U.el("ul", {
      style: "margin:0; padding-left:1.2rem; font-size:0.88rem; color:var(--ink-soft);",
    });
    ["privBullet1", "privBullet2", "privBullet3"].forEach(function (k) {
      calloutList.appendChild(U.el("li", null, t(k)));
    });
    calloutBox.appendChild(calloutList);
    body.appendChild(calloutBox);

    var rightsP = U.el("p", {
      style:
        "font-size:0.86rem; color:var(--ink-soft); background:#f9fafb; border:1px solid var(--line); border-radius:6px; padding:0.75rem 0.9rem; margin-bottom:0; line-height:1.45;",
    });
    rightsP.innerHTML = t("privRightsHtml");
    body.appendChild(rightsP);

    card.appendChild(body);

    var mFoot = U.el("div", {
      class: "modal-footer",
      style: "display:flex; justify-content:flex-end; align-items:center;",
    });

    var understandBtn = U.el(
      "button",
      { class: "btn btn-primary", type: "button", style: "min-width: 140px;" },
      t("privBtnAck")
    );
    mFoot.appendChild(understandBtn);
    card.appendChild(mFoot);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    var closeDialog = U.openDialog(backdrop, understandBtn, { persistent: true });

    understandBtn.onclick = async function () {
      understandBtn.disabled = true;
      understandBtn.textContent = t("privSaving");
      try {
        await API.apiFetch("/api/citizen/acknowledge-notice", { method: "POST" });
        API.setPrivacyAcknowledged(true);
        closeDialog();
        if (typeof onDismiss === "function") {
          onDismiss();
        }
      } catch (err) {
        understandBtn.disabled = false;
        understandBtn.textContent = t("privBtnAck");
        U.toast(t("privErr", { msg: err.message || "" }), "error");
      }
    };
  }

  function addCard(container, label, value, sub, tone, gauge, delta, spark, pendingSparks, refRange, badge, unit) {
    var isMissingCard = tone === "missing";
    var card = U.el("div", { class: "card" + (tone ? " " + tone : "") });
    var topRow = U.el("div", { class: "card-top-row" });
    topRow.appendChild(U.el("div", { class: "label" }, tLabel(label)));
    var effectiveBadge = badge || (isMissingCard ? { text: t("notRecorded"), tone: "neutral" } : null);
    if (effectiveBadge) {
      topRow.appendChild(U.el("span", { class: "vital-badge badge-" + (effectiveBadge.tone || "neutral") }, effectiveBadge.text));
    }
    card.appendChild(topRow);

    var valRow = U.el("div", { class: "value-row" });
    var valStr = String(value === null || value === undefined ? "—" : value);
    var valUnit = isMissingCard ? "" : (unit || "");

    if (!valUnit && !isMissingCard && typeof valStr === "string") {
      var match = valStr.match(/^([0-9./—-]+)\s*([a-zA-Z°%]+.*)$/);
      if (match) {
        valStr = match[1];
        valUnit = match[2];
      }
    }

    valRow.appendChild(U.el("span", { class: "value" }, valStr));
    if (valUnit) {
      valRow.appendChild(U.el("span", { class: "unit" }, valUnit));
    }
    card.appendChild(valRow);

    if (refRange || delta || isMissingCard) {
      var metaRow = U.el("div", { class: "card-meta" });
      if (isMissingCard) {
        metaRow.appendChild(U.el("span", { class: "ref-range" }, t("notTaken")));
      } else if (refRange) {
        metaRow.appendChild(U.el("span", { class: "ref-range" }, refRange));
      }
      if (delta) metaRow.appendChild(delta);
      card.appendChild(metaRow);
    }

    if (sub) card.appendChild(U.el("div", { class: "sub" }, sub));
    if (gauge) card.appendChild(gauge);
    if (spark) {
      if (pendingSparks) {
        pendingSparks.push({ card: card, values: spark.values, color: spark.color });
      } else {
        renderSparkline(card, spark.values, spark.color);
      }
    }
    container.appendChild(card);
    return card;
  }

  function renderAlertBanner(log) {
    var banner = document.getElementById("alertBanner");
    if (!banner) return;
    U.clear(banner);

    var alerts = [];
    if (!isMissing(log.systolic_bp) && !isMissing(log.diastolic_bp)) {
      var bpPair = log.systolic_bp + "/" + log.diastolic_bp;
      if (log.systolic_bp >= 180 || log.diastolic_bp >= 120) {
        alerts.push(t("alertBpCrisis", { bp: bpPair }));
      } else if (log.systolic_bp >= 140 || log.diastolic_bp >= 90) {
        alerts.push(t("alertBpStage2", { bp: bpPair }));
      } else if (log.systolic_bp >= 130 || log.diastolic_bp >= 80) {
        alerts.push(t("alertBpStage1", { bp: bpPair }));
      }
    }
    if (!isMissing(log.spo2) && log.spo2 <= 90) {
      alerts.push(t("alertSpo2Crit", { val: log.spo2 }));
    }
    // Spec alert rule: temperature >= 37.9 (was 38.5, which missed
    // low-grade fevers the backend already counts as alerts).
    if (!isMissing(log.temperature) && Number(log.temperature) >= 37.9) {
      alerts.push(t("alertFever", { val: log.temperature }));
    }

    if (alerts.length > 0) {
      var box = U.el("div", { class: "alert-banner", role: "alert" });
      var alertIcon = U.el("div", { class: "alert-icon", "aria-hidden": "true" });
      alertIcon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a5271d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      box.appendChild(alertIcon);
      var content = U.el("div", { class: "alert-content" });
      content.appendChild(U.el("h3", null, t("alertHeading")));
      var ul = U.el("ul", { style: "margin:0.25rem 0 0; padding-left:1.2rem;" });
      alerts.forEach(function (msg) {
        ul.appendChild(U.el("li", null, msg));
      });
      content.appendChild(ul);
      box.appendChild(content);
      banner.appendChild(box);
    }
  }

  /* Tiny sparkline for a single vital across the recent time series.
   * Wrapped in .sparkline-wrap (fixed height) so Chart.js sizes against a
   * bounded parent instead of looping on the card's auto height. */
  function renderSparkline(card, values, color) {
    if (!window.Chart || !values || values.length < 2) return;
    var wrap = U.el("div", { class: "sparkline-wrap" });
    var canvas = U.el("canvas", { class: "sparkline" });
    wrap.appendChild(canvas);
    card.appendChild(wrap);
    var ascendingVals = values.slice().reverse();
    var ctx = canvas.getContext("2d");
    var strokeColor = color || "#0f6b53";
    sparkCharts.push(new window.Chart(ctx, {
      type: "line",
      data: {
        labels: ascendingVals.map(function () { return ""; }),
        datasets: [{
          data: ascendingVals,
          borderColor: strokeColor,
          backgroundColor: strokeColor === "#a5271d" || strokeColor === "#c0392b"
            ? "rgba(165, 39, 29, 0.08)"
            : "rgba(15, 107, 83, 0.07)",
          fill: true,
          spanGaps: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 1.75,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        layout: { padding: { top: 2, bottom: 2, left: 1, right: 1 } },
      },
    }));
  }

  /* Newest-first series for a sparkline: up to 10 non-null values. */
  function sparkSeries(logs, key) {
    var out = [];
    for (var i = 0; i < logs.length && out.length < 10; i++) {
      var value = logs[i][key];
      if (!isMissing(value)) out.push(value);
    }
    return out;
  }

  function spark(logs, key, color) {
    var values = sparkSeries(logs, key);
    return values.length >= 2 ? { values: values, color: color } : null;
  }

  /* ---------------- hero status panel ---------------- */

  /* Overall status derived from the latest reading (display only).
   * Levels mirror the clinical alert rules: crisis/Stage 2 BP, critical
   * SpO2 and fever are "action"; Stage 1/Elevated BP, low SpO2 and a BMI
   * outside normal are "attention"; everything else is "normal". */
  function deriveStatus(log) {
    var findings = [];

    var bpCat = bpCategory(log.systolic_bp, log.diastolic_bp);
    var bpText =
      isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
        ? ""
        : " (" + log.systolic_bp + "/" + log.diastolic_bp + " mmHg)";
    if (bpCat === "Crisis" || bpCat === "Stage 2" || bpCat === "Stage 1") {
      findings.push({ text: t("findBpRange", { cat: tCat(bpCat), bp: bpText }), tone: bpCat === "Stage 1" ? "warn" : "bad" });
    } else if (bpCat === "Elevated") {
      findings.push({ text: t("findBpHigh", { bp: bpText }), tone: "warn" });
    }

    var spo2Cat = spo2Category(log.spo2);
    if (spo2Cat === "Critical") {
      findings.push({ text: t("findSpo2Crit", { val: log.spo2 }), tone: "bad" });
    } else if (spo2Cat === "Low") {
      findings.push({ text: t("findSpo2Low", { val: log.spo2 }), tone: "warn" });
    }

    if (!isMissing(log.temperature) && Number(log.temperature) >= 37.9) {
      findings.push({ text: t("findFever", { val: log.temperature }), tone: "bad" });
    }

    var bmiCat = bmiCategory(log.bmi);
    if (bmiCat && bmiCat !== "Normal") {
      findings.push({ text: t("findBmi", { cat: tCat(bmiCat), val: U.fmtNum(log.bmi, 1) }), tone: "warn" });
    }

    var level = findings.some(function (f) { return f.tone === "bad"; })
      ? "action"
      : findings.length
        ? "attention"
        : "normal";

    var sentence;
    if (level === "normal") {
      sentence = t("normalSentence");
    } else {
      var texts = findings.map(function (f) { return f.text; });
      var joined =
        texts.length === 1
          ? texts[0]
          : texts.slice(0, -1).join(", ") + t("statusJoinAnd") + texts[texts.length - 1];
      sentence = t("statusLatestPrefix", { findings: joined });
    }

    var next;
    if (level === "action") {
      next = t("actionNext");
    } else if (level === "attention") {
      next = t("attentionNext");
    } else {
      next = t("normalNext");
    }

    return {
      level: level,
      label: level === "action" ? t("statusAction") : level === "attention" ? t("statusMonitor") : t("statusNormal"),
      tone: level === "action" ? "bad" : level === "attention" ? "warn" : "ok",
      sentence: sentence,
      next: next,
    };
  }

  /* Time-of-day greeting in PHT using the stored name (no extra request). */
  function renderGreeting() {
    var node = document.getElementById("heroGreeting");
    if (!node) return;
    var hour = Number(
      new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        hour12: false,
      }).format(new Date())
    );
    hour = hour % 24; // some locales format midnight as "24"
    var part = hour < 12 ? t("greetingMorning") : hour < 18 ? t("greetingAfternoon") : t("greetingEvening");
    var first = (API.getName() || "").trim().split(/\s+/)[0];
    node.textContent = first ? part + ", " + first : part;
  }

  function applyDashboardHeadings() {
    var map = [
      ["headlineHeading", "headlineHeading"],
      ["supportHeading", "supportHeading"],
      ["trendsHeading", "trendsHeading"],
      ["bhwNotesHeading", "bhwNotesHeading"],
      ["bhwNotesSub", "bhwNotesSub"],
      ["vitalHintsSummary", "hintsSummary"],
    ];
    map.forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (el) el.textContent = t(pair[1]);
    });
  }

  function renderHero(log) {
    var pill = document.getElementById("heroPill");
    var sentence = document.getElementById("heroSentence");
    var next = document.getElementById("heroNext");
    if (!pill || !sentence || !next) return;
    var status = deriveStatus(log);
    pill.className = "hero-pill " + status.tone;
    pill.textContent = status.label;
    sentence.textContent = status.sentence;
    next.textContent = status.next;
  }

  /* No-readings onboarding state lives in the hero itself. */
  function renderHeroOnboarding() {
    var pill = document.getElementById("heroPill");
    var sentence = document.getElementById("heroSentence");
    var next = document.getElementById("heroNext");
    if (!pill || !sentence || !next) return;
    pill.className = "hero-pill muted";
    pill.textContent = t("noReadingsPill");
    sentence.textContent = t("noReadingsSentence");
    next.textContent = t("noReadingsNext");
  }

  /* Hero on a failed first load, so it never sits on "Checking…". */
  function renderHeroUnavailable() {
    var pill = document.getElementById("heroPill");
    var sentence = document.getElementById("heroSentence");
    var next = document.getElementById("heroNext");
    if (!pill || !sentence || !next) return;
    pill.className = "hero-pill muted";
    pill.textContent = t("unavailPill");
    sentence.textContent = t("unavailSentence");
    next.textContent = t("unavailNext");
  }

  /* ---------------- mini trends (dashboard at a glance) ---------------- */

  function miniSeries(logs, key) {
    return logs.map(function (log) {
      return isMissing(log[key]) ? null : log[key];
    });
  }

  function hasEnough(values) {
    return values.filter(function (v) { return v !== null; }).length >= 2;
  }

  /* Plain-language trend line for a chart, e.g.
   * "Systolic went from 128 to 135 mmHg over 5 readings (up 7)." */
  function trendSentence(values, label, unit, decimals) {
    var pts = values.filter(function (v) { return v !== null; }).map(Number);
    if (pts.length < 2) return "";
    var d = decimals || 0;
    var first = pts[0];
    var last = pts[pts.length - 1];
    var diff = last - first;
    var u = unit ? " " + unit : "";
    var change = Math.abs(diff) < Math.pow(10, -d) / 2
      ? t("trendNoChange")
      : t(diff > 0 ? "trendUp" : "trendDown", { diff: Math.abs(diff).toFixed(d) });
    return t("trendMsg", {
      label: label,
      first: first.toFixed(d),
      last: last.toFixed(d),
      unit: u,
      count: pts.length,
      change: change,
    });
  }

  function setChartSummary(id, parts) {
    var node = document.getElementById(id);
    if (!node) return;
    node.textContent = parts.filter(Boolean).join(" ");
  }

  function setMiniNote(canvasId, noteId, message) {
    var canvas = document.getElementById(canvasId);
    var note = document.getElementById(noteId);
    if (canvas) canvas.hidden = Boolean(message);
    if (note) U.empty(note, message || "");
  }

  /* Two compact trend charts for the last ≤10 readings. Chart.js is a
   * progressive enhancement: when the CDN is unreachable the canvases are
   * hidden and a text pointer to History is shown instead. */
  function renderMiniTrends(logs) {
    var section = document.getElementById("trendsSection");
    if (!section) return;
    if (logs.length < 2) {
      section.hidden = true;
      return;
    }
    section.hidden = false;

    var recent = logs.slice(0, 10).reverse(); // ascending, newest last
    var labels = recent.map(function (log) {
      return U.fmtDT(log.timestamp);
    });

    if (!window.Chart) {
      setMiniNote("bpMiniChart", "bpMiniNote", t("chartsUnavailMini"));
      setMiniNote("weightMiniChart", "weightMiniNote", t("chartsUnavailMini"));
      return;
    }

    var sys = miniSeries(recent, "systolic_bp");
    var dia = miniSeries(recent, "diastolic_bp");
    if (hasEnough(sys) || hasEnough(dia)) {
      setMiniNote("bpMiniChart", "bpMiniNote", "");
      setChartSummary("bpMiniSummary", [
        trendSentence(sys, t("chartSystolic"), "mmHg"),
        trendSentence(dia, t("chartDiastolic"), "mmHg"),
      ]);
      drawChart("bpMini", "bpMiniChart", {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: t("chartSystolic"),
              data: sys,
              borderColor: "#1565c0",
              spanGaps: true,
              tension: 0.25,
              pointRadius: 2.5,
            },
            {
              label: t("chartDiastolic"),
              data: dia,
              borderColor: "#b9761b",
              spanGaps: true,
              tension: 0.25,
              pointRadius: 2.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.7,
          plugins: { legend: { display: true, position: "bottom" } },
          scales: {
            x: { ticks: { maxTicksLimit: 5, maxRotation: 0 } },
            y: { beginAtZero: false },
          },
        },
      });
    } else {
      setMiniNote("bpMiniChart", "bpMiniNote", t("notEnoughBp"));
    }

    var weight = miniSeries(recent, "weight");
    var bmi = miniSeries(recent, "bmi");
    if (hasEnough(weight) || hasEnough(bmi)) {
      setMiniNote("weightMiniChart", "weightMiniNote", "");
      setChartSummary("weightMiniSummary", [
        trendSentence(weight, tLabel("Weight"), "kg", 1),
        trendSentence(bmi, t("chartBmi"), "", 1),
      ]);
      drawChart("weightMini", "weightMiniChart", {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: t("chartWeightKg"),
              data: weight,
              borderColor: "#0f6b53",
              backgroundColor: "rgba(15, 107, 83, 0.12)",
              fill: true,
              spanGaps: true,
              tension: 0.25,
              pointRadius: 2.5,
              yAxisID: "y",
            },
            {
              label: t("chartBmi"),
              data: bmi,
              borderColor: "#8a5a00",
              spanGaps: true,
              tension: 0.25,
              pointRadius: 2.5,
              yAxisID: "y1",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.7,
          plugins: { legend: { display: true, position: "bottom" } },
          scales: {
            x: { ticks: { maxTicksLimit: 5, maxRotation: 0 } },
            y: { position: "left", beginAtZero: false },
            y1: {
              position: "right",
              beginAtZero: false,
              grid: { drawOnChartArea: false },
            },
          },
        },
      });
    } else {
      setMiniNote("weightMiniChart", "weightMiniNote", t("notEnoughWeight"));
    }
  }

  function renderLatest(logs) {
    var log = logs[0];
    var prevLog = logs.length > 1 ? logs[1] : null;
    // Release the previous reading's sparkline instances (their canvases are
    // about to be removed) so repeated kiosk readings never leak charts.
    sparkCharts.forEach(function (chart) {
      chart.destroy();
    });
    sparkCharts = [];
    var cards = document.getElementById("cards");
    var supportCards = document.getElementById("supportCards");
    U.clear(cards);
    U.clear(supportCards);
    renderAlertBanner(log);
    renderHero(log);
    renderMiniTrends(logs);

    var fragHeadline = document.createDocumentFragment();
    var fragSupport = document.createDocumentFragment();
    var pendingSparks = [];

    // Delta calculations (vs the previous reading, when both exist)
    var weightDelta = prevLog && !isMissing(log.weight) && !isMissing(prevLog.weight)
      ? createDelta(log.weight - prevLog.weight, "kg", true) : null;
    var bmiDelta = prevLog && !isMissing(log.bmi) && !isMissing(prevLog.bmi)
      ? createDelta(log.bmi - prevLog.bmi, "", true) : null;
    var bpDelta = prevLog && !isMissing(log.systolic_bp) && !isMissing(prevLog.systolic_bp)
      ? createDelta(log.systolic_bp - prevLog.systolic_bp, "sys", true, false, 0) : null;
    var tempDelta = prevLog && !isMissing(log.temperature) && !isMissing(prevLog.temperature)
      ? createDelta(log.temperature - prevLog.temperature, "°C", true) : null;
    var pulseDelta = prevLog && !isMissing(log.pulse_rate) && !isMissing(prevLog.pulse_rate)
      ? createDelta(log.pulse_rate - prevLog.pulse_rate, "bpm", false, true, 0) : null;
    var spo2Delta = prevLog && !isMissing(log.spo2) && !isMissing(prevLog.spo2)
      ? createDelta(log.spo2 - prevLog.spo2, "%", false, false, 0) : null;

    // Cards are ordered by clinical priority: actionable vitals first,
    // anthropometrics (BMI / weight / height) last.
    var bpCat = bpCategory(log.systolic_bp, log.diastolic_bp);
    var bpGauge = !isMissing(log.systolic_bp)
      ? createGauge("track-bp", ((log.systolic_bp - 90) / (190 - 90)) * 100, t("gaugeBpLeft"), t("gaugeBpRight")) : null;
    var bpBadge = isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
      ? null
      : bpCat === "Normal"
        ? { text: t("catNormal"), tone: "good" }
        : bpCat === "Elevated"
          ? { text: t("catElevated"), tone: "warn" }
          : { text: tCat(bpCat), tone: "danger" };
    addCard(
      fragHeadline,
      "Blood pressure",
      isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
        ? "—"
        : log.systolic_bp + "/" + log.diastolic_bp,
      null,
      isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
        ? "missing"
        : bpCat === "Normal"
          ? null
          : "abnormal",
      bpGauge,
      bpDelta,
      spark(logs, "systolic_bp", "#0f6b53"),
      pendingSparks,
      t("targetBp"),
      bpBadge,
      "mmHg"
    );

    var spo2Cat = spo2Category(log.spo2);
    var spo2Gauge = !isMissing(log.spo2)
      ? createGauge("track-spo2", ((log.spo2 - 80) / (100 - 80)) * 100, t("gaugeSpo2Left"), t("gaugeSpo2Right")) : null;
    var spo2Badge = isMissing(log.spo2)
      ? null
      : spo2Cat === "Normal"
        ? { text: t("catNormal"), tone: "good" }
        : spo2Cat === "Low"
          ? { text: t("catLowSpo2"), tone: "warn" }
          : { text: t("catCritical"), tone: "danger" };
    addCard(
      fragHeadline,
      "SpO2 (Oxygen)",
      U.fmtNum(log.spo2, 0),
      null,
      isMissing(log.spo2) ? "missing" : spo2Cat === "Normal" ? null : "abnormal",
      spo2Gauge,
      spo2Delta,
      spark(logs, "spo2", "#0f6b53"),
      pendingSparks,
      t("targetSpo2"),
      spo2Badge,
      "%"
    );

    var hasFever = !isMissing(log.temperature) && Number(log.temperature) >= 37.9;
    var tempGauge = !isMissing(log.temperature)
      ? createGauge("track-temp", ((log.temperature - 35) / (40 - 35)) * 100, "36.0°C", t("gaugeTempRight")) : null;
    var tempBadge = isMissing(log.temperature)
      ? null
      : hasFever
        ? { text: t("catFever"), tone: "danger" }
        : { text: t("catNormal"), tone: "good" };
    addCard(
      fragHeadline,
      "Body temperature",
      U.fmtNum(log.temperature, 1),
      null,
      isMissing(log.temperature) ? "missing" : hasFever ? "abnormal" : null,
      tempGauge,
      tempDelta,
      spark(logs, "temperature", hasFever ? "#c0392b" : "#0f6b53"),
      pendingSparks,
      t("targetTemp"),
      tempBadge,
      "°C"
    );

    var pulseBadge = isMissing(log.pulse_rate)
      ? null
      : (log.pulse_rate >= 60 && log.pulse_rate <= 100)
        ? { text: t("catNormal"), tone: "good" }
        : { text: log.pulse_rate < 60 ? t("catLowPulse") : t("catElevated"), tone: "warn" };
    addCard(
      fragSupport,
      "Pulse rate",
      U.fmtNum(log.pulse_rate, 0),
      null,
      isMissing(log.pulse_rate) ? "missing" : null,
      null,
      pulseDelta,
      spark(logs, "pulse_rate", "#0f6b53"),
      pendingSparks,
      t("targetPulse"),
      pulseBadge,
      "bpm"
    );

    var bmiCat = bmiCategory(log.bmi);
    var bmiGauge = !isMissing(log.bmi)
      ? createGauge("track-bmi", ((log.bmi - 15) / (35 - 15)) * 100, t("gaugeBmiLeft"), t("gaugeBmiRight")) : null;
    var bmiBadge = isMissing(log.bmi)
      ? null
      : bmiCat === "Normal"
        ? { text: t("catNormal"), tone: "good" }
        : { text: tCat(bmiCat), tone: "warn" };
    addCard(
      fragSupport,
      "Body mass index",
      isMissing(log.bmi) ? "—" : U.fmtNum(log.bmi, 1),
      null,
      isMissing(log.bmi) ? "missing" : bmiCat === "Normal" ? null : "abnormal",
      bmiGauge,
      bmiDelta,
      spark(logs, "bmi", "#0f6b53"),
      pendingSparks,
      t("targetBmi"),
      bmiBadge,
      "BMI"
    );

    addCard(
      fragSupport,
      "Weight",
      U.fmtNum(log.weight, 1),
      null,
      isMissing(log.weight) ? "missing" : null,
      null,
      weightDelta,
      spark(logs, "weight", "#0f6b53"),
      pendingSparks,
      t("targetWeight"),
      null,
      "kg"
    );

    addCard(
      fragSupport,
      "Height",
      U.fmtNum(log.height, 1),
      null,
      isMissing(log.height) ? "missing" : null,
      null,
      null,
      null,
      null,
      t("targetHeight"),
      null,
      "cm"
    );

    // Batch append to DOM in a single reflow/repaint pass
    cards.appendChild(fragHeadline);
    supportCards.appendChild(fragSupport);

    // Render sparklines after canvases are attached to live DOM
    pendingSparks.forEach(function (p) {
      renderSparkline(p.card, p.values, p.color);
    });
  }

  function renderConsentChip(granted) {
    var chip = document.getElementById("consentChip");
    if (chip) {
      chip.className = "status-chip " + (granted ? "granted" : "not-granted");
      chip.textContent = granted ? t("consentGranted") : t("consentNotGranted");
      chip.title = granted ? t("consentTitleYes") : t("consentTitleNo");
    }
    // Trust strip: plain-language explanation of what the chip means.
    var explain = document.getElementById("consentExplain");
    if (explain) {
      U.clear(explain);
      explain.appendChild(
        document.createTextNode(
          granted ? t("consentExplainYes") : t("consentExplainNo")
        )
      );
      explain.appendChild(U.el("a", { href: "/citizen/consent.html" }, t("consentLink")));
      explain.appendChild(document.createTextNode("."));
    }
  }

  function renderBhwNotes(notes) {
    var container = document.getElementById("bhwNotesList");
    if (!container) return;
    U.clear(container);
    if (!notes || !notes.length) {
      U.empty(container, t("bhwNotesEmpty"));
      return;
    }
    var list = U.el("ul", { class: "citizen-notes-list" });
    notes.forEach(function (item) {
      var text = item.note || "";
      var isReferral = text.indexOf("Referral to RHU:") === 0;
      var card = U.el("li", {
        class: "citizen-note-card" + (isReferral ? " is-referral" : ""),
      });
      if (isReferral) {
        card.appendChild(
          U.el("span", { class: "citizen-note-ref" }, t("bhwNotesRefBadge"))
        );
      }
      card.appendChild(U.el("p", { class: "citizen-note-text" }, text));
      card.appendChild(
        U.el(
          "div",
          { class: "citizen-note-meta" },
          t("bhwNotesFrom") + " " + (item.bhw || "BHW") + " · " + U.fmtDT(item.timestamp)
        )
      );
      list.appendChild(card);
    });
    container.appendChild(list);
  }

  async function initDashboard() {
    if (!API.requireRole("citizen")) return;
    var statusNode = document.getElementById("status");
    var cards = document.getElementById("cards");
    var supportCards = document.getElementById("supportCards");
    var headlineSection = document.getElementById("headlineSection");
    var supportSection = document.getElementById("supportSection");
    var trendsSection = document.getElementById("trendsSection");
    var emptyNode = document.getElementById("emptyState");
    var meta = document.getElementById("latestMeta");
    var passportBtn = document.getElementById("passportBtn");

    var knownTimestamp = null;
    var latestLog = null;
    var cachedLogs = [];
    var cachedConsent = null;
    var cachedNotes = [];
    var loaded = false;
    var noticeDismissedInPage = false;

    function setVitalsVisible(visible) {
      [headlineSection, supportSection, trendsSection].forEach(function (node) {
        if (node) node.hidden = !visible;
      });
    }

    function renderLatestMeta(logs) {
      if (!logs || !logs.length) {
        meta.textContent = "";
        return;
      }
      var latest = logs[0];
      var visitsCount = logs.length;
      var visitsLabel = visitsCount === 1 ? t("checkinSingle") : t("checkinPlural", { n: visitsCount });
      meta.textContent = t("latestMetaText", {
        dt: U.fmtDT(latest.timestamp),
        age: fmtAgeLocal(latest.timestamp),
        visits: visitsLabel,
      });
    }

    function syncLangUI() {
      applyCitizenI18n();
      renderGreeting();
      applyDashboardHeadings();
      if (cachedConsent !== null) renderConsentChip(cachedConsent);
      if (loaded) {
        if (cachedLogs.length) {
          renderLatest(cachedLogs);
          renderLatestMeta(cachedLogs);
        } else {
          renderHeroOnboarding();
        }
        renderBhwNotes(cachedNotes);
      }
    }

    bindLangSwitchers(syncLangUI);
    syncLangUI();

    async function load(options) {
      var isAuto = Boolean(options && options.auto);
      // First load shows a spinner; later refreshes keep content on screen
      // (stale-while-revalidate) so nothing flashes.
      if (!loaded && !isAuto) U.loading(statusNode, t("loadingLatest"));
      try {
        var results = await Promise.all([
          API.apiFetch("/api/health-data"),
          API.apiFetch("/api/consent"),
          API.apiFetch("/api/citizen/notes").catch(function () {
            return { notes: cachedNotes };
          }),
        ]);
        U.clear(statusNode);
        var logs = results[0].logs || [];
        var consentInfo = results[1] || {};
        cachedLogs = logs;
        cachedConsent = Boolean(consentInfo.consent_granted);
        cachedNotes = (results[2] && results[2].notes) || [];
        renderConsentChip(cachedConsent);
        renderBhwNotes(cachedNotes);

        var shouldShowConsentModal =
          !isAuto &&
          consentInfo.privacy_acknowledged === false &&
          !noticeDismissedInPage &&
          API.getPrivacyAcknowledged() !== true;

        if (shouldShowConsentModal) {
          showCitizenConsentModal(function () {
            noticeDismissedInPage = true;
          });
        } else if (consentInfo.privacy_acknowledged) {
          API.setPrivacyAcknowledged(true);
        }

        if (logs.length === 0) {
          knownTimestamp = null;
          latestLog = null;
          U.clear(cards);
          U.clear(supportCards);
          setVitalsVisible(false);
          renderHeroOnboarding();
          U.clear(emptyNode);
          meta.textContent = "";
          if (passportBtn) passportBtn.hidden = false;
          loaded = true;
          return true;
        }

        U.clear(emptyNode);
        setVitalsVisible(true);
        if (passportBtn) passportBtn.hidden = false;
        var latest = logs[0];
        renderLatestMeta(logs);

        // Re-render only when a new kiosk reading actually arrived, so the
        // 60s poll never disturbs the screen or screen-reader users.
        if (knownTimestamp !== latest.timestamp) {
          knownTimestamp = latest.timestamp;
          latestLog = latest;
          renderLatest(logs);
        }
        loaded = true;
        return true;
      } catch (error) {
        // First-load/manual failures surface an error with Retry; auto-refresh
        // failures keep the stale (still valid) content on screen.
        if (!isAuto) {
          if (!loaded) {
            U.clear(cards);
            U.clear(supportCards);
            renderHeroUnavailable();
          }
          U.error(statusNode, error.message, function () {
            load({});
          });
        }
        return false;
      }
    }

    if (passportBtn) {
      passportBtn.onclick = async function () {
        setBusy(passportBtn, true, t("btnOpening"));
        var me = {};
        try {
          me = await API.apiFetch("/api/me");
        } catch (e) {
          me = { full_name: API.getName() };
        } finally {
          setBusy(passportBtn, false);
        }
        showHealthPassportModal(me, latestLog);
      };
    }

    var guideBtnDashboard = document.getElementById("vitalsGuideBtnDashboard");
    if (guideBtnDashboard) {
      guideBtnDashboard.onclick = showVitalsGuideModal;
    }

    var refreshBtn = document.getElementById("citizenRefreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async function () {
        setBusy(refreshBtn, true, t("btnRefreshing"));
        try {
          var ok = await load({});
          if (ok) U.toast(t("toastRefreshed"), "success");
        } finally {
          setBusy(refreshBtn, false);
        }
      });
    }

    await load({});

    // Real-time live synchronization: instantly updates cards when kiosk POSTs
    var realtimeSync = API.initRealtimeSync({
      initialLogId: (latestLog && latestLog.id) || 0,
      onReading: function (reading) {
        load({ auto: true }).then(function (ok) {
          if (!ok) return;
          var allCards = document.querySelectorAll("#cards .card, #supportCards .card");
          allCards.forEach(function (c) {
            c.classList.remove("card-pulse");
            void c.offsetWidth;
            c.classList.add("card-pulse");
          });
          var bmiNote = reading.bmi ? (" · BMI: " + reading.bmi) : "";
          U.toast(t("toastNewReading") + bmiNote, "success");
        });
      },
    });
  }

  /* ---------------- history ---------------- */

  var historyState = {
    logs: [],
    filter: "",
    range: "all",
    page: 1,
    pageSize: 10,
    viewMode: null,
    chartGroup: window.innerWidth <= 640 ? "key" : "all",
  };

  var HISTORY_RANGES = [
    { key: "all", labelKey: "rangeAll", days: null },
    { key: "7", labelKey: "range7", days: 7 },
    { key: "30", labelKey: "range30", days: 30 },
    { key: "90", labelKey: "range90", days: 90 },
  ];

  function logTime(log) {
    return new Date(String(log.timestamp).replace(" ", "T") + "Z").getTime();
  }

  /* Per-cell tone for the history table: "" | "cell-warn" | "cell-bad". */
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
        if (log.temperature >= 37.9) return "cell-bad";
        return log.temperature < 35.5 ? "cell-warn" : "";
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

  function renderLogTable(logs) {
    historyState.logs = logs || [];
    var wrap = document.getElementById("tableWrap");
    var controls = document.getElementById("tableControls");
    var paginationWrap = document.getElementById("paginationWrap");
    U.clear(wrap);
    if (controls) U.clear(controls);
    if (paginationWrap) U.clear(paginationWrap);

    // Filter controls
    if (controls) {
      var searchDiv = U.el("div", { class: "table-search" });
      // Visible label (placeholder alone is not an accessible label).
      var inputId = "historyFilterInput";
      searchDiv.appendChild(
        U.el(
          "label",
          {
            for: inputId,
            class: "muted",
            style: "display:block; font-size:0.8rem; margin-bottom:0.25rem;",
          },
          t("filterLabel")
        )
      );
      var input = U.el("input", {
        id: inputId,
        type: "search",
        placeholder: t("filterPlaceholder"),
        value: historyState.filter,
      });
      input.oninput = function () {
        historyState.filter = input.value.trim().toLowerCase();
        historyState.page = 1;
        drawTableRows();
      };
      searchDiv.appendChild(input);
      controls.appendChild(searchDiv);

      var presets = U.el("div", { class: "date-presets", role: "group", "aria-label": t("filterLabel") });
      HISTORY_RANGES.forEach(function (r) {
        var btn = U.el("button", {
          type: "button",
          class: "date-preset-btn" + (historyState.range === r.key ? " active" : ""),
          "aria-pressed": historyState.range === r.key ? "true" : "false",
        }, t(r.labelKey));
        btn.onclick = function () {
          historyState.range = r.key;
          historyState.page = 1;
          presets.querySelectorAll(".date-preset-btn").forEach(function (b) {
            b.classList.remove("active");
            b.setAttribute("aria-pressed", "false");
          });
          btn.classList.add("active");
          btn.setAttribute("aria-pressed", "true");
          drawTableRows();
        };
        presets.appendChild(btn);
      });
      controls.appendChild(presets);

      var countLbl = U.el("span", { id: "historyCount", class: "muted", style: "font-size:0.85rem;" }, t("totalReadingsCount", { n: logs.length }));
      controls.appendChild(countLbl);
    }

    drawTableRows();
  }

  function drawTableRows() {
    var wrap = document.getElementById("tableWrap");
    var paginationWrap = document.getElementById("paginationWrap");
    U.clear(wrap);
    if (paginationWrap) U.clear(paginationWrap);

    var range = HISTORY_RANGES.filter(function (r) { return r.key === historyState.range; })[0];
    var cutoff = range && range.days ? Date.now() - range.days * 86400000 : null;

    var filtered = historyState.logs.filter(function (log) {
      if (cutoff !== null && logTime(log) < cutoff) return false;
      if (!historyState.filter) return true;
      var text = (U.fmtDT(log.timestamp) + " " + (log.weight || "") + " " + (log.bmi || "") + " " +
        (log.systolic_bp || "") + "/" + (log.diastolic_bp || "") + " " + (log.temperature || "")).toLowerCase();
      return text.indexOf(historyState.filter) >= 0;
    });

    var countLbl = document.getElementById("historyCount");
    if (countLbl) {
      countLbl.textContent = filtered.length === historyState.logs.length
        ? t("totalReadingsCount", { n: historyState.logs.length })
        : t("showingReadingsCount", { shown: filtered.length, total: historyState.logs.length });
    }

    if (!filtered.length) {
      U.empty(wrap, t("noMatchFilter"));
      return;
    }

    var totalPages = Math.ceil(filtered.length / historyState.pageSize);
    if (historyState.page > totalPages) historyState.page = totalPages;
    var startIdx = (historyState.page - 1) * historyState.pageSize;
    var pageSlice = filtered.slice(startIdx, startIdx + historyState.pageSize);

    var tableWrap = U.el("div", { class: "table-wrap" });
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    [t("thTime"), t("thWeight"), t("thHeight"), t("thBmi"), t("thTemp"), t("thPulse"), t("thSpo2"), t("thBp")]
      .forEach(function (label, index) {
        headRow.appendChild(U.el("th", index === 0 ? { scope: "col" } : { class: "num", scope: "col" }, label));
      });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    var rowsFrag = document.createDocumentFragment();
    pageSlice.forEach(function (log) {
      var row = U.el("tr");
      row.appendChild(U.el("td", { class: "cell-time nowrap", title: U.fmtUTC(log.timestamp), style: "font-weight:600; text-align:left;" }, U.fmtDT(log.timestamp)));
      [
        [U.fmtNum(log.weight, 1), ""],
        [U.fmtNum(log.height, 1), ""],
        [U.fmtNum(log.bmi, 1), cellTone("bmi", log)],
        [U.fmtNum(log.temperature, 1), cellTone("temp", log)],
        [U.fmtNum(log.pulse_rate, 0), cellTone("pulse", log)],
        [U.fmtNum(log.spo2, 0), cellTone("spo2", log)],
        [isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
          ? "—"
          : log.systolic_bp + "/" + log.diastolic_bp, cellTone("bp", log)],
      ].forEach(function (pair) {
        var tone = pair[1];
        var td = U.el("td", { class: "num" + (tone ? " " + tone : "") });
        td.appendChild(document.createTextNode(pair[0]));
        if (tone) {
          // Not colour-only: screen readers and greyscale prints get a word.
          td.appendChild(U.el("span", { class: "sr-only" }, " (" + t(tone === "cell-bad" ? "needsAttentionLegend" : "outsideNormalLegend") + ")"));
        }
        row.appendChild(td);
      });
      rowsFrag.appendChild(row);
    });
    tbody.appendChild(rowsFrag);
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    var views = U.wrapCheckinViews(pageSlice, tableWrap, cellTone, historyState.viewMode, checkinViewsI18n());
    var origSetMode = views.setMode;
    views.setMode = function (next) {
      historyState.viewMode = next;
      origSetMode(next);
    };
    wrap.appendChild(views.container);

    // Pagination
    if (paginationWrap && totalPages > 1) {
      var pager = U.el("div", { class: "pagination" });
      var prevBtn = U.el("button", { type: "button", disabled: historyState.page <= 1 }, t("pagerPrev"));
      prevBtn.onclick = function () {
        if (historyState.page > 1) {
          historyState.page--;
          drawTableRows();
        }
      };
      pager.appendChild(prevBtn);

      pager.appendChild(U.el("span", { class: "muted" }, t("pagerPageOf", { page: historyState.page, total: totalPages })));

      var nextBtn = U.el("button", { type: "button", disabled: historyState.page >= totalPages }, t("pagerNext"));
      nextBtn.onclick = function () {
        if (historyState.page < totalPages) {
          historyState.page++;
          drawTableRows();
        }
      };
      pager.appendChild(nextBtn);
      paginationWrap.appendChild(pager);
    }
  }

  function drawChart(key, canvasId, config) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;
    if (charts[key]) charts[key].destroy();
    charts[key] = new window.Chart(canvas, config);
  }

  function renderCharts(logs) {
    var note = document.getElementById("chartNote");
    var section = document.getElementById("chartsSection");
    U.clear(note);

    if (!window.Chart) {
      section.hidden = true;
      var chartTabsHidden = document.getElementById("historyChartTabs");
      if (chartTabsHidden) chartTabsHidden.hidden = true;
      U.empty(note, t("chartsUnavailHistory"));
      return;
    }
    section.hidden = false;
    var chartTabs = document.getElementById("historyChartTabs");
    if (chartTabs) chartTabs.hidden = false;
    if (!thresholdRegistered) {
      window.Chart.register(feverThresholdPlugin);
      thresholdRegistered = true;
    }

    var ascending = logs.slice().reverse();
    var labels = ascending.map(function (log) {
      return U.fmtDT(log.timestamp);
    });
    function series(key) {
      return ascending.map(function (log) { return isMissing(log[key]) ? null : log[key]; });
    }
    setChartSummary("temperatureSummary", [trendSentence(series("temperature"), tLabel("Body temperature"), "°C", 1)]);
    setChartSummary("weightSummary", [trendSentence(series("weight"), tLabel("Weight"), "kg", 1)]);
    setChartSummary("bmiSummary", [trendSentence(series("bmi"), t("chartBmi"), "", 1)]);
    setChartSummary("bpSummary", [
      trendSentence(series("systolic_bp"), t("chartSystolic"), "mmHg"),
      trendSentence(series("diastolic_bp"), t("chartDiastolic"), "mmHg"),
    ]);
    setChartSummary("spo2Summary", [trendSentence(series("spo2"), t("chartSpo2Pct"), "%")]);
    var green = "#0f6b53";
    var red = "#a5271d";
    var baseOptions = {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } },
        y: { beginAtZero: false },
      },
    };

    drawChart("weight", "weightChart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: t("chartWeightKg"),
            data: ascending.map(function (log) {
              return log.weight;
            }),
            borderColor: green,
            backgroundColor: "rgba(15, 107, 83, 0.12)",
            fill: true,
            spanGaps: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: baseOptions,
    });

    drawChart("bmi", "bmiChart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: t("chartBmi"),
            data: ascending.map(function (log) {
              return log.bmi;
            }),
            borderColor: "#8a5a00",
            backgroundColor: "rgba(138, 90, 0, 0.12)",
            fill: true,
            spanGaps: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: baseOptions,
    });

    drawChart("bp", "bpChart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: t("chartSystolic"),
            data: ascending.map(function (log) {
              return log.systolic_bp;
            }),
            borderColor: "#1565c0",
            backgroundColor: "rgba(21, 101, 192, 0.10)",
            spanGaps: true,
            tension: 0.25,
            pointRadius: 3,
            pointStyle: "circle",
          },
          {
            label: t("chartDiastolic"),
            data: ascending.map(function (log) {
              return log.diastolic_bp;
            }),
            borderColor: "#b9761b",
            backgroundColor: "rgba(185, 118, 27, 0.10)",
            spanGaps: true,
            tension: 0.25,
            pointRadius: 3,
            pointStyle: "rect",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: { legend: { display: true, position: "bottom" } },
        scales: {
          x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } },
          y: { beginAtZero: false },
        },
      },
    });

    drawChart("spo2", "spo2Chart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: t("chartSpo2Pct"),
            data: ascending.map(function (log) {
              return log.spo2;
            }),
            borderColor: "#0b3d30",
            backgroundColor: "rgba(11, 61, 48, 0.12)",
            fill: true,
            spanGaps: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } },
          y: { suggestedMin: 80, suggestedMax: 100 },
        },
      },
    });

    var temps = ascending.map(function (log) {
      return log.temperature;
    });
    var tempMax = Math.max.apply(
      null,
      temps.filter(function (t) {
        return t !== null && t !== undefined;
      }).concat([38.5])
    );
    drawChart("temperature", "temperatureChart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: t("chartTempC"),
            data: temps,
            borderColor: "#a5271d",
            backgroundColor: "rgba(165, 39, 29, 0.12)",
            fill: true,
            spanGaps: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: { display: false },
          feverThreshold: {},
        },
        scales: {
          x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } },
          y: {
            beginAtZero: false,
            suggestedMin: 34,
            suggestedMax: tempMax,
            title: { display: true, text: "°C" },
          },
        },
      },
    });
  }

  async function initHistory() {
    if (!API.requireRole("citizen")) return;
    var statusNode = document.getElementById("status");
    var tableWrap = document.getElementById("tableWrap");
    var section = document.getElementById("chartsSection");
    var passportBtn = document.getElementById("passportBtnHistory");
    var chartTabs = document.getElementById("historyChartTabs");

    function applyChartFilter(group) {
      historyState.chartGroup = group;
      var allowed = {
        key: ["bp", "temp"],
        all: ["temp", "weight", "bmi", "bp", "spo2"],
        bp: ["bp"],
        temp: ["temp"],
        spo2: ["spo2"],
        body: ["weight", "bmi"],
      }[group] || ["temp", "weight", "bmi", "bp", "spo2"];
      if (chartTabs) {
        chartTabs.querySelectorAll(".chart-filter-btn").forEach(function (btn) {
          var active = btn.dataset.chartGroup === group;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
      }
      if (section) {
        section.querySelectorAll(".chart-box[data-chart-metric]").forEach(function (box) {
          box.hidden = allowed.indexOf(box.dataset.chartMetric) === -1;
        });
      }
      Object.keys(charts).forEach(function (k) {
        if (charts[k] && typeof charts[k].resize === "function") {
          requestAnimationFrame(function () { charts[k].resize(); });
        }
      });
    }

    if (chartTabs) {
      chartTabs.querySelectorAll(".chart-filter-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          applyChartFilter(btn.dataset.chartGroup);
        });
      });
    }

    if (passportBtn) {
      passportBtn.onclick = async function () {
        setBusy(passportBtn, true, t("btnOpening"));
        var me = {};
        try {
          me = await API.apiFetch("/api/me");
        } catch (e) {
          me = { full_name: API.getName() };
        } finally {
          setBusy(passportBtn, false);
        }
        var latest = (historyState.logs && historyState.logs.length) ? historyState.logs[0] : null;
        showHealthPassportModal(me, latest);
      };
    }

    var guideBtnHistory = document.getElementById("vitalsGuideBtnHistory");
    if (guideBtnHistory) {
      guideBtnHistory.onclick = showVitalsGuideModal;
    }

    var exportCsvBtn = document.getElementById("exportCsvBtn");
    if (exportCsvBtn) {
      exportCsvBtn.onclick = function () {
        var logs = historyState.logs || [];
        if (!logs.length) {
          U.toast(t("csvNone"), "warn");
          return;
        }
        var headers = [
          "Timestamp (PHT)",
          "Systolic BP (mmHg)",
          "Diastolic BP (mmHg)",
          "BP Category",
          "Heart Rate (bpm)",
          "SpO2 (%)",
          "Temperature (°C)",
          "Weight (kg)",
          "Height (cm)",
          "BMI",
          "BMI Category"
        ];
        var rows = logs.map(function (log) {
          return [
            U.fmtDT(log.timestamp),
            isMissing(log.systolic_bp) ? "" : log.systolic_bp,
            isMissing(log.diastolic_bp) ? "" : log.diastolic_bp,
            bpCategory(log.systolic_bp, log.diastolic_bp) || "",
            isMissing(log.pulse_rate) ? "" : log.pulse_rate,
            isMissing(log.spo2) ? "" : log.spo2,
            isMissing(log.temperature) ? "" : log.temperature,
            isMissing(log.weight) ? "" : log.weight,
            isMissing(log.height) ? "" : log.height,
            isMissing(log.bmi) ? "" : log.bmi,
            bmiCategory(log.bmi) || ""
          ].map(function (cell) {
            var s = String(cell == null ? "" : cell);
            if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
            s = s.replace(/"/g, '""');
            return /[",\r\n]/.test(s) ? '"' + s + '"' : s;
          }).join(",");
        });
        var csvContent = "\uFEFF" + headers.join(",") + "\r\n" + rows.join("\r\n");
        var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        var dateSlug = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = "health_records_" + dateSlug + ".csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        U.toast(t("csvDone", { n: logs.length }), "success");
      };
    }

    bindLangSwitchers(function () {
      if (historyState.logs && historyState.logs.length > 0) {
        renderLogTable(historyState.logs);
        renderCharts(historyState.logs);
        applyChartFilter(historyState.chartGroup);
      } else if (statusNode && statusNode.querySelector(".empty")) {
        U.empty(statusNode, t("noReadingsHistory"));
      }
    });

    U.loading(statusNode, t("loadingReadings"));
    U.clear(tableWrap);
    section.hidden = true;

    try {
      var data = await API.apiFetch("/api/health-data");
      U.clear(statusNode);
      var logs = data.logs || [];
      historyState.logs = logs;
      if (logs.length === 0) {
        U.empty(statusNode, t("noReadingsHistory"));
        U.clear(document.getElementById("chartNote"));
        return;
      }
      renderLogTable(logs);
      renderCharts(logs);
      applyChartFilter(historyState.chartGroup);

      API.initRealtimeSync({
        onReading: function () {
          API.apiFetch("/api/health-data").then(function (res) {
            var freshLogs = res.logs || [];
            historyState.logs = freshLogs;
            if (freshLogs.length > 0) {
              section.hidden = false;
              renderLogTable(freshLogs);
              renderCharts(freshLogs);
              U.toast(t("toastHistoryNew"), "success");
            }
          });
        },
      });
    } catch (error) {
      section.hidden = true;
      U.clear(tableWrap);
      U.error(statusNode, error.message, initHistory);
    }
  }

  /* ---------------- consent ---------------- */

  function consentBadge(granted) {
    return U.el(
      "span",
      { class: "badge " + (granted ? "badge-ok" : "badge-no") },
      t(granted ? "consBadgeGranted" : "consBadgeNotGranted")
    );
  }

  function renderConsentState(granted) {
    var stateNode = document.getElementById("consentState");
    U.clear(stateNode);
    stateNode.appendChild(consentBadge(granted));
    stateNode.appendChild(
      document.createTextNode(t(granted ? "consStateYes" : "consStateNo"))
    );
    document.getElementById("grantBtn").disabled = granted;
    document.getElementById("revokeBtn").disabled = !granted;
    var colOn = document.getElementById("consentColOn");
    var colOff = document.getElementById("consentColOff");
    if (colOn) colOn.classList.toggle("is-current", granted);
    if (colOff) colOff.classList.toggle("is-current", !granted);
  }

  function renderConsentHistory(history) {
    var wrap = document.getElementById("historyWrap");
    U.clear(wrap);
    if (!history.length) {
      U.empty(wrap, t("consHistoryEmpty"));
      return;
    }
    var tableWrap = U.el("div", { class: "table-wrap" });
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    [t("thTime"), t("consThAction"), t("consThIp")].forEach(function (label) {
      headRow.appendChild(U.el("th", { scope: "col" }, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    history.forEach(function (entry) {
      var row = U.el("tr");
      row.appendChild(U.el("td", { class: "cell-time nowrap", title: U.fmtUTC(entry.timestamp), style: "font-weight:600; text-align:left;" }, U.fmtDT(entry.timestamp)));
      var actionCell = U.el("td");
      actionCell.appendChild(
        U.el(
          "span",
          { class: "badge " + (entry.action === "granted" ? "badge-ok" : "badge-warn") },
          t(entry.action === "granted" ? "consBadgeGranted" : "consBadgeRevoked")
        )
      );
      row.appendChild(actionCell);
      row.appendChild(U.el("td", null, entry.ip_address || "—"));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);
  }

  var cachedConsentState = { loaded: false, granted: false, history: [] };

  async function loadConsent(statusNode) {
    var results = await Promise.all([
      API.apiFetch("/api/consent"),
      API.apiFetch("/api/citizen/consent-history"),
    ]);
    cachedConsentState.loaded = true;
    cachedConsentState.granted = Boolean(results[0].consent_granted);
    cachedConsentState.history = results[1].history || [];
    renderConsentState(cachedConsentState.granted);
    renderConsentHistory(cachedConsentState.history);
    U.clear(statusNode);
  }

  async function initConsent() {
    if (!API.requireRole("citizen")) return;
    var statusNode = document.getElementById("status");
    var grantBtn = document.getElementById("grantBtn");
    var revokeBtn = document.getElementById("revokeBtn");

    bindLangSwitchers(function () {
      if (cachedConsentState.loaded) {
        renderConsentState(cachedConsentState.granted);
        renderConsentHistory(cachedConsentState.history);
      }
    });

    U.loading(statusNode, t("consChecking"));
    try {
      await loadConsent(statusNode);
    } catch (error) {
      U.error(statusNode, error.message);
      document.getElementById("consentState").textContent = t("consUnavail");
      grantBtn.disabled = true;
      revokeBtn.disabled = true;
      return;
    }

    async function changeConsent(granted) {
      grantBtn.disabled = true;
      revokeBtn.disabled = true;
      U.loading(statusNode, t(granted ? "consGranting" : "consRevoking"));
      try {
        await API.apiFetch("/api/consent", {
          method: "POST",
          body: { consent_granted: granted },
        });
        await loadConsent(statusNode);
        U.toast(t(granted ? "consToastGranted" : "consToastRevoked"), "success");
      } catch (error) {
        U.error(statusNode, error.message);
        try {
          await loadConsent(statusNode);
        } catch (reloadError) {
          /* the error state from the failed action stays visible */
        }
      }
    }

    grantBtn.addEventListener("click", function () {
      U.confirmDialog({
        title: t("consDlgGrantTitle"),
        message: t("consDlgGrantMsg"),
        note: t("consDlgGrantNote"),
        confirmLabel: t("btnGrantConsent"),
        cancelLabel: t("consDlgKeepPriv"),
        onConfirm: function () { changeConsent(true); },
      });
    });
    revokeBtn.addEventListener("click", function () {
      U.confirmDialog({
        title: t("consDlgRevokeTitle"),
        message: t("consDlgRevokeMsg"),
        note: t("consDlgRevokeNote"),
        confirmLabel: t("btnRevokeConsent"),
        cancelLabel: t("consDlgCancel"),
        danger: true,
        onConfirm: function () { changeConsent(false); },
      });
    });
  }

  /* ---------------- profile ---------------- */

  /* Inline, per-field validation message under an input. Pass "" to clear. */
  function setFieldError(input, message) {
    if (!input) return;
    var errId = input.id + "FieldError";
    var node = document.getElementById(errId);
    if (!node) {
      node = U.el("p", { id: errId, class: "field-error" });
      var field = input.closest(".field") || input.parentNode;
      field.appendChild(node);
      var described = (input.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
      if (described.indexOf(errId) < 0) described.unshift(errId);
      input.setAttribute("aria-describedby", described.join(" "));
    }
    node.textContent = message || "";
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function validateFullName(value) {
    if (!value) return "Full name is required.";
    if (value.length < 2) return "Enter your full name.";
    return "";
  }

  function validateBirthdate(value) {
    if (!value) return "Birthdate is required.";
    if (value > todayISO()) return "Birthdate cannot be in the future.";
    if (value < "1900-01-01") return "Check the year of your birthdate.";
    return "";
  }

  async function initProfile() {
    if (!API.requireRole("citizen")) return;
    var statusNode = document.getElementById("status");
    var profileForm = document.getElementById("profileForm");
    var passwordForm = document.getElementById("passwordForm");
    var profileError = document.getElementById("profileError");
    var profileFeedback = document.getElementById("profileFeedback");
    var passwordError = document.getElementById("passwordError");
    var passwordFeedback = document.getElementById("passwordFeedback");
    var nameInput = document.getElementById("fullName");
    var birthInput = document.getElementById("birthdate");
    var genderSelect = document.getElementById("gender");
    var profileSubmit = document.getElementById("profileSubmit");
    var newPwInput = document.getElementById("newPassword");
    var pwHint = document.getElementById("passwordHint");
    var saved = null; // last saved values, for unsaved-change tracking
    var feedbackTimer = null;

    birthInput.max = todayISO();

    function currentValues() {
      return { full_name: fieldValue("fullName"), birthdate: fieldValue("birthdate"), gender: fieldValue("gender") };
    }

    function isDirty() {
      if (!saved) return false;
      var now = currentValues();
      return now.full_name !== saved.full_name || now.birthdate !== saved.birthdate || now.gender !== saved.gender;
    }

    function updateDirty() {
      var dirty = isDirty();
      profileSubmit.disabled = !dirty;
      profileSubmit.textContent = t(dirty ? "profSaveChanges" : "profNoChanges");
    }

    function flash(node, message) {
      node.textContent = message;
      if (feedbackTimer) window.clearTimeout(feedbackTimer);
      feedbackTimer = window.setTimeout(function () { node.textContent = ""; }, 6000);
    }

    var confirmPwInput = document.getElementById("confirmNewPassword");
    function updatePwHint() {
      var len = newPwInput.value.length;
      pwHint.classList.toggle("hint-ok", len >= 8);
      if (len === 0) {
        pwHint.textContent = t("pwHintInitial");
      } else if (len >= 8) {
        pwHint.textContent = t("pwHintOk", { len: len });
      } else {
        var rem = 8 - len;
        pwHint.textContent = rem === 1 ? t("pwHintNeedSingle") : t("pwHintNeedPlural", { n: rem });
      }
    }

    bindLangSwitchers(function () {
      if (saved) updateDirty();
      updatePwHint();
    });

    U.loading(statusNode, t("profLoading"));
    try {
      var me = await API.apiFetch("/api/me");
      U.clear(statusNode);
      document.getElementById("usernameReadonly").value = me.username;
      nameInput.value = me.full_name;
      birthInput.value = me.birthdate;
      genderSelect.value = ["male", "female", "other"].indexOf(me.gender) >= 0 ? me.gender : "other";
      saved = currentValues();
      updateDirty();
    } catch (error) {
      U.error(statusNode, error.message);
      return;
    }

    [nameInput, birthInput, genderSelect].forEach(function (node) {
      node.addEventListener("input", function () {
        showFormError(profileFeedback, "");
        // Clear an error as soon as the user fixes it; don't nag while typing.
        if (node.getAttribute("aria-invalid") === "true") {
          setFieldError(node, node === nameInput ? validateFullName(node.value.trim()) : node === birthInput ? validateBirthdate(node.value) : "");
        }
        updateDirty();
      });
      node.addEventListener("change", updateDirty);
    });
    nameInput.addEventListener("blur", function () { if (saved) setFieldError(nameInput, validateFullName(nameInput.value.trim())); });
    birthInput.addEventListener("blur", function () { if (saved) setFieldError(birthInput, validateBirthdate(birthInput.value)); });

    // Warn before leaving with unsaved edits.
    window.addEventListener("beforeunload", function (event) {
      if (isDirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    });

    profileForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(profileError, "");
      showFormError(profileFeedback, "");
      var payload = currentValues();
      var nameErr = validateFullName(payload.full_name);
      var birthErr = validateBirthdate(payload.birthdate);
      setFieldError(nameInput, nameErr);
      setFieldError(birthInput, birthErr);
      if (nameErr || birthErr) {
        (nameErr ? nameInput : birthInput).focus();
        return;
      }
      setBusy(profileSubmit, true, t("privSaving"));
      var ok = false;
      try {
        await API.apiFetch("/api/citizen/profile", { method: "PUT", body: payload });
        ok = true;
        saved = payload;
        API.saveSession(API.getToken(), API.getRole(), payload.full_name);
        if (API.renderWhoami) API.renderWhoami();
        var time = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date());
        flash(profileFeedback, t("profSavedAt", { time: time }));
        U.toast(t("profToastUpdated"), "success");
      } catch (error) {
        showFormError(profileError, error.message);
        U.toast(error.message, "error");
      } finally {
        setBusy(profileSubmit, false);
        updateDirty();
        if (!ok) profileSubmit.disabled = false;
      }
    });

    newPwInput.addEventListener("input", function () {
      updatePwHint();
      if (newPwInput.getAttribute("aria-invalid") === "true" && newPwInput.value.length >= 8) setFieldError(newPwInput, "");
      if (confirmPwInput && confirmPwInput.getAttribute("aria-invalid") === "true" && confirmPwInput.value === newPwInput.value) {
        setFieldError(confirmPwInput, "");
      }
    });
    if (confirmPwInput) {
      confirmPwInput.addEventListener("input", function () {
        if (confirmPwInput.getAttribute("aria-invalid") === "true" && confirmPwInput.value === newPwInput.value) {
          setFieldError(confirmPwInput, "");
        }
      });
    }

    passwordForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(passwordError, "");
      showFormError(passwordFeedback, "");
      var submit = document.getElementById("passwordSubmit");
      var currentInput = document.getElementById("currentPassword");
      var current = currentInput.value;
      var next = newPwInput.value;
      var confirmVal = confirmPwInput ? confirmPwInput.value : next;
      setFieldError(currentInput, current ? "" : t("errCurrPw"));
      setFieldError(newPwInput, next.length >= 8 ? "" : t("errNewPwLen"));
      if (confirmPwInput) {
        setFieldError(
          confirmPwInput,
          !confirmVal ? t("errConfirmPwReq") : confirmVal !== next ? t("errPwMismatch") : ""
        );
      }
      if (!current) { currentInput.focus(); return; }
      if (next.length < 8) { newPwInput.focus(); return; }
      if (confirmPwInput && confirmVal !== next) { confirmPwInput.focus(); return; }
      if (next === current) {
        setFieldError(newPwInput, t("errPwSame"));
        newPwInput.focus();
        return;
      }
      setBusy(submit, true, t("btnUpdating"));
      try {
        await API.apiFetch("/api/citizen/password", {
          method: "PUT",
          body: { current_password: current, new_password: next },
        });
        passwordForm.reset();
        updatePwHint();
        flash(passwordFeedback, t("pwUpdatedMsg"));
        U.toast(t("pwToastUpdated"), "success");
      } catch (error) {
        showFormError(passwordError, error.message);
        U.toast(error.message, "error");
      } finally {
        setBusy(submit, false);
      }
    });

    var logoutMain = document.getElementById("logoutBtnMain");
    if (logoutMain) {
      logoutMain.addEventListener("click", function () {
        API.logout();
      });
    }
  }

  /* ---------------- forgot password ---------------- */

  function initForgotPassword() {
    var form = document.getElementById("forgotPasswordForm");
    if (!form) return;
    var errorNode = document.getElementById("resetError");
    var successCard = document.getElementById("resetSuccess");
    var submit = document.getElementById("resetSubmit");
    var newPwInput = document.getElementById("newPassword");
    var pwHint = document.getElementById("passwordHint");

    function updatePwHint() {
      if (!pwHint || !newPwInput) return;
      var len = newPwInput.value.length;
      pwHint.classList.toggle("hint-ok", len >= 8);
      pwHint.textContent = len === 0
        ? "At least 8 characters."
        : len >= 8
          ? "Length looks good (" + len + " characters)."
          : (8 - len) + " more character" + (8 - len === 1 ? "" : "s") + " needed.";
    }

    if (newPwInput) {
      newPwInput.addEventListener("input", updatePwHint);
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(errorNode, "");

      var username = fieldValue("username");
      var fullName = fieldValue("fullName");
      var birthdate = fieldValue("birthdate");
      var newPassword = document.getElementById("newPassword").value;
      var confirmPassword = document.getElementById("confirmPassword").value;

      if (!username) {
        showFormError(errorNode, "Please enter your username.");
        return;
      }
      if (!fullName) {
        showFormError(errorNode, "Please enter your full name as registered.");
        return;
      }
      if (!birthdate) {
        showFormError(errorNode, "Please select your registered birthdate.");
        return;
      }
      if (!newPassword || newPassword.length < 8) {
        showFormError(errorNode, "New password must be at least 8 characters long.");
        return;
      }
      if (newPassword !== confirmPassword) {
        showFormError(errorNode, "Passwords do not match. Please verify both fields.");
        return;
      }

      setBusy(submit, true, "Verifying details…");
      try {
        await API.apiFetch("/api/forgot-password", {
          method: "POST",
          body: {
            username: username,
            full_name: fullName,
            birthdate: birthdate,
            new_password: newPassword,
          },
        });
        form.style.display = "none";
        if (successCard) successCard.style.display = "block";
        U.toast("Password reset complete. You can now sign in.", "success");
      } catch (err) {
        showFormError(errorNode, err.message || "Failed to reset password. Please check your details.");
        setBusy(submit, false);
      }
    });
  }

  /* ---------------- router ---------------- */

  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page");
    if (page === "citizen-login" || page === "bhw-login") initLogin();
    else if (page === "citizen-register") initRegister();
    else if (page === "citizen-forgot-password") initForgotPassword();
    else if (page === "citizen-dashboard") initDashboard();
    else if (page === "citizen-history") initHistory();
    else if (page === "citizen-consent") initConsent();
    else if (page === "citizen-profile") initProfile();
  });
})();
