import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminLogin({ onAuthenticated }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (isLoading) return;

        setError("");
        setIsLoading(true);

        try {
            const { data, error: loginError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (loginError) {
                throw loginError;
            }

            const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");

            if (adminError) {
                await supabase.auth.signOut();
                throw adminError;
            }

            if (!isAdmin) {
                await supabase.auth.signOut();
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