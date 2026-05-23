const LANGUAGE_KEY = "taxiLanguage";

const LANGUAGES = [
  { code: "fr", flag: "🇫🇷", label: "Français", dir: "ltr" },
  { code: "en", flag: "🇬🇧", label: "English", dir: "ltr" },
  { code: "zh", flag: "🇨🇳", label: "中文", dir: "ltr" },
  { code: "ar", flag: "🇸🇦", label: "العربية", dir: "rtl" },
];

const TRANSLATIONS = {
  fr: {
    pageTitleBook: "Réserver un taxi",
    pageTitleAdmin: "Administration taxi",
    languageLabel: "Langue",
    bookingEyebrow: "Réservation taxi",
    bookingTitle: "Demandez votre trajet",
    bookingIntro: "Envoyez les détails de votre trajet et l'équipe confirmera votre rendez-vous.",
    name: "Nom",
    phone: "Téléphone",
    pickupAddress: "Adresse de départ",
    destination: "Destination",
    date: "Date",
    time: "Heure",
    passengers: "Passagers",
    notes: "Notes",
    submitBooking: "Envoyer la réservation",
    submitting: "Envoi...",
    bookingSuccess: "Votre demande de réservation a bien été envoyée.",
    bookingError: "Impossible d'envoyer la réservation.",
    adminEyebrow: "Admin",
    signIn: "Connexion",
    username: "Nom d'utilisateur",
    password: "Mot de passe",
    signingIn: "Connexion...",
    invalidLogin: "Nom d'utilisateur ou mot de passe incorrect.",
    authRequired: "Connexion requise.",
    requestFailed: "La demande a échoué.",
    taxiAdmin: "Administration taxi",
    dispatch: "Planning",
    dashboard: "Tableau de bord",
    appointments: "Rendez-vous",
    clients: "Clients",
    signOut: "Déconnexion",
    management: "Gestion",
    searchPlaceholder: "Rechercher clients, téléphones, adresses",
    allStatuses: "Tous les statuts",
    pending: "En attente",
    confirmed: "Confirmé",
    inProgress: "En cours",
    completed: "Terminé",
    cancelled: "Annulé",
    noShow: "Absent",
    totalRides: "Trajets totaux",
    completedRevenue: "Revenus terminés",
    revenueByMonth: "Revenus par mois",
    noCompletedRevenue: "Aucun revenu terminé enregistré pour le moment.",
    addAppointment: "Ajouter un rendez-vous",
    editAppointment: "Modifier le rendez-vous",
    saveAppointment: "Enregistrer le rendez-vous",
    deleteAppointmentConfirm: "Supprimer ce rendez-vous ?",
    noAppointments: "Aucun rendez-vous trouvé.",
    addClient: "Ajouter un client",
    editClient: "Modifier le client",
    saveClient: "Enregistrer le client",
    deleteClientConfirm: "Supprimer ce client et ses rendez-vous ?",
    noClients: "Aucun client trouvé.",
    clientName: "Nom du client",
    clientPhone: "Téléphone du client",
    email: "E-mail",
    status: "Statut",
    fareAmount: "Montant",
    cancel: "Annuler",
    edit: "Modifier",
    delete: "Supprimer",
    at: "à",
    to: "vers",
    appointmentCount: "rendez-vous",
  },
  en: {
    pageTitleBook: "Book a Taxi",
    pageTitleAdmin: "Taxi Admin",
    languageLabel: "Language",
    bookingEyebrow: "Taxi booking",
    bookingTitle: "Request your ride",
    bookingIntro: "Send your trip details and the dispatch team will confirm your appointment.",
    name: "Name",
    phone: "Phone",
    pickupAddress: "Pickup address",
    destination: "Destination",
    date: "Date",
    time: "Time",
    passengers: "Passengers",
    notes: "Notes",
    submitBooking: "Submit booking",
    submitting: "Submitting...",
    bookingSuccess: "Your booking request was sent successfully.",
    bookingError: "Unable to submit booking.",
    adminEyebrow: "Admin",
    signIn: "Sign in",
    username: "Username",
    password: "Password",
    signingIn: "Signing in...",
    invalidLogin: "Invalid username or password.",
    authRequired: "Authentication required.",
    requestFailed: "Request failed.",
    taxiAdmin: "Taxi Admin",
    dispatch: "Dispatch",
    dashboard: "Dashboard",
    appointments: "Appointments",
    clients: "Clients",
    signOut: "Sign out",
    management: "Management",
    searchPlaceholder: "Search clients, phones, addresses",
    allStatuses: "All statuses",
    pending: "Pending",
    confirmed: "Confirmed",
    inProgress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    noShow: "No show",
    totalRides: "Total rides",
    completedRevenue: "Completed revenue",
    revenueByMonth: "Revenue by month",
    noCompletedRevenue: "No completed revenue recorded yet.",
    addAppointment: "Add appointment",
    editAppointment: "Edit appointment",
    saveAppointment: "Save appointment",
    deleteAppointmentConfirm: "Delete this appointment?",
    noAppointments: "No appointments found.",
    addClient: "Add client",
    editClient: "Edit client",
    saveClient: "Save client",
    deleteClientConfirm: "Delete this client and their appointments?",
    noClients: "No clients found.",
    clientName: "Client name",
    clientPhone: "Client phone",
    email: "Email",
    status: "Status",
    fareAmount: "Fare amount",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    at: "at",
    to: "to",
    appointmentCount: "appointments",
  },
  zh: {
    pageTitleBook: "预订出租车",
    pageTitleAdmin: "出租车管理",
    languageLabel: "语言",
    bookingEyebrow: "出租车预订",
    bookingTitle: "提交您的行程",
    bookingIntro: "发送行程信息，调度团队会确认您的预约。",
    name: "姓名",
    phone: "电话",
    pickupAddress: "上车地址",
    destination: "目的地",
    date: "日期",
    time: "时间",
    passengers: "乘客人数",
    notes: "备注",
    submitBooking: "提交预订",
    submitting: "正在提交...",
    bookingSuccess: "您的预订请求已成功发送。",
    bookingError: "无法提交预订。",
    adminEyebrow: "管理",
    signIn: "登录",
    username: "用户名",
    password: "密码",
    signingIn: "正在登录...",
    invalidLogin: "用户名或密码不正确。",
    authRequired: "需要登录。",
    requestFailed: "请求失败。",
    taxiAdmin: "出租车管理",
    dispatch: "调度",
    dashboard: "仪表盘",
    appointments: "预约",
    clients: "客户",
    signOut: "退出登录",
    management: "管理",
    searchPlaceholder: "搜索客户、电话、地址",
    allStatuses: "所有状态",
    pending: "待处理",
    confirmed: "已确认",
    inProgress: "进行中",
    completed: "已完成",
    cancelled: "已取消",
    noShow: "未到",
    totalRides: "总行程",
    completedRevenue: "已完成收入",
    revenueByMonth: "每月收入",
    noCompletedRevenue: "还没有已完成收入记录。",
    addAppointment: "添加预约",
    editAppointment: "编辑预约",
    saveAppointment: "保存预约",
    deleteAppointmentConfirm: "删除此预约？",
    noAppointments: "未找到预约。",
    addClient: "添加客户",
    editClient: "编辑客户",
    saveClient: "保存客户",
    deleteClientConfirm: "删除此客户及其预约？",
    noClients: "未找到客户。",
    clientName: "客户姓名",
    clientPhone: "客户电话",
    email: "邮箱",
    status: "状态",
    fareAmount: "金额",
    cancel: "取消",
    edit: "编辑",
    delete: "删除",
    at: "在",
    to: "到",
    appointmentCount: "个预约",
  },
  ar: {
    pageTitleBook: "حجز سيارة أجرة",
    pageTitleAdmin: "إدارة سيارات الأجرة",
    languageLabel: "اللغة",
    bookingEyebrow: "حجز تاكسي",
    bookingTitle: "اطلب رحلتك",
    bookingIntro: "أرسل تفاصيل الرحلة وسيؤكد فريق التشغيل موعدك.",
    name: "الاسم",
    phone: "الهاتف",
    pickupAddress: "عنوان الانطلاق",
    destination: "الوجهة",
    date: "التاريخ",
    time: "الوقت",
    passengers: "عدد الركاب",
    notes: "ملاحظات",
    submitBooking: "إرسال الحجز",
    submitting: "جار الإرسال...",
    bookingSuccess: "تم إرسال طلب الحجز بنجاح.",
    bookingError: "تعذر إرسال الحجز.",
    adminEyebrow: "إدارة",
    signIn: "تسجيل الدخول",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    signingIn: "جار تسجيل الدخول...",
    invalidLogin: "اسم المستخدم أو كلمة المرور غير صحيحة.",
    authRequired: "تسجيل الدخول مطلوب.",
    requestFailed: "فشل الطلب.",
    taxiAdmin: "إدارة التاكسي",
    dispatch: "التشغيل",
    dashboard: "لوحة التحكم",
    appointments: "المواعيد",
    clients: "العملاء",
    signOut: "تسجيل الخروج",
    management: "الإدارة",
    searchPlaceholder: "ابحث عن العملاء أو الهواتف أو العناوين",
    allStatuses: "كل الحالات",
    pending: "قيد الانتظار",
    confirmed: "مؤكد",
    inProgress: "قيد التنفيذ",
    completed: "مكتمل",
    cancelled: "ملغى",
    noShow: "لم يحضر",
    totalRides: "إجمالي الرحلات",
    completedRevenue: "إيراد الرحلات المكتملة",
    revenueByMonth: "الإيراد حسب الشهر",
    noCompletedRevenue: "لا توجد إيرادات مكتملة بعد.",
    addAppointment: "إضافة موعد",
    editAppointment: "تعديل الموعد",
    saveAppointment: "حفظ الموعد",
    deleteAppointmentConfirm: "هل تريد حذف هذا الموعد؟",
    noAppointments: "لم يتم العثور على مواعيد.",
    addClient: "إضافة عميل",
    editClient: "تعديل العميل",
    saveClient: "حفظ العميل",
    deleteClientConfirm: "هل تريد حذف هذا العميل ومواعيده؟",
    noClients: "لم يتم العثور على عملاء.",
    clientName: "اسم العميل",
    clientPhone: "هاتف العميل",
    email: "البريد الإلكتروني",
    status: "الحالة",
    fareAmount: "المبلغ",
    cancel: "إلغاء",
    edit: "تعديل",
    delete: "حذف",
    at: "في",
    to: "إلى",
    appointmentCount: "مواعيد",
  },
};

