import { useEffect, useId, useState } from "react";
import { getUserSupabase } from "../lib/supabase";
import { validateCareerFitPassword } from "../lib/passwordPolicy";

const copy = {
  ar: {
    title: "تحقق من بريدك الإلكتروني للمتابعة",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "name@example.com",
    send: "أرسل رابط تسجيل الدخول",
    applicationEmailIntro: "سنرسل رابط التحقق إلى البريد الإلكتروني الذي أدخلته في طلبك.",
    applicationLookupTitle: "تحقق من حالة طلبك",
    applicationLookupIntro: "أدخل البريد الإلكتروني المستخدم في طلبك. سنرسل رابطاً آمناً لعرض حالة طلبك.",
    checkEmailTitle: "تحقق من بريدك الإلكتروني",
    checkEmail: "أرسلنا لك رابط تسجيل دخول آمن. افتح بريدك الإلكتروني، وافتح رسالة تسجيل الدخول، ثم اضغط Sign in للعودة إلى CareerFit وإكمال العملية.",
    checkEmailNote: "الرابط صالح لمدة 5 دقائق ويمكن استخدامه مرة واحدة فقط.",
    resend: "إعادة إرسال الرابط",
    useDifferentEmail: "استخدم بريداً إلكترونياً مختلفاً",
    cancel: "إلغاء",
    sending: "جارٍ الإرسال...",
    sendError: "تعذر إرسال رابط تسجيل الدخول. حاول مرة أخرى.",
    unavailable: "المصادقة غير متاحة حالياً. حاول مرة أخرى لاحقاً.",
  },
  en: {
    title: "Verify your email to continue",
    emailLabel: "Email address",
    emailPlaceholder: "name@example.com",
    send: "Send sign-in link",
    applicationEmailIntro: "We will send a verification link to the email address entered in your application.",
    applicationLookupTitle: "Check your application",
    applicationLookupIntro: "Enter the email address used in your application. We will send a secure link to view its status.",
    checkEmailTitle: "Check your email",
    checkEmail: "We sent you a secure sign-in link. Open your email, open the sign-in message, then click Sign in to return to CareerFit and continue.",
    checkEmailNote: "The link is valid for 5 minutes and can only be used once.",
    resend: "Resend link",
    useDifferentEmail: "Use a different email",
    cancel: "Cancel",
    sending: "Sending...",
    sendError: "Could not send the sign-in link. Please try again.",
    unavailable: "Authentication is unavailable right now. Please try again later.",
  },
};

const maskEmail = (value) => {
  const [localPart, domain] = value.split("@");
  if (!domain) return value;
  return `${localPart.slice(0, 1)}${"*".repeat(Math.max(1, localPart.length - 1))}@${domain}`;
};

function MagicLinkAuthModal({ isOpen, language = "ar", authOrigin = null, applicationEmail = "", onClose, onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState("email");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const titleId = useId();
  const text = copy[language] || copy.ar;
  const isApplicationAuth = authOrigin === "application";
  const isApplicationLookupAuth = authOrigin === "application-status";
  const displayedEmail = isApplicationAuth ? applicationEmail : email;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isLoading) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, isOpen, onClose]);

  useEffect(() => {
    if (isOpen) return;
    setEmail("");
    setStep("email");
    setError("");
    setIsLoading(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isApplicationAuth) return;
    setEmail(applicationEmail);
    setStep("email");
    setError("");
  }, [applicationEmail, isApplicationAuth, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const userSupabase = getUserSupabase();
    if (!userSupabase) return undefined;

    const { data: authListener } = userSupabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.email_confirmed_at) return;
      onAuthenticated(session.user, "magic-link");
      onClose();
    });

    return () => authListener.subscription.unsubscribe();
  }, [isOpen, onAuthenticated, onClose]);

  if (!isOpen) return null;

  const sendMagicLink = async (event) => {
    event?.preventDefault();
    const userSupabase = getUserSupabase();
    if (!userSupabase || isLoading) {
      setError(text.unavailable);
      return;
    }

    const requestedEmail = isApplicationAuth ? applicationEmail.trim() : email.trim();
    if (!requestedEmail) {
      setError(text.sendError);
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const { error: otpError } = await userSupabase.auth.signInWithOtp({
        email: requestedEmail,
        options: {
          shouldCreateUser: !isApplicationLookupAuth,
          emailRedirectTo: new URL(
            authOrigin === "application" ? "/?application_verified=1" : (authOrigin === "application-status" || authOrigin === "career-profile") ? "/career-profile" : "/",
            window.location.origin,
          ).toString(),
        },
      });
      if (otpError) throw otpError;
      setStep("sent");
    } catch {
      setError(text.sendError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="user-auth-modal-backdrop" role="presentation">
      <section className="user-auth-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} dir={language === "ar" ? "rtl" : "ltr"}>
        <h2 id={titleId}>{step === "email" ? (isApplicationLookupAuth ? text.applicationLookupTitle : text.title) : text.checkEmailTitle}</h2>
        {step === "email" ? (
          <form onSubmit={sendMagicLink}>
            {isApplicationAuth ? (
              <>
                <p>{text.applicationEmailIntro}</p>
                <p className="user-auth-modal__email" dir="ltr">{displayedEmail}</p>
              </>
            ) : (
              <>
                {isApplicationLookupAuth && <p className="user-auth-modal__intro">{text.applicationLookupIntro}</p>}
                <label htmlFor="user-auth-email">{text.emailLabel}</label>
                <input
                  id="user-auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={text.emailPlaceholder}
                  autoComplete="email"
                  required
                />
              </>
            )}
            {error && <p className="user-auth-modal__error" role="alert">{error}</p>}
            <div className="user-auth-modal__actions">
              <button type="button" onClick={onClose} disabled={isLoading}>{text.cancel}</button>
              <button type="submit" disabled={isLoading}>{isLoading ? text.sending : text.send}</button>
            </div>
          </form>
        ) : (
          <div>
            <p>{text.checkEmail}</p>
            <p dir="ltr">{maskEmail(displayedEmail)}</p>
            <p>{text.checkEmailNote}</p>
            {error && <p className="user-auth-modal__error" role="alert">{error}</p>}
            <div className="user-auth-modal__actions">
              <button type="button" onClick={sendMagicLink} disabled={isLoading}>{isLoading ? text.sending : text.resend}</button>
              {!isApplicationAuth && (
                <button type="button" onClick={() => { setStep("email"); setError(""); }} disabled={isLoading}>{text.useDifferentEmail}</button>
              )}
              <button type="button" onClick={onClose} disabled={isLoading}>{text.cancel}</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

const accountCopy = {
  ar: {
    signInTitle: "سجّل الدخول إلى حساب CareerFit",
    signIn: "تسجيل الدخول",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    forgotPassword: "هل نسيت كلمة المرور؟",
    cancel: "إلغاء",
    back: "العودة لتسجيل الدخول",
    sendReset: "إرسال رابط إعادة التعيين",
    resetTitle: "تعيين كلمة مرور جديدة",
    resetIntro: "اختر كلمة مرور جديدة وآمنة لحسابك.",
    resetPassword: "تحديث كلمة المرور",
    signingIn: "جارٍ تسجيل الدخول...",
    sending: "جارٍ الإرسال...",
    updating: "جارٍ تحديث كلمة المرور...",
    credentialsError: "تعذر تسجيل الدخول. تحقق من بريدك الإلكتروني وكلمة المرور.",
    recoveryError: "تعذر إرسال رابط إعادة التعيين. حاول مرة أخرى.",
    resetError: "تعذر تحديث كلمة المرور. حاول مرة أخرى.",
    passwordMismatch: "كلمتا المرور غير متطابقتين.",
    passwordTooShort: "استخدم كلمة مرور من 12 حرفاً على الأقل. يُنصح بعبارة مرور طويلة وفريدة.",
    resetSentTitle: "تحقق من بريدك الإلكتروني",
    resetSent: "إذا كان هناك حساب بهذا البريد، فستتلقى رسالة آمنة لإعادة تعيين كلمة المرور.",
    activationRequired: "لا يمكن تعيين كلمة مرور قبل قبول طلبك.",
    unavailable: "المصادقة غير متاحة حالياً. حاول مرة أخرى لاحقاً.",
  },
  en: {
    signInTitle: "Sign in to your CareerFit account",
    signIn: "Sign in",
    email: "Email address",
    password: "Password",
    confirmPassword: "Confirm password",
    forgotPassword: "Forgot password?",
    cancel: "Cancel",
    back: "Back to sign in",
    sendReset: "Send reset link",
    resetTitle: "Set a new password",
    resetIntro: "Choose a new, secure password for your account.",
    resetPassword: "Update password",
    signingIn: "Signing in...",
    sending: "Sending...",
    updating: "Updating password...",
    credentialsError: "Unable to sign in. Check your email address and password.",
    recoveryError: "Unable to send a password reset link. Please try again.",
    resetError: "Unable to update your password. Please try again.",
    passwordMismatch: "Passwords do not match.",
    passwordTooShort: "Use at least 12 characters. A long, unique passphrase is recommended.",
    resetSentTitle: "Check your email",
    resetSent: "If an account exists for this email, you will receive a secure password reset message.",
    activationRequired: "You cannot set a password until your application is accepted.",
    unavailable: "Authentication is unavailable right now. Please try again later.",
  },
};

function CareerProfileAuthModal({ isOpen, language = "ar", authFlow = "default", onClose, onAuthenticated }) {
  const [step, setStep] = useState("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const titleId = useId();
  const text = accountCopy[language] || accountCopy.ar;

  const clearPasswords = () => {
    setPassword("");
    setPasswordConfirmation("");
  };

  useEffect(() => {
    if (isOpen) return;
    setStep("sign-in");
    setEmail("");
    clearPasswords();
    setError("");
    setNotice("");
    setIsLoading(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (authFlow === "recovery") {
      clearPasswords();
      setError("");
      setNotice("");
      setStep("recovery");
    }
  }, [authFlow, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isLoading) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, isOpen, onClose]);

  if (!isOpen) return null;

  const validateNewPassword = () => {
    if (validateCareerFitPassword(password, passwordConfirmation) === "too_short") {
      setError(text.passwordTooShort);
      return false;
    }
    if (validateCareerFitPassword(password, passwordConfirmation) === "mismatch") {
      setError(text.passwordMismatch);
      return false;
    }
    return true;
  };

  const withAuth = async (work, fallbackError) => {
    const userSupabase = getUserSupabase();
    if (!userSupabase || isLoading) {
      setError(text.unavailable);
      return;
    }
    setError("");
    setNotice("");
    setIsLoading(true);
    try {
      await work(userSupabase);
    } catch {
      clearPasswords();
      setError(fallbackError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    await withAuth(async (userSupabase) => {
      const { data, error: signInError } = await userSupabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError || !data.user?.email_confirmed_at) throw new Error("sign-in failed");
      clearPasswords();
      onAuthenticated(data.user, "password");
      onClose();
    }, text.credentialsError);
  };

  const handleRecoveryRequest = async (event) => {
    event.preventDefault();
    await withAuth(async (userSupabase) => {
      const { error: recoveryError } = await userSupabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: new URL("/career-profile", window.location.origin).toString(),
      });
      if (recoveryError) throw recoveryError;
      setNotice(text.resetSent);
      setStep("recovery-sent");
    }, text.recoveryError);
  };

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    if (!validateNewPassword()) return;
    await withAuth(async (userSupabase) => {
      const { data: reviewStatus, error: reviewStatusError } = await userSupabase.rpc("get_my_application_review_status");
      if (reviewStatusError || reviewStatus !== "accepted") {
        clearPasswords();
        setError(text.activationRequired);
        return;
      }

      const { data, error: updateError } = await userSupabase.auth.updateUser({ password });
      clearPasswords();
      if (updateError || !data.user) throw new Error("password update failed");
      onAuthenticated(data.user, "password");
      onClose();
    }, text.resetError);
  };

  const accountFields = () => <>
    <label htmlFor="career-profile-auth-email">{text.email}
      <input id="career-profile-auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required />
    </label>
    <label htmlFor="career-profile-auth-password">{text.password}
      <input id="career-profile-auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
    </label>
  </>;

  const title = step === "recovery" ? text.resetTitle
    : step === "recovery-sent" ? text.resetSentTitle
      : step === "forgot" ? text.forgotPassword : text.signInTitle;

  return <div className="user-auth-modal-backdrop" role="presentation">
    <section className="user-auth-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} dir={language === "ar" ? "rtl" : "ltr"}>
      <h2 id={titleId}>{title}</h2>
      {step === "sign-in" && <form onSubmit={handleSignIn}>
        {accountFields()}
        {error && <p className="user-auth-modal__error" role="alert">{error}</p>}
        <button className="user-auth-modal__link" type="button" onClick={() => { clearPasswords(); setError(""); setStep("forgot"); }}>{text.forgotPassword}</button>
        <div className="user-auth-modal__actions"><button type="button" onClick={onClose} disabled={isLoading}>{text.cancel}</button><button type="submit" disabled={isLoading}>{isLoading ? text.signingIn : text.signIn}</button></div>
      </form>}
      {step === "forgot" && <form onSubmit={handleRecoveryRequest}>
        <label htmlFor="career-profile-auth-email">{text.email}
          <input id="career-profile-auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required />
        </label>
        {error && <p className="user-auth-modal__error" role="alert">{error}</p>}
        <div className="user-auth-modal__actions"><button type="button" onClick={() => setStep("sign-in")} disabled={isLoading}>{text.back}</button><button type="submit" disabled={isLoading}>{isLoading ? text.sending : text.sendReset}</button></div>
      </form>}
      {step === "recovery-sent" && <div><p className="user-auth-modal__notice" role="status">{notice}</p><div className="user-auth-modal__actions"><button type="button" onClick={onClose}>{text.cancel}</button><button type="button" onClick={() => setStep("sign-in")}>{text.back}</button></div></div>}
      {step === "recovery" && <form onSubmit={handlePasswordUpdate}>
        <p className="user-auth-modal__intro">{text.resetIntro}</p>
        <label htmlFor="career-profile-auth-password">{text.password}
          <input id="career-profile-auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
        </label>
        <label htmlFor="career-profile-auth-password-confirmation">{text.confirmPassword}
          <input id="career-profile-auth-password-confirmation" type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" required />
        </label>
        {error && <p className="user-auth-modal__error" role="alert">{error}</p>}
        <div className="user-auth-modal__actions"><button type="submit" disabled={isLoading}>{isLoading ? text.updating : text.resetPassword}</button></div>
      </form>}
    </section>
  </div>;
}

export default function UserAuthModal(props) {
  return props.authOrigin === "career-profile"
    ? <CareerProfileAuthModal {...props} />
    : <MagicLinkAuthModal {...props} />;
}
