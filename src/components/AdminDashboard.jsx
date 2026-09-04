import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminDashboard({ adminUser }) {
    const [applications, setApplications] = useState([]);
    const [expandedApplicationId, setExpandedApplicationId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadApplications = async () => {
            setIsLoading(true);
            setError("");

            const { data, error: loadError } = await supabase
                .from("applications")
                .select(`
            id,
            status,
            motivation,
            target_job_url,
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
        )
        `)
                .order("submitted_at", { ascending: false });

            if (loadError) {
                console.error("Admin applications", loadError);
                setError("تعذر تحميل الطلبات.");
                setIsLoading(false);
                return;
            }

            setApplications(data ?? []);
            setIsLoading(false);
        };

        loadApplications();
    }, []);

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

    const handleViewCv = async (application) => {
    const cv = getCv(application);

    if (!cv?.storage_path) {
        return;
    }

    const previewWindow = window.open("", "_blank");

    const { data, error: cvError } = await supabase.storage
        .from("cvs")
        .createSignedUrl(cv.storage_path, 60);

    if (cvError || !data?.signedUrl) {
        previewWindow?.close();
        console.error("CV signed URL", cvError);
        setError("تعذر فتح السيرة الذاتية.");
        return;
    }

    if (previewWindow) {
        previewWindow.location.href = data.signedUrl;
    } else {
        window.location.href = data.signedUrl;
    }
    };
    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    return (
        <main className="admin-dashboard" dir="rtl">
            <header className="admin-dashboard-header">
                <div>
                    <span>CareerFit Lab</span>
                    <h1>طلبات المتقدمين</h1>
                    <p>{adminUser.email}</p>
                </div>

                <button type="button" onClick={handleLogout}>
                    تسجيل الخروج
                </button>
            </header>

            {isLoading && <p>جارٍ تحميل الطلبات...</p>}

            {error && <p className="form-error">{error}</p>}

            {!isLoading && !error && applications.length === 0 && (
                <p>لا توجد طلبات حتى الآن.</p>
            )}

            {!isLoading && applications.length > 0 && (
                <div className="admin-applications-list">
                    {applications.map((application) => {
                        const profile = getProfile(application);
                        const isExpanded = expandedApplicationId === application.id;

                        return (
                            <article
                                className={`admin-application-card ${isExpanded ? "expanded" : ""}`}
                                key={application.id}
                            >
                                <div className="admin-card-summary">
                                    <div className="admin-card-person">
                                        <div className="admin-card-avatar">
                                            {(application.applicants?.full_name || "?").charAt(0).toUpperCase()}
                                        </div>

                                        <div>
                                            <h2>{application.applicants?.full_name || "بدون اسم"}</h2>
                                            <p>{application.applicants?.email}</p>
                                            <p>{application.applicants?.phone}</p>
                                        </div>
                                    </div>

                                    <div className="admin-card-meta">
                                        <span className="admin-status-badge">
                                            {application.status === "submitted" ? "طلب جديد" : application.status}
                                        </span>

                                        <span>
                                            {new Date(application.submitted_at).toLocaleDateString("ar")}
                                        </span>

                                        <button
                                            className={`admin-expand-button ${isExpanded ? "open" : ""}`}
                                            type="button"
                                            aria-expanded={isExpanded}
                                            aria-label={isExpanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                                            onClick={() =>
                                                setExpandedApplicationId((current) =>
                                                    current === application.id ? null : application.id
                                                )
                                            }
                                        >
                                            ↓
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="admin-card-expanded">
                                        <div className="admin-profile-details">
                                            <div>
                                                <span>الجامعة / المؤسسة</span>
                                                <strong>{profile?.institution || "غير محدد"}</strong>
                                            </div>

                                            <div>
                                                <span>التخصص</span>
                                                <strong>{profile?.major || "غير محدد"}</strong>
                                            </div>

                                            <div>
                                                <span>سنة التخرج</span>
                                                <strong>{profile?.graduation_year || "غير محدد"}</strong>
                                            </div>

                                            <div>
                                                <span>الوضع الحالي</span>
                                                <strong>
                                                    {statusLabels[profile?.current_status] ||
                                                        profile?.current_status ||
                                                        "غير محدد"}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>الدور المستهدف</span>
                                                <strong>{profile?.target_role || "غير محدد"}</strong>
                                            </div>

                                            <div>
                                                <span>القطاع المستهدف</span>
                                                <strong>{profile?.target_industry || "غير محدد"}</strong>
                                            </div>

                                            <div className="admin-detail-wide">
                                                <span>المجالات المهنية</span>
                                                <strong>{formatTargetFields(profile?.target_fields)}</strong>
                                            </div>

                                            <div>
                                                <span>مستوى الإنجليزية</span>
                                                <strong>
                                                    {englishLabels[profile?.english_level] ||
                                                        profile?.english_level ||
                                                        "غير محدد"}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>التوفر</span>
                                                <strong>{profile?.availability || "غير محدد"}</strong>
                                            </div>

                                            <div className="admin-detail-wide">
                                                <span>الهدف المهني</span>
                                                <strong>
                                                    {careerGoalLabels[profile?.career_goal] ||
                                                        profile?.career_goal ||
                                                        "غير محدد"}
                                                </strong>
                                            </div>

                                            <div className="admin-detail-wide">
                                                <span>ملخص الوضع الحالي</span>
                                                <strong>{profile?.current_profile_summary || "غير محدد"}</strong>
                                            </div>

                                            <div className="admin-detail-wide">
                                                <span>LinkedIn</span>
                                                <strong>{profile?.linkedin_url || "غير محدد"}</strong>
                                            </div>
                                        </div>
                                        <div className="admin-cv-section">
                                            {getCv(application) ? (
                                                <>
                                                <div>
                                                    <span>السيرة الذاتية</span>
                                                    <strong>{getCv(application)?.original_filename}</strong>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleViewCv(application)}
                                                >
                                                    عرض CV
                                                </button>
                                                </>
                                            ) : (
                                                <span>لم يتم إرفاق سيرة ذاتية</span>
                                            )}
                                            </div>
                                        <div className="admin-application-footer">
                                            <div>
                                                <span>سبب التقديم</span>
                                                <p>{application.motivation || "غير محدد"}</p>
                                            </div>

                                            <div className="admin-reference">
                                                <span>رقم الطلب</span>
                                                <strong>{application.id}</strong>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </main>
    );
}