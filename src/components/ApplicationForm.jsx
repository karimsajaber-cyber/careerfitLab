import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getUserSupabase } from "../lib/supabase";
import {
  isValidLongProfessionalNarrative,
  isValidShortProfessionalDescription,
  isValidPersonName,
  isValidPhone,
  isValidProfessionalRole,
  isValidProfessionalUrl,
  isValidSkillListText,
} from "../lib/professionalDataValidation";
import { useUserAuth } from "./UserAuthProvider";

const initialValues = {
  fullName: "",
  email: "",
  phone: "",
  opportunityType: "",
  targetRole: "",
  targetFields: [],
  targetFieldsOther: "",
  relevantExperience: "",
  strongestSkills: "",
  careerChallenge: "",
  careerfitHelp: "",
  linkedinUrl: "",
  portfolioUrl: "",
  additionalNotes: "",
  privacyConsent: false,
};

const TARGET_FIELD_OPTIONS = [
  ["software_it", "البرمجة وتقنية المعلومات", "Software & IT"],
  ["data_ai", "البيانات والذكاء الاصطناعي", "Data & AI"],
  ["technical_support", "الدعم التقني", "Technical Support"],
  ["customer_support_success", "دعم ونجاح العملاء", "Customer Support & Success"],
  ["sales_business_development", "المبيعات وتطوير الأعمال", "Sales & Business Development"],
  ["marketing_content", "التسويق وصناعة المحتوى", "Marketing & Content"],
  ["operations", "العمليات", "Operations"],
  ["supply_chain_logistics_procurement", "سلاسل التوريد واللوجستيات والمشتريات", "Supply Chain, Logistics & Procurement"],
  ["project_management", "إدارة المشاريع", "Project Management"],
  ["product_management", "إدارة المنتجات", "Product Management"],
  ["human_resources_recruitment", "الموارد البشرية والتوظيف", "Human Resources & Recruitment"],
  ["finance_accounting", "المالية والمحاسبة", "Finance & Accounting"],
  ["healthcare_life_sciences", "الصحة وعلوم الحياة", "Healthcare & Life Sciences"],
  ["education_training", "التعليم والتدريب", "Education & Training"],
  ["design_ux", "التصميم وتجربة المستخدم", "Design & UX"],
  ["administration_office", "الإدارة والأعمال المكتبية", "Administration & Office"],
  ["engineering", "الهندسة", "Engineering"],
  ["research_academia", "البحث والأكاديميا", "Research & Academia"],
  ["ngo_development", "المنظمات والتنمية", "NGO & Development"],
  ["other", "أخرى", "Other"],
];

const OPPORTUNITY_TYPE_OPTIONS = [
  ["first_professional_job", "الحصول على أول وظيفة مهنية", "Get my first professional job"],
  ["career_change", "الانتقال إلى مجال مهني جديد", "Move into a new career field"],
  ["better_job", "الحصول على وظيفة أفضل", "Get a better job"],
  ["remote_international_work", "العثور على عمل عن بُعد أو دولي", "Find remote or international work"],
  ["improve_readiness", "تحسين جاهزيتي قبل التقديم", "Improve my readiness before applying"],
  ["internship_experience", "الحصول على تدريب أو خبرة عملية", "Get an internship or practical experience"],
  ["other", "هدف آخر", "Other"],
];

const CV_STATUS_OPTIONS = [
  ["current", "محدثة", "Up to date"],
  ["needs_update", "محدثة جزئياً", "Partially updated"],
  ["not_sure", "لست متأكداً", "Not sure"],
];
const OPPORTUNITY_TYPE_VALUES = new Set(OPPORTUNITY_TYPE_OPTIONS.map(([value]) => value));
const TARGET_FIELD_VALUES = new Set(TARGET_FIELD_OPTIONS.map(([value]) => value));
const CV_STATUS_VALUES = new Set(CV_STATUS_OPTIONS.map(([value]) => value));

const ERROR_COPY = {
  fullName: ["أدخل اسماً كاملاً صالحاً من 2 إلى 100 حرف.", "Enter a valid full name of 2 to 100 characters."],
  email: ["يرجى إدخال بريد إلكتروني صحيح.", "Please enter a valid email address."],
  phone: ["أدخل رقم هاتف صالحاً من 7 إلى 15 رقماً.", "Enter a valid phone number with 7 to 15 digits."],
  opportunityType: ["اختر هدفاً مهنياً رئيسياً صالحاً.", "Select a valid primary career goal."],
  targetRole: ["إذا أدخلت هذا الحقل، اكتب مسمى وظيفياً أو دوراً مهنياً واضحاً، مثل AI Engineer أو Customer Support Specialist.", "If you fill in this field, enter a clear professional role or job title, such as AI Engineer or Customer Support Specialist."],
  targetFields: ["اختر من 1 إلى 3 مجالات مهنية صالحة.", "Select 1 to 3 valid target fields."],
  targetFieldsOther: ["اكتب مجالاً مهنياً حقيقياً وواضحاً حتى 100 حرف، مثل الأمن السيبراني أو الهندسة المدنية.", "Enter a real, clear professional field of up to 100 characters, such as Cybersecurity or Civil Engineering."],
  relevantExperience: ["اكتب وصفاً واضحاً من 20 حرفاً على الأقل ومن عدة كلمات ذات معنى عن خبرتك أو مشاريعك، وليس نصاً تجريبياً أو عشوائياً.", "Enter a clear answer of at least 20 characters using several meaningful words about your experience or projects, not placeholder or random text."],
  strongestSkills: ["اكتب مهارات أو نقاط قوة حقيقية وواضحة، ويفضّل فصلها بفواصل، مثل Python، Django، REST APIs.", "Enter real, clear skills or strengths, preferably separated with commas, such as Python, Django, REST APIs."],
  careerChallenge: ["اكتب وصفاً واضحاً من 15 حرفاً على الأقل ومن عدة كلمات ذات معنى لتحديك المهني الحالي.", "Describe a real current career challenge in at least 15 characters using several meaningful words."],
  careerfitHelp: ["اكتب نتيجة واضحة من 15 حرفاً على الأقل ومن عدة كلمات ذات معنى تريد من CareerFit مساعدتك في تحقيقها.", "Describe a clear outcome you want CareerFit to help with in at least 15 characters using several meaningful words."],
  linkedinUrl: ["أدخل رابط LinkedIn صالحاً يبدأ بـ http أو https.", "Enter a valid LinkedIn URL starting with http or https."],
  portfolioUrl: ["أدخل رابط Portfolio أو GitHub صالحاً يبدأ بـ http أو https.", "Enter a valid portfolio or GitHub URL starting with http or https."],
  additionalNotes: ["اكتب ملاحظة واضحة ومفيدة أو اترك الحقل فارغاً.", "Enter a clear, useful note or leave this field empty."],
  cvStatus: ["يرجى تحديد ما إذا كانت سيرتك الذاتية محدثة.", "Please select your CV status."],
  changesSinceCv: ["اكتب تحديثاً واضحاً ومفيداً أو اترك الحقل فارغاً.", "Enter a clear, useful update or leave this field empty."],
  privacyConsent: ["يرجى الموافقة على بيان الخصوصية قبل المتابعة.", "Please confirm that you agree to the privacy statement."],
  file: ["يجب أن يكون الملف PDF وبحجم لا يتجاوز 5MB.", "Your CV must be a PDF no larger than 5 MB."],
};

const FIELD_ORDER = [
  "fullName",
  "email",
  "phone",
  "opportunityType",
  "targetRole",
  "targetFields",
  "targetFieldsOther",
  "relevantExperience",
  "strongestSkills",
  "careerChallenge",
  "careerfitHelp",
  "linkedinUrl",
  "portfolioUrl",
  "additionalNotes",
  "file",
  "cvStatus",
  "changesSinceCv",
  "privacyConsent",
];
const MAGIC_LINK_RETURN_PARAM = "application_verified";
const APPLICATION_DRAFT_TOKEN_STORAGE_KEY = "careerfit-application-draft-token";
const FIELD_MAX_LENGTHS = {
  fullName: 100,
  email: 254,
  phone: 32,
  opportunityType: 100,
  targetRole: 100,
  targetFieldsOther: 100,
  relevantExperience: 2000,
  strongestSkills: 1000,
  careerChallenge: 2000,
  careerfitHelp: 2000,
  linkedinUrl: 2048,
  portfolioUrl: 2048,
  additionalNotes: 2000,
  changesSinceCv: 2000,
};

