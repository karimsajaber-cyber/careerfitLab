import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getUserSupabase } from "../lib/supabase";
import { applyCareerProfileSeed } from "../lib/careerProfileSeed";
import {
  isValidCareerConstraint,
  isValidEducationNarrative,
  isValidLanguage,
  isValidLocation,
  isValidLongProfessionalNarrative,
  isValidProfessionalRole,
  isValidSkill,
  normalizeProfessionalText,
} from "../lib/professionalDataValidation";
import { useUserAuth } from "./UserAuthProvider";
import { validateCareerFitPassword } from "../lib/passwordPolicy";

const MAX_TEXT_LENGTH = 2000;
const MAX_ITEM_LENGTH = 100;
const MAX_ITEMS = 12;
const RELOCATION_VALUES = new Set(["yes", "no", "flexible"]);
const WORK_ARRANGEMENT_VALUES = new Set(["remote", "hybrid", "onsite", "flexible"]);
const AVAILABILITY_VALUES = new Set(["full_time", "part_time", "flexible"]);

const emptyProfile = {
  professionalSummary: "",
  targetRoles: [],
  skills: [],
  experienceSummary: "",
  educationSummary: "",
  languages: [],
  location: { preferredLocation: "", relocation: "" },
  work: { arrangement: "", availability: "" },
  careerConstraints: [],
};

const asItems = (value) => Array.isArray(value)
  ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, MAX_ITEMS)
  : [];

const asObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

const cloneProfile = (profile) => ({
  ...profile,
  targetRoles: [...profile.targetRoles],
  skills: [...profile.skills],
  languages: [...profile.languages],
  location: { ...profile.location },
  work: { ...profile.work },
  careerConstraints: [...profile.careerConstraints],
});

const normaliseItem = normalizeProfessionalText;

const itemValidators = {
  targetRoles: isValidProfessionalRole,
  skills: isValidSkill,
  languages: isValidLanguage,
  careerConstraints: isValidCareerConstraint,
};

const isValidItemList = (items, field) => (
  items.length <= MAX_ITEMS && items.every((item) => itemValidators[field](item))
);

const normaliseProfile = (profileData) => {
  const data = asObject(profileData);
  const location = asObject(data.location_preferences);
  const work = asObject(data.work_preferences);

  return {
    professionalSummary: typeof data.professional_summary === "string" ? data.professional_summary : "",
    targetRoles: asItems(data.target_roles),
    skills: asItems(data.skills),
    experienceSummary: typeof data.experience_summary === "string" ? data.experience_summary : "",
    educationSummary: typeof data.education_summary === "string" ? data.education_summary : "",
    languages: asItems(data.languages),
    location: {
      preferredLocation: typeof location.preferred_location === "string" ? location.preferred_location : "",
      relocation: typeof location.relocation === "string" ? location.relocation : "",
    },
    work: {
      arrangement: typeof work.arrangement === "string" ? work.arrangement : "",
      availability: typeof work.availability === "string" ? work.availability : "",
    },
    careerConstraints: asItems(data.career_constraints),
  };
};

const serialiseProfile = (profile, existingData) => {
  const currentData = asObject(existingData);
  return {
    ...currentData,
    professional_summary: profile.professionalSummary.trim() || null,
    target_roles: profile.targetRoles,
    skills: profile.skills,
    experience_summary: profile.experienceSummary.trim() || null,
    education_summary: profile.educationSummary.trim() || null,
    languages: profile.languages,
    location_preferences: {
      ...asObject(currentData.location_preferences),
      preferred_location: profile.location.preferredLocation.trim() || null,
      relocation: profile.location.relocation || null,
    },
    work_preferences: {
      ...asObject(currentData.work_preferences),
      arrangement: profile.work.arrangement || null,
      availability: profile.work.availability || null,
    },
    career_constraints: profile.careerConstraints,
  };
};

