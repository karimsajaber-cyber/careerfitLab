import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const initialValues = {
  fullName: "",
  email: "",
  phone: "",
  institution: "",
  major: "",
  graduationYear: "",
  currentStatus: "",
  targetFields: [],
  targetFieldsOther: "",
  englishLevel: "",
  careerGoal: "",
  linkedinUrl: "",
  targetJobUrl: "",
  motivation: "",
  privacyConsent: false,
};

const STATUS_OPTIONS = [
  ["student", "طالب", "Student"],
  ["fresh_graduate", "خريج جديد", "Fresh graduate"],
  ["employed", "موظف حالياً", "Currently employed"],
  ["unemployed", "غير موظف حالياً", "Currently unemployed"],
  ["career_changer", "أغيّر مساري", "Career changer"],
  ["freelancer", "أعمل بشكل حر", "Freelancer"],
  ["other", "أخرى", "Other"],
];

const ENGLISH_LEVEL_OPTIONS = [
  ["basic", "أساسي", "Basic"],
  ["intermediate", "متوسط", "Intermediate"],
  ["upper_intermediate", "جيد", "Upper-intermediate"],
  ["advanced", "متقدم", "Advanced"],
];

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

const CAREER_GOAL_OPTIONS = [
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

const ERROR_COPY = {
  fullName: ["يرجى إدخال الاسم الكامل.", "Please enter your full name."],
  email: ["يرجى إدخال بريد إلكتروني صحيح.", "Please enter a valid email address."],
  phone: ["يرجى إدخال رقم هاتف صحيح.", "Please enter a valid phone number."],
  currentStatus: ["يرجى تحديد وضعك المهني الحالي.", "Please select your current professional status."],
  targetFields: ["يرجى اختيار مجال مهني واحد على الأقل.", "Please select at least one target field."],
  targetFieldsOther: ["يرجى كتابة المجال الآخر الذي تستهدفه.", "Please specify the other target field."],
  englishLevel: ["يرجى تحديد مستوى الإنجليزية.", "Please select your English level."],
  careerGoal: ["يرجى تحديد هدفك المهني الأساسي.", "Please select your main career goal."],
  motivation: ["يرجى توضيح أكثر شيء تحتاج مساعدة فيه حالياً.", "Please tell us what you most need help with right now."],
  cvStatus: ["يرجى تحديد ما إذا كانت سيرتك الذاتية محدثة.", "Please select your CV status."],
  privacyConsent: ["يرجى الموافقة على بيان الخصوصية قبل المتابعة.", "Please confirm that you agree to the privacy statement."],
  file: ["يجب أن يكون الملف PDF وبحجم لا يتجاوز 5MB.", "Your CV must be a PDF no larger than 5 MB."],
};

const FIELD_ORDER = [
  "fullName",
  "email",
  "phone",
  "currentStatus",
  "englishLevel",
  "targetFields",
  "targetFieldsOther",
  "careerGoal",
  "motivation",
  "file",
  "cvStatus",
  "privacyConsent",
];

function hasValidEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

function hasValidPhone(value) {
  return /^\d{6,15}$/.test(value.trim());
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
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  const uploadInputRef = useRef(null);
  const fieldRefs = useRef({});

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
  const rawValue = type === "checkbox" ? checked : value;
  const nextValue = name === "phone" ? String(rawValue).replace(/\D/g, "") : rawValue;
  setValues((current) => ({ ...current, [name]: nextValue }));
    if (name === "fullName") {
      if (String(nextValue).trim().length >= 2) clearValidationError("fullName");
      return;
    }

    if (name === "email") {
      if (hasValidEmail(String(nextValue))) clearValidationError("email");
      return;
    }

    if (name === "phone") {
      if (hasValidPhone(String(nextValue))) clearValidationError("phone");
      return;
    }

    if (name === "privacyConsent") {
      if (checked) clearValidationError("privacyConsent");
      return;
    }

    if (String(nextValue).trim()) clearValidationError(name);
  };

const toggleTargetField = (field) => {
  setValues((current) => {
    const exists = current.targetFields.includes(field);

    if (exists) {
      const nextFields = current.targetFields.filter((item) => item !== field);

      return {
        ...current,
        targetFields: nextFields,
        targetFieldsOther: field === "other" ? "" : current.targetFieldsOther,
      };
    }

    if (current.targetFields.length >= 3) {
      return current;
    }

    return {
      ...current,
      targetFields: [...current.targetFields, field],
    };
  });

  clearValidationError("targetFields");

  if (field === "other" && values.targetFields.includes("other")) {
    clearValidationError("targetFieldsOther");
  }
};

  const validateStepOne = () => {
    const errors = {};
    if (values.fullName.trim().length < 2) errors.fullName = true;
    if (!hasValidEmail(values.email)) errors.email = true;
    if (!hasValidPhone(values.phone)) errors.phone = true;
    return errors;
  };

  const validateStepTwo = () => {
    const errors = {};
    if (!values.currentStatus) errors.currentStatus = true;
    if (!values.englishLevel) errors.englishLevel = true;
    if (values.targetFields.length === 0) errors.targetFields = true;
    if (values.targetFields.includes("other") && !values.targetFieldsOther.trim()) {
      errors.targetFieldsOther = true;
    }
    if (!values.careerGoal) errors.careerGoal = true;
    if (!values.motivation.trim()) errors.motivation = true;
    if (file && !cvStatus) errors.cvStatus = true;
    if (!values.privacyConsent) errors.privacyConsent = true;
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

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
    setIsSubmitting(true);

    try {
      if (!supabase) throw new Error("Supabase is not configured");

      const body = new FormData();
      body.append(
        "payload",
        JSON.stringify({
          ...values,
          targetFields: values.targetFields.join(","),
          targetFieldsOther: values.targetFields.includes("other")
            ? values.targetFieldsOther.trim()
            : null,
          linkedin: values.linkedinUrl,
          cvStatus,
          changesSinceCv,
          quiz: quiz
            ? {
                answers: quiz.quizAnswers,
                score: quiz.quizScore,
                resultTier: quiz.quizResultTier,
                completedAt: quiz.quizCompletedAt,
              }
            : null,
        }),
      );

      if (file) body.append("cv", file);

      const response = await supabase.functions.invoke("submit-application", { body });
      if (response.error || !response.data?.ok) {
        throw new Error("Application submission failed");
      }

      setSuccess(response.data.applicationId);
    } catch (error) {
      console.error("CareerFit Lab application submission", error);
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

  const renderError = (name) =>
    validationErrors[name] ? (
      <span className="field-error-message" id={`${name}-error`} role="alert">
        {errorMessage(name)}
      </span>
    ) : null;

  const renderTextField = (name, arabicLabel, englishLabel, optional = false, type = "text") => (
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
          aria-invalid={Boolean(validationErrors[name])}
          aria-describedby={validationErrors[name] ? `${name}-error` : undefined}
        />
      </label>
      {renderError(name)}
    </div>
  );

  if (success) {
    return (
      <div className="form refined-form">
        <div className="section-heading application-heading">
          <span>{L("التسجيل", "Application")}</span>
          <h2>{L("تم استلام طلبك", "Application received")}</h2>
        </div>
        <div className="submission-status success" role="status">
          <strong>{L("تم استلام طلبك بنجاح.", "Application received successfully.")}</strong>
          <span>
            {L(
              "تم حفظ طلب المشاركة وسنراجع المعلومات المقدمة.",
              "Your application has been saved and the submitted information will be reviewed.",
            )}
          </span>
          <small>
            {L("مرجع الطلب:", "Application reference:")} {success.slice(0, 8)}
          </small>
        </div>
      </div>
    );
  }

  return (
    <form className="form refined-form" onSubmit={handleSubmit} noValidate>
      <div className="section-heading application-heading">
        <span>{L("التسجيل", "Application")}</span>
        <h2>{L("ابدأ بخطوتين بسيطتين", "Start in two simple steps")}</h2>
      </div>

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
          {renderTextField("institution", "المؤسسة", "Institution", true)}
          {renderTextField("major", "التخصص", "Major", true)}
          {renderTextField("graduationYear", "سنة التخرج", "Graduation year", true)}
        </div>
      ) : (
        <div className="fields step-two-fields">
          <section className="full form-group">
            <div className="form-group-heading">
              <h3>{L("اتجاهك المهني", "Career direction")}</h3>
              <p>
                {L(
                  "اختر ما يصف وضعك الحالي وما الذي تستهدفه الآن.",
                  "Tell us where you are now and what you are aiming for.",
                )}
              </p>
            </div>

            <div className={`field-shell ${validationErrors.currentStatus ? "has-error" : ""}`}>
              <label htmlFor="currentStatus">
                <span className="field-label-row">
                  <span>{L("الوضع المهني الحالي", "Current status")}</span>
                  <small className="required-mark" aria-hidden="true">*</small>
                </span>
                <select
                  ref={assignRef("currentStatus")}
                  id="currentStatus"
                  name="currentStatus"
                  value={values.currentStatus}
                  onChange={updateValue}
                  aria-invalid={Boolean(validationErrors.currentStatus)}
                  aria-describedby={validationErrors.currentStatus ? "currentStatus-error" : undefined}
                >
                  <option value="">{L("اختر الحالة", "Select status")}</option>
                  {STATUS_OPTIONS.map(([value, arabic, english]) => (
                    <option key={value} value={value}>
                      {L(arabic, english)}
                    </option>
                  ))}
                </select>
              </label>
              {renderError("currentStatus")}
            </div>

            <div className={`field-shell ${validationErrors.englishLevel ? "has-error" : ""}`}>
              <label htmlFor="englishLevel">
                <span className="field-label-row">
                  <span>{L("مستوى الإنجليزية", "English level")}</span>
                  <small className="required-mark" aria-hidden="true">*</small>
                </span>
                <select
                  ref={assignRef("englishLevel")}
                  id="englishLevel"
                  name="englishLevel"
                  value={values.englishLevel}
                  onChange={updateValue}
                  aria-invalid={Boolean(validationErrors.englishLevel)}
                  aria-describedby={validationErrors.englishLevel ? "englishLevel-error" : undefined}
                >
                  <option value="">{L("اختر المستوى", "Select level")}</option>
                  {ENGLISH_LEVEL_OPTIONS.map(([value, arabic, english]) => (
                    <option key={value} value={value}>
                      {L(arabic, english)}
                    </option>
                  ))}
                </select>
              </label>
              {renderError("englishLevel")}
            </div>

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
                    aria-invalid={Boolean(validationErrors.targetFieldsOther)}
                    aria-describedby={validationErrors.targetFieldsOther ? "targetFieldsOther-error" : undefined}
                  />
                </label>
                {renderError("targetFieldsOther")}
              </div>
            )}

            <div className={`field-shell ${validationErrors.careerGoal ? "has-error" : ""}`}>
              <label htmlFor="careerGoal">
                <span className="field-label-row">
                  <span>{L("ما الهدف المهني الأهم خلال 6–12 شهراً؟", "What would you most like to achieve in the next 6–12 months?")}</span>
                  <small className="required-mark" aria-hidden="true">*</small>
                </span>
                <select
                  ref={assignRef("careerGoal")}
                  id="careerGoal"
                  name="careerGoal"
                  value={values.careerGoal}
                  onChange={updateValue}
                  aria-invalid={Boolean(validationErrors.careerGoal)}
                  aria-describedby={validationErrors.careerGoal ? "careerGoal-error" : undefined}
                >
                  <option value="">{L("اختر الهدف", "Select goal")}</option>
                  {CAREER_GOAL_OPTIONS.map(([value, arabic, english]) => (
                    <option key={value} value={value}>
                      {L(arabic, english)}
                    </option>
                  ))}
                </select>
              </label>
              {renderError("careerGoal")}
            </div>
          </section>

          <section className="full form-group">
            <div className="form-group-heading">
              <h3>{L("ملفك المهني", "Your professional profile")}</h3>
            </div>

            {renderTextField("linkedinUrl", "رابط LinkedIn", "LinkedIn URL", true, "url")}
            {renderTextField("targetJobUrl", "رابط وظيفة مستهدفة", "Target job URL", true, "url")}
            <p className="field-helper">
              {L(
                "أضف رابط الوظيفة فقط إذا كان لديك شاغر محدد تريد استهدافه.",
                "Add a job link only if you already have a specific vacancy in mind.",
              )}
            </p>

            <div className={`field-shell ${validationErrors.motivation ? "has-error" : ""}`}>
              <label htmlFor="motivation">
                <span className="field-label-row">
                  <span>{L("ما أكثر شيء تحتاج مساعدة فيه حالياً؟", "What do you most need help with right now?")}</span>
                  <small className="required-mark" aria-hidden="true">*</small>
                </span>
                <textarea
                  ref={assignRef("motivation")}
                  id="motivation"
                  name="motivation"
                  value={values.motivation}
                  onChange={updateValue}
                  aria-invalid={Boolean(validationErrors.motivation)}
                  aria-describedby={validationErrors.motivation ? "motivation-error" : "motivation-helper"}
                />
              </label>
              <p className="field-helper" id="motivation-helper">
                {L(
                  "مثلاً: السيرة الذاتية، LinkedIn، اختيار الوظائف، المقابلات أو استراتيجية التقديم.",
                  "For example: CV, LinkedIn, suitable roles, interviews, or application strategy.",
                )}
              </p>
              {renderError("motivation")}
            </div>
          </section>

          <section className="full form-group cv-group">
            <div className="form-group-heading">
              <h3>{L("سيرتك الذاتية", "Your CV")}</h3>
              <p>{L("إرفاق السيرة اختياري في هذه المرحلة.", "Uploading a CV is optional at this stage.")}</p>
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
                    id="changesSinceCv"
                    value={changesSinceCv}
                    onChange={(event) => setChangesSinceCv(event.target.value)}
                  />
                </label>
                <p className="field-helper">
                  {L(
                    "مثلاً: وظيفة أو مشروع جديد، مهارات جديدة، تخرج حديث أو تغيير المجال المستهدف.",
                    "For example: a new role or project, new skills, graduation, or a changed target field.",
                  )}
                </p>
              </div>
            )}
          </section>

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
                  "يرجى إكمال الحقول المطلوبة والمحددة أدناه.",
                  "Please complete the highlighted required fields.",
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
          disabled={isSubmitting}
          type={step === 1 ? "button" : "submit"}
          onClick={step === 1 ? handleContinue : undefined}
        >
          {step === 1
            ? L("التالي", "Continue")
            : isSubmitting
              ? L("جارٍ إرسال الطلب...", "Submitting...")
              : L("قدّم طلب المشاركة", "Submit Application")}
        </button>
      </div>
    </form>
  );
}