function hasValidEmail(value) {
  const email = String(value || "").trim();
  return email.length <= 254 && /^\S+@\S+\.\S+$/.test(email);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function readApplicationDraftToken() {
  try {
    const token = window.localStorage.getItem(APPLICATION_DRAFT_TOKEN_STORAGE_KEY) || "";
    if (/^[a-f0-9]{64}$/i.test(token)) return token;
    window.localStorage.removeItem(APPLICATION_DRAFT_TOKEN_STORAGE_KEY);
  } catch {
    // Browser storage is optional; the application can still use the direct submit path.
  }
  return "";
}

function storeApplicationDraftToken(token) {
  if (!/^[a-f0-9]{64}$/i.test(String(token || ""))) return false;
  try {
    window.localStorage.setItem(APPLICATION_DRAFT_TOKEN_STORAGE_KEY, token);
    return true;
  } catch {
    return false;
  }
}

function clearApplicationDraftToken() {
  try {
    window.localStorage.removeItem(APPLICATION_DRAFT_TOKEN_STORAGE_KEY);
  } catch {
    // No action is needed when browser storage is unavailable.
  }
}

export default function ApplicationForm({ language, quiz }) {
  const ar = language === "ar";
  const L = (arabic, english) => (ar ? arabic : english);

  const [values, setValues] = useState(initialValues);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [cvStatus, setCvStatus] = useState("");
  const [changesSinceCv, setChangesSinceCv] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completion, setCompletion] = useState(null);
  const [isAwaitingAuthentication, setIsAwaitingAuthentication] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [isApplicationStatusLoading, setIsApplicationStatusLoading] = useState(false);
  const [isApplicationStatusModalOpen, setIsApplicationStatusModalOpen] = useState(false);
  const [pendingDraftToken, setPendingDraftToken] = useState(() => readApplicationDraftToken());
  const { user, isAuthReady, isAuthenticationOpen, requestAuthentication } = useUserAuth();

  const uploadInputRef = useRef(null);
  const fieldRefs = useRef({});
  const applicationStatusContextRef = useRef(null);
  const applicationStatusRequestIdRef = useRef(0);
  const verifiedEmail = normalizeEmail(user?.email);
  const hasVerifiedEmail = Boolean(user?.email_confirmed_at && verifiedEmail);
  const isSubmissionBlocked = [
    "already_submitted",
    "legacy_identity_conflict",
    "identity_conflict",
    "unavailable",
    "submission_state_uncertain",
  ].includes(applicationStatus);

  const closeApplicationStatusModal = () => {
    setIsApplicationStatusModalOpen(false);
  };

  const completeApplication = (applicationId) => {
    const completedApplicationId = String(applicationId || "").trim();
    if (!completedApplicationId) {
      setSubmitError(L(
        "تم حفظ الطلب، لكن تعذر عرض مرجع الطلب. يرجى مراجعة حالة طلبك.",
        "Your application was saved, but we could not display its reference. Please check your application status.",
      ));
      return;
    }

    // One state transition keeps the completed screen and its confirmation overlay in sync.
    setCompletion({ applicationId: completedApplicationId, isModalOpen: true });
  };

  const acknowledgeApplicationCompletion = () => {
    setCompletion((current) => (current ? { ...current, isModalOpen: false } : current));
  };

  const continueApplication = () => {
    setIsApplicationStatusModalOpen(false);
    const section = document.getElementById("register");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.requestAnimationFrame(() => {
      section?.querySelector("input:not([disabled]), select:not([disabled]), textarea:not([disabled])")?.focus({
        preventScroll: true,
      });
    });
  };

  const clearPendingDraft = () => {
    clearApplicationDraftToken();
    setPendingDraftToken("");
  };

  const clearMagicLinkReturnMarker = (url = new URL(window.location.href)) => {
    if (url.searchParams.get(MAGIC_LINK_RETURN_PARAM) !== "1") return;
    url.searchParams.delete(MAGIC_LINK_RETURN_PARAM);
    url.hash = "";
    window.history.replaceState({}, "", url.toString());
  };

  const requestNewVerificationLink = () => {
    const applicationEmail = normalizeEmail(values.email);
    if (!hasValidEmail(applicationEmail)) {
      clearPendingDraft();
      setApplicationStatus(null);
      setVerificationNotice("");
      setIsApplicationStatusModalOpen(false);
      continueApplication();
      return;
    }
    setApplicationStatus(null);
    setVerificationNotice("");
    setIsApplicationStatusModalOpen(false);
    setIsAwaitingAuthentication(true);
    requestAuthentication(ar ? "ar" : "en", "application", applicationEmail);
  };

  const assignRef = (name) => (node) => {
    fieldRefs.current[name] = node;
  };

  const errorMessage = (name) => {
    const copy = ERROR_COPY[name];
    return copy ? copy[ar ? 0 : 1] : "";
  };

  const clearValidationError = (name) => {
    setValidationErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const updateValue = (event) => {
    const { name, value, checked, type } = event.target;
    const nextValue = type === "checkbox" ? checked : value;
    const nextValues = { ...values, [name]: nextValue };
    setValues(nextValues);
    revalidateField(name, nextValues);
  };

  const markFieldTouched = (name) => {
    setTouchedFields((current) => ({ ...current, [name]: true }));
    const errors = { ...validateStepOne(values), ...validateStepTwo(values) };
    setValidationErrors((current) => ({ ...current, [name]: Boolean(errors[name]) }));
  };

  const revalidateField = (name, candidate = values, candidateCv = { file, cvStatus, changesSinceCv }) => {
    if (!validationAttempted && !touchedFields[name]) return;
    const errors = { ...validateStepOne(candidate), ...validateStepTwo(candidate, candidateCv) };
    setValidationErrors((current) => {
      const next = { ...current };
      if (errors[name]) next[name] = true;
      else delete next[name];
      return next;
    });
  };

  const toggleTargetField = (field) => {
    const exists = values.targetFields.includes(field);
    const nextValues = exists
      ? {
        ...values,
        targetFields: values.targetFields.filter((item) => item !== field),
        targetFieldsOther: field === "other" ? "" : values.targetFieldsOther,
      }
      : values.targetFields.length >= 3
        ? values
        : { ...values, targetFields: [...values.targetFields, field] };
    setValues(nextValues);
    revalidateField("targetFields", nextValues);
    if (field === "other") revalidateField("targetFieldsOther", nextValues);
  };

  const validateStepOne = (candidate = values) => {
    const errors = {};
    if (!isValidPersonName(candidate.fullName)) errors.fullName = true;
    if (!hasValidEmail(candidate.email)) errors.email = true;
    if (!isValidPhone(candidate.phone)) errors.phone = true;
    return errors;
  };

  const validateStepTwo = (candidate = values, candidateCv = { file, cvStatus, changesSinceCv }) => {
    const errors = {};
    if (!OPPORTUNITY_TYPE_VALUES.has(candidate.opportunityType)) errors.opportunityType = true;
    if (candidate.targetRole.trim() && !isValidProfessionalRole(candidate.targetRole)) errors.targetRole = true;
    if (candidate.targetFields.length < 1 || candidate.targetFields.length > 3 || candidate.targetFields.some((field) => !TARGET_FIELD_VALUES.has(field))) errors.targetFields = true;
    if (candidate.targetFields.includes("other") && !isValidProfessionalRole(candidate.targetFieldsOther)) {
      errors.targetFieldsOther = true;
    }
    if (!isValidLongProfessionalNarrative(candidate.relevantExperience, 20)) errors.relevantExperience = true;
    if (!isValidSkillListText(candidate.strongestSkills)) errors.strongestSkills = true;
    if (!isValidLongProfessionalNarrative(candidate.careerChallenge, 15)) errors.careerChallenge = true;
    if (!isValidLongProfessionalNarrative(candidate.careerfitHelp, 15)) errors.careerfitHelp = true;
    if (candidate.linkedinUrl.trim() && !isValidProfessionalUrl(candidate.linkedinUrl, true)) errors.linkedinUrl = true;
    if (candidate.portfolioUrl.trim() && !isValidProfessionalUrl(candidate.portfolioUrl)) errors.portfolioUrl = true;
    if (candidate.additionalNotes.trim() && !isValidShortProfessionalDescription(candidate.additionalNotes)) errors.additionalNotes = true;
    if (candidateCv.file && !CV_STATUS_VALUES.has(candidateCv.cvStatus)) errors.cvStatus = true;
    if (candidateCv.changesSinceCv.trim() && !isValidShortProfessionalDescription(candidateCv.changesSinceCv)) errors.changesSinceCv = true;
    if (candidate.privacyConsent !== true) errors.privacyConsent = true;
    return errors;
  };

  const scrollToFirstInvalid = (errors) => {
    const firstInvalid = FIELD_ORDER.find((name) => errors[name]);
    if (!firstInvalid) return;

    window.requestAnimationFrame(() => {
      const node = fieldRefs.current[firstInvalid];
      if (!node) return;
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        if (typeof node.focus === "function") node.focus({ preventScroll: true });
      }, 250);
    });
  };

  const handleContinue = () => {
    const errors = validateStepOne();
    if (Object.keys(errors).length > 0) {
      setValidationAttempted(true);
      setTouchedFields((current) => ({ ...current, fullName: true, email: true, phone: true }));
      setValidationErrors((current) => ({ ...current, ...errors }));
      scrollToFirstInvalid(errors);
      return;
    }

    setValidationAttempted(false);
    setValidationErrors((current) => {
      const next = { ...current };
      delete next.fullName;
      delete next.email;
      delete next.phone;
      return next;
    });
    setStep(2);
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf" || selectedFile.size > 5 * 1024 * 1024) {
      setFile(null);
      setCvStatus("");
      setChangesSinceCv("");
      setValidationErrors((current) => ({ ...current, file: true }));
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setCvStatus("");
    setChangesSinceCv("");
    clearValidationError("file");
    clearValidationError("cvStatus");
  };

  const removeFile = () => {
    setFile(null);
    setCvStatus("");
    setChangesSinceCv("");
    clearValidationError("file");
    clearValidationError("cvStatus");
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  };

  const handleCvStatus = (nextStatus) => {
    setCvStatus(nextStatus);
    clearValidationError("cvStatus");
    if (nextStatus === "current") setChangesSinceCv("");
  };

  const getVerifiedSession = async () => {
    const userSupabase = getUserSupabase();
    if (!userSupabase) return null;

    try {
      const { data } = await userSupabase.auth.getSession();
      const session = data.session;
      const email = normalizeEmail(session?.user?.email);
      if (!session?.access_token || !session.user?.email_confirmed_at || !email) return null;

      return { userSupabase, session, email };
    } catch {
      return null;
    }
  };

  const createSubmissionSnapshot = () => ({
    values: { ...values },
    file,
    cvStatus,
    changesSinceCv,
    quiz,
  });

  const handleUseDifferentEmail = async () => {
    if (isChangingEmail || isSubmitting) return;

    const userSupabase = getUserSupabase();
    if (!userSupabase) return;

    setIsChangingEmail(true);
    setEmailChangeError("");
    setVerificationNotice("");
    try {
      const { error } = await userSupabase.auth.signOut();
      if (error) throw error;
    } catch {
      setEmailChangeError(L(
        "تعذر تغيير البريد الإلكتروني حالياً. حاول مرة أخرى.",
        "We could not change the email right now. Please try again.",
      ));
    } finally {
      setIsChangingEmail(false);
    }
  };

  const beginMagicLinkVerification = (email) => {
    setIsAwaitingAuthentication(true);
    requestAuthentication(ar ? "ar" : "en", "application", email);
  };

  const getSubmissionErrorCode = async (data, error) => {
    if (typeof data?.error === "string") return data.error;

    // Supabase exposes non-2xx Edge Function responses through error.context.
    if (typeof error?.context?.clone !== "function") return "";
    try {
      const body = await error.context.clone().json();
      return typeof body?.error === "string" ? body.error : "";
    } catch {
      return "";
    }
  };

  const applySemanticFieldErrors = (fieldErrors) => {
    if (!fieldErrors || typeof fieldErrors !== "object") return false;

    const semanticCopy = {
      targetRole: L("اكتب مسمى وظيفياً واضحاً، مثل أخصائي دعم العملاء.", "Enter a clear professional role, such as Customer Support Specialist."),
      targetFieldsOther: L("اكتب مجالاً مهنياً حقيقياً وواضحاً.", "Enter a real, clear professional field."),
      relevantExperience: L("صف خبرة عمل أو مشروع أو دراسة عملية حقيقية مرتبطة بطلبك.", "Describe real work, project, study, or practical experience relevant to your application."),
      strongestSkills: L("اذكر مهارات مهنية حقيقية، مثل Excel أو Python أو SAP.", "Enter real professional skills, such as Excel, Python, SAP, or Customer Support."),
      careerChallenge: L("اشرح تحدياً مهنياً حقيقياً تواجهه حالياً.", "Describe a real career challenge you are currently facing."),
      careerfitHelp: L("اشرح بوضوح كيف تريد من CareerFit مساعدتك.", "Explain clearly how you want CareerFit to help you."),
    };
    const nextErrors = Object.fromEntries(
      Object.keys(fieldErrors)
        .filter((key) => key in semanticCopy)
        .map((key) => [key, semanticCopy[key]]),
    );

    if (!Object.keys(nextErrors).length) return false;
    setValidationErrors((current) => ({ ...current, ...nextErrors }));
    setValidationAttempted(true);
    return true;
  };

  const handleSubmissionError = (serverError, authenticatedSession, { draft = false, fieldErrors = null } = {}) => {
    if (serverError === "semantic_invalid" && applySemanticFieldErrors(fieldErrors)) {
      return true;
    }
    if (serverError === "submission_state_uncertain") {
      if (draft) clearPendingDraft();
      setApplicationStatus("submission_state_uncertain");
      setVerificationNotice(L(
        "تعذر تأكيد ما إذا كان طلبك قد تم التراجع عنه بالكامل. يرجى التحقق من طلبي قبل المحاولة مرة أخرى.",
        "We could not confirm whether your application was fully rolled back. Please check My Application before trying again.",
      ));
      setIsApplicationStatusModalOpen(true);
      return true;
    }
    if (serverError === "unauthorized") {
      beginMagicLinkVerification(authenticatedSession.email);
      return true;
    }
    if (serverError === "email_mismatch") {
      setValues((current) => ({ ...current, email: authenticatedSession.email }));
      setSubmitError(L(
        "تم تحديث البريد الإلكتروني إلى بريدك الموثق. راجع الطلب ثم أرسله مرة أخرى.",
        "Your verified email has been applied. Please review your application and submit again.",
      ));
      return true;
    }
    if (serverError === "application_already_exists") {
      if (draft) clearPendingDraft();
      setApplicationStatus("already_submitted");
      setVerificationNotice(L(
        "لقد تم تقديم طلبك مسبقًا بهذا البريد الإلكتروني.",
        "You already submitted an application.",
      ));
      setIsApplicationStatusModalOpen(true);
      return true;
    }
    if (serverError === "legacy_identity_conflict") {
      if (draft) clearPendingDraft();
      setApplicationStatus("legacy_identity_conflict");
      setVerificationNotice(L(
        "وجدنا سجلاً سابقاً لهذا البريد الإلكتروني. يرجى التواصل معنا للمتابعة بشكل آمن.",
        "We found an existing application record for this email. Please contact support to continue securely.",
      ));
      setIsApplicationStatusModalOpen(true);
      return true;
    }
    if (serverError === "identity_conflict") {
      if (draft) clearPendingDraft();
      setApplicationStatus("identity_conflict");
      setVerificationNotice(L(
        "تعذر متابعة الطلب بهذا الحساب. يرجى التواصل مع الدعم.",
        "We could not continue this application with this account. Please contact support.",
      ));
      setIsApplicationStatusModalOpen(true);
      return true;
    }
    if (draft && serverError === "draft_not_found_or_expired") {
      clearPendingDraft();
      setApplicationStatus("draft_unavailable");
      setVerificationNotice(L(
        "تعذر استعادة الطلب المحفوظ أو انتهت صلاحيته. يرجى بدء طلب جديد.",
        "Your saved application could not be restored or has expired. Please start a new application.",
      ));
      setIsApplicationStatusModalOpen(true);
      return true;
    }
    if (draft && serverError === "verified_email_mismatch") {
      clearPendingDraft();
      setApplicationStatus("draft_verification_mismatch");
      setVerificationNotice(L(
        "تعذر مطابقة الحساب الموثق مع الطلب المحفوظ. يرجى بدء طلب جديد باستخدام البريد نفسه.",
        "The verified account could not be matched with the saved application. Please start a new application using the same email.",
      ));
      setIsApplicationStatusModalOpen(true);
      return true;
    }
    if (draft && serverError === "draft_already_claimed_or_unavailable") {
      clearPendingDraft();
      setApplicationStatus("draft_unavailable");
      setVerificationNotice(L(
        "الطلب المحفوظ لم يعد متاحاً للمتابعة. يرجى بدء طلب جديد.",
        "The saved application is no longer available to continue. Please start a new application.",
      ));
      setIsApplicationStatusModalOpen(true);
      return true;
    }
    if (draft && ["claim_rpc_failure", "unexpected_claim_result", "invalid_draft"].includes(serverError)) {
      setApplicationStatus("draft_claim_retry");
      setVerificationNotice(L(
        "تعذر التحقق من الطلب المحفوظ حالياً. يرجى المحاولة مرة أخرى.",
        "We could not verify the saved application right now. Please try again.",
      ));
      setIsApplicationStatusModalOpen(true);
      return true;
    }
    return false;
  };

  const submitApplication = async (snapshot, authenticatedSession) => {
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const submissionValues = { ...snapshot.values, email: authenticatedSession.email };
      const body = new FormData();
      body.append(
        "payload",
        JSON.stringify({
          ...submissionValues,
          targetFields: submissionValues.targetFields.join(","),
          targetFieldsOther: submissionValues.targetFields.includes("other")
            ? submissionValues.targetFieldsOther.trim()
            : null,
          cvStatus: snapshot.cvStatus,
          changesSinceCv: snapshot.changesSinceCv,
          quiz: snapshot.quiz
            ? {
                answers: snapshot.quiz.quizAnswers,
                score: snapshot.quiz.quizScore,
                resultTier: snapshot.quiz.quizResultTier,
                completedAt: snapshot.quiz.quizCompletedAt,
              }
            : null,
        }),
      );

      if (snapshot.file) body.append("cv", snapshot.file);

      const { data, error } = await authenticatedSession.userSupabase.functions.invoke("submit-application", {
        headers: { Authorization: `Bearer ${authenticatedSession.session.access_token}` },
        body,
      });
      const serverError = await getSubmissionErrorCode(data, error);

      if (handleSubmissionError(serverError, authenticatedSession, { fieldErrors: data?.fieldErrors })) return;
      if (error || data?.ok !== true) throw new Error("Application submission failed");

      setIsAwaitingAuthentication(false);
      completeApplication(data.applicationId);
    } catch {
      setSubmitError(
        L(
          "تعذر إرسال الطلب حالياً. يرجى المحاولة مرة أخرى.",
          "We could not submit your application right now. Please try again.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const createApplicationDraft = async (snapshot) => {
    setIsSubmitting(true);
    setSubmitError("");

    // A deliberate new attempt replaces a previous opaque-token context only.
    // Its server-side row remains private and expires through existing cleanup.
    clearPendingDraft();
    applicationStatusContextRef.current = null;
    setApplicationStatus(null);
    setVerificationNotice("");
    setIsApplicationStatusModalOpen(false);

    try {
      const body = new FormData();
      body.append(
        "payload",
        JSON.stringify({
          ...snapshot.values,
          // CVs are selected only after verification. Keep a neutral server-valid
          // status for a later optional upload without storing any file data.
          cvStatus: "not_sure",
          changesSinceCv: "",
          quiz: snapshot.quiz
            ? {
              answers: snapshot.quiz.quizAnswers,
              score: snapshot.quiz.quizScore,
              resultTier: snapshot.quiz.quizResultTier,
              completedAt: snapshot.quiz.quizCompletedAt,
            }
            : null,
        }),
      );

      const userSupabase = getUserSupabase();
      const { data, error } = userSupabase
        ? await userSupabase.functions.invoke("create-application-draft", { body })
        : { data: null, error: new Error("Application drafts are unavailable") };
      const serverError = await getSubmissionErrorCode(data, error);

      if (serverError === "draft_rate_limited") {
        setSubmitError(L(
          "تعذر حفظ طلب جديد حالياً. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.",
          "We cannot save another application request right now. Please wait a little and try again.",
        ));
        return;
      }
      if (serverError === "semantic_invalid" && applySemanticFieldErrors(data?.fieldErrors)) return;
      if (error || data?.ok !== true || !storeApplicationDraftToken(data.draftToken)) {
        throw new Error("Application draft creation failed");
      }

      setPendingDraftToken(data.draftToken);
      beginMagicLinkVerification(normalizeEmail(snapshot.values.email));
    } catch {
      setSubmitError(L(
        "تعذر حفظ طلبك للتحقق من البريد الإلكتروني. يرجى المحاولة مرة أخرى.",
        "We could not save your application for email verification. Please try again.",
      ));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitApplicationDraft = async () => {
    const draftToken = pendingDraftToken || readApplicationDraftToken();
    const authenticatedSession = await getVerifiedSession();
    if (!draftToken) {
      clearPendingDraft();
      setApplicationStatus("draft_unavailable");
      setVerificationNotice(L(
        "تعذر استعادة الطلب المحفوظ. يرجى بدء طلب جديد.",
        "We could not restore your saved application. Please start a new application.",
      ));
      setIsApplicationStatusModalOpen(true);
      return;
    }
    if (!authenticatedSession) {
      setApplicationStatus("verification_session_unavailable");
      setVerificationNotice(L(
        "تعذر التحقق من جلسة بريدك الإلكتروني حالياً. يرجى المحاولة مرة أخرى.",
        "We could not verify your email session right now. Please try again.",
      ));
      setIsApplicationStatusModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    try {
      const body = new FormData();
      body.append("draft_token", draftToken);
      if (file) body.append("cv", file);

      const { data, error } = await authenticatedSession.userSupabase.functions.invoke("submit-application", {
        headers: { Authorization: `Bearer ${authenticatedSession.session.access_token}` },
        body,
      });
      const serverError = await getSubmissionErrorCode(data, error);
      if (handleSubmissionError(serverError, authenticatedSession, { draft: true, fieldErrors: data?.fieldErrors })) return;
      if (error || data?.ok !== true) throw new Error("Draft application submission failed");

      clearPendingDraft();
      setIsAwaitingAuthentication(false);
      setIsApplicationStatusModalOpen(false);
      completeApplication(data.applicationId);
    } catch {
      setSubmitError(L(
        "تعذر إرسال الطلب المحفوظ حالياً. يرجى المحاولة مرة أخرى.",
        "We could not submit your saved application right now. Please try again.",
      ));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!hasVerifiedEmail) return;
    setValues((current) => (current.email === verifiedEmail ? current : { ...current, email: verifiedEmail }));
  }, [hasVerifiedEmail, verifiedEmail]);

  useEffect(() => {
    if (user?.id) return;
    applicationStatusContextRef.current = null;
    setApplicationStatus(null);
    setIsApplicationStatusLoading(false);
    setIsApplicationStatusModalOpen(false);
  }, [user?.id]);

  useEffect(() => {
    if (!isApplicationStatusModalOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeApplicationStatusModal();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isApplicationStatusModalOpen]);

  useEffect(() => {
    if (!completion?.isModalOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") acknowledgeApplicationCompletion();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completion?.isModalOpen]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const returnedFromMagicLink = url.searchParams.get(MAGIC_LINK_RETURN_PARAM) === "1";
    const storedDraftToken = pendingDraftToken || readApplicationDraftToken();
    const hasPendingDraft = Boolean(storedDraftToken);
    const isCurrentInPageAttempt = isAwaitingAuthentication && hasPendingDraft;
    const isCurrentMagicLinkReturn = returnedFromMagicLink && hasPendingDraft;

    // The query marker has meaning only when coupled to the opaque token for a
    // current Application attempt. A session or old token alone never opens UI.
    if (returnedFromMagicLink && !hasPendingDraft) {
      clearMagicLinkReturnMarker(url);
      return;
    }

    if (isCurrentMagicLinkReturn && !isAuthReady) return;

    if (isCurrentMagicLinkReturn && !hasVerifiedEmail) {
      clearMagicLinkReturnMarker(url);
      clearPendingDraft();
      setIsAwaitingAuthentication(false);
      setApplicationStatus("verification_failed");
      setIsApplicationStatusLoading(false);
      setVerificationNotice(L(
        "رابط التحقق غير صالح أو انتهت صلاحيته. يرجى بدء طلب جديد ثم طلب رابط تحقق جديد.",
        "This verification link is invalid or has expired. Please start a new application and request a new verification link.",
      ));
      setIsApplicationStatusModalOpen(true);
      return;
    }

    if (hasVerifiedEmail && (isCurrentInPageAttempt || isCurrentMagicLinkReturn) && user?.id) {
      const statusContext = `${user.id}:${storedDraftToken}`;
      if (applicationStatusContextRef.current === statusContext) return;

      const requestId = applicationStatusRequestIdRef.current + 1;
      applicationStatusRequestIdRef.current = requestId;
      // Mark the user before the request so Strict Mode cannot issue a duplicate status check.
      applicationStatusContextRef.current = statusContext;
      setIsApplicationStatusLoading(true);
      setVerificationNotice(L("جارٍ التحقق من حالة طلبك...", "Checking your application status..."));

      const checkApplicationStatus = async () => {
        let nextStatus = "unavailable";
        try {
          const userSupabase = getUserSupabase();
          const { data, error } = userSupabase
            ? await userSupabase.rpc("get_my_application_status")
            : { data: null, error: new Error("User authentication is unavailable") };
          if (!error && ["ready", "already_submitted", "legacy_identity_conflict", "identity_conflict"].includes(data)) {
            nextStatus = data;
          }
        } catch {
          nextStatus = "unavailable";
        }

        if (applicationStatusRequestIdRef.current !== requestId) return;

        setApplicationStatus(nextStatus);
        setIsApplicationStatusLoading(false);
        setIsAwaitingAuthentication(false);
        setIsApplicationStatusModalOpen(true);
        if (nextStatus === "already_submitted") clearPendingDraft();
        const hasUsablePendingDraft = nextStatus !== "already_submitted" && hasPendingDraft;
        setPendingDraftToken((current) => current || (hasUsablePendingDraft ? storedDraftToken : ""));
        setVerificationNotice(
          nextStatus === "already_submitted"
            ? L("لقد تم تقديم طلبك مسبقًا بهذا البريد الإلكتروني.", "You already submitted an application.")
            : nextStatus === "legacy_identity_conflict"
              ? L(
                "وجدنا سجلًا سابقًا مرتبطًا بهذا البريد. يرجى التواصل معنا لإكمال التحقق بأمان.",
                "We found an existing record linked to this email. Please contact us to continue securely.",
              )
              : nextStatus === "identity_conflict"
                ? L(
                  "تعذر متابعة الطلب بهذا الحساب. يرجى التواصل معنا.",
                  "We could not continue this application with this account. Please contact us to continue securely.",
                )
                : nextStatus === "ready"
                  ? hasUsablePendingDraft
                    ? L(
                      "تم تأكيد بريدك الإلكتروني. بيانات طلبك جاهزة. يمكنك إرفاق سيرتك الذاتية اختياريًا قبل إرسال الطلب.",
                      "Your application details are ready. You can optionally attach a CV before submitting.",
                    )
                    : L(
                      "تم التحقق من بريدك الإلكتروني. راجع بياناتك ثم أرسل الطلب.",
                      "Your email has been verified. Please review your details and submit your application.",
                    )
                  : L(
                    "تعذر التحقق من حالة طلبك حالياً. يرجى المحاولة لاحقاً.",
                    "We could not verify your application status right now. Please try again later.",
                  ),
        );

        if (returnedFromMagicLink) clearMagicLinkReturnMarker(url);
      };

      checkApplicationStatus();
      return;
    }

    if (isAwaitingAuthentication && !isAuthenticationOpen) {
      setIsAwaitingAuthentication(false);
    }
  }, [hasVerifiedEmail, isAuthReady, isAuthenticationOpen, isAwaitingAuthentication, pendingDraftToken, user?.id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || isAwaitingAuthentication || isApplicationStatusLoading || isSubmissionBlocked) return;

    setSubmitError("");

    const errors = { ...validateStepOne(), ...validateStepTwo() };
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setValidationAttempted(true);
      scrollToFirstInvalid(errors);
      return;
    }

    setValidationErrors({});
    setValidationAttempted(false);
    const snapshot = createSubmissionSnapshot();
    const authenticatedSession = await getVerifiedSession();

    if (!authenticatedSession) {
      await createApplicationDraft(snapshot);
      return;
    }

    setIsApplicationStatusLoading(true);
    try {
      const { data: existingStatus, error: statusError } = await authenticatedSession.userSupabase
        .rpc("get_my_application_status");
      if (!statusError && existingStatus === "already_submitted") {
        clearPendingDraft();
        setApplicationStatus("already_submitted");
        setVerificationNotice(L(
          "لقد تم تقديم طلبك مسبقًا بهذا البريد الإلكتروني.",
          "You already submitted an application.",
        ));
        setIsApplicationStatusModalOpen(true);
        return;
      }
    } catch {
      // The submission endpoint remains the final authority if this UX check is unavailable.
    } finally {
      setIsApplicationStatusLoading(false);
    }

    await submitApplication(snapshot, authenticatedSession);
  };

  const renderError = (name) =>
    validationErrors[name] ? (
      <span className="field-error-message" id={`${name}-error`} role="alert">
        {errorMessage(name)}
      </span>
    ) : null;

  const renderTextField = (name, arabicLabel, englishLabel, optional = false, type = "text", helperCopy = null) => (
    <div className={`field-shell ${validationErrors[name] ? "has-error" : ""}`}>
      <label htmlFor={name}>
        <span className="field-label-row">
          <span>{L(arabicLabel, englishLabel)}</span>
          {optional ? (
            <small>{L("اختياري", "Optional")}</small>
          ) : (
            <small className="required-mark" aria-hidden="true">*</small>
          )}
        </span>
        <input
          ref={assignRef(name)}
          id={name}
          name={name}
          type={type}
          value={values[name]}
          onChange={updateValue}
          onBlur={() => markFieldTouched(name)}
          maxLength={FIELD_MAX_LENGTHS[name]}
          disabled={name === "email" && hasVerifiedEmail}
          aria-invalid={Boolean(validationErrors[name])}
          aria-describedby={validationErrors[name] ? `${name}-error` : helperCopy ? `${name}-helper` : undefined}
        />
      </label>
      {name === "email" && hasVerifiedEmail && (
        <div className="field-helper" role="status">
          <span>{L("هذا البريد الإلكتروني موثّق للجلسة الحالية.", "This email is verified for your current session.")}</span>
          <button type="button" onClick={handleUseDifferentEmail} disabled={isChangingEmail || isSubmitting}>
            {isChangingEmail ? L("جارٍ تغيير البريد...", "Changing email...") : L("استخدم بريداً إلكترونياً مختلفاً", "Use a different email")}
          </button>
        </div>
      )}
      {name === "email" && emailChangeError && (
        <span className="field-error-message" role="alert">{emailChangeError}</span>
      )}
      {helperCopy && <p className="field-helper" id={`${name}-helper`}>{L(helperCopy[0], helperCopy[1])}</p>}
      {renderError(name)}
    </div>
  );

  if (completion) {
    const applicationReference = completion.applicationId.slice(0, 8);
    return (
      <>
        <div className="form refined-form">
          <div className="section-heading application-heading">
            <span>{L("التسجيل", "Application")}</span>
            <h2>{L("تم استلام طلبك", "Application received")}</h2>
          </div>
          <p className="application-complete-summary" role="status">
            {L("طلبك مكتمل وتم استلامه للمراجعة.", "Your application is complete and has been received for review.")}
          </p>
          <p className="application-complete-reference" dir="ltr">
            {L("مرجع الطلب:", "Application reference:")} {applicationReference}
          </p>
        </div>
        {completion.isModalOpen && createPortal(
          <div className="application-status-modal-backdrop" role="presentation">
            <section
              className="application-status-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="application-success-modal-title"
            >
              <span className="application-status-modal__eyebrow">CareerFit Lab</span>
              <h2 id="application-success-modal-title">
                {L("تم استلام طلبك بنجاح.", "Application received successfully.")}
              </h2>
              <p>
                {L(
                  "تم حفظ طلب المشاركة وسنراجع المعلومات المقدمة.",
                  "Your application has been saved and the submitted information will be reviewed.",
                )}
              </p>
              <p className="application-success-modal__reference" dir="ltr">
                {L("مرجع الطلب:", "Application reference:")} {applicationReference}
              </p>
              <div className="application-status-modal__actions">
                <button type="button" autoFocus onClick={acknowledgeApplicationCompletion}>
                  {L("موافق", "OK")}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
      </>
    );
  }

  return (
    <form className="form refined-form" onSubmit={handleSubmit} noValidate>
      <div className="section-heading application-heading">
        <span>{L("التسجيل", "Application")}</span>
        <h2>{L("ابدأ بخطوتين بسيطتين", "Start in two simple steps")}</h2>
      </div>

      {verificationNotice && (
        <div
          className={`submission-status ${!applicationStatus || applicationStatus === "ready" ? "success" : "submission-error"}`}
          role="status"
        >
          {verificationNotice}
        </div>
      )}

      <div className="formsteps" aria-label={L("خطوات الطلب", "Application steps")}>
        <b className={step === 1 ? "active" : step > 1 ? "complete" : ""}>
          1. {L("المعلومات الأساسية", "Basic information")}
        </b>
        <b className={step === 2 ? "active" : ""}>
          2. {L("الاتجاه المهني", "Career direction")}
        </b>
      </div>

      {step === 1 ? (
        <div className="fields">
          {renderTextField("fullName", "الاسم الكامل", "Full name")}
          {renderTextField("email", "البريد الإلكتروني", "Email", false, "email")}
          {renderTextField("phone", "رقم الهاتف", "Phone", false, "tel")}
        </div>
      ) : (
        <div className="fields step-two-fields">
          <section className="full form-group">
            <div className="form-group-heading">
              <h3>{L("اتجاهك المهني", "Career direction")}</h3>
              <p>
                {L(
                  "ساعدنا على فهم الفرصة التي تسعى لها والمجالات التي تريد استهدافها.",
                  "Help us understand the opportunity and fields you want to target.",
                )}
              </p>
            </div>

            <div className={`field-shell ${validationErrors.opportunityType ? "has-error" : ""}`}>
              <label htmlFor="opportunityType">
                <span className="field-label-row">
                  <span>{L("هدفك المهني الرئيسي", "Primary career goal")}</span>
                  <small className="required-mark" aria-hidden="true">*</small>
                </span>
                <select
                  ref={assignRef("opportunityType")}
                  id="opportunityType"
                  name="opportunityType"
                  value={values.opportunityType}
                  onChange={updateValue}
                  onBlur={() => markFieldTouched("opportunityType")}
                  aria-invalid={Boolean(validationErrors.opportunityType)}
                  aria-describedby={validationErrors.opportunityType ? "opportunityType-error" : undefined}
                >
                  <option value="">{L("اختر نوع الفرصة", "Select opportunity type")}</option>
                  {OPPORTUNITY_TYPE_OPTIONS.map(([value, arabic, english]) => (
                    <option key={value} value={value}>
                      {L(arabic, english)}
                    </option>
                  ))}
                </select>
              </label>
              {renderError("opportunityType")}
            </div>

            {renderTextField(
              "targetRole",
              "وظيفة أو دور تستهدفه حالياً",
              "Role you are currently targeting",
              true,
              "text",
              [
                "اختياري: اكتب مسمى وظيفياً حقيقياً وواضحاً إذا كان لديك دور محدد في ذهنك.",
                "Optional: enter a real, clear job title if you have a specific role in mind.",
              ],
            )}

            <div className={`field-shell target-fields-shell ${validationErrors.targetFields ? "has-error" : ""}`}>
              <div className="field-label-row">
                <span id="target-fields-label">{L("المجالات التي تسعى لها", "Target fields")}</span>
                <small className="required-mark" aria-hidden="true">*</small>
              </div>
                <p className="field-helper">
                  {L(
                    "اختر حتى 3 مجالات تمثل اتجاهك المهني الحالي بشكل أفضل.",
                    "Choose up to 3 fields that best match your current career direction.",
                  )}
                </p>
              <div
                ref={assignRef("targetFields")}
                className={`chips target-field-chips ${validationErrors.targetFields ? "control-error" : ""}`}
                role="group"
                aria-labelledby="target-fields-label"
                aria-invalid={Boolean(validationErrors.targetFields)}
                aria-describedby={validationErrors.targetFields ? "targetFields-error" : undefined}
                tabIndex={-1}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) markFieldTouched("targetFields");
                }}
              >
                {TARGET_FIELD_OPTIONS.map(([value, arabic, english]) => {
                  const selected = values.targetFields.includes(value);
                  return (
                    <button 
                      type="button" 
                      key={value} 
                      className={selected ? "selected" : ""} 
                      aria-pressed={selected} 
                      disabled={!selected && values.targetFields.length >= 3}
                      onClick={() => toggleTargetField(value)} 
                    >
                      {selected && <span className="chip-check" aria-hidden="true">✓</span>}
                      {L(arabic, english)}
                    </button>
                  );
                })}
              </div>
                <p className="field-helper">
                {L(
                  `تم اختيار ${values.targetFields.length} من 3`,
                  `${values.targetFields.length} / 3 selected`,
                )}
              </p>
              {renderError("targetFields")}
            </div>

            {values.targetFields.includes("other") && (
              <div className={`field-shell other-target-field ${validationErrors.targetFieldsOther ? "has-error" : ""}`}>
                <label htmlFor="targetFieldsOther">
                  <span className="field-label-row">
                    <span>{L("يرجى تحديد المجال الذي تستهدفه", "Please specify your target field")}</span>
                    <small className="required-mark" aria-hidden="true">*</small>
                  </span>
                  <input
                    ref={assignRef("targetFieldsOther")}
                    id="targetFieldsOther"
                    name="targetFieldsOther"
                    value={values.targetFieldsOther}
                    onChange={updateValue}
                    onBlur={() => markFieldTouched("targetFieldsOther")}
                    maxLength={FIELD_MAX_LENGTHS.targetFieldsOther}
                    aria-invalid={Boolean(validationErrors.targetFieldsOther)}
                    aria-describedby={validationErrors.targetFieldsOther ? "targetFieldsOther-error" : "targetFieldsOther-helper"}
                  />
                </label>
                <p className="field-helper" id="targetFieldsOther-helper">
                  {L(
                    "اكتب مجالاً مهنياً حقيقياً وواضحاً، مثل الأمن السيبراني أو الهندسة المدنية.",
                    "Enter a real, clear professional field, such as Cybersecurity or Civil Engineering.",
                  )}
                </p>
                {renderError("targetFieldsOther")}
              </div>
            )}

          </section>

          <section className="full form-group">
            <div className="form-group-heading">
              <h3>{L("خبرتك وما تحتاجه", "Your experience and needs")}</h3>
              <p>
                {L(
                  "إجابات مختصرة تساعدنا على فهم أفضل خطوة تالية لك.",
                  "Short answers help us understand the best next step for you.",
                )}
              </p>
            </div>

            <div className={`field-shell ${validationErrors.relevantExperience ? "has-error" : ""}`}>
              <label htmlFor="relevantExperience">
                <span className="field-label-row">
                  <span>{L("ما الخبرة أو المشاريع التي تريد أن نأخذها بعين الاعتبار؟", "What experience or projects should we consider when reviewing your application?")}</span>
                  <small className="required-mark" aria-hidden="true">*</small>
                </span>
                <textarea
                  ref={assignRef("relevantExperience")}
                  id="relevantExperience"
                  name="relevantExperience"
                  value={values.relevantExperience}
                  onChange={updateValue}
                  onBlur={() => markFieldTouched("relevantExperience")}
                  maxLength={FIELD_MAX_LENGTHS.relevantExperience}
                  aria-invalid={Boolean(validationErrors.relevantExperience)}
                  aria-describedby={validationErrors.relevantExperience ? "relevantExperience-error" : "relevantExperience-helper"}
                />
              </label>
              <p className="field-helper" id="relevantExperience-helper">
                {L(
                  "مثلاً: خبرة عملية، تدريب، مشاريع، عمل حر أو دراسة ذات صلة.",
                  "For example: work experience, internships, projects, freelance work, or relevant study.",
                )}
              </p>
              {renderError("relevantExperience")}
            </div>

            <div className={`field-shell ${validationErrors.strongestSkills ? "has-error" : ""}`}>
              <label htmlFor="strongestSkills">
                <span className="field-label-row">
                  <span>{L("ما أبرز مهاراتك أو نقاط قوتك حالياً؟", "What are your strongest skills or strengths right now?")}</span>
                  <small className="required-mark" aria-hidden="true">*</small>
                </span>
                <textarea
                  ref={assignRef("strongestSkills")}
                  id="strongestSkills"
                  name="strongestSkills"
                  value={values.strongestSkills}
                  onChange={updateValue}
                  onBlur={() => markFieldTouched("strongestSkills")}
                  maxLength={FIELD_MAX_LENGTHS.strongestSkills}
                  aria-invalid={Boolean(validationErrors.strongestSkills)}
                  aria-describedby={validationErrors.strongestSkills ? "strongestSkills-error" : "strongestSkills-helper"}
                />
              </label>
              <p className="field-helper" id="strongestSkills-helper">
                {L(
                  "اكتب مهارات حقيقية، ويفضّل فصلها بفواصل، مثل Python، Django، REST APIs.",
                  "List real skills, preferably separated with commas, such as Python, Django, REST APIs.",
                )}
              </p>
              {renderError("strongestSkills")}
            </div>

            <div className={`field-shell ${validationErrors.careerChallenge ? "has-error" : ""}`}>
              <label htmlFor="careerChallenge">
                <span className="field-label-row">
                  <span>{L("ما أكبر تحدٍ مهني تواجهه حالياً؟", "What is the main career challenge you are facing right now?")}</span>
                  <small className="required-mark" aria-hidden="true">*</small>
                </span>
                <textarea
                  ref={assignRef("careerChallenge")}
                  id="careerChallenge"
                  name="careerChallenge"
                  value={values.careerChallenge}
                  onChange={updateValue}
                  onBlur={() => markFieldTouched("careerChallenge")}
                  maxLength={FIELD_MAX_LENGTHS.careerChallenge}
                  aria-invalid={Boolean(validationErrors.careerChallenge)}
                  aria-describedby={validationErrors.careerChallenge ? "careerChallenge-error" : "careerChallenge-helper"}
                />
              </label>
              <p className="field-helper" id="careerChallenge-helper">
                {L(
                  "صف تحدياً مهنياً حقيقياً تواجهه الآن، مثل تحديد الوظائف المناسبة أو نقص الخبرة.",
                  "Describe a real career challenge you face now, such as targeting suitable roles or limited experience.",
                )}
              </p>
              {renderError("careerChallenge")}
            </div>

            <div className={`field-shell ${validationErrors.careerfitHelp ? "has-error" : ""}`}>
              <label htmlFor="careerfitHelp">
                <span className="field-label-row">
                  <span>{L("ما النتيجة التي تريد من CareerFit مساعدتك في تحقيقها؟", "What outcome would you like CareerFit to help you achieve?")}</span>
                  <small className="required-mark" aria-hidden="true">*</small>
                </span>
                <textarea
                  ref={assignRef("careerfitHelp")}
                  id="careerfitHelp"
                  name="careerfitHelp"
                  value={values.careerfitHelp}
                  onChange={updateValue}
                  onBlur={() => markFieldTouched("careerfitHelp")}
                  maxLength={FIELD_MAX_LENGTHS.careerfitHelp}
                  aria-invalid={Boolean(validationErrors.careerfitHelp)}
                  aria-describedby={validationErrors.careerfitHelp ? "careerfitHelp-error" : "careerfitHelp-helper"}
                />
              </label>
              <p className="field-helper" id="careerfitHelp-helper">
                {L(
                  "مثلاً: توضيح المسار المهني، تحسين السيرة الذاتية، أو الاستعداد للمقابلات.",
                  "For example: clearer career direction, a stronger CV, or better interview preparation.",
                )}
              </p>
              {renderError("careerfitHelp")}
            </div>
          </section>

          <section className="full form-group">
            <div className="form-group-heading">
              <h3>{L("تفاصيل اختيارية", "Optional details")}</h3>
            </div>

            {renderTextField("linkedinUrl", "رابط LinkedIn", "LinkedIn URL", true, "url")}
            {renderTextField("portfolioUrl", "رابط Portfolio أو GitHub", "Portfolio or GitHub URL", true, "url")}
            <div className={`field-shell ${validationErrors.additionalNotes ? "has-error" : ""}`}>
              <label htmlFor="additionalNotes">
                <span className="field-label-row">
                  <span>{L("ملاحظات إضافية", "Additional notes")}</span>
                  <small>{L("اختياري", "Optional")}</small>
                </span>
                <textarea
                  ref={assignRef("additionalNotes")}
                  id="additionalNotes"
                  name="additionalNotes"
                  value={values.additionalNotes}
                  onChange={updateValue}
                  onBlur={() => markFieldTouched("additionalNotes")}
                  maxLength={FIELD_MAX_LENGTHS.additionalNotes}
                  aria-invalid={Boolean(validationErrors.additionalNotes)}
                  aria-describedby={validationErrors.additionalNotes ? "additionalNotes-error" : "additionalNotes-helper"}
                />
              </label>
              <p className="field-helper" id="additionalNotes-helper">
                {L("اختياري: تكفي ملاحظة قصيرة وواضحة.", "Optional: a short, clear note is enough.")}
              </p>
              {renderError("additionalNotes")}
            </div>
          </section>

          {hasVerifiedEmail && !pendingDraftToken && (
          <section className="full form-group cv-group">
            <div className="form-group-heading">
              <h3>{L("سيرتك الذاتية", "Your CV")}</h3>
              <p>
                {L(
                  "رفع السيرة الذاتية اختياري، لكن يُفضّل إرفاقها إن كانت متوفرة للحصول على تقييم أدق وأفضل.",
                  "Uploading a CV is optional, but we recommend attaching one if available for a more accurate and useful evaluation.",
                )}
              </p>
            </div>

            <div
              ref={assignRef("file")}
              className={`upload ${validationErrors.file ? "control-error" : ""}`}
              tabIndex={-1}
            >
              <input
                ref={uploadInputRef}
                id="cvFile"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
              />
              <div className="upload-copy">
                <strong>{file ? file.name : L("ارفع السيرة الذاتية", "Upload your CV")}</strong>
                <span>{L("PDF فقط، حتى 5MB", "PDF only, up to 5 MB")}</span>
              </div>
              <button
                className="button secondary compact-button"
                type="button"
                onClick={() => (file ? removeFile() : uploadInputRef.current?.click())}
              >
                {file ? L("إزالة الملف", "Remove file") : L("اختر ملفاً", "Choose file")}
              </button>
            </div>
            {renderError("file")}

            {file && (
              <div className={`field-shell cv-status-shell ${validationErrors.cvStatus ? "has-error" : ""}`}>
                <div className="field-label-row">
                  <span id="cv-status-label">{L("هل سيرتك الذاتية محدثة؟", "Is your CV up to date?")}</span>
                  <small className="required-mark" aria-hidden="true">*</small>
                </div>
                <div
                  ref={assignRef("cvStatus")}
                  className={`chips cv-cards ${validationErrors.cvStatus ? "control-error" : ""}`}
                  role="group"
                  aria-labelledby="cv-status-label"
                  aria-invalid={Boolean(validationErrors.cvStatus)}
                  aria-describedby={validationErrors.cvStatus ? "cvStatus-error" : undefined}
                  tabIndex={-1}
                >
                  {CV_STATUS_OPTIONS.map(([value, arabic, english]) => {
                    const selected = cvStatus === value;
                    return (
                      <button
                        type="button"
                        key={value}
                        className={selected ? "selected" : ""}
                        aria-pressed={selected}
                        onClick={() => handleCvStatus(value)}
                      >
                        {selected && <span className="chip-check" aria-hidden="true">✓</span>}
                        {L(arabic, english)}
                      </button>
                    );
                  })}
                </div>
                {renderError("cvStatus")}
              </div>
            )}

            {file && cvStatus && cvStatus !== "current" && (
              <div className="field-shell cv-changes-field">
                <label htmlFor="changesSinceCv">
                  <span className="field-label-row">
                    <span>{L("ما الذي تغيّر منذ آخر تحديث للسيرة الذاتية؟", "What has changed since your CV was last updated?")}</span>
                    <small>{L("اختياري", "Optional")}</small>
                  </span>
                  <textarea
                    ref={assignRef("changesSinceCv")}
                    id="changesSinceCv"
                    value={changesSinceCv}
                    maxLength={FIELD_MAX_LENGTHS.changesSinceCv}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setChangesSinceCv(nextValue);
                      revalidateField("changesSinceCv", values, { file, cvStatus, changesSinceCv: nextValue });
                    }}
                    onBlur={() => markFieldTouched("changesSinceCv")}
                    aria-invalid={Boolean(validationErrors.changesSinceCv)}
                    aria-describedby={validationErrors.changesSinceCv ? "changesSinceCv-error" : "changesSinceCv-helper"}
                  />
                </label>
                {renderError("changesSinceCv")}
                <p className="field-helper" id="changesSinceCv-helper">
                  {L(
                    "مثلاً: وظيفة أو مشروع جديد، مهارات جديدة، تخرج حديث أو تغيير المجال المستهدف.",
                    "For example: a new role or project, new skills, graduation, or a changed target field.",
                  )}
                </p>
              </div>
            )}
          </section>
          )}

          <section className={`full submit-area ${validationErrors.privacyConsent ? "has-error" : ""}`}>
            <div
              ref={assignRef("privacyConsent")}
              className={`privacy-control ${validationErrors.privacyConsent ? "control-error" : ""}`}
              tabIndex={-1}
            >
              <label className="consent" htmlFor="privacyConsent">
                <input
                  id="privacyConsent"
                  name="privacyConsent"
                  type="checkbox"
                  checked={values.privacyConsent}
                  onChange={updateValue}
                  onBlur={() => markFieldTouched("privacyConsent")}
                  aria-invalid={Boolean(validationErrors.privacyConsent)}
                  aria-describedby={validationErrors.privacyConsent ? "privacyConsent-error" : undefined}
                />
                <span>
                  {L(
                    "أوافق على استخدام المعلومات التي أرسلها لمراجعة طلب المشاركة وفهم وضعي المهني الحالي.",
                    "I agree to the use of the information I submit to review my application and understand my current professional situation.",
                  )}
                </span>
              </label>
            </div>
            {renderError("privacyConsent")}

            <p className="submission-note">
              {L(
                "لن يعني إرسال الطلب قبول المشاركة تلقائياً. سيتم مراجعة المعلومات المقدمة أولاً.",
                "Submitting an application does not automatically confirm participation. The submitted information will be reviewed first.",
              )}
            </p>

            {validationAttempted && Object.keys(validationErrors).length > 0 && (
              <div className="validation-summary" role="alert">
                {L(
                  "يرجى تصحيح الحقول المطلوبة أو غير الصالحة والمحددة أدناه.",
                  "Please correct the highlighted required or invalid fields.",
                )}
              </div>
            )}

            {submitError && (
              <div className="submission-status submission-error" role="alert">
                {submitError}
              </div>
            )}
          </section>
        </div>
      )}

      <div className="actions form-actions">
        {step === 2 && (
          <button className="button secondary" type="button" onClick={() => setStep(1)} disabled={isSubmitting}>
            {L("السابق", "Back")}
          </button>
        )}
        <button
          className="button primary"
          disabled={isSubmitting || isAwaitingAuthentication || isApplicationStatusLoading || isSubmissionBlocked}
          type={step === 1 ? "button" : "submit"}
          onClick={step === 1 ? handleContinue : undefined}
        >
          {step === 1
            ? L("التالي", "Continue")
            : isSubmitting
              ? L("جارٍ إرسال الطلب...", "Submitting...")
            : isAwaitingAuthentication
                ? L("أكمل التحقق من البريد الإلكتروني أولاً", "Complete email verification first")
                : isApplicationStatusLoading
                  ? L("جارٍ التحقق من حالة الطلب...", "Checking application status...")
                  : isSubmissionBlocked
                    ? L("التقديم غير متاح لهذا الحساب", "Submission unavailable for this account")
                : hasVerifiedEmail
                  ? L("قدّم طلب المشاركة", "Submit Application")
                  : L("متابعة وتأكيد البريد الإلكتروني", "Continue & verify email")}
        </button>
      </div>

      {isApplicationStatusModalOpen && (
        <div className="application-status-modal-backdrop" role="presentation">
          <section
            className="application-status-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-status-modal-title"
          >
            <button
              className="application-status-modal__close"
              type="button"
              aria-label={L("إغلاق", "Close")}
              onClick={closeApplicationStatusModal}
            >
              ×
            </button>
            <span className="application-status-modal__eyebrow">CareerFit Lab</span>
            <h2 id="application-status-modal-title">
              {applicationStatus === "ready"
                ? L("تم التحقق من البريد الإلكتروني", "Email verified")
                : applicationStatus === "already_submitted"
                  ? L("تم إرسال الطلب مسبقاً", "Application already submitted")
                  : applicationStatus === "verification_failed"
                    ? L("تعذر التحقق من البريد الإلكتروني", "Email verification failed")
                  : L("تعذر متابعة الطلب", "Application status")}
            </h2>
            <p>{verificationNotice}</p>
            {submitError && (
              <p className="application-status-modal__error" role="alert">{submitError}</p>
            )}
            {applicationStatus === "ready" && pendingDraftToken && (
              <label className="application-status-modal__cv">
                <span>{L("إرفاق السيرة الذاتية (اختياري)", "Attach CV (optional)")}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                />
                <small>
                  {file
                    ? file.name
                    : L("PDF فقط، حتى 5MB", "PDF only, up to 5 MB")}
                </small>
              </label>
            )}
            <div className="application-status-modal__actions">
              {applicationStatus === "ready" ? (
                <button
                  type="button"
                  autoFocus
                  onClick={pendingDraftToken ? submitApplicationDraft : continueApplication}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? L("جارٍ إرسال الطلب...", "Submitting application...")
                    : pendingDraftToken
                      ? L("إرسال الطلب", "Submit application")
                      : L("متابعة الطلب", "Continue application")}
                </button>
              ) : applicationStatus === "draft_claim_retry" ? (
                <button type="button" autoFocus onClick={submitApplicationDraft} disabled={isSubmitting}>
                  {L("حاول مرة أخرى", "Try again")}
                </button>
              ) : applicationStatus === "verification_failed" ? (
                <button type="button" autoFocus onClick={requestNewVerificationLink}>
                  {L("ابدأ طلباً جديداً", "Start a new application")}
                </button>
              ) : (
                <button type="button" autoFocus onClick={closeApplicationStatusModal}>
                  {L("إغلاق", "Close")}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </form>
  );
}