function currentLanguage() {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  return LANGUAGES.some((language) => language.code === saved) ? saved : "fr";
}

function translate(key, params = {}) {
  const language = currentLanguage();
  let text = TRANSLATIONS[language]?.[key] || TRANSLATIONS.fr[key] || key;
  Object.entries(params).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, value);
  });
  return text;
}

function localizeDocument() {
  const language = currentLanguage();
  const config = LANGUAGES.find((item) => item.code === language) || LANGUAGES[0];
  document.documentElement.lang = language;
  document.documentElement.dir = config.dir;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = translate(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = translate(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.title = translate(element.dataset.i18nTitle);
  });
  document.title = translate(document.body.dataset.pageTitle || "pageTitleBook");
  document.dispatchEvent(new CustomEvent("languagechange", { detail: { language } }));
}

function renderLanguageSelector() {
  document.querySelectorAll("[data-language-switcher]").forEach((container) => {
    container.setAttribute("aria-label", translate("languageLabel"));
    container.innerHTML = LANGUAGES.map((language) => `
      <button
        type="button"
        class="language-option"
        data-language="${language.code}"
        aria-label="${language.label}"
        title="${language.label}"
      >
        <span aria-hidden="true">${language.flag}</span>
        <span>${language.label}</span>
      </button>
    `).join("");
  });
}

function setLanguage(language) {
  if (!LANGUAGES.some((item) => item.code === language)) return;
  localStorage.setItem(LANGUAGE_KEY, language);
  renderLanguageSelector();
  localizeDocument();
  updateLanguageButtons();
}

function updateLanguageButtons() {
  const language = currentLanguage();
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.classList.toggle("active", button.dataset.language === language);
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-language]");
  if (button) setLanguage(button.dataset.language);
});

document.addEventListener("DOMContentLoaded", () => {
  renderLanguageSelector();
  localizeDocument();
  updateLanguageButtons();
});

window.TaxiI18n = {
  currentLanguage,
  setLanguage,
  t: translate,
  localizeDocument,
};
