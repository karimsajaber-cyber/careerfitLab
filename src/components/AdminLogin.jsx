import { useEffect, useState } from "react";
import { getAdminSupabase } from "../lib/supabase";

export default function AdminLogin({ onAuthenticated }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSessionChecking, setIsSessionChecking] = useState(true);

    useEffect(() => {
        let isActive = true;

        const restoreAdminSession = async () => {
            const adminSupabase = getAdminSupabase();
            if (!adminSupabase) {
                if (isActive) setIsSessionChecking(false);
                return;
            }

            try {
                const { data, error: sessionError } = await adminSupabase.auth.getSession();
                if (sessionError || !data.session?.user) return;

                const { data: isAdmin, error: adminError } = await adminSupabase.rpc("is_admin");
                if (!adminError && isAdmin === true && isActive) {
                    onAuthenticated(data.session.user);
                }
            } finally {
                if (isActive) setIsSessionChecking(false);
            }
        };

        restoreAdminSession();
        return () => {
            isActive = false;
        };
    }, [onAuthenticated]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (isLoading) return;

        setError("");
        setIsLoading(true);

        try {
            const adminSupabase = getAdminSupabase();
            if (!adminSupabase) throw new Error("Supabase is not configured");
            const { data, error: loginError } = await adminSupabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (loginError) {
                throw loginError;
            }

            const { data: isAdmin, error: adminError } = await adminSupabase.rpc("is_admin");

            if (adminError) {
                await adminSupabase.auth.signOut();
                throw adminError;
            }

            if (!isAdmin) {
                await adminSupabase.auth.signOut();
                setError("هذا الحساب غير مخوّل بالدخول إلى لوحة الإدارة.");
                return;
            }

            onAuthenticated(data.user);
        } catch (loginError) {
            console.error("Admin login", loginError);
            setError("تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isSessionChecking) {
        return (
            <main className="admin-login-page">
                <div className="admin-login-card admin-login-card--checking" aria-live="polite">
                    <div className="admin-login-heading">
                        <span>CareerFit Lab</span>
                        <h1>لوحة الإدارة</h1>
                        <p>جارٍ التحقق من صلاحية الدخول.</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="admin-login-page">
            <form className="admin-login-card" onSubmit={handleSubmit}>
                <div className="admin-login-heading">
                    <span>CareerFit Lab</span>
                    <h1>لوحة الإدارة</h1>
                    <p>سجّل الدخول للوصول إلى طلبات المتقدمين.</p>
                </div>

                <label>
                    البريد الإلكتروني
                    <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        required
                    />
                </label>

                <label>

                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                    />
                </label>

                {error && <p className="form-error">{error}</p>}

                <button type="submit" disabled={isLoading}>
                    {isLoading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
                </button>
            </form>
        </main>
    );
}
