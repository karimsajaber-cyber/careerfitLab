import { useEffect, useRef, useState } from "react";
import { getAdminSupabase } from "../lib/supabase";
import CareerFitAssistant from "./CareerFitAssistant";

const HIDDEN_APPLICATIONS_STORAGE_KEY = "careerfit_admin_hidden_applications";
const ADMIN_SECTIONS = new Set(["overview", "applications", "users", "ai-access", "usage-costs"]);

const getAdminSectionFromUrl = () => {
    const section = new URLSearchParams(window.location.search).get("section");
    return ADMIN_SECTIONS.has(section) ? section : "overview";
};

const readHiddenApplicationIds = () => {
    try {
        const storedIds = JSON.parse(window.localStorage.getItem(HIDDEN_APPLICATIONS_STORAGE_KEY) || "[]");
        return Array.isArray(storedIds) ? storedIds.filter((id) => typeof id === "string") : [];
    } catch {
        return [];
    }
};

const normalizeUserRows = (rows) => {
    const uniqueUsers = new Map();

    (Array.isArray(rows) ? rows : []).forEach((account) => {
        const userId = typeof account?.user_id === "string" ? account.user_id.trim() : "";
        const emailKey = typeof account?.email === "string" ? account.email.trim().toLowerCase() : "";
        if (!userId || uniqueUsers.has(userId)) return;
        uniqueUsers.set(userId, { ...account, userId, emailKey });
    });

    return [...uniqueUsers.values()];
};

