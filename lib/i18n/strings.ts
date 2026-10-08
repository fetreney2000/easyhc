/**
 * Centralized Bahasa Melayu strings for the EasyHC application.
 * All user-facing text MUST be defined here, not inline in components.
 * Variable/function/component names in code stay English.
 */

export const strings = {
  // App
  appName: "EasyHC",
  appDescription: "Sistem Kehadiran Lantai",

  // Auth
  login: "Log Masuk",
  logout: "Log Keluar",
  username: "Nama Pengguna",
  password: "Kata Laluan",
  loginTitle: "Log Masuk ke Akaun Anda",
  loginError: "Nama pengguna atau kata laluan salah",
  loginButton: "Log Masuk",

  // Navigation
  dashboard: "Papan Pemuka",
  scanQR: "Imbas Kod QR",
  profile: "Profil",
  reports: "Laporan",
  floors: "Lantai",
  floorManagement: "Pengurusan Lantai",
  userManagement: "Pengurusan Pengguna",
  qrCodes: "Kod QR",
  myUnit: "Unit Saya",
  allFloors: "Semua Lantai",
  allStaffLocations: "Lokasi Semua Kakitangan",
  manualCheckIn: "Daftar Masuk Manual",

  // Attendance
  checkIn: "Daftar Masuk",
  checkOut: "Daftar Keluar",
  checkInError: "Gagal daftar masuk. Sila cuba lagi.",
  qrInvalid: "Kod QR tidak sah atau telah pun ditukar.",
  invalidCheckoutToken: "Token daftar keluar tidak sah. Sila imbas kod QR semula.",
  visitorAlreadyOnThisFloor:
    "Anda sudah berdaftar masuk di lantai ini. Sila daftar keluar dahulu.",
  visitorAlreadyOnFloor: (floorName: string) =>
    `Anda sudah berdaftar masuk di ${floorName}. Sila daftar keluar dahulu.`,
  visitorAlreadyCheckedIn:
    "Anda sudah berdaftar masuk. Sila daftar keluar dahulu.",
  visitorUseOriginalDevice:
    "Sila daftar keluar dengan peranti yang anda guna untuk mendaftar masuk, atau minta bantuan staf.",
  checkOutSuccess: "Berjaya daftar keluar",
  checkedOutFrom: (floorName: string) =>
    `Berjaya daftar keluar dari ${floorName}`,
  checkedInTo: (floorName: string) =>
    `Berjaya daftar masuk ke ${floorName}`,
  visitorCheckedInAt: (floorName: string) =>
    `Berjaya daftar masuk sebagai pelawat di ${floorName}`,
  checkOutError: "Gagal daftar keluar. Sila cuba lagi.",
  forceCheckout: "Paksa Keluar",
  forceCheckoutConfirm: "Anda pasti mahu memaksa keluar pengguna ini?",
  forceCheckoutSuccess: "Berjaya memaksa keluar",

  // Visitor
  visitor: "Pelawat",
  visitorName: "Nama Pelawat",
  visitorPhone: "No. Telefon",
  visitorCheckInTitle: "Daftar Masuk Pelawat",
  visitorCheckInSuccess: "Berjaya daftar masuk sebagai pelawat",
  visitorCheckOutSuccess: "Berjaya daftar keluar",
  visitorPhonePlaceholder: "Contoh: 0123456789",

  // Dashboard
  totalPresent: "Jumlah Kehadiran",
  totalEmployees: "Kakitangan",
  totalVisitors: "Pelawat",
  noOnePresent: "Tiada sesiapa di lantai ini",
  noDataAvailable: "Tiada data tersedia",
  lastUpdated: "Kemaskini Terakhir",
  refresh: "Muat Semula",
  loading: "Memuatkan...",

  // User Management
  addUser: "Tambah Pengguna",
  editUser: "Sunting Pengguna",
  deleteUser: "Padam Pengguna",
  deleteConfirm: "Anda pasti mahu memadam pengguna ini?",
  deleteUserSuccess: "Berjaya memadam pengguna",
  userSaved: "Berjaya menyimpan pengguna",
  userSaveError: "Gagal menyimpan pengguna",
  name: "Nama",
  phone: "No. Telefon",
  jawatanInfo: "Jawatan",
  jawatanInfoPlaceholder: "Contoh: Penolong Pegawai Farmasi",
  role: "Peranan",
  jabatan: "Jabatan",
  unit: "Unit",
  status: "Status",
  active: "Aktif",
  inactive: "Tidak Aktif",
  actions: "Tindakan",
  resetPassword: "Tetap Semula Kata Laluan",
  resetPasswordConfirm: "Anda pasti mahu menetap semula kata laluan pengguna ini?",
  resetPasswordSuccess: "Kata laluan berjaya ditetap semula",
  newPassword: "Kata Laluan Baharu",
  searchUsers: "Cari pengguna...",
  allRoles: "Semua Peranan",

  // Floor Management
  addFloor: "Tambah Lantai",
  addJabatan: "Tambah Jabatan",
  addUnit: "Tambah Unit",
  editFloor: "Sunting Lantai",
  deleteFloor: "Padam Lantai",
  deleteFloorConfirm: "Anda pasti mahu memadam lantai ini?",
  floorName: "Nama Lantai",
  floorSaved: "Berjaya menyimpan lantai",
  floorSaveError: "Gagal menyimpan lantai",
  floorDeleted: "Berjaya memadam lantai",
  regenerateQR: "Jana Semula Kod QR",
  regenerateQRConfirm: "Anda pasti? Kod QR lama akan tidak sah serta-merta.",
  printQR: "Cetak Kod QR",
  qrCodeFor: "Kod QR untuk",

  // Manual Check-in
  manualCheckInDesc: "Daftar masuk pengguna ke lantai tanpa imbasan kod QR. Hanya untuk Superadmin dan Admin.",
  selectUser: "Pilih Pengguna",
  selectFloor: "Pilih Lantai",
  manualCheckInSuccess: "Berjaya daftar masuk secara manual",
  manualCheckInError: "Gagal daftar masuk secara manual",

  // Reports
  exportCSV: "Eksport CSV",
  printReport: "Cetak Laporan",
  fromDate: "Dari Tarikh",
  toDate: "Hingga Tarikh",
  noReportData: "Tiada data untuk julat tarikh yang dipilih",
  reportsPickDates:
    "Pilih tarikh mula dan tarikh akhir terlebih dahulu untuk memaparkan laporan.",

  // Profile
  editProfile: "Sunting Profil",
  changePassword: "Tukar Kata Laluan",
  currentPassword: "Kata Laluan Semasa",
  confirmNewPassword: "Sahkan Kata Laluan Baharu",
  passwordChanged: "Kata laluan berjaya ditukar",
  reloginRequired: "Sila log masuk semula dengan kata laluan baharu.",
  passwordChangeError: "Gagal menukar kata laluan",
  passwordMismatch: "Kata laluan tidak sepadan",
  profileUpdated: "Profil berjaya dikemaskini",
  profileUpdateError: "Gagal mengemaskini profil",

  // API responses — route handlers draw from here (strings.ts is the single
  // source of truth for user-facing copy; see this file's header)
  userNotFound: "Pengguna tidak dijumpai",
  userNotFoundRelogin:
    "Pengguna tidak dijumpai. Sila log keluar dan log masuk semula.",
  usernameExists: "Nama pengguna sudah wujud",
  cannotDeleteOwnAccount: "Anda tidak boleh memadam akaun sendiri",
  userDeleted: "Pengguna berjaya dipadam",
  currentPasswordIncorrect: "Kata laluan semasa salah",
  passwordResetDone: "Kata laluan berjaya ditetap semula",
  superadminPasswordReset: "Kata laluan superadmin berjaya ditetap semula",
  floorNotFound: "Lantai tidak dijumpai",
  floorExists: "Nama lantai sudah wujud",
  jabatanNotFound: "Jabatan tidak dijumpai",
  jabatanExists: "Nama jabatan sudah wujud",
  unitNotFound: "Unit tidak dijumpai",
  recordNotFound: "Rekod tidak dijumpai",
  alreadyCheckedOut: "Sudah didaftar keluar",
  userAlreadyCheckedOut: "Pengguna ini sudah didaftar keluar",
  attendanceIdRequired: "ID kehadiran diperlukan",
  attendanceNotFound: "Rekod kehadiran tidak dijumpai",
  qrTokenRequired: "Token QR diperlukan",
  invalidQrCode: "Kod QR tidak sah",
  manualCheckinFloorRequired: "ID lantai diperlukan untuk daftar masuk manual",
  manualCheckinUserRequired: "Pengguna diperlukan untuk daftar masuk manual",
  qrGenerateError: "Ralat menjana kod QR",

  // Staff access QR — the notice-board poster that opens the app itself
  qrAppLabel: "QR Akses Kakitangan",
  qrAppHint:
    "Satu kod tetap untuk papan kenyataan — imbas untuk membuka EasyHC: akaun log masuk terus ke papan pemuka, pengguna baharu ke halaman log masuk.",
  qrAppAlt: "Kod QR akses aplikasi EasyHC",
  qrAppPrintTitle: "EasyHC — Imbas untuk Buka Aplikasi",
  qrAppStep1: "Imbas kod QR ini dengan kamera telefon anda",
  qrAppStep2: "Log masuk dengan nama pengguna dan kata laluan anda",
  qrAppStep3:
    "Tambah ke Skrin Utama (Add to Home Screen) supaya EasyHC boleh dibuka terus tanpa perlu imbas lagi",
  loginAddToHomeTip:
    "Tip: tambah EasyHC ke skrin utama anda untuk akses pantas — tidak perlu bookmark alamat.",
  installApp: "Pasang Aplikasi",
  methodColumn: "Kaedah",
  stillActive: "Masih aktif",
  methodManual: "Manual",

  // QR Scanner
  scanQRTitle: "Imbas Kod QR Lantai",
  scanQRInstruction: "Halakan kamera ke kod QR di pintu masuk lantai",
  cameraPermissionDenied: "Akses kamera dinafikan. Sila benarkan akses kamera dalam tetapan pelayar anda.",
  cameraError: "Gagal mengakses kamera. Sila pastikan kamera tersedia.",

  // Validation
  required: "Ruangan ini wajib diisi",
  invalidUsername: "Nama pengguna tidak sah",
  minLength: (field: string, min: number) => `${field} mestilah sekurang-kurangnya ${min} aksara`,
  maxLength: (field: string, max: number) => `${field} mestilah tidak melebihi ${max} aksara`,
  invalidPhone: "Nombor telefon tidak sah",
  passwordMinLength: "Kata laluan mestilah sekurang-kurangnya 6 aksara",

  // General
  save: "Simpan",
  cancel: "Batal",
  delete: "Padam",
  edit: "Sunting",
  confirm: "Sahkan",
  back: "Kembali",
  search: "Cari...",
  error: "Ralat",
  success: "Berjaya",
  warning: "Amaran",

  // Time/Date

  // Offline
  offlineMessage: "Anda sedang luar talian. Tindakan daftar masuk/keluar memerlukan sambungan internet.",
  backOnline: "Sambungan internet dipulihkan",

  // Cron/Auto checkout

  // Errors
  serverError: "Ralat pelayan. Sila cuba lagi.",
  forbidden: "Akses ditolak",
  tooManyAttempts: "Terlalu banyak percubaan. Sila cuba lagi sebentar lagi.",
  unauthorized: "Anda tidak mempunyai kebenaran untuk tindakan ini",

  // Shell / misc (previously inline in components)
  copyright: "Hak Cipta",
  lightMode: "Mod Siang",
  darkMode: "Mod Gelap",
  menu: "Menu",
  skipToContent: "Langkau ke kandungan utama",
  retry: "Cuba Lagi",
  pageNotFound: "Halaman tidak dijumpai",
  pageError: "Ralat semasa memaparkan halaman ini",
  offlineTitle: "Tiada sambungan internet",
  currentLocation: "Lokasi Semasa",
  unknownFloor: "Tidak Diketahui",
  employee: "Kakitangan",

  // Dashboard presence card
  checkedInAtFloor: "Anda berdaftar masuk di",
  pressButtonToCheckOut: "Tekan butang di sebelah untuk daftar keluar",

  // Placeholders & empty states
  namePlaceholder: "Contoh: Ali Bin Abu",
  jabatanPlaceholder: "Contoh: Jabatan Teknologi Maklumat",
  unitPlaceholder: "Contoh: Unit Pembangunan Sistem",
  noJabatanAvailable: "Tiada jabatan tersedia. Sila tambah jabatan dahulu.",
  noUnitAvailable: "Tiada unit tersedia. Sila tambah unit dahulu.",
  noUnitsYet: "Tiada unit. Sila tambah unit baharu.",
  noFloorsYet: "Tiada lantai dikonfigurasi. Sila tambah lantai dahulu.",

  // Delete confirmations
  deleteJabatan: "Padam Jabatan",
  jabatanDeleted: "Jabatan berjaya dipadam",
  deleteJabatanConfirm: (name: string) =>
    `Anda pasti mahu memadam jabatan "${name}"?`,
  deleteUnit: "Padam Unit",
  unitDeleted: "Unit berjaya dipadam",
  deleteUnitConfirm: (name: string) =>
    `Anda pasti mahu memadam unit "${name}"?`,

  // QR codes page + print labels
  qrIntro:
    "Setiap lantai mempunyai 2 jenis kod QR: satu untuk kakitangan (imbas dalam aplikasi) dan satu untuk pelawat (imbas dengan kamera telefon).",
  qrStaffLabel: "Kakitangan / Staff",
  qrVisitorLabel: "Pelawat / Visitor",
  qrStaffScanHint: "Imbas dalam aplikasi EasyHC",
  qrVisitorScanHint: "Imbas dengan kamera telefon (URL pelawat)",
  qrPrintStaffLabel: "KAKITANGAN / STAFF",
  qrPrintVisitorLabel: "PELAWAT / VISITOR",
  qrPrintStaffDesc: "Imbas menggunakan aplikasi EasyHC untuk daftar masuk",
  qrPrintVisitorDesc:
    "Imbas menggunakan kamera telefon anda untuk daftar masuk sebagai pelawat",
  qrRegenerated: "Kod QR berjaya dijana semula",

  // Row counts / export feedback
  recordsCount: (n: number) => `${n} rekod`,
  showingRange: (from: number, to: number, total: number) =>
    `Memaparkan ${from}–${to} daripada ${total} rekod`,
  attendanceHistory: "Sejarah Kehadiran",
  csvExported: "Fail CSV berjaya dimuat turun",
  csvLimited: (n: number) => `Eksport dihadkan kepada ${n} rekod`,
  invalidDate: "Tarikh tidak sah",

  // Evacuation mode — full-screen takeover of the whole app
  evacMode: "Mod Evakuasi",
  evacModeDesc: "Paparan evakuasi skrin penuh untuk masa kecemasan",
  evacFullscreen: "Skrin Penuh",
  evacExitFullscreen: "Keluar Skrin Penuh",
  evacByFloor: "Mengikut Lantai",
  evacSafePrompt: "Sampai di tempat berkumpul? Sahkan ketibaan anda di bawah.",
  evacVisitorPrompt: "Sudah tiba di tempat berkumpul? Tekan butang di bawah.",
  evacVisitorConfirmed: (floorName: string) =>
    `Terima kasih — anda disahkan selamat di ${floorName}.`,
  // One NEUTRAL message for every visitor-confirm failure (no open record /
  // not on the roster): distinguishable responses would let anyone probe
  // whether a phone number is inside the building during an evacuation
  evacVisitorNoMatch: "Nombor ini tidak dapat disahkan untuk sesi evakuasi semasa.",
  evacStatusUnknown:
    "Status evakuasi tidak dapat disemak. Jika sesi sedang berlangsung, tekan butang di bawah.",
  // Staff WITHOUT an open check-in at alarm time: informational page only —
  // no button, no stats (they were never counted as expected)
  evacNotOnRosterDesc:
    "Sesi ini mengambil kira mereka yang berdaftar masuk sebelum sesi bermula. Jika anda berada di bangunan, sila lapor kepada ketua lantai atau ketua keselamatan.",
  evacElapsed: (elapsed: string) => `Berlangsung ${elapsed}`,
  // The display's escape hatch: switch accounts mid-drill (an activator may
  // be logged in as the wrong person) or log back in after a dead session
  evacLogin: "Log Masuk",
  evacSwitchAccount: "Tukar Akaun",

  // Evacuation after-action reports (evacuation:view_report)
  evacReportTitle: "Laporan Evakuasi",
  evacReportDetail: "Butiran Laporan",
  evacNoReports: "Tiada laporan evakuasi lagi",
  evacViewDetail: "Lihat",
  evacReportWhen: "Tarikh & Masa",
  evacDuration: "Tempoh",
  evacConfirmTime: "Masa Pengesahan",
  evacSessionNotFound: "Sesi evakuasi tidak dijumpai",

  // Evacuation sessions — "I made it to the muster point" feedback
  evacSessionActive: "SESI EVAKUASI AKTIF",
  evacStartedAt: (time: string) => `Sesi bermula ${time}`,
  evacSafe: "Selamat",
  evacMissing: "Belum Kesan",
  evacExpected: "Dijangka",
  evacImSafe: "Saya Selamat",
  evacSafeRecorded: "Pengesahan anda telah direkodkan",
  evacYouAreSafe: "Anda selamat",
  evacStart: "Mula Sesi Evakuasi",
  evacStartConfirm:
    "Mulakan sesi evakuasi sekarang? Semua kakitangan dan pelawat yang berdaftar masuk akan disenaraikan untuk pengesahan ketibaan.",
  evacStartSuccess: "Sesi evakuasi dimulakan",
  evacClose: "Tutup Sesi",
  evacCloseConfirm:
    "Tutup sesi evakuasi? Senarai pengesahan akan dibekukan sebagai rekod pasca-kejadian.",
  evacCloseSuccess: "Sesi evakuasi ditutup",
  evacNoSession: "Tiada sesi evakuasi aktif",
  evacAlreadyActive: "Sesi evakuasi sedang berlangsung",
  evacNotInRoster: "Anda tidak berada dalam senarai sesi ini",
  evacEntryNotFound: "Senarai pengesahan tidak dijumpai",
  evacInvalidPayload: "Permintaan tidak sah",
  evacNamesNote:
    "Senarai nama dipaparkan kepada pengurusan keselamatan dan ketua lantai sahaja.",
  evacRosterTitle: "Senarai Pengesahan",
  evacMarkSafe: "Tandakan selamat",
  evacUnmarkSafe: "Batal tanda",
  evacLastClosed: (closedAt: string, confirmed: number, total: number) =>
    `Sesi terakhir: ditutup ${closedAt} — ${confirmed}/${total} pengesahan`,
  evacSessionOld:
    "Sesi ini telah berlangsung lebih 2 jam. Tutup jika sesi ini tersilap dimulakan.",

  // Tables, filters and forms (previously inline literals)
  typeLabel: "Jenis",
  all: "Semua",
  searchByName: "Cari mengikut nama...",
  jabatanName: "Nama Jabatan",
  unitName: "Nama Unit",
  createdAt: "Tarikh Dicipta",
  homeFloor: "Lantai Asal",
  pickJabatan: "Pilih jabatan",
  pickFloorOptional: "Pilih lantai (pilihan)",
  editJabatan: "Sunting Jabatan",
  editUnit: "Sunting Unit",
  jabatanSaved: "Jabatan berjaya disimpan",
  unitSaved: "Unit berjaya disimpan",
  noJabatansYet: "Tiada jabatan. Sila tambah jabatan baharu.",
  countStaff: (n: number) => `${n} kakitangan`,
  countVisitors: (n: number) => `${n} pelawat`,
  qrEmployeeAlt: "Kod QR kakitangan",
  qrVisitorAlt: "Kod QR pelawat",

  // One-time setup API responses
  setupMissingFields:
    "Semua medan diperlukan: nama, nama pengguna, kata laluan",
  setupCredentialsRequired: "Nama pengguna dan kata laluan diperlukan",
  systemInitialized: "Sistem telah dikonfigurasi. Pengguna sudah wujud.",
  superadminCreated: "Superadmin berjaya dicipta",
  invalidSecret: "Rahsia tidak sah",
} as const;