function ItemEditor({ id, label, hint, items, onAdd, onRemove, onBlur, language, inputRef, validationError }) {
  const [draft, setDraft] = useState("");
  const [itemError, setItemError] = useState("");
  const isArabic = language === "ar";

  const submitItem = () => {
    const result = onAdd(draft);
    if (result.ok) {
      setDraft("");
      setItemError("");
    } else {
      setItemError(result.error);
    }
  };

  return (
    <div className="career-profile__item-editor">
      <div className="career-profile__field-heading">
        <label htmlFor={id}>{label}</label>
        <span>{hint}</span>
      </div>
      <div className="career-profile__item-entry">
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={draft}
          maxLength={MAX_ITEM_LENGTH}
          onChange={(event) => {
            setDraft(event.target.value);
            if (itemError) setItemError("");
          }}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitItem();
            }
          }}
          placeholder={isArabic ? "أضف عنصراً" : "Add an item"}
          aria-invalid={Boolean(itemError || validationError)}
          aria-describedby={itemError || validationError ? `${id}-error` : undefined}
        />
        <button type="button" onClick={submitItem}>
          {isArabic ? "إضافة" : "Add"}
        </button>
      </div>
      {(itemError || validationError) && <p className="career-profile__field-error" id={`${id}-error`} role="alert">{itemError || validationError}</p>}
      <div className="career-profile__items" aria-live="polite">
        {items.map((item) => (
          <span className="career-profile__item" key={item}>
            {item}
            <button type="button" onClick={() => onRemove(item)} aria-label={`${isArabic ? "إزالة" : "Remove"} ${item}`}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function CareerProfile({ language = "ar", onLanguageChange }) {
  const isArabic = language === "ar";
  const { user, authenticationMethod, requestAuthentication, signOut: signOutUser } = useUserAuth();
  const [profile, setProfile] = useState(emptyProfile);
  const [persistedProfile, setPersistedProfile] = useState(emptyProfile);
  const [profileData, setProfileData] = useState({});
  const [profileMode, setProfileMode] = useState("create");
  const [applicationReviewStatus, setApplicationReviewStatus] = useState(null);
  const [isReviewStatusLoading, setIsReviewStatusLoading] = useState(false);
  const [reviewStatusError, setReviewStatusError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActivatingAccount, setIsActivatingAccount] = useState(false);
  const [isAccountActivated, setIsAccountActivated] = useState(false);
  const [activationPassword, setActivationPassword] = useState("");
  const [activationPasswordConfirmation, setActivationPasswordConfirmation] = useState("");
  const [activationError, setActivationError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [hasSaveAttempted, setHasSaveAttempted] = useState(false);
  const [actionError, setActionError] = useState("");
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const formId = useId();
  const fieldRefs = useRef({});

  const copy = isArabic ? {
    eyebrow: "طلبي",
    title: "تابع حالة طلبك",
    description: "تحقق من حالة طلب CareerFit، ثم فعّل حسابك بعد قبول الطلب للوصول إلى ملفك المهني.",
    signedIn: "مسجل الدخول باسم",
    signOut: "تسجيل الخروج",
    signingOut: "جارٍ تسجيل الخروج...",
    signOutError: "تعذر تسجيل الخروج حالياً. حاول مرة أخرى.",
    authTitle: "الوصول إلى طلبي",
    authText: "تحقق من حالة طلبك عبر رابط آمن، أو سجّل الدخول إذا كنت فعّلت حسابك مسبقاً.",
    checkApplication: "تحقق من حالة طلبي",
    signIn: "تسجيل الدخول",
    checkingApplication: "جارٍ التحقق من حالة طلبك...",
    profileAccess: "الوصول إلى الملف المهني",
    acceptedTitle: "تم قبول طلبك",
    acceptedText: "يمكنك الآن تفعيل حسابك للوصول إلى ملفك المهني.",
    activateTitle: "فعّل حسابك",
    activateText: "أنشئ كلمة مرور لحسابك الحالي. لن يتم إنشاء حساب جديد ولن تتغير حالة طلبك.",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    activate: "تفعيل الحساب",
    activating: "جارٍ تفعيل الحساب...",
    alreadyActivated: "فعّلت حسابك مسبقاً؟ سجّل الدخول بكلمة المرور",
    reauthenticationError: "تعذر الانتقال لتسجيل الدخول حالياً. حاول مرة أخرى.",
    activationError: "تعذر تفعيل الحساب حالياً. حاول مرة أخرى.",
    passwordMismatch: "كلمتا المرور غير متطابقتين.",
    passwordTooShort: "استخدم كلمة مرور من 12 حرفاً على الأقل. يُنصح بعبارة مرور طويلة وفريدة.",
    profileReadyText: "يمكنك الآن إنشاء ملفك المهني وتحديثه لاحقاً.",
    noApplicationTitle: "قدّم طلبك أولاً",
    noApplicationText: "يُتاح الملف المهني بعد تقديم طلب CareerFit وقبوله.",
    submittedTitle: "طلبك قيد التقديم",
    submittedText: "سنراجع طلبك أولاً. سيتاح الملف المهني عند قبول الطلب.",
    underReviewTitle: "طلبك قيد المراجعة",
    underReviewText: "سيتاح الملف المهني عند قبول طلبك.",
    rejectedTitle: "لم يُقبل الطلب",
    rejectedText: "الملف المهني غير متاح لهذا الطلب حالياً.",
    waitlistedTitle: "طلبك على قائمة الانتظار",
    waitlistedText: "سيتاح الملف المهني عند قبول طلبك.",
    withdrawnTitle: "تم سحب الطلب",
    withdrawnText: "الملف المهني غير متاح لهذا الطلب حالياً.",
    reviewStatusError: "تعذر التحقق من حالة طلبك حالياً. حاول مرة أخرى لاحقاً.",
    goToApplication: "انتقل إلى الطلب",
    loading: "جارٍ تحميل ملفك المهني...",
    loadError: "تعذر تحميل ملفك المهني حالياً. حاول مرة أخرى لاحقاً.",
    create: "إنشاء ملفي المهني",
    edit: "تعديل الملف المهني",
    save: "حفظ التغييرات",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ...",
    saved: "تم حفظ التغييرات بنجاح.",
    saveError: "تعذر حفظ ملفك المهني حالياً. حاول مرة أخرى.",
    validationNotice: "يرجى تصحيح الحقول الموضحة قبل المتابعة.",
    createTitle: "أنشئ ملفك المهني",
    viewTitle: "ملفي المهني",
    createGuidance: "للحصول على نتائج أدق وفرص أكثر ملاءمة، أدخل معلوماتك المهنية بشكل صادق وواضح. إذا كان لديك CV، سيمكنك إضافته للاستفادة منه في أدوات CareerFit. وإذا لم يكن لديك CV، لا مشكلة — يمكن لـCareerFit مساعدتك في إنشائه لاحقًا.",
    createdTitle: "تم إنشاء ملفك المهني بنجاح",
    createdBody: "سنستخدم هذه المعلومات لتخصيص تجربتك المهنية وتحسين التحليلات والفرص المقترحة لك.",
    continue: "متابعة",
    required: "مطلوب",
    optional: "اختياري",
    summary: "نبذة مهنية",
    summaryHint: "اكتب عدة كلمات واضحة تلخص خبرتك أو مشاريعك أو هدفك المهني، وتجنب النص التجريبي أو الأحرف العشوائية.",
    targetRoles: "الأدوار المستهدفة",
    skills: "المهارات",
    experience: "ملخص الخبرة",
    education: "ملخص التعليم",
    languages: "اللغات",
    constraints: "القيود أو الاعتبارات المهنية",
    roleHint: "أضف مسميات وظيفية حقيقية، مثل AI Engineer أو Customer Support Specialist.",
    skillsHint: "أضف مهارات حقيقية، مثل Python أو Excel أو SAP.",
    languagesHint: "أضف أسماء لغات حقيقية، مثل العربية أو English.",
    constraintsHint: "أضف تفضيلاً أو قيداً مهنياً واضحاً، مثل العمل عن بُعد أو دوام جزئي.",
    experienceHint: "اكتب عدة كلمات تصف خبرتك العملية أو مشاريعك أو تدريبك بشكل واضح.",
    educationHint: "اكتب عدة كلمات تصف تعليمك أو تدريبك أو مؤهلاتك ذات الصلة.",
    locationHint: "اكتب موقعاً حقيقياً وواضحاً، مثل رام الله أو غزة.",
    location: "تفضيلات الموقع",
    preferredLocation: "الموقع المفضل",
    relocation: "الاستعداد للانتقال",
    relocationOptions: [["", "اختر"], ["yes", "نعم"], ["no", "لا"], ["flexible", "مرن"]],
    work: "تفضيلات العمل",
    arrangement: "نمط العمل",
    arrangementOptions: [["", "اختر"], ["remote", "عن بُعد"], ["hybrid", "هجين"], ["onsite", "من الموقع"], ["flexible", "مرن"]],
    availability: "نوع الالتزام",
    availabilityOptions: [["", "اختر"], ["full_time", "دوام كامل"], ["part_time", "دوام جزئي"], ["flexible", "مرن"]],
    characterLimit: (count) => `${count} / ${MAX_TEXT_LENGTH}`,
    errors: {
      professionalSummary: "اكتب نبذة مهنية واضحة من 40 حرفاً على الأقل ومن عدة كلمات ذات معنى، وليست نصاً تجريبياً أو عشوائياً.",
      targetRoles: "أضف دوراً مهنياً حقيقياً وواضحاً واحداً على الأقل، مثل AI Engineer.",
      skills: "أضف مهارتين حقيقيتين واضحتين على الأقل، مثل Python أو Excel.",
      experienceSummary: "اكتب ملخص خبرة واضحاً من 20 حرفاً على الأقل ومن عدة كلمات ذات معنى، وليس نصاً تجريبياً أو عشوائياً.",
      educationSummary: "اكتب ملخص تعليم أو تدريب واضحاً من 10 أحرف على الأقل ومن عدة كلمات ذات معنى.",
      languages: "أضف اسم لغة حقيقياً وواضحاً واحداً على الأقل، مثل العربية أو English.",
      careerConstraints: "أضف قيوداً أو تفضيلات مهنية واضحة، وليست نصاً تجريبياً أو عشوائياً.",
      preferredLocation: "أدخل موقعاً مفضلاً حقيقياً وواضحاً من حرفين على الأقل.",
      relocation: "اختر مدى استعدادك للانتقال.",
      arrangement: "اختر نمط العمل المفضل.",
      availability: "اختر نوع الالتزام المناسب.",
    },
    itemErrors: {
      invalid: "أدخل عنصراً مهنياً واضحاً ومفيداً.",
      duplicate: "هذا العنصر مضاف بالفعل.",
      maximum: `يمكنك إضافة حتى ${MAX_ITEMS} عناصر فقط.`,
    },
  } : {
    eyebrow: "My Application",
    title: "Check your application status",
    description: "Check your CareerFit application, then activate your account after acceptance to access your career profile.",
    signedIn: "Signed in as",
    signOut: "Sign out",
    signingOut: "Signing out...",
    signOutError: "We could not sign you out right now. Please try again.",
    authTitle: "Access my application",
    authText: "Use a secure link to check your application, or sign in if you have already activated your account.",
    checkApplication: "Check my application",
    signIn: "Sign in",
    checkingApplication: "Checking your application status...",
    profileAccess: "Career profile access",
    acceptedTitle: "Your application was accepted",
    acceptedText: "You can now activate your account to access your career profile.",
    activateTitle: "Activate your account",
    activateText: "Set a password for your current account. This does not create a new account or change your application status.",
    password: "Password",
    confirmPassword: "Confirm password",
    activate: "Activate account",
    activating: "Activating account...",
    alreadyActivated: "Already activated? Sign in with password",
    reauthenticationError: "We could not start password sign-in right now. Please try again.",
    activationError: "We could not activate your account right now. Please try again.",
    passwordMismatch: "Passwords do not match.",
    passwordTooShort: "Use at least 12 characters. A long, unique passphrase is recommended.",
    profileReadyText: "You can now create your career profile and update it later.",
    noApplicationTitle: "Submit an application first",
    noApplicationText: "Career Profile becomes available after your CareerFit application is accepted.",
    submittedTitle: "Application submitted",
    submittedText: "We will review your application first. Career Profile becomes available after acceptance.",
    underReviewTitle: "Application under review",
    underReviewText: "Career Profile becomes available after your application is accepted.",
    rejectedTitle: "Application not accepted",
    rejectedText: "Career Profile is not available for this application at this time.",
    waitlistedTitle: "Application waitlisted",
    waitlistedText: "Career Profile becomes available after your application is accepted.",
    withdrawnTitle: "Application withdrawn",
    withdrawnText: "Career Profile is not available for this application at this time.",
    reviewStatusError: "We could not verify your application status right now. Please try again later.",
    goToApplication: "Go to application",
    loading: "Loading your career profile...",
    loadError: "We could not load your career profile right now. Please try again later.",
    create: "Create my career profile",
    edit: "Edit career profile",
    save: "Save changes",
    cancel: "Cancel",
    saving: "Saving...",
    saved: "Your changes were saved successfully.",
    saveError: "We could not save your career profile right now. Please try again.",
    validationNotice: "Please correct the highlighted fields before continuing.",
    createTitle: "Create your career profile",
    viewTitle: "My career profile",
    createGuidance: "For more accurate results and better-matched opportunities, share your professional information honestly and clearly. If you have a CV, you will be able to add it for CareerFit tools later. If you do not have one, that is okay — CareerFit can help you create one later.",
    createdTitle: "Your career profile was created successfully",
    createdBody: "We will use this information to personalize your career experience and improve future insights and suggested opportunities.",
    continue: "Continue",
    required: "Required",
    optional: "Optional",
    summary: "Professional summary",
    summaryHint: "Use several clear words to summarize your background, projects, or career goal. Avoid placeholder or random text.",
    targetRoles: "Target roles",
    skills: "Skills",
    experience: "Experience summary",
    education: "Education summary",
    languages: "Languages",
    constraints: "Career constraints or considerations",
    roleHint: "Add real job titles, such as AI Engineer or Customer Support Specialist.",
    skillsHint: "Add real skills, such as Python, Excel, or SAP.",
    languagesHint: "Add real language names, such as Arabic or English.",
    constraintsHint: "Add a clear career preference or constraint, such as remote work or part-time hours.",
    experienceHint: "Use several words to clearly describe your work experience, projects, or training.",
    educationHint: "Use several words to clearly describe relevant education, training, or qualifications.",
    locationHint: "Enter a real, clear location, such as Ramallah or Gaza.",
    location: "Location preferences",
    preferredLocation: "Preferred location",
    relocation: "Open to relocation",
    relocationOptions: [["", "Select"], ["yes", "Yes"], ["no", "No"], ["flexible", "Flexible"]],
    work: "Work preferences",
    arrangement: "Work arrangement",
    arrangementOptions: [["", "Select"], ["remote", "Remote"], ["hybrid", "Hybrid"], ["onsite", "On-site"], ["flexible", "Flexible"]],
    availability: "Availability",
    availabilityOptions: [["", "Select"], ["full_time", "Full-time"], ["part_time", "Part-time"], ["flexible", "Flexible"]],
    characterLimit: (count) => `${count} / ${MAX_TEXT_LENGTH}`,
    errors: {
      professionalSummary: "Write a clear professional summary of at least 40 characters using several meaningful words, not placeholder or random text.",
      targetRoles: "Add at least one real, clear target role, such as AI Engineer.",
      skills: "Add at least two real, clear skills, such as Python or Excel.",
      experienceSummary: "Write a clear experience summary of at least 20 characters using several meaningful words, not placeholder or random text.",
      educationSummary: "Write a clear education or training summary of at least 10 characters using several meaningful words.",
      languages: "Add at least one real, clear language name, such as Arabic or English.",
      careerConstraints: "Add clear career constraints or preferences, not placeholder or random text.",
      preferredLocation: "Enter a real, clear preferred location with at least 2 characters.",
      relocation: "Select your openness to relocation.",
      arrangement: "Select your preferred work arrangement.",
      availability: "Select your availability.",
    },
    itemErrors: {
      invalid: "Enter a clear, useful professional item.",
      duplicate: "This item has already been added.",
      maximum: `You can add up to ${MAX_ITEMS} items.`,
    },
  };

  const reviewStates = {
    no_application: { title: copy.noApplicationTitle, text: copy.noApplicationText, showApplicationLink: true },
    submitted: { title: copy.submittedTitle, text: copy.submittedText },
    under_review: { title: copy.underReviewTitle, text: copy.underReviewText },
    rejected: { title: copy.rejectedTitle, text: copy.rejectedText },
    waitlisted: { title: copy.waitlistedTitle, text: copy.waitlistedText },
    withdrawn: { title: copy.withdrawnTitle, text: copy.withdrawnText },
  };
  const reviewState = applicationReviewStatus === "accepted"
    ? { title: copy.acceptedTitle, text: copy.acceptedText, accepted: true }
    : reviewStates[applicationReviewStatus] || null;
  const canAccessProfile = applicationReviewStatus === "accepted" && (authenticationMethod === "password" || isAccountActivated);

  const optionLabel = (options, value) => options.find(([optionValue]) => optionValue === value)?.[1] || value;

  useEffect(() => {
    if (!user?.id) {
      setApplicationReviewStatus(null);
      setReviewStatusError("");
      setIsReviewStatusLoading(false);
      setIsLoading(false);
      setProfile(emptyProfile);
      setPersistedProfile(emptyProfile);
      setProfileData({});
      setProfileMode("create");
      setTouchedFields({});
      setHasSaveAttempted(false);
      setIsAccountActivated(false);
      setActivationPassword("");
      setActivationPasswordConfirmation("");
      setActivationError("");
      return undefined;
    }

    let isActive = true;
    const loadReviewStatus = async () => {
      setIsReviewStatusLoading(true);
      setApplicationReviewStatus(null);
      setReviewStatusError("");
      setIsLoading(false);
      setLoadError("");
      setSaveNotice("");
      setSaveError("");
      setValidationErrors({});
      setActionError("");

      try {
        const userSupabase = getUserSupabase();
        if (!userSupabase) throw new Error("User authentication is unavailable");

        const { data, error } = await userSupabase.rpc("get_my_application_review_status");
        if (error || typeof data !== "string") throw error || new Error("Invalid application review status");
        if (isActive) setApplicationReviewStatus(data);
      } catch {
        if (isActive) setReviewStatusError(copy.reviewStatusError);
      } finally {
        if (isActive) setIsReviewStatusLoading(false);
      }
    };

    loadReviewStatus();
    return () => { isActive = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !canAccessProfile) {
      setIsLoading(false);
      return undefined;
    }

    let isActive = true;
    const loadProfile = async () => {
      setIsLoading(true);
      setLoadError("");
      setProfile(emptyProfile);
      setPersistedProfile(emptyProfile);
      setProfileData({});
      setProfileMode("create");

      try {
        const userSupabase = getUserSupabase();
        if (!userSupabase) throw new Error("User authentication is unavailable");

        const { data, error } = await userSupabase
          .from("career_profiles")
          .select("user_id, profile_data, schema_version")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        const loadedData = asObject(data?.profile_data);
        let loadedProfile = normaliseProfile(loadedData);
        if (!data) {
          const { data: applicationSeed, error: seedError } = await userSupabase.rpc("get_my_career_profile_seed");
          if (!isActive) return;
          if (!seedError && applicationSeed && typeof applicationSeed === "object") {
            loadedProfile = applyCareerProfileSeed(loadedProfile, applicationSeed, false);
          }
        }
        if (isActive) {
          setProfileData(loadedData);
          setProfile(loadedProfile);
          setPersistedProfile(cloneProfile(loadedProfile));
          setProfileMode(data ? "view" : "create");
          setTouchedFields({});
          setHasSaveAttempted(false);
        }
      } catch {
        if (isActive) setLoadError(copy.loadError);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadProfile();
    return () => { isActive = false; };
  }, [user?.id, canAccessProfile]);

  const updateText = (field, value) => {
    const nextProfile = { ...profile, [field]: value };
    setProfile(nextProfile);
    setSaveNotice("");
    setSaveError("");
    setActionError("");
    if (touchedFields[field] || hasSaveAttempted) {
      const errors = validateProfile(nextProfile);
      setValidationErrors((current) => ({ ...current, [field]: errors[field] || "" }));
    }
  };

  const updateNested = (section, field, value) => {
    const nextProfile = { ...profile, [section]: { ...profile[section], [field]: value } };
    setProfile(nextProfile);
    setSaveNotice("");
    setSaveError("");
    setActionError("");
    if (touchedFields[field] || hasSaveAttempted) {
      const errors = validateProfile(nextProfile);
      setValidationErrors((current) => ({ ...current, [field]: errors[field] || "" }));
    }
  };

  const markFieldTouched = (field) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
    const errors = validateProfile();
    setValidationErrors((current) => ({ ...current, [field]: errors[field] || "" }));
  };

  const addItem = (field, value) => {
    const nextItem = normaliseItem(value);
    if (!itemValidators[field](nextItem)) return { ok: false, error: copy.errors[field] || copy.itemErrors.invalid };
    if (profile[field].length >= MAX_ITEMS) return { ok: false, error: copy.itemErrors.maximum };
    if (profile[field].some((item) => item.toLocaleLowerCase() === nextItem.toLocaleLowerCase())) {
      return { ok: false, error: copy.itemErrors.duplicate };
    }
    setProfile((current) => ({ ...current, [field]: [...current[field], nextItem] }));
    setSaveNotice("");
    setSaveError("");
    setActionError("");
    setValidationErrors((current) => ({ ...current, [field]: "" }));
    return { ok: true };
  };

  const removeItem = (field, value) => {
    const nextProfile = { ...profile, [field]: profile[field].filter((item) => item !== value) };
    setProfile(nextProfile);
    setSaveNotice("");
    setSaveError("");
    setActionError("");
    if (touchedFields[field] || hasSaveAttempted) {
      const errors = validateProfile(nextProfile);
      setValidationErrors((current) => ({ ...current, [field]: errors[field] || "" }));
    }
  };

  const validateProfile = (candidate = profile) => {
    const errors = {};
    if (!isValidLongProfessionalNarrative(candidate.professionalSummary, 40)) errors.professionalSummary = copy.errors.professionalSummary;
    if (candidate.targetRoles.length < 1 || !isValidItemList(candidate.targetRoles, "targetRoles")) errors.targetRoles = copy.errors.targetRoles;
    if (candidate.skills.length < 2 || !isValidItemList(candidate.skills, "skills")) errors.skills = copy.errors.skills;
    if (!isValidLongProfessionalNarrative(candidate.experienceSummary, 20)) errors.experienceSummary = copy.errors.experienceSummary;
    if (!isValidEducationNarrative(candidate.educationSummary)) errors.educationSummary = copy.errors.educationSummary;
    if (candidate.languages.length < 1 || !isValidItemList(candidate.languages, "languages")) errors.languages = copy.errors.languages;
    if (!isValidItemList(candidate.careerConstraints, "careerConstraints")) errors.careerConstraints = copy.errors.careerConstraints;
    if (!isValidLocation(candidate.location.preferredLocation)) errors.preferredLocation = copy.errors.preferredLocation;
    if (!RELOCATION_VALUES.has(candidate.location.relocation)) errors.relocation = copy.errors.relocation;
    if (!WORK_ARRANGEMENT_VALUES.has(candidate.work.arrangement)) errors.arrangement = copy.errors.arrangement;
    if (!AVAILABILITY_VALUES.has(candidate.work.availability)) errors.availability = copy.errors.availability;
    return errors;
  };

  const focusFirstInvalidField = (errors) => {
    const fieldOrder = ["professionalSummary", "targetRoles", "skills", "experienceSummary", "educationSummary", "languages", "preferredLocation", "relocation", "arrangement", "availability", "careerConstraints"];
    const firstInvalidField = fieldOrder.find((field) => errors[field]);
    const target = fieldRefs.current[firstInvalidField];
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target?.focus({ preventScroll: true }), 250);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!user?.id || !canAccessProfile || isSaving) return;
    setHasSaveAttempted(true);
    const errors = validateProfile();
    if (Object.keys(errors).length > 0) {
      setSaveNotice("");
      setSaveError("");
      setValidationErrors(errors);
      setActionError(copy.validationNotice);
      focusFirstInvalidField(errors);
      return;
    }

    setIsSaving(true);
    setSaveNotice("");
    setSaveError("");
    try {
      const userSupabase = getUserSupabase();
      if (!userSupabase) throw new Error("User authentication is unavailable");

      const nextProfileData = serialiseProfile(profile, profileData);
      const { data: sessionData, error: sessionError } = await userSupabase.auth.getSession();
      if (sessionError || !sessionData.session) throw sessionError || new Error("Profile session unavailable");
      const { data, error } = await userSupabase.functions.invoke("save-career-profile", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: { profile_data: nextProfileData, schema_version: 1 },
      });
      if (data?.error === "semantic_invalid" && data.fieldErrors && typeof data.fieldErrors === "object") {
        const semanticErrors = {
          professionalSummary: isArabic ? "اكتب ملخصاً مهنياً واضحاً يعكس خبرتك واتجاهك." : "Enter a clear professional summary that reflects your experience and direction.",
          targetRoles: isArabic ? "أضف مسميات وظيفية مهنية واضحة." : "Add clear professional target roles.",
          skills: isArabic ? "أضف مهارات مهنية حقيقية وواضحة." : "Add real, clear professional skills.",
          experienceSummary: isArabic ? "صف خبرة عمل أو مشروع أو دراسة عملية حقيقية." : "Describe real work, project, study, or practical experience.",
          educationSummary: isArabic ? "اكتب ملخصاً واضحاً لتعليمك أو تدريبك." : "Enter a clear summary of your education or training.",
        };
        setValidationErrors((current) => ({ ...current, ...Object.fromEntries(Object.keys(data.fieldErrors).filter((key) => key in semanticErrors).map((key) => [key, semanticErrors[key]])) }));
        setActionError(copy.validationNotice);
        return;
      }
      const savedProfileData = data?.profile_data;
      if (error || !savedProfileData || typeof savedProfileData !== "object") throw error || new Error("Profile save failed");
      setProfileData(asObject(savedProfileData));
      setPersistedProfile(cloneProfile(profile));
      setValidationErrors({});
      setActionError("");
      if (profileMode === "create") {
        setProfileMode("view");
        setIsCreationModalOpen(true);
      } else {
        setProfileMode("view");
        setSaveNotice(copy.saved);
      }
    } catch {
      setSaveError(copy.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const activateAccount = async (event) => {
    event.preventDefault();
    if (!user?.id || applicationReviewStatus !== "accepted" || isActivatingAccount) return;

    setActivationError("");
    if (validateCareerFitPassword(activationPassword, activationPasswordConfirmation) === "too_short") {
      setActivationError(copy.passwordTooShort);
      return;
    }
    if (validateCareerFitPassword(activationPassword, activationPasswordConfirmation) === "mismatch") {
      setActivationError(copy.passwordMismatch);
      return;
    }

    setIsActivatingAccount(true);
    try {
      const userSupabase = getUserSupabase();
      if (!userSupabase) throw new Error("User authentication is unavailable");

      const { data: currentReviewStatus, error: reviewStatusError } = await userSupabase.rpc("get_my_application_review_status");
      if (reviewStatusError || currentReviewStatus !== "accepted") throw new Error("Application is not accepted");

      const { data, error } = await userSupabase.auth.updateUser({ password: activationPassword });
      if (error || !data.user) throw error || new Error("Account activation failed");
      setActivationPassword("");
      setActivationPasswordConfirmation("");
      setIsAccountActivated(true);
    } catch {
      setActivationPassword("");
      setActivationPasswordConfirmation("");
      setActivationError(copy.activationError);
    } finally {
      setIsActivatingAccount(false);
    }
  };

  const startPasswordSignIn = async () => {
    if (isActivatingAccount) return;
    setActivationError("");
    const signedOut = await signOutUser();
    if (!signedOut) {
      setActivationError(copy.reauthenticationError);
      return;
    }
    requestAuthentication(language, "career-profile");
  };

  const signOut = async () => {
    if (isSigningOut) return;

    const userSupabase = getUserSupabase();
    if (!userSupabase) {
      setSignOutError(copy.signOutError);
      return;
    }

    setSignOutError("");
    setIsSigningOut(true);

    try {
      const { error } = await userSupabase.auth.signOut();
      if (error) throw error;

      window.location.assign("/");
    } catch {
      setSignOutError(copy.signOutError);
      setIsSigningOut(false);
    }
  };

  return (
    <div className="career-profile-page" dir={isArabic ? "rtl" : "ltr"} lang={isArabic ? "ar" : "en"}>
      <header className="site-header">
        <a className="brand" href="/"><b>CL</b><span>CareerFit Lab</span></a>
        <button type="button" className="lang" onClick={() => onLanguageChange?.(isArabic ? "en" : "ar")}>{isArabic ? "EN" : "العربية"}</button>
      </header>
      <main className="career-profile">
        <section className="career-profile__intro">
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </section>

        {user && (
          <section className="career-profile__account career-profile__account--standalone">
            <div className="career-profile__account-identity">
              <span>{copy.signedIn}</span>
              <strong dir="ltr">{user.email}</strong>
            </div>
            <button
              className="career-profile__sign-out"
              type="button"
              onClick={signOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? copy.signingOut : copy.signOut}
            </button>
            {signOutError && <p className="submission-error" role="alert">{signOutError}</p>}
          </section>
        )}

        {!user ? (
          <section className="career-profile__auth-card">
            <h2>{copy.authTitle}</h2>
            <p>{copy.authText}</p>
            <div className="career-profile__auth-actions">
              <button type="button" className="button primary" onClick={() => requestAuthentication(language, "application-status")}>{copy.checkApplication}</button>
              <button type="button" className="button secondary" onClick={() => requestAuthentication(language, "career-profile")}>{copy.signIn}</button>
            </div>
          </section>
        ) : isReviewStatusLoading ? (
          <p className="career-profile__loading" role="status">{copy.checkingApplication}</p>
        ) : reviewStatusError || !reviewState ? (
          <section className="career-profile__gate" role="alert">
            <span className="eyebrow">{copy.profileAccess}</span>
            <h2>{copy.reviewStatusError}</h2>
          </section>
        ) : !reviewState.accepted ? (
          <section className="career-profile__gate">
            <span className="eyebrow">{copy.profileAccess}</span>
            <h2>{reviewState.title}</h2>
            <p>{reviewState.text}</p>
            {reviewState.showApplicationLink && <a className="button primary" href="/#register">{copy.goToApplication}</a>}
          </section>
        ) : reviewState.accepted && !canAccessProfile ? (
          <section className="career-profile__gate career-profile__gate--accepted">
            <span className="eyebrow">{copy.profileAccess}</span>
            <h2>{reviewState.title}</h2>
            <p>{reviewState.text}</p>
            <form className="career-profile__activation-form" onSubmit={activateAccount} noValidate>
              <h3>{copy.activateTitle}</h3>
              <p>{copy.activateText}</p>
              <label htmlFor={`${formId}-activation-password`}>{copy.password}
                <input id={`${formId}-activation-password`} type="password" value={activationPassword} onChange={(event) => setActivationPassword(event.target.value)} autoComplete="new-password" required />
              </label>
              <label htmlFor={`${formId}-activation-password-confirmation`}>{copy.confirmPassword}
                <input id={`${formId}-activation-password-confirmation`} type="password" value={activationPasswordConfirmation} onChange={(event) => setActivationPasswordConfirmation(event.target.value)} autoComplete="new-password" required />
              </label>
              {activationError && <p className="submission-error" role="alert">{activationError}</p>}
              <div className="career-profile__activation-actions">
                <button type="submit" className="button primary" disabled={isActivatingAccount}>{isActivatingAccount ? copy.activating : copy.activate}</button>
                <button type="button" className="button secondary" onClick={startPasswordSignIn} disabled={isActivatingAccount}>{copy.alreadyActivated}</button>
              </div>
            </form>
          </section>
        ) : isLoading ? (
          <p className="career-profile__loading" role="status">{copy.loading}</p>
        ) : (
          <>
            {loadError ? (
              <section className="career-profile__gate" role="alert"><h2>{copy.loadError}</h2></section>
            ) : profileMode === "view" ? (
              <section className="career-profile__view">
                <div className="career-profile__view-header">
                  <div><span className="eyebrow">{copy.profileAccess}</span><h2>{copy.viewTitle}</h2></div>
                  <button type="button" className="button primary" onClick={() => { setProfile(cloneProfile(persistedProfile)); setSaveNotice(""); setSaveError(""); setProfileMode("edit"); }}>{copy.edit}</button>
                </div>
                {saveNotice && <p className="submission-status success career-profile__view-notice" role="status">{saveNotice}</p>}
                <div className="career-profile__view-grid">
                  <section><h3>{copy.summary}</h3><p>{profile.professionalSummary}</p></section>
                  <section><h3>{copy.targetRoles}</h3><div className="career-profile__items">{profile.targetRoles.map((item) => <span className="career-profile__item" key={item}>{item}</span>)}</div></section>
                  <section><h3>{copy.skills}</h3><div className="career-profile__items">{profile.skills.map((item) => <span className="career-profile__item" key={item}>{item}</span>)}</div></section>
                  <section><h3>{copy.experience}</h3><p>{profile.experienceSummary}</p></section>
                  <section><h3>{copy.education}</h3><p>{profile.educationSummary}</p></section>
                  <section><h3>{copy.languages}</h3><div className="career-profile__items">{profile.languages.map((item) => <span className="career-profile__item" key={item}>{item}</span>)}</div></section>
                  <section><h3>{copy.location}</h3><p>{profile.location.preferredLocation} · {optionLabel(copy.relocationOptions, profile.location.relocation)}</p></section>
                  <section><h3>{copy.work}</h3><p>{optionLabel(copy.arrangementOptions, profile.work.arrangement)} · {optionLabel(copy.availabilityOptions, profile.work.availability)}</p></section>
                  {profile.careerConstraints.length > 0 && <section><h3>{copy.constraints}</h3><div className="career-profile__items">{profile.careerConstraints.map((item) => <span className="career-profile__item" key={item}>{item}</span>)}</div></section>}
                </div>
              </section>
            ) : (
              <>
                {profileMode === "create" && <section className="career-profile__guidance"><h2>{copy.createTitle}</h2><p>{copy.createGuidance}</p></section>}
                <form className="career-profile__form" onSubmit={saveProfile} noValidate>
                  <section className={`career-profile__section ${validationErrors.professionalSummary ? "is-invalid" : ""}`}>
                    <div className="career-profile__field-heading"><label htmlFor={`${formId}-summary`}>{copy.summary} <small>{copy.required}</small></label><span>{copy.summaryHint}</span></div>
                    <textarea ref={(node) => { fieldRefs.current.professionalSummary = node; }} id={`${formId}-summary`} value={profile.professionalSummary} maxLength={MAX_TEXT_LENGTH} onChange={(event) => updateText("professionalSummary", event.target.value)} onBlur={() => markFieldTouched("professionalSummary")} aria-invalid={Boolean(validationErrors.professionalSummary)} aria-describedby={validationErrors.professionalSummary ? `${formId}-summary-error` : undefined} />
                    {validationErrors.professionalSummary && <p className="career-profile__field-error" id={`${formId}-summary-error`} role="alert">{validationErrors.professionalSummary}</p>}
                    <small>{copy.characterLimit(profile.professionalSummary.length)}</small>
                  </section>
                  <div className="career-profile__grid">
                    <ItemEditor id={`${formId}-roles`} inputRef={(node) => { fieldRefs.current.targetRoles = node; }} label={`${copy.targetRoles} · ${copy.required}`} hint={copy.roleHint} items={profile.targetRoles} onAdd={(value) => addItem("targetRoles", value)} onRemove={(value) => removeItem("targetRoles", value)} onBlur={() => markFieldTouched("targetRoles")} language={language} validationError={validationErrors.targetRoles} />
                    <ItemEditor id={`${formId}-skills`} inputRef={(node) => { fieldRefs.current.skills = node; }} label={`${copy.skills} · ${copy.required}`} hint={copy.skillsHint} items={profile.skills} onAdd={(value) => addItem("skills", value)} onRemove={(value) => removeItem("skills", value)} onBlur={() => markFieldTouched("skills")} language={language} validationError={validationErrors.skills} />
                    <ItemEditor id={`${formId}-languages`} inputRef={(node) => { fieldRefs.current.languages = node; }} label={`${copy.languages} · ${copy.required}`} hint={copy.languagesHint} items={profile.languages} onAdd={(value) => addItem("languages", value)} onRemove={(value) => removeItem("languages", value)} onBlur={() => markFieldTouched("languages")} language={language} validationError={validationErrors.languages} />
                    <ItemEditor id={`${formId}-constraints`} inputRef={(node) => { fieldRefs.current.careerConstraints = node; }} label={`${copy.constraints} · ${copy.optional}`} hint={copy.constraintsHint} items={profile.careerConstraints} onAdd={(value) => addItem("careerConstraints", value)} onRemove={(value) => removeItem("careerConstraints", value)} onBlur={() => markFieldTouched("careerConstraints")} language={language} validationError={validationErrors.careerConstraints} />
                  </div>
                  <div className="career-profile__grid">
                    <section className={`career-profile__section ${validationErrors.experienceSummary ? "is-invalid" : ""}`}><div className="career-profile__field-heading"><label htmlFor={`${formId}-experience`}>{copy.experience} <small>{copy.required}</small></label><span>{copy.experienceHint}</span></div><textarea ref={(node) => { fieldRefs.current.experienceSummary = node; }} id={`${formId}-experience`} value={profile.experienceSummary} maxLength={MAX_TEXT_LENGTH} onChange={(event) => updateText("experienceSummary", event.target.value)} onBlur={() => markFieldTouched("experienceSummary")} aria-invalid={Boolean(validationErrors.experienceSummary)} aria-describedby={validationErrors.experienceSummary ? `${formId}-experience-error` : undefined} />{validationErrors.experienceSummary && <p className="career-profile__field-error" id={`${formId}-experience-error`} role="alert">{validationErrors.experienceSummary}</p>}<small>{copy.characterLimit(profile.experienceSummary.length)}</small></section>
                    <section className={`career-profile__section ${validationErrors.educationSummary ? "is-invalid" : ""}`}><div className="career-profile__field-heading"><label htmlFor={`${formId}-education`}>{copy.education} <small>{copy.required}</small></label><span>{copy.educationHint}</span></div><textarea ref={(node) => { fieldRefs.current.educationSummary = node; }} id={`${formId}-education`} value={profile.educationSummary} maxLength={MAX_TEXT_LENGTH} onChange={(event) => updateText("educationSummary", event.target.value)} onBlur={() => markFieldTouched("educationSummary")} aria-invalid={Boolean(validationErrors.educationSummary)} aria-describedby={validationErrors.educationSummary ? `${formId}-education-error` : undefined} />{validationErrors.educationSummary && <p className="career-profile__field-error" id={`${formId}-education-error`} role="alert">{validationErrors.educationSummary}</p>}<small>{copy.characterLimit(profile.educationSummary.length)}</small></section>
                  </div>
                  <div className="career-profile__grid">
                    <section className={`career-profile__section career-profile__section--structured ${validationErrors.preferredLocation || validationErrors.relocation ? "is-invalid" : ""}`}><h2>{copy.location}</h2><p className="career-profile__field-hint">{copy.locationHint}</p><label htmlFor={`${formId}-location`}>{copy.preferredLocation} <small>{copy.required}</small></label><input ref={(node) => { fieldRefs.current.preferredLocation = node; }} id={`${formId}-location`} value={profile.location.preferredLocation} maxLength={MAX_ITEM_LENGTH} onChange={(event) => updateNested("location", "preferredLocation", event.target.value)} onBlur={() => markFieldTouched("preferredLocation")} aria-invalid={Boolean(validationErrors.preferredLocation)} aria-describedby={validationErrors.preferredLocation ? `${formId}-location-error` : undefined} />{validationErrors.preferredLocation && <p className="career-profile__field-error" id={`${formId}-location-error`} role="alert">{validationErrors.preferredLocation}</p>}<label htmlFor={`${formId}-relocation`}>{copy.relocation} <small>{copy.required}</small></label><select ref={(node) => { fieldRefs.current.relocation = node; }} id={`${formId}-relocation`} value={profile.location.relocation} onChange={(event) => updateNested("location", "relocation", event.target.value)} aria-invalid={Boolean(validationErrors.relocation)} aria-describedby={validationErrors.relocation ? `${formId}-relocation-error` : undefined}>{copy.relocationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{validationErrors.relocation && <p className="career-profile__field-error" id={`${formId}-relocation-error`} role="alert">{validationErrors.relocation}</p>}</section>
                    <section className={`career-profile__section career-profile__section--structured ${validationErrors.arrangement || validationErrors.availability ? "is-invalid" : ""}`}><h2>{copy.work}</h2><label htmlFor={`${formId}-arrangement`}>{copy.arrangement} <small>{copy.required}</small></label><select ref={(node) => { fieldRefs.current.arrangement = node; }} id={`${formId}-arrangement`} value={profile.work.arrangement} onChange={(event) => updateNested("work", "arrangement", event.target.value)} aria-invalid={Boolean(validationErrors.arrangement)} aria-describedby={validationErrors.arrangement ? `${formId}-arrangement-error` : undefined}>{copy.arrangementOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{validationErrors.arrangement && <p className="career-profile__field-error" id={`${formId}-arrangement-error`} role="alert">{validationErrors.arrangement}</p>}<label htmlFor={`${formId}-availability`}>{copy.availability} <small>{copy.required}</small></label><select ref={(node) => { fieldRefs.current.availability = node; }} id={`${formId}-availability`} value={profile.work.availability} onChange={(event) => updateNested("work", "availability", event.target.value)} aria-invalid={Boolean(validationErrors.availability)} aria-describedby={validationErrors.availability ? `${formId}-availability-error` : undefined}>{copy.availabilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{validationErrors.availability && <p className="career-profile__field-error" id={`${formId}-availability-error`} role="alert">{validationErrors.availability}</p>}</section>
                  </div>
                  <div className="career-profile__actions">
                    <div>{actionError && <p className="submission-error" role="alert">{actionError}</p>}{saveError && <p className="submission-error" role="alert">{saveError}</p>}</div>
                    {profileMode === "edit" && <button type="button" className="button secondary" onClick={() => { setProfile(cloneProfile(persistedProfile)); setValidationErrors({}); setActionError(""); setSaveError(""); setProfileMode("view"); }}>{copy.cancel}</button>}
                    <button type="submit" className="button primary" disabled={isSaving}>{isSaving ? copy.saving : profileMode === "create" ? copy.create : copy.save}</button>
                  </div>
                </form>
              </>
            )}
            {isCreationModalOpen && createPortal(<div className="career-profile-modal-backdrop" role="presentation"><section className="career-profile-modal" role="dialog" aria-modal="true" aria-labelledby={`${formId}-created-title`}><span className="eyebrow">CareerFit Lab</span><h2 id={`${formId}-created-title`}>{copy.createdTitle}</h2><p>{copy.createdBody}</p><button type="button" className="button primary" autoFocus onClick={() => setIsCreationModalOpen(false)}>{copy.continue}</button></section></div>, document.body)}
          </>
        )}
      </main>
    </div>
  );
}