export default function AdminDashboard({ adminUser }) {
    const [activeSection, setActiveSection] = useState(getAdminSectionFromUrl);
    const [applications, setApplications] = useState([]);
    const [applicationDetail, setApplicationDetail] = useState(null);
    const [hiddenApplicationIds, setHiddenApplicationIds] = useState(readHiddenApplicationIds);
    const [applicationPendingRemoval, setApplicationPendingRemoval] = useState(null);
    const [deleteStep, setDeleteStep] = useState("confirm");
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteSuccess, setDeleteSuccess] = useState("");
    const [deleteRefreshError, setDeleteRefreshError] = useState("");
    const [logoutError, setLogoutError] = useState("");
    const [cvErrorApplicationId, setCvErrorApplicationId] = useState(null);
    const [cvError, setCvError] = useState("");
    const [isHiddenApplicantsOpen, setIsHiddenApplicantsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [targetFieldFilter, setTargetFieldFilter] = useState("");
    const [currentStatusFilter, setCurrentStatusFilter] = useState("");
    const [englishLevelFilter, setEnglishLevelFilter] = useState("");
    const [cvStatusFilter, setCvStatusFilter] = useState("");
    const [applicationDateFilter, setApplicationDateFilter] = useState("");
    const [visibilityFilter, setVisibilityFilter] = useState("visible");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [aiAccessRequests, setAiAccessRequests] = useState([]);
    const [isAiAccessRequestsLoading, setIsAiAccessRequestsLoading] = useState(true);
    const [aiAccessRequestError, setAiAccessRequestError] = useState("");
    const [aiAccessRequestActionId, setAiAccessRequestActionId] = useState(null);
    const [aiAccessMessageLimits, setAiAccessMessageLimits] = useState({});
    const [aiAccessCustomMessageLimits, setAiAccessCustomMessageLimits] = useState({});
    const [users, setUsers] = useState([]);
    const [isUsersLoading, setIsUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState("");
    const [usersSearchQuery, setUsersSearchQuery] = useState("");
    const [usersVerifiedFilter, setUsersVerifiedFilter] = useState("");
    const [usersApplicationFilter, setUsersApplicationFilter] = useState("");
    const [usersAiAccessFilter, setUsersAiAccessFilter] = useState("");
    const [usersPage, setUsersPage] = useState(1);
    const [usersPageSize, setUsersPageSize] = useState(25);
    const usersLoadRequestIdRef = useRef(0);
    const [aiUserAccessDialog, setAiUserAccessDialog] = useState(null);
    const [aiUserQuotaChoice, setAiUserQuotaChoice] = useState("1");
    const [aiUserCustomQuota, setAiUserCustomQuota] = useState("");
    const [isAiUserAccessSubmitting, setIsAiUserAccessSubmitting] = useState(false);
    const [aiUserAccessError, setAiUserAccessError] = useState("");
    const [aiUserAccessFeedback, setAiUserAccessFeedback] = useState("");
    const [applicationStatusAction, setApplicationStatusAction] = useState(null);
    const [isApplicationStatusUpdating, setIsApplicationStatusUpdating] = useState(false);
    const [applicationStatusActionError, setApplicationStatusActionError] = useState("");
    const [applicationStatusFeedback, setApplicationStatusFeedback] = useState("");
    const [semanticAdminData, setSemanticAdminData] = useState(null);
    const [semanticAdminError, setSemanticAdminError] = useState("");
    const [isSemanticAdminLoading, setIsSemanticAdminLoading] = useState(false);
    const [isSemanticAdminSaving, setIsSemanticAdminSaving] = useState(false);

    const loadSemanticAdminData = async () => {
        const client = getAdminSupabase();
        if (!client) { setSemanticAdminError("Semantic validation controls are unavailable."); return; }
        setIsSemanticAdminLoading(true); setSemanticAdminError("");
        try { const { data, error: rpcError } = await client.rpc("admin_get_semantic_validation"); if (rpcError || !data?.configuration) throw rpcError || new Error("Semantic configuration unavailable"); setSemanticAdminData(data); } catch { setSemanticAdminError("Semantic validation data could not be loaded."); } finally { setIsSemanticAdminLoading(false); }
    };
    const updateSemanticAdminData = async (mode, applicationEnabled, profileEnabled) => {
        const client = getAdminSupabase(); if (!client || isSemanticAdminSaving) return;
        if (mode === "enforced" && !window.confirm("Enable enforced semantic validation? Confirmed invalid fields may block users.")) return;
        setIsSemanticAdminSaving(true); setSemanticAdminError("");
        try { const { error: rpcError } = await client.rpc("admin_update_semantic_validation", { p_mode: mode, p_application_enabled: applicationEnabled, p_career_profile_enabled: profileEnabled }); if (rpcError) throw rpcError; await loadSemanticAdminData(); } catch { setSemanticAdminError("Semantic validation settings could not be updated."); } finally { setIsSemanticAdminSaving(false); }
    };

    useEffect(() => { if (activeSection === "usage-costs") loadSemanticAdminData(); }, [activeSection]);

    const closeDeleteDialog = () => {
        if (isDeleting) return;
        setApplicationPendingRemoval(null);
        setDeleteStep("confirm");
        setDeletePassword("");
        setDeleteError("");
    };

    const openDeleteDialog = (application) => {
        setApplicationPendingRemoval(application);
        setDeleteStep("confirm");
        setDeletePassword("");
        setDeleteError("");
        setDeleteSuccess("");
        setDeleteRefreshError("");
    };

    const selectAdminSection = (section) => {
        const nextSection = ADMIN_SECTIONS.has(section) ? section : "overview";
        if (nextSection === activeSection) return;
        const url = new URL(window.location.href);
        url.searchParams.set("section", nextSection);
        window.history.pushState({}, "", url.toString());
        setActiveSection(nextSection);
    };

    const loadApplications = async () => {
        const adminSupabase = getAdminSupabase();
        if (!adminSupabase) {
            setError("Supabase is not configured");
            setIsLoading(false);
            return false;
        }
        setIsLoading(true);
        setError("");

        try {
            const { data, error: loadError } = await adminSupabase
                .from("applications")
                .select(`
            id,
            status,
            motivation,
            strongest_skills,
            career_challenge,
            portfolio_url,
            additional_notes,
            submitted_at,
        applicants (
        id,
        full_name,
        email,
        phone,
        applicant_profiles (
            institution,
            major,
            graduation_year,
            current_status,
            target_role,
            target_industry,
            target_fields,
            target_fields_other,
            english_level,
            career_goal,
            availability,
            current_profile_summary,
            linkedin_url
        )
        ),
        cv_documents (
            id,
            storage_path,
            original_filename,
            cv_status,
            uploaded_at
        ),
        quiz_attempts (
            score,
            result_tier,
            completed_at
        )
            `)
                .order("submitted_at", { ascending: false });

            if (loadError) {
                console.error("Admin applications", loadError);
                setError("تعذر تحميل الطلبات.");
                setIsLoading(false);
                return false;
            }

            const loadedApplications = data ?? [];
            setApplications(loadedApplications);
            setIsLoading(false);
            return loadedApplications;
        } catch {
            setError("تعذر تحميل الطلبات.");
            setIsLoading(false);
            return false;
        }
    };

    const loadUsers = async () => {
        const requestId = usersLoadRequestIdRef.current + 1;
        usersLoadRequestIdRef.current = requestId;
        const adminSupabase = getAdminSupabase();
        if (!adminSupabase) {
            if (usersLoadRequestIdRef.current === requestId) {
                setUsersError("تعذر تحميل المستخدمين.");
                setIsUsersLoading(false);
            }
            return false;
        }

        setIsUsersLoading(true);
        setUsersError("");
        try {
            const { data, error: usersLoadError } = await adminSupabase.rpc("admin_list_users");
            if (usersLoadRequestIdRef.current !== requestId) return false;
            if (usersLoadError) throw usersLoadError;
            setUsers(normalizeUserRows(data));
            return true;
        } catch {
            if (usersLoadRequestIdRef.current === requestId) setUsersError("تعذر تحميل المستخدمين.");
            return false;
        } finally {
            if (usersLoadRequestIdRef.current === requestId) setIsUsersLoading(false);
        }
    };

    useEffect(() => {
        loadApplications();
    }, []);

    useEffect(() => {
        const syncSectionFromUrl = () => setActiveSection(getAdminSectionFromUrl());
        const currentSection = new URLSearchParams(window.location.search).get("section");

        if (!ADMIN_SECTIONS.has(currentSection)) {
            const url = new URL(window.location.href);
            url.searchParams.set("section", "overview");
            window.history.replaceState({}, "", url.toString());
        }

        window.addEventListener("popstate", syncSectionFromUrl);
        return () => window.removeEventListener("popstate", syncSectionFromUrl);
    }, []);

    useEffect(() => {
        let isActive = true;

        const loadAiAccessRequests = async () => {
            const adminSupabase = getAdminSupabase();
            if (!adminSupabase) {
                if (isActive) {
                    setAiAccessRequestError("تعذر تحميل طلبات الوصول.");
                    setIsAiAccessRequestsLoading(false);
                }
                return;
            }

            setIsAiAccessRequestsLoading(true);
            setAiAccessRequestError("");

            const { data, error: requestError } = await adminSupabase.rpc("admin_list_pending_ai_access_requests");
            if (!isActive) return;

            if (requestError) {
                setAiAccessRequestError("تعذر تحميل طلبات الوصول.");
                setIsAiAccessRequestsLoading(false);
                return;
            }

            setAiAccessRequests(Array.isArray(data) ? data : []);
            setIsAiAccessRequestsLoading(false);
        };

        loadAiAccessRequests();
        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => {
        loadUsers();
        return () => {
            usersLoadRequestIdRef.current += 1;
        };
    }, []);

    useEffect(() => {
        setUsersPage(1);
    }, [usersSearchQuery, usersVerifiedFilter, usersApplicationFilter, usersAiAccessFilter, usersPageSize]);

    useEffect(() => {
        if (!applicationPendingRemoval) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") closeDeleteDialog();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [applicationPendingRemoval, isDeleting]);

    useEffect(() => {
        if (!applicationDetail) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") setApplicationDetail(null);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [applicationDetail]);

    useEffect(() => {
        if (!applicationStatusAction) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !isApplicationStatusUpdating) setApplicationStatusAction(null);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [applicationStatusAction, isApplicationStatusUpdating]);

    useEffect(() => {
        setCurrentPage(1);
    }, [
        searchQuery,
        targetFieldFilter,
        currentStatusFilter,
        englishLevelFilter,
        cvStatusFilter,
        applicationDateFilter,
        visibilityFilter,
        hiddenApplicationIds,
    ]);

    const statusLabels = {
        student: "طالب",
        fresh_graduate: "خريج جديد",
        employed: "موظف حالياً",
        unemployed: "غير موظف حالياً",
        career_changer: "أغيّر مساري",
        freelancer: "أعمل بشكل حر",
        other: "أخرى",
    };

    const englishLabels = {
        basic: "أساسي",
        intermediate: "متوسط",
        upper_intermediate: "جيد",
        advanced: "متقدم",
    };

    const careerGoalLabels = {
        first_professional_job: "الحصول على أول وظيفة مهنية",
        career_change: "الانتقال إلى مجال مهني جديد",
        better_job: "الحصول على وظيفة أفضل",
        remote_international_work: "العثور على عمل عن بُعد أو دولي",
        improve_readiness: "تحسين الجاهزية قبل التقديم",
        internship_experience: "الحصول على تدريب أو خبرة عملية",
        other: "هدف آخر",
    };

    const targetFieldLabels = {
        software_it: "البرمجة وتقنية المعلومات",
        data_ai: "البيانات والذكاء الاصطناعي",
        technical_support: "الدعم التقني",
        customer_support_success: "دعم ونجاح العملاء",
        sales_business_development: "المبيعات وتطوير الأعمال",
        marketing_content: "التسويق وصناعة المحتوى",
        operations: "العمليات",
        supply_chain_logistics_procurement: "سلاسل التوريد واللوجستيات والمشتريات",
        project_management: "إدارة المشاريع",
        product_management: "إدارة المنتجات",
        human_resources_recruitment: "الموارد البشرية والتوظيف",
        finance_accounting: "المالية والمحاسبة",
        healthcare_life_sciences: "الصحة وعلوم الحياة",
        education_training: "التعليم والتدريب",
        design_ux: "التصميم وتجربة المستخدم",
        administration_office: "الإدارة والأعمال المكتبية",
        engineering: "الهندسة",
        research_academia: "البحث والأكاديميا",
        ngo_development: "المنظمات والتنمية",
        other: "أخرى",
    };

    const formatTargetFields = (value) => {
        if (!value) return "غير محدد";

        return value
            .split(",")
            .map((field) => targetFieldLabels[field.trim()] || field.trim())
            .join("، ");
    };

    const getProfile = (application) => {
        const profile = application.applicants?.applicant_profiles;
        return Array.isArray(profile) ? profile[0] : profile;
    };

    const getCv = (application) => {
    const cv = application.cv_documents;
    return Array.isArray(cv) ? cv[0] : cv;
    };

    const getQuiz = (application) => {
        const quiz = application.quiz_attempts;
        return Array.isArray(quiz) ? quiz[0] : quiz;
    };

    const displayValue = (value) => {
        const normalized = typeof value === "string" ? value.trim() : value;
        return normalized === null || normalized === undefined || normalized === "" ? "لم يتم تقديمه" : normalized;
    };

    const applicationStatusLabels = {
        submitted: "طلب جديد",
        under_review: "قيد المراجعة",
        accepted: "مقبول",
        waitlisted: "قائمة الانتظار",
        rejected: "مرفوض",
        withdrawn: "منسحب",
    };

    const formatApplicationStatus = (status) => applicationStatusLabels[status] || displayValue(status);

    const statusActionsFor = (status) => {
        if (status === "submitted") {
            return [
                { status: "under_review", label: "قيد المراجعة", className: "admin-application-detail__status-action--review" },
                { status: "accepted", label: "قبول الطلب", className: "admin-application-detail__status-action--approve" },
                { status: "rejected", label: "رفض الطلب", className: "admin-application-detail__status-action--reject" },
            ];
        }
        if (status === "under_review") {
            return [
                { status: "accepted", label: "قبول الطلب", className: "admin-application-detail__status-action--approve" },
                { status: "rejected", label: "رفض الطلب", className: "admin-application-detail__status-action--reject" },
            ];
        }
        return [];
    };

    const readinessTierLabels = {
        ready: "جاهز للتقديم",
        preparing: "جاهز مع بعض التحسينات",
        starter: "يحتاج تجهيزاً أولياً",
    };

    const getTargetFieldIds = (application) => {
        const targetFields = getProfile(application)?.target_fields;
        return targetFields ? targetFields.split(",").map((field) => field.trim()).filter(Boolean) : [];
    };

    const getCvStatus = (application) => getCv(application)?.cv_status || "no_cv";

    const getApplicationDate = (application) => application.submitted_at?.slice(0, 10) || "";

    const handleViewCv = async (application) => {
    const adminSupabase = getAdminSupabase();
    setCvErrorApplicationId(null);
    setCvError("");
    if (!adminSupabase) return;
    const cv = getCv(application);

    if (!cv?.storage_path) {
        setCvErrorApplicationId(application.id);
        setCvError("تعذر فتح السيرة الذاتية.");
        return;
    }

    const previewWindow = window.open("", "_blank");

    const { data, error: cvError } = await adminSupabase.storage
        .from("cvs")
        .createSignedUrl(cv.storage_path, 60);

    if (cvError || !data?.signedUrl) {
        previewWindow?.close();
        console.error("CV signed URL", cvError);
        setCvErrorApplicationId(application.id);
        setCvError("تعذر فتح السيرة الذاتية.");
        return;
    }

    if (previewWindow) {
        previewWindow.location.href = data.signedUrl;
    } else {
        window.location.href = data.signedUrl;
    }
    };
    const handleLogout = async () => {
        const adminSupabase = getAdminSupabase();
        if (!adminSupabase) {
            setLogoutError("تعذر تسجيل الخروج حالياً. حاول مرة أخرى.");
            return;
        }

        setLogoutError("");
        try {
            const { error: signOutError } = await adminSupabase.auth.signOut();
            if (signOutError) throw signOutError;
            window.location.reload();
        } catch {
            setLogoutError("تعذر تسجيل الخروج حالياً. حاول مرة أخرى.");
        }
    };

    const handleAiAccessRequest = async (requestId, action) => {
        if (!requestId || aiAccessRequestActionId) return;

        const selectedMessageLimit = aiAccessMessageLimits[requestId] || "1";
        const customMessageLimit = String(aiAccessCustomMessageLimits[requestId] || "").trim();
        const messageLimit = selectedMessageLimit === "custom"
            ? (/^\d+$/.test(customMessageLimit) ? Number(customMessageLimit) : null)
            : Number(selectedMessageLimit);

        if (action === "approve" && (!Number.isInteger(messageLimit) || messageLimit < 1 || messageLimit > 1000)) {
            setAiAccessRequestError("أدخل حد رسائل صحيحاً بين 1 و1000.");
            return;
        }

        const adminSupabase = getAdminSupabase();
        if (!adminSupabase) {
            setAiAccessRequestError("تعذر تنفيذ الإجراء حالياً.");
            return;
        }

        setAiAccessRequestError("");
        setAiAccessRequestActionId(requestId);

        try {
            const response = action === "approve"
                ? await adminSupabase.rpc("admin_approve_ai_access", {
                    p_request_id: requestId,
                    p_message_limit: messageLimit,
                })
                : await adminSupabase.rpc("admin_reject_ai_access", { p_request_id: requestId });

            if (response.error) throw response.error;

            setAiAccessRequests((currentRequests) => currentRequests.filter(
                (request) => request.request_id !== requestId,
            ));
            setAiAccessMessageLimits((currentLimits) => {
                const nextLimits = { ...currentLimits };
                delete nextLimits[requestId];
                return nextLimits;
            });
            setAiAccessCustomMessageLimits((currentLimits) => {
                const nextLimits = { ...currentLimits };
                delete nextLimits[requestId];
                return nextLimits;
            });
        } catch {
            setAiAccessRequestError("تعذر تنفيذ الإجراء حالياً. حاول مرة أخرى.");
        } finally {
            setAiAccessRequestActionId(null);
        }
    };

    const openAiUserAccessDialog = (account, mode) => {
        const currentLimit = Number.isInteger(account.ai_message_limit) ? account.ai_message_limit : 1;
        const presetLimit = [1, 3, 5].includes(currentLimit) ? String(currentLimit) : "custom";
        setAiUserAccessDialog({ account, mode });
        setAiUserQuotaChoice(presetLimit);
        setAiUserCustomQuota(presetLimit === "custom" ? String(currentLimit) : "");
        setAiUserAccessError("");
        setAiUserAccessFeedback("");
    };

    const closeAiUserAccessDialog = () => {
        if (isAiUserAccessSubmitting) return;
        setAiUserAccessDialog(null);
        setAiUserAccessError("");
        setAiUserCustomQuota("");
    };

    const submitAiUserAccess = async () => {
        if (!aiUserAccessDialog || isAiUserAccessSubmitting) return;

        const isRevoke = aiUserAccessDialog.mode === "revoke";
        const customLimit = String(aiUserCustomQuota).trim();
        const messageLimit = isRevoke
            ? null
            : aiUserQuotaChoice === "custom"
                ? (/^\d+$/.test(customLimit) ? Number(customLimit) : null)
                : Number(aiUserQuotaChoice);

        if (!isRevoke && (!Number.isInteger(messageLimit) || messageLimit < 1 || messageLimit > 1000)) {
            setAiUserAccessError("أدخل حد رسائل صحيحاً بين 1 و1000.");
            return;
        }

        const adminSupabase = getAdminSupabase();
        if (!adminSupabase) {
            setAiUserAccessError("تعذر تنفيذ الإجراء حالياً.");
            return;
        }

        setIsAiUserAccessSubmitting(true);
        setAiUserAccessError("");
        try {
            const { error: actionError } = await adminSupabase.rpc("admin_set_ai_access", {
                p_user_id: aiUserAccessDialog.account.userId,
                p_enabled: !isRevoke,
                p_message_limit: messageLimit,
            });
            if (actionError) throw actionError;

            const didReloadUsers = await loadUsers();
            setAiUserAccessDialog(null);
            setAiUserCustomQuota("");
            setAiUserAccessFeedback(
                didReloadUsers
                    ? isRevoke ? "تم إيقاف وصول AI." : "تم تحديث وصول AI وحد الرسائل."
                    : "تم حفظ التغيير، لكن تعذر تحديث قائمة المستخدمين. أعد تحميل الصفحة.",
            );
        } catch {
            setAiUserAccessError("تعذر تحديث وصول AI حالياً. حاول مرة أخرى.");
        } finally {
            setIsAiUserAccessSubmitting(false);
        }
    };

    const formatRequestDate = (value) => {
        const date = value ? new Date(value) : null;
        return date && !Number.isNaN(date.getTime())
            ? date.toLocaleString("ar")
            : "غير محدد";
    };

    const updateHiddenApplicationIds = (update) => {
        setHiddenApplicationIds((currentIds) => {
            const nextIds = update(currentIds);

            try {
                window.localStorage.setItem(HIDDEN_APPLICATIONS_STORAGE_KEY, JSON.stringify(nextIds));
            } catch (storageError) {
                console.error("Admin hidden applications storage", storageError);
            }

            return nextIds;
        });
    };

    const deleteApplication = async () => {
        if (!applicationPendingRemoval || isDeleting || !deletePassword) return;

        const applicationId = applicationPendingRemoval.id;
        const adminSupabase = getAdminSupabase();
        if (!applicationId || !adminSupabase) {
            setDeletePassword("");
            setDeleteError("Could not delete this application. Please try again.");
            return;
        }

        setIsDeleting(true);
        setDeleteError("");

        try {
            const { data: sessionData } = await adminSupabase.auth.getSession();
            const adminEmail = sessionData.session?.user?.email;
            if (!adminEmail) {
                setDeleteError("Incorrect password or verification failed.");
                return;
            }

            const { data: verifiedAdmin, error: verificationError } = await adminSupabase.auth.signInWithPassword({
                email: adminEmail,
                password: deletePassword,
            });
            if (verificationError || !verifiedAdmin.user) {
                setDeleteError("Incorrect password or verification failed.");
                return;
            }

            const { error: deleteError } = await adminSupabase.rpc("admin_delete_application", {
                p_application_id: applicationId,
            });
            if (deleteError) throw deleteError;

            const didReloadApplications = await loadApplications();
            updateHiddenApplicationIds((currentIds) => currentIds.filter(
                (applicationId) => applicationId !== String(applicationPendingRemoval.id),
            ));
            setApplicationDetail(null);
            setApplicationPendingRemoval(null);
            setDeleteStep("confirm");
            if (didReloadApplications) {
                setDeleteSuccess("Application deleted successfully.");
            } else {
                setDeleteRefreshError("Application was deleted, but the dashboard could not refresh. Please reload the page.");
            }
        } catch {
            setDeleteError("Could not delete this application. Please try again.");
        } finally {
            setDeletePassword("");
            setIsDeleting(false);
        }
    };

    const openApplicationStatusAction = (application, action) => {
        if (isApplicationStatusUpdating) return;
        setApplicationStatusAction({ application, action });
        setApplicationStatusActionError("");
        setApplicationStatusFeedback("");
    };

    const closeApplicationStatusAction = () => {
        if (isApplicationStatusUpdating) return;
        setApplicationStatusAction(null);
        setApplicationStatusActionError("");
    };

    const submitApplicationStatusAction = async () => {
        if (!applicationStatusAction || isApplicationStatusUpdating) return;

        const { application, action } = applicationStatusAction;
        const adminSupabase = getAdminSupabase();
        if (!application?.id || !adminSupabase) {
            setApplicationStatusActionError("تعذر تحديث حالة الطلب حالياً. حاول مرة أخرى.");
            return;
        }

        setIsApplicationStatusUpdating(true);
        setApplicationStatusActionError("");
        try {
            const { error: updateError } = await adminSupabase.rpc("admin_update_application_status", {
                p_application_id: application.id,
                p_new_status: action.status,
            });
            if (updateError) throw updateError;

            const refreshedApplications = await loadApplications();
            setApplicationStatusAction(null);
            if (refreshedApplications) {
                const refreshedApplication = refreshedApplications.find((item) => item.id === application.id) || null;
                setApplicationDetail(refreshedApplication);
                setApplicationStatusFeedback("تم تحديث حالة الطلب.");
            } else {
                setApplicationStatusFeedback("تم تحديث حالة الطلب، لكن تعذر تحديث القائمة. أعد تحميل الصفحة.");
            }
        } catch {
            setApplicationStatusActionError("تعذر تحديث حالة الطلب حالياً. حاول مرة أخرى.");
        } finally {
            setIsApplicationStatusUpdating(false);
        }
    };

    const restoreApplication = (applicationId) => {
        const normalizedId = String(applicationId);
        updateHiddenApplicationIds((currentIds) => currentIds.filter((id) => id !== normalizedId));
        if (hiddenApplications.length === 1) setIsHiddenApplicantsOpen(false);
    };

    const visibleApplications = applications.filter(
        (application) => !hiddenApplicationIds.includes(String(application.id))
    );
    const hiddenApplications = applications.filter(
        (application) => hiddenApplicationIds.includes(String(application.id))
    );
    const applicationsForVisibility = visibilityFilter === "hidden"
        ? hiddenApplications
        : visibilityFilter === "all"
            ? applications
            : visibleApplications;
    const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
    const filteredApplications = applicationsForVisibility.filter((application) => {
        const profile = getProfile(application);
        const searchableText = [
            application.applicants?.full_name,
            application.applicants?.email,
            application.applicants?.phone,
        ].filter(Boolean).join(" ").toLocaleLowerCase();

        return (
            (!normalizedSearchQuery || searchableText.includes(normalizedSearchQuery))
            && (!targetFieldFilter || getTargetFieldIds(application).includes(targetFieldFilter))
            && (!currentStatusFilter || profile?.current_status === currentStatusFilter)
            && (!englishLevelFilter || profile?.english_level === englishLevelFilter)
            && (!cvStatusFilter || getCvStatus(application) === cvStatusFilter)
            && (!applicationDateFilter || getApplicationDate(application) === applicationDateFilter)
        );
    });
    const targetFieldOptions = [...new Set(applications.flatMap(getTargetFieldIds))];
    const currentStatusOptions = [...new Set(
        applications.map((application) => getProfile(application)?.current_status).filter(Boolean)
    )];
    const englishLevelOptions = [...new Set(
        applications.map((application) => getProfile(application)?.english_level).filter(Boolean)
    )];
    const cvStatusOptions = [...new Set(applications.map(getCvStatus))];
    const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedApplications = filteredApplications.slice(
        (safeCurrentPage - 1) * pageSize,
        safeCurrentPage * pageSize
    );
    const hasActiveFilters = Boolean(
        normalizedSearchQuery
        || targetFieldFilter
        || currentStatusFilter
        || englishLevelFilter
        || cvStatusFilter
        || applicationDateFilter
        || visibilityFilter !== "visible"
    );

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages));
    }, [totalPages]);

    const clearFilters = () => {
        setSearchQuery("");
        setTargetFieldFilter("");
        setCurrentStatusFilter("");
        setEnglishLevelFilter("");
        setCvStatusFilter("");
        setApplicationDateFilter("");
        setVisibilityFilter("visible");
        setCurrentPage(1);
    };

    const normalizedUsersSearchQuery = usersSearchQuery.trim().toLocaleLowerCase();
    const filteredUsers = users.filter((account) => (
        (!normalizedUsersSearchQuery || account.emailKey.includes(normalizedUsersSearchQuery))
        && (!usersVerifiedFilter || String(account.email_verified) === usersVerifiedFilter)
        && (!usersApplicationFilter || String(account.application_linked) === usersApplicationFilter)
        && (!usersAiAccessFilter || String(account.ai_access_enabled) === usersAiAccessFilter)
    ));
    const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPageSize));
    const safeUsersPage = Math.min(usersPage, usersTotalPages);
    const paginatedUsers = filteredUsers.slice(
        (safeUsersPage - 1) * usersPageSize,
        safeUsersPage * usersPageSize,
    );

    const adminSections = [
        ["overview", "نظرة عامة"],
        ["applications", "الطلبات"],
        ["users", "المستخدمون"],
        ["ai-access", "وصول AI"],
        ["usage-costs", "الاستخدام والتكلفة"],
    ];

    return (
        <>
        <main className="admin-dashboard" dir="rtl">
            <header className="admin-dashboard-header">
                <div>
                    <span>CareerFit Lab</span>
                    <h1>لوحة الإدارة</h1>
                    <p>{adminUser.email}</p>
                </div>

                <button type="button" onClick={handleLogout}>
                    تسجيل الخروج
                </button>
            </header>

            {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
            {deleteRefreshError && <p className="form-error" role="alert">{deleteRefreshError}</p>}
            {aiUserAccessFeedback && <p className="admin-users__feedback" role="status">{aiUserAccessFeedback}</p>}
            {applicationStatusFeedback && <p className="admin-users__feedback" role="status">{applicationStatusFeedback}</p>}

            <nav className="admin-section-tabs" aria-label="أقسام لوحة الإدارة">
                {adminSections.map(([section, label]) => (
                    <button
                        key={section}
                        type="button"
                        className={activeSection === section ? "active" : ""}
                        aria-pressed={activeSection === section}
                        onClick={() => selectAdminSection(section)}
                    >
                        {label}
                    </button>
                ))}
            </nav>

            {activeSection === "overview" && (
                <section className="admin-overview" aria-labelledby="admin-overview-title">
                    <div className="admin-section-heading">
                        <span>CareerFit Lab</span>
                        <h2 id="admin-overview-title">نظرة عامة</h2>
                        <p>ملخص سريع للبيانات المتاحة في لوحة الإدارة.</p>
                    </div>
                    <div className="admin-overview__grid">
                        <button type="button" onClick={() => selectAdminSection("applications")}>
                            <span>الطلبات</span>
                            <strong>{isLoading ? "—" : applications.length}</strong>
                        </button>
                        <button type="button" onClick={() => selectAdminSection("users")}>
                            <span>المستخدمون</span>
                            <strong>{isUsersLoading ? "—" : users.length}</strong>
                        </button>
                        <button type="button" onClick={() => selectAdminSection("ai-access")}>
                            <span>طلبات وصول AI المعلّقة</span>
                            <strong>{isAiAccessRequestsLoading ? "—" : aiAccessRequests.length}</strong>
                        </button>
                    </div>
                </section>
            )}

            {activeSection === "users" && <section className="admin-users" aria-labelledby="admin-users-title">
                <div className="admin-users__heading">
                    <div>
                        <span>CareerFit</span>
                        <h2 id="admin-users-title">المستخدمون</h2>
                    </div>
                    {!isUsersLoading && !usersError && <strong>{users.length}</strong>}
                </div>

                {isUsersLoading && <p>جارٍ تحميل المستخدمين...</p>}
                {usersError && <p className="form-error" role="alert">{usersError}</p>}
                {!isUsersLoading && !usersError && users.length === 0 && (
                    <p className="admin-users__empty">لا توجد حسابات مستخدمين حتى الآن.</p>
                )}
                {!isUsersLoading && !usersError && users.length > 0 && (
                    <>
                        <div className="admin-users__controls">
                            <label htmlFor="admin-users-search">
                                البحث بالبريد الإلكتروني
                                <input
                                    id="admin-users-search"
                                    name="users-email-search"
                                    type="search"
                                    autoComplete="off"
                                    value={usersSearchQuery}
                                    onChange={(event) => setUsersSearchQuery(event.target.value)}
                                    placeholder="name@example.com"
                                />
                            </label>
                            <label>
                                التحقق
                                <select value={usersVerifiedFilter} onChange={(event) => setUsersVerifiedFilter(event.target.value)}>
                                    <option value="">الكل</option>
                                    <option value="true">موثّق</option>
                                    <option value="false">غير موثّق</option>
                                </select>
                            </label>
                            <label>
                                الطلب
                                <select value={usersApplicationFilter} onChange={(event) => setUsersApplicationFilter(event.target.value)}>
                                    <option value="">الكل</option>
                                    <option value="true">مرتبط</option>
                                    <option value="false">غير مرتبط</option>
                                </select>
                            </label>
                            <label>
                                وصول AI
                                <select value={usersAiAccessFilter} onChange={(event) => setUsersAiAccessFilter(event.target.value)}>
                                    <option value="">الكل</option>
                                    <option value="true">مفعّل</option>
                                    <option value="false">غير مفعّل</option>
                                </select>
                            </label>
                        </div>
                        <p className="admin-users__summary">{filteredUsers.length} من أصل {users.length} مستخدماً</p>
                        {filteredUsers.length === 0 ? <p className="admin-users__empty">لا توجد حسابات مطابقة.</p> : <div className="admin-users__table-wrap">
                            <table className="admin-users__table">
                                <thead>
                                    <tr><th>البريد الإلكتروني</th><th>موثّق</th><th>الطلب</th><th>وصول AI</th><th>المستخدم / الحد</th><th>تاريخ الإنشاء</th><th>إجراءات</th></tr>
                                </thead>
                                <tbody>
                                {paginatedUsers.map((account) => {
                            const hasAiAccess = account.ai_access_enabled === true;
                            const remainingMessages = Number.isInteger(account.ai_remaining_messages)
                                ? account.ai_remaining_messages
                                : "—";
                            return (
                                <tr key={account.userId}>
                                    <td data-label="البريد الإلكتروني" dir="ltr">{account.email}</td>
                                    <td data-label="موثّق">{account.email_verified ? "نعم" : "لا"}</td>
                                    <td data-label="الطلب">{account.application_linked ? "نعم" : "لا"}</td>
                                    <td data-label="وصول AI">{hasAiAccess ? "مفعّل" : "غير مفعّل"}</td>
                                    <td data-label="المستخدم / الحد">{Number.isInteger(account.ai_messages_used) ? account.ai_messages_used : "—"} / {Number.isInteger(account.ai_message_limit) ? account.ai_message_limit : "—"}<small>{remainingMessages === "—" ? "" : `المتبقي: ${remainingMessages}`}</small></td>
                                    <td data-label="تاريخ الإنشاء">{formatRequestDate(account.account_created_at)}</td>
                                    <td data-label="إجراءات">
                                        <div className="admin-users__actions">
                                            {hasAiAccess ? <>
                                                <button type="button" onClick={() => openAiUserAccessDialog(account, "update")}>تعديل الحد</button>
                                                <button type="button" className="admin-users__revoke" onClick={() => openAiUserAccessDialog(account, "revoke")}>إيقاف</button>
                                            </> : (
                                                <button type="button" onClick={() => openAiUserAccessDialog(account, "grant")}>تفعيل AI</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                                })}
                                </tbody>
                            </table>
                        </div>}
                        <div className="admin-users__pagination" aria-label="ترقيم صفحات المستخدمين">
                            <label>عدد المستخدمين في الصفحة
                                <select value={usersPageSize} onChange={(event) => setUsersPageSize(Number(event.target.value))}>
                                    <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                                </select>
                            </label>
                            <div>
                                <button type="button" onClick={() => setUsersPage((page) => Math.max(1, page - 1))} disabled={safeUsersPage === 1}>السابق</button>
                                <span>صفحة {safeUsersPage} من {usersTotalPages}</span>
                                <button type="button" onClick={() => setUsersPage((page) => Math.min(usersTotalPages, page + 1))} disabled={safeUsersPage === usersTotalPages}>التالي</button>
                            </div>
                        </div>
                    </>
                )}
            </section>}

            {activeSection === "ai-access" && <section className="admin-ai-access-requests" aria-labelledby="admin-ai-access-requests-title">
                <div className="admin-ai-access-requests__heading">
                    <div>
                        <span>CareerFit AI</span>
                        <h2 id="admin-ai-access-requests-title">طلبات الوصول إلى المساعد</h2>
                    </div>
                    {!isAiAccessRequestsLoading && <strong>{aiAccessRequests.length}</strong>}
                </div>

                {isAiAccessRequestsLoading && <p>جارٍ تحميل طلبات الوصول...</p>}
                {aiAccessRequestError && <p className="form-error">{aiAccessRequestError}</p>}
                {!isAiAccessRequestsLoading && !aiAccessRequestError && aiAccessRequests.length === 0 && (
                    <p className="admin-ai-access-requests__empty">لا توجد طلبات وصول معلّقة.</p>
                )}
                {!isAiAccessRequestsLoading && aiAccessRequests.length > 0 && (
                    <div className="admin-ai-access-requests__list">
                        {aiAccessRequests.map((request) => {
                            const isProcessing = aiAccessRequestActionId === request.request_id;
                            const messageLimit = aiAccessMessageLimits[request.request_id] || "1";
                            const customMessageLimit = aiAccessCustomMessageLimits[request.request_id] || "";
                            const isCustomMessageLimitValid = /^\d+$/.test(String(customMessageLimit))
                                && Number(customMessageLimit) >= 1
                                && Number(customMessageLimit) <= 1000;

                            return (
                                <article className="admin-ai-access-request" key={request.request_id}>
                                    <div className="admin-ai-access-request__details">
                                        <strong dir="ltr">{request.email || "بدون بريد إلكتروني"}</strong>
                                        <span>تاريخ الطلب: {formatRequestDate(request.requested_at)}</span>
                                        {request.request_note ? <p>{request.request_note}</p> : null}
                                    </div>
                                    <div className="admin-ai-access-request__actions">
                                        <label>
                                            حد الرسائل
                                            <select
                                                value={messageLimit}
                                                disabled={Boolean(aiAccessRequestActionId)}
                                                onChange={(event) => setAiAccessMessageLimits((currentLimits) => ({
                                                    ...currentLimits,
                                                    [request.request_id]: event.target.value,
                                                }))}
                                            >
                                                <option value="1">1</option>
                                                <option value="3">3</option>
                                                <option value="5">5</option>
                                                <option value="custom">مخصص</option>
                                            </select>
                                        </label>
                                        {messageLimit === "custom" && (
                                            <label>
                                                الحد المخصص
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="1000"
                                                    step="1"
                                                    inputMode="numeric"
                                                    value={customMessageLimit}
                                                    disabled={Boolean(aiAccessRequestActionId)}
                                                    onChange={(event) => setAiAccessCustomMessageLimits((currentLimits) => ({
                                                        ...currentLimits,
                                                        [request.request_id]: event.target.value,
                                                    }))}
                                                />
                                            </label>
                                        )}
                                                 <button
                                            type="button"
                                            className="admin-ai-access-request__approve"
                                            disabled={Boolean(aiAccessRequestActionId) || (messageLimit === "custom" && !isCustomMessageLimitValid)}
                                            onClick={() => handleAiAccessRequest(request.request_id, "approve")}
                                        >
                                            {isProcessing ? "جارٍ التنفيذ..." : "موافقة"}
                                        </button>
                                        <button
                                            type="button"
                                            className="admin-ai-access-request__reject"
                                            disabled={Boolean(aiAccessRequestActionId)}
                                            onClick={() => handleAiAccessRequest(request.request_id, "reject")}
                                        >
                                            {isProcessing ? "جارٍ التنفيذ..." : "رفض"}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>}

            {activeSection === "usage-costs" && (
                <section className="admin-usage-placeholder" aria-labelledby="admin-usage-placeholder-title">
                    <div className="admin-section-heading">
                        <span>CareerFit AI</span>
                        <h2 id="admin-usage-placeholder-title">الاستخدام والتكلفة</h2>
                    </div>
                    <p>Cost estimate unavailable until pricing is configured.</p>
                    {isSemanticAdminLoading && <p>جارٍ تحميل إعدادات التحقق...</p>}
                    {semanticAdminError && <p className="form-error" role="alert">{semanticAdminError}</p>}
                    {semanticAdminData?.configuration && <div className="admin-semantic-validation">
                        <h3>Semantic Validation</h3>
                        <p>{semanticAdminData.configuration.mode === "off" ? "AI semantic validation is disabled. Deterministic validation remains active." : semanticAdminData.configuration.mode === "shadow" ? "Semantic checks run for monitoring but do not block users." : "Confirmed invalid semantic responses may block affected fields. Technical failures fall back safely."}</p>
                        <div className="admin-semantic-validation__modes" role="group" aria-label="Semantic validation mode">
                            {["off", "shadow", "enforced"].map((mode) => <button key={mode} type="button" className={semanticAdminData.configuration.mode === mode ? "is-active" : ""} disabled={isSemanticAdminSaving} onClick={() => updateSemanticAdminData(mode, semanticAdminData.configuration.application_enabled, semanticAdminData.configuration.career_profile_enabled)}>{mode.toUpperCase()}</button>)}
                        </div>
                        <label><input type="checkbox" checked={Boolean(semanticAdminData.configuration.application_enabled)} disabled={isSemanticAdminSaving} onChange={(event) => updateSemanticAdminData(semanticAdminData.configuration.mode, event.target.checked, semanticAdminData.configuration.career_profile_enabled)} /> Application semantic validation</label>
                        <label><input type="checkbox" checked={Boolean(semanticAdminData.configuration.career_profile_enabled)} disabled={isSemanticAdminSaving} onChange={(event) => updateSemanticAdminData(semanticAdminData.configuration.mode, semanticAdminData.configuration.application_enabled, event.target.checked)} /> Career Profile semantic validation</label>
                        <details><summary>Operational metrics</summary><div className="admin-semantic-validation__metrics">{Object.entries(semanticAdminData.metrics || {}).map(([key, value]) => <span key={key}>{key.replaceAll("_", " ")}: {value ?? "Unknown"}</span>)}</div></details>
                    </div>}
                </section>
            )}

            {activeSection === "applications" && <>
            {isLoading && <p>جارٍ تحميل الطلبات...</p>}
            {error && <p className="form-error">{error}</p>}

            {!isLoading && !error && applications.length > 0 && (
                <section className="admin-applications-controls" aria-label="بحث وتصفية الطلبات">
                    <div className="admin-applications-controls__search">
                        <label htmlFor="admin-applications-search">البحث في المتقدمين</label>
                        <input
                            id="admin-applications-search"
                            name="application-search"
                            type="search"
                            autoComplete="off"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="الاسم أو البريد الإلكتروني أو الهاتف"
                        />
                    </div>
                    <div className="admin-applications-controls__filters">
                        <label>
                            المجال المستهدف
                            <select value={targetFieldFilter} onChange={(event) => setTargetFieldFilter(event.target.value)}>
                                <option value="">كل المجالات</option>
                                {targetFieldOptions.map((field) => (
                                    <option value={field} key={field}>{targetFieldLabels[field] || field}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            الوضع الحالي
                            <select value={currentStatusFilter} onChange={(event) => setCurrentStatusFilter(event.target.value)}>
                                <option value="">كل الحالات</option>
                                {currentStatusOptions.map((status) => (
                                    <option value={status} key={status}>{statusLabels[status] || status}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            مستوى الإنجليزية
                            <select value={englishLevelFilter} onChange={(event) => setEnglishLevelFilter(event.target.value)}>
                                <option value="">كل المستويات</option>
                                {englishLevelOptions.map((level) => (
                                    <option value={level} key={level}>{englishLabels[level] || level}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            حالة CV
                            <select value={cvStatusFilter} onChange={(event) => setCvStatusFilter(event.target.value)}>
                                <option value="">كل الحالات</option>
                                {cvStatusOptions.map((status) => (
                                    <option value={status} key={status}>
                                        {status === "no_cv" ? "لم يتم إرفاق CV" : status}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            تاريخ التقديم
                            <input
                                type="date"
                                value={applicationDateFilter}
                                onChange={(event) => setApplicationDateFilter(event.target.value)}
                            />
                        </label>
                        <label>
                            العرض
                            <select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)}>
                                <option value="visible">الظاهرون</option>
                                <option value="hidden">المخفون</option>
                                <option value="all">الكل</option>
                            </select>
                        </label>
                    </div>
                    <div className="admin-applications-controls__footer">
                        <p>{filteredApplications.length} من أصل {applications.length} طلباً</p>
                        {hasActiveFilters && (
                            <button type="button" onClick={clearFilters}>مسح عوامل التصفية</button>
                        )}
                    </div>
                </section>
            )}

            {!isLoading && !error && hiddenApplicationIds.length > 0 && (
                <div className="admin-hidden-applications">
                    <button
                        type="button"
                        className="admin-hidden-applications__toggle"
                        onClick={() => setIsHiddenApplicantsOpen((isOpen) => !isOpen)}
                        aria-expanded={isHiddenApplicantsOpen}
                    >
                        المتقدمون المخفيون ({hiddenApplicationIds.length})
                    </button>

                    {isHiddenApplicantsOpen && (
                        <div className="admin-hidden-applications__panel">
                            {hiddenApplications.map((application) => (
                                <div className="admin-hidden-applications__item" key={application.id}>
                                    <div>
                                        <strong>{application.applicants?.full_name || "بدون اسم"}</strong>
                                        <span>{application.applicants?.email || "بدون بريد إلكتروني"}</span>
                                    </div>
                                    <button type="button" onClick={() => restoreApplication(application.id)}>
                                        استعادة
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {!isLoading && !error && applications.length === 0 && (
                <p>لا توجد طلبات حتى الآن.</p>
            )}

            {!isLoading && !error && applications.length > 0 && filteredApplications.length === 0 && (
                <p>لا توجد طلبات مطابقة للبحث أو عوامل التصفية.</p>
            )}

            {!isLoading && !error && paginatedApplications.length > 0 && (
                <div className="admin-applications-list">
                    {paginatedApplications.map((application) => {
                        const profile = getProfile(application);

                        return (
                            <article className="admin-application-card" key={application.id}>
                                <div className="admin-card-summary">
                                    <div className="admin-card-person">
                                        <div className="admin-card-avatar">
                                            {(application.applicants?.full_name || "?").charAt(0).toUpperCase()}
                                        </div>

                                        <div>
                                            <h2>{application.applicants?.full_name || "بدون اسم"}</h2>
                                            <p dir="ltr">{displayValue(application.applicants?.email)}</p>
                                        </div>
                                    </div>

                                    <div className="admin-card-meta">
                                        <span className="admin-card-opportunity">
                                            {careerGoalLabels[profile?.career_goal] || displayValue(profile?.career_goal)}
                                        </span>
                                        <span className="admin-status-badge">
                                            {formatApplicationStatus(application.status)}
                                        </span>
                                        <span>
                                            {formatRequestDate(application.submitted_at)}
                                        </span>
                                        <button
                                            className="admin-application-view-button"
                                            type="button"
                                            onClick={() => setApplicationDetail(application)}
                                        >
                                            عرض
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
            {!isLoading && !error && filteredApplications.length > 0 && (
                <div className="admin-pagination" aria-label="ترقيم صفحات الطلبات">
                    <label>
                        عدد الطلبات في الصفحة
                        <select
                            value={pageSize}
                            onChange={(event) => {
                                setPageSize(Number(event.target.value));
                                setCurrentPage(1);
                            }}
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </label>
                    <div>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={safeCurrentPage === 1}
                        >
                            السابق
                        </button>
                        <span>صفحة {safeCurrentPage} من {totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                            disabled={safeCurrentPage === totalPages}
                        >
                            التالي
                        </button>
                    </div>
                </div>
            )}
            </>}
        </main>
        {deleteSuccess && <p role="status">{deleteSuccess}</p>}
        {applicationDetail && (() => {
            const profile = getProfile(applicationDetail);
            const cv = getCv(applicationDetail);
            const quiz = getQuiz(applicationDetail);

            return (
                <div className="admin-application-detail-backdrop" role="presentation">
                    <section
                        className="admin-application-detail"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-application-detail-title"
                        dir="rtl"
                    >
                        <div className="admin-application-detail__header">
                            <div>
                                <span>CareerFit Lab</span>
                                <h2 id="admin-application-detail-title">{displayValue(applicationDetail.applicants?.full_name)}</h2>
                                <p dir="ltr">{displayValue(applicationDetail.applicants?.email)}</p>
                            </div>
                            <button
                                type="button"
                                className="admin-application-detail__close"
                                aria-label="إغلاق التفاصيل"
                                onClick={() => setApplicationDetail(null)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="admin-application-detail__content">
                            <section className="admin-application-detail__group">
                                <h3>ملخص الطلب</h3>
                                <div className="admin-application-detail__grid">
                                    <div><span>الاسم الكامل</span><strong>{displayValue(applicationDetail.applicants?.full_name)}</strong></div>
                                    <div><span>البريد الإلكتروني الموثق</span><strong dir="ltr">{displayValue(applicationDetail.applicants?.email)}</strong></div>
                                    <div><span>رقم الهاتف</span><strong dir="ltr">{displayValue(applicationDetail.applicants?.phone)}</strong></div>
                                    <div><span>نوع الفرصة</span><strong>{careerGoalLabels[profile?.career_goal] || displayValue(profile?.career_goal)}</strong></div>
                                    <div><span>حالة الطلب</span><strong>{formatApplicationStatus(applicationDetail.status)}</strong></div>
                                    <div><span>تاريخ التقديم</span><strong>{formatRequestDate(applicationDetail.submitted_at)}</strong></div>
                                </div>
                            </section>

                            <section className="admin-application-detail__group">
                                <h3>الاتجاه المهني</h3>
                                <div className="admin-application-detail__grid">
                                    <div><span>الدور المستهدف</span><strong>{displayValue(profile?.target_role)}</strong></div>
                                    <div><span>المجالات المستهدفة</span><strong>{formatTargetFields(profile?.target_fields)}</strong></div>
                                    <div className="wide"><span>مجال مستهدف آخر</span><strong>{displayValue(profile?.target_fields_other)}</strong></div>
                                </div>
                            </section>

                            <section className="admin-application-detail__group">
                                <h3>الخبرة والاحتياج</h3>
                                <div className="admin-application-detail__grid">
                                    <div className="wide"><span>الخبرة ذات الصلة</span><strong>{displayValue(profile?.current_profile_summary)}</strong></div>
                                    <div className="wide"><span>أقوى المهارات</span><strong>{displayValue(applicationDetail.strongest_skills)}</strong></div>
                                    <div className="wide"><span>أكبر تحدٍ مهني</span><strong>{displayValue(applicationDetail.career_challenge)}</strong></div>
                                    <div className="wide"><span>ما الذي يريد المساعدة فيه من CareerFit</span><strong>{displayValue(applicationDetail.motivation)}</strong></div>
                                </div>
                            </section>

                            <section className="admin-application-detail__group">
                                <h3>روابط وملاحظات</h3>
                                <div className="admin-application-detail__grid">
                                    <div className="wide"><span>LinkedIn</span><strong dir="ltr">{displayValue(profile?.linkedin_url)}</strong></div>
                                    <div className="wide"><span>Portfolio / GitHub</span><strong dir="ltr">{displayValue(applicationDetail.portfolio_url)}</strong></div>
                                    <div className="wide"><span>ملاحظات إضافية</span><strong>{displayValue(applicationDetail.additional_notes)}</strong></div>
                                </div>
                            </section>

                            <section className="admin-application-detail__group">
                                <h3>اختبار الجاهزية والسيرة الذاتية</h3>
                                <div className="admin-application-detail__grid">
                                    <div><span>درجة الجاهزية</span><strong>{quiz ? displayValue(quiz.score) : "لم يتم تقديمه"}</strong></div>
                                    <div><span>نتيجة الجاهزية</span><strong>{quiz ? readinessTierLabels[quiz.result_tier] || displayValue(quiz.result_tier) : "لم يتم تقديمه"}</strong></div>
                                    <div><span>تاريخ إكمال الاختبار</span><strong>{quiz ? formatRequestDate(quiz.completed_at) : "لم يتم تقديمه"}</strong></div>
                                    <div className="wide admin-application-detail__cv">
                                        <span>السيرة الذاتية</span>
                                        {cv ? (
                                            <div>
                                                <strong>{displayValue(cv.original_filename)}</strong>
                                                <button type="button" onClick={() => handleViewCv(applicationDetail)}>عرض CV</button>
                                            </div>
                                        ) : <strong>لم يتم تقديمه</strong>}
                                        {cvErrorApplicationId === applicationDetail.id && cvError && (
                                            <p className="form-error" role="alert">{cvError}</p>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="admin-application-detail__actions">
                            {statusActionsFor(applicationDetail.status).map((action) => (
                                <button
                                    key={action.status}
                                    type="button"
                                    className={action.className}
                                    disabled={isApplicationStatusUpdating}
                                    onClick={() => openApplicationStatusAction(applicationDetail, action)}
                                >
                                    {action.label}
                                </button>
                            ))}
                            {!hiddenApplicationIds.includes(String(applicationDetail.id)) && (
                                <button type="button" className="admin-application-detail__delete" onClick={() => openDeleteDialog(applicationDetail)}>
                                    حذف الطلب
                                </button>
                            )}
                            <button type="button" onClick={() => setApplicationDetail(null)}>إغلاق</button>
                        </div>
                    </section>
                </div>
            );
        })()}
        {applicationPendingRemoval && (
            <div className="admin-remove-dialog-backdrop" role="presentation">
                <section
                    className="admin-remove-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="admin-remove-dialog-title"
                >
                    {deleteStep === "confirm" ? (
                        <>
                            <h2 id="admin-remove-dialog-title">
                                Are you sure you want to permanently delete this application and its related application data?
                            </h2>
                            <div className="admin-remove-dialog__actions">
                                <button type="button" onClick={closeDeleteDialog} disabled={isDeleting}>Cancel</button>
                                <button
                                    type="button"
                                    className="admin-remove-dialog__confirm"
                                    onClick={() => setDeleteStep("password")}
                                    disabled={isDeleting}
                                >
                                    Continue
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <h2 id="admin-remove-dialog-title">Confirm your password</h2>
                            <p>Enter your current admin password to permanently delete this application.</p>
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    deleteApplication();
                                }}
                            >
                                <label className="admin-delete-auth-username" htmlFor="admin-delete-username">
                                    Admin email
                                    <input
                                        id="admin-delete-username"
                                        name="username"
                                        type="email"
                                        autoComplete="username"
                                        value={adminUser.email || ""}
                                        readOnly
                                        tabIndex={-1}
                                    />
                                </label>
                                <label htmlFor="admin-delete-password">
                                    Password
                                    <input
                                        id="admin-delete-password"
                                        name="current-password"
                                        type="password"
                                        autoComplete="current-password"
                                        value={deletePassword}
                                        onChange={(event) => setDeletePassword(event.target.value)}
                                        disabled={isDeleting}
                                    />
                                </label>
                                {deleteError && <p role="alert">{deleteError}</p>}
                                <div className="admin-remove-dialog__actions">
                                    <button type="button" onClick={closeDeleteDialog} disabled={isDeleting}>Cancel</button>
                                    <button
                                        type="submit"
                                        className="admin-remove-dialog__confirm"
                                        disabled={isDeleting || !deletePassword}
                                    >
                                        {isDeleting ? "Deleting..." : "Delete application"}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </section>
            </div>
        )}
        {applicationStatusAction && (
            <div className="admin-remove-dialog-backdrop" role="presentation">
                <section
                    className="admin-remove-dialog admin-application-status-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="admin-application-status-dialog-title"
                    dir="rtl"
                >
                    <h2 id="admin-application-status-dialog-title">
                        {applicationStatusAction.action.status === "accepted"
                            ? `هل أنت متأكد من قبول طلب ${displayValue(applicationStatusAction.application.applicants?.full_name)}؟`
                            : applicationStatusAction.action.status === "rejected"
                                ? `هل أنت متأكد من رفض طلب ${displayValue(applicationStatusAction.application.applicants?.full_name)}؟`
                                : `هل أنت متأكد من نقل طلب ${displayValue(applicationStatusAction.application.applicants?.full_name)} إلى قيد المراجعة؟`}
                    </h2>
                    <p dir="ltr">{displayValue(applicationStatusAction.application.applicants?.email)}</p>
                    <p>سيتم تغيير حالة الطلب إلى: {applicationStatusAction.action.label}.</p>
                    {applicationStatusActionError && <p className="form-error" role="alert">{applicationStatusActionError}</p>}
                    <div className="admin-remove-dialog__actions">
                        <button type="button" onClick={closeApplicationStatusAction} disabled={isApplicationStatusUpdating}>إلغاء</button>
                        <button
                            type="button"
                            className={applicationStatusAction.action.status === "rejected"
                                ? "admin-remove-dialog__confirm"
                                : "admin-application-status-dialog__confirm"}
                            onClick={submitApplicationStatusAction}
                            disabled={isApplicationStatusUpdating}
                        >
                            {isApplicationStatusUpdating ? "جارٍ الحفظ..." : "تأكيد"}
                        </button>
                    </div>
                </section>
            </div>
        )}
        {aiUserAccessDialog && (
            <div className="admin-remove-dialog-backdrop" role="presentation">
                <section className="admin-remove-dialog admin-ai-user-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-ai-user-dialog-title" dir="rtl">
                    {aiUserAccessDialog.mode === "revoke" ? <>
                        <h2 id="admin-ai-user-dialog-title">إيقاف وصول AI؟</h2>
                        <p>سيتم إيقاف الوصول إلى AI لهذا المستخدم دون حذف حسابه أو سجل استخدامه.</p>
                    </> : <>
                        <h2 id="admin-ai-user-dialog-title">{aiUserAccessDialog.mode === "grant" ? "تفعيل وصول AI" : "تعديل حد رسائل AI"}</h2>
                        <p dir="ltr">{aiUserAccessDialog.account.email}</p>
                        <label className="admin-ai-user-dialog__quota">
                            حد الرسائل
                            <select value={aiUserQuotaChoice} disabled={isAiUserAccessSubmitting} onChange={(event) => setAiUserQuotaChoice(event.target.value)}>
                                <option value="1">1</option><option value="3">3</option><option value="5">5</option><option value="custom">مخصص</option>
                            </select>
                        </label>
                        {aiUserQuotaChoice === "custom" && <label className="admin-ai-user-dialog__quota">
                            الحد المخصص
                            <input type="number" min="1" max="1000" step="1" inputMode="numeric" value={aiUserCustomQuota} disabled={isAiUserAccessSubmitting} onChange={(event) => setAiUserCustomQuota(event.target.value)} />
                        </label>}
                    </>}
                    {aiUserAccessError && <p className="form-error" role="alert">{aiUserAccessError}</p>}
                    <div className="admin-remove-dialog__actions">
                        <button type="button" onClick={closeAiUserAccessDialog} disabled={isAiUserAccessSubmitting}>إلغاء</button>
                        <button type="button" className={aiUserAccessDialog.mode === "revoke" ? "admin-remove-dialog__confirm" : "admin-ai-user-dialog__confirm"} onClick={submitAiUserAccess} disabled={isAiUserAccessSubmitting}>
                            {isAiUserAccessSubmitting ? "جارٍ الحفظ..." : aiUserAccessDialog.mode === "revoke" ? "تأكيد الإيقاف" : "حفظ"}
                        </button>
                    </div>
                </section>
            </div>
        )}
        <CareerFitAssistant aiEnabled getAuthClient={getAdminSupabase} sessionUserId={adminUser.id} />
        </>
    );
}
