import { useEffect, useId, useRef, useState } from "react";
import { careerFitAssistantContent } from "../data/careerFitAssistantContent";
import { getUserSupabase } from "../lib/supabase";
import { useUserAuth } from "./UserAuthProvider";

const initialMessages = [{ type: "assistant", id: "welcome" }];
const guideOrder = ["situation", "challenge", "target"];
const primaryActionIds = ["fit", "apply", "gain"];
const MAX_AI_HISTORY_MESSAGES = 6;
const MAX_AI_HISTORY_CONTENT_LENGTH = 1000;
let assistantWasOpen = false;

const normalizeIntentText = (value) => value
  .toLowerCase()
  .replace(/[\u064B-\u065F\u0670]/g, "")
  .replace(/[إأآ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .replace(/[^\p{L}\p{N}+]+/gu, " ")
  .trim();

const matchIntent = (value, content) => {
  const normalizedValue = normalizeIntentText(value);
  return content.intents.find((intent) => intent.terms.some(
    (term) => normalizedValue.includes(normalizeIntentText(term)),
  ))?.id || null;
};

export default function CareerFitAssistant({
  language = "ar",
  isOpen,
  onOpenChange,
  aiEnabled = false,
  isAuthenticated = false,
  onAuthenticationRequired,
  getAuthClient = getUserSupabase,
  sessionUserId,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAiPending, setIsAiPending] = useState(false);
  const [aiAccessUnavailable, setAiAccessUnavailable] = useState(false);
  const [remainingMessages, setRemainingMessages] = useState(null);
  const [aiAccessRequestStatus, setAiAccessRequestStatus] = useState(null);
  const [isAiAccessRequestLoading, setIsAiAccessRequestLoading] = useState(false);
  const [isAiAccessRequestSubmitting, setIsAiAccessRequestSubmitting] = useState(false);
  const [aiAccessRequestError, setAiAccessRequestError] = useState("");
  const [aiAccessRequestSubmitted, setAiAccessRequestSubmitted] = useState(false);
  const [conversationOwnerUserId, setConversationOwnerUserId] = useState(null);
  const content = careerFitAssistantContent[language] || careerFitAssistantContent.ar;
  const { user: authenticatedUser, requestAuthentication, consumeAiAuthRequestOrigin, signOut } = useUserAuth();
  const [signOutError, setSignOutError] = useState("");
  const panelId = useId();
  const launcherRef = useRef(null);
  const messagesRef = useRef(null);
  const aiHistoryRef = useRef([]);
  const aiRequestIdRef = useRef(0);
  const isAiPendingRef = useRef(false);
  const isArabic = language === "ar";
  const authenticatedUserId = sessionUserId ?? authenticatedUser?.id ?? null;
  const isConversationForCurrentUser = conversationOwnerUserId === authenticatedUserId;
  const visibleMessages = isConversationForCurrentUser ? messages : initialMessages;
  const visibleDraft = isConversationForCurrentUser ? draft : "";
  const hasVisibleInteraction = isConversationForCurrentUser && hasInteracted;
  const hasAuthenticatedSession = isAuthenticated || Boolean(authenticatedUserId);
  const requestUserAuthentication = onAuthenticationRequired || (() => requestAuthentication(language, "assistant"));
  const authCopy = isArabic
    ? {
      sessionRequired: "تحقق من بريدك الإلكتروني للمتابعة.",
      accessUnavailable: "الوصول إلى مساعد الذكاء الاصطناعي غير متاح لحسابك حالياً.",
      testingNotice: "الوصول إلى المساعد محدود خلال الاختبار. اطرح أسئلة واضحة ومركزة للاستفادة من رسائلك المتاحة.",
      remaining: (count) => `الرسائل المتبقية: ${count}`,
      signOut: "تسجيل الخروج",
      signOutError: "تعذر تسجيل الخروج حالياً. حاول مرة أخرى.",
      requestAccess: "اطلب الوصول إلى مساعد الذكاء الاصطناعي",
      requestSubmitting: "جارٍ إرسال الطلب...",
      requestPending: "طلب الوصول الخاص بك قيد المراجعة.",
      requestSubmitted: "تم إرسال طلب الوصول إلى المساعد الذكي. طلبك قيد المراجعة.",
      requestRejected: "لم تتم الموافقة على طلب الوصول السابق.",
      requestError: "تعذر إرسال طلب الوصول حالياً. حاول مرة أخرى.",
    }
    : {
      sessionRequired: "Verify your email to continue.",
      accessUnavailable: "AI access is currently unavailable for your account.",
      testingNotice: "AI access is limited during testing. Ask clear, focused questions to make the most of your available messages.",
      remaining: (count) => `${count} questions remaining`,
      signOut: "Sign out",
      signOutError: "Unable to sign out right now. Please try again.",
      requestAccess: "Request AI Access",
      requestSubmitting: "Sending request...",
      requestPending: "Your access request is pending approval.",
      requestSubmitted: "Your AI access request has been submitted and is pending review.",
      requestRejected: "Your previous access request was not approved.",
      requestError: "Unable to send your access request right now. Please try again.",
    };
  const panelIsOpen = (typeof isOpen === "boolean" ? isOpen : uncontrolledOpen) || assistantWasOpen;
  const setPanelOpen = onOpenChange || setUncontrolledOpen;

  useEffect(() => {
    if (panelIsOpen && messagesRef.current) {
      const latestMessage = messagesRef.current.lastElementChild;
      messagesRef.current.scrollTop = latestMessage ? latestMessage.offsetTop : 0;
    }
  }, [panelIsOpen, messages, isAiPending]);

  useEffect(() => () => {
    aiRequestIdRef.current += 1;
    isAiPendingRef.current = false;
    if (assistantWasOpen) {
      window.sessionStorage.setItem("careerfit-assistant-restore-open", "true");
    }
  }, []);

  useEffect(() => {
    aiHistoryRef.current = [];
    aiRequestIdRef.current += 1;
    isAiPendingRef.current = false;
    setIsAiPending(false);
    setAiAccessUnavailable(false);
    setRemainingMessages(null);
    setAiAccessRequestStatus(null);
    setIsAiAccessRequestLoading(false);
    setIsAiAccessRequestSubmitting(false);
    setAiAccessRequestError("");
    setAiAccessRequestSubmitted(false);
    setMessages(initialMessages);
    setDraft("");
    setHasInteracted(false);
    setSuggestionsOpen(false);
    setIsExpanded(false);
    setSignOutError("");
    setConversationOwnerUserId(authenticatedUserId);
  }, [authenticatedUserId]);

  useEffect(() => {
    if (aiEnabled || !authenticatedUser?.id) {
      setAiAccessRequestStatus(null);
      setIsAiAccessRequestLoading(false);
      return undefined;
    }

    let isActive = true;
    const loadAccessRequest = async () => {
      setIsAiAccessRequestLoading(true);
      setAiAccessRequestError("");

      try {
        const userSupabase = getUserSupabase();
        if (!userSupabase) return;

        const { data, error } = await userSupabase.rpc("get_my_ai_access_request");
        if (error || !isActive) return;

        const request = Array.isArray(data) ? data[0] : data;
        const requestStatus = typeof request?.status === "string" ? request.status : null;
        setAiAccessRequestStatus(requestStatus);

        const hasExistingAccess = requestStatus === "approved" || requestStatus === "granted";
        if (!consumeAiAuthRequestOrigin() || requestStatus === "pending" || hasExistingAccess) return;

        setIsAiAccessRequestSubmitting(true);
        try {
          const { data: submittedData, error: submitError } = await userSupabase.rpc("request_ai_access", {
            p_request_note: null,
          });
          if (submitError) throw submitError;
          if (!isActive) return;

          const submittedRequest = Array.isArray(submittedData) ? submittedData[0] : submittedData;
          setAiAccessRequestStatus(typeof submittedRequest?.status === "string" ? submittedRequest.status : "pending");
          setAiAccessRequestSubmitted(true);
        } catch {
          if (isActive) setAiAccessRequestError(authCopy.requestError);
        } finally {
          if (isActive) setIsAiAccessRequestSubmitting(false);
        }
      } finally {
        if (isActive) setIsAiAccessRequestLoading(false);
      }
    };

    loadAccessRequest();
    return () => {
      isActive = false;
    };
  }, [aiEnabled, authenticatedUser?.id]);

  const resetAiConversation = () => {
    aiHistoryRef.current = [];
    aiRequestIdRef.current += 1;
    isAiPendingRef.current = false;
    setIsAiPending(false);
  };

  const handleUserSignOut = async () => {
    setSignOutError("");
    const didSignOut = await signOut();
    if (!didSignOut) setSignOutError(authCopy.signOutError);
  };

  const requestAiAccess = async () => {
    if (aiEnabled || !authenticatedUser?.id || isAiAccessRequestSubmitting || aiAccessRequestStatus === "pending") {
      return;
    }

    setAiAccessRequestError("");
    setIsAiAccessRequestSubmitting(true);

    try {
      const userSupabase = getUserSupabase();
      if (!userSupabase) throw new Error("Supabase is not configured");

      const { data, error } = await userSupabase.rpc("request_ai_access", { p_request_note: null });
      if (error) throw error;

      const request = Array.isArray(data) ? data[0] : data;
      setAiAccessRequestStatus(typeof request?.status === "string" ? request.status : "pending");
      setAiAccessRequestSubmitted(true);
    } catch {
      setAiAccessRequestError(authCopy.requestError);
    } finally {
      setIsAiAccessRequestSubmitting(false);
    }
  };

  const closeAssistant = () => {
    assistantWasOpen = false;
    resetAiConversation();
    setMessages(initialMessages);
    setHasInteracted(false);
    setSuggestionsOpen(false);
    setIsExpanded(false);
    setPanelOpen(false);
    launcherRef.current?.focus();
  };

  const toggleAssistant = () => {
    if (panelIsOpen) {
      closeAssistant();
      return;
    }

    setMessages(initialMessages);
    resetAiConversation();
    setHasInteracted(false);
    setSuggestionsOpen(false);
    setIsExpanded(false);
    assistantWasOpen = true;
    setPanelOpen(true);
  };

  const navigateTo = (target) => {
    const section = document.getElementById(target);
    if (!section) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  const responseForAction = (actionId, text = "") => {
    if (actionId === "fit") return { type: "flow", flowId: "fitSituation", context: {} };
    if (actionId === "interview") return { type: "flow", flowId: "interviewConcern", context: {} };
    if (actionId === "direction") return { type: "flow", flowId: "directionSituation", context: {} };

    if (actionId === "cv" && text) {
      const normalizedText = normalizeIntentText(text);
      if (content.cvIntentTerms.outdated.some((term) => normalizedText.includes(normalizeIntentText(term)))) {
        return { type: "assistant", id: "cvOutdated" };
      }
      if (content.cvIntentTerms.quality.some((term) => normalizedText.includes(normalizeIntentText(term)))) {
        return { type: "assistant", id: "cvGood" };
      }
    }

    if (actionId === "contact") return { type: "contact" };
    return { type: "assistant", id: actionId };
  };

  const handleQuickAction = (actionId) => {
    const response = responseForAction(actionId);
    setMessages((currentMessages) => [
      ...currentMessages,
      { type: "visitor", id: actionId },
      response,
    ]);
    setHasInteracted(true);
    setSuggestionsOpen(false);
  };

  const handleFlowOption = (flowId, optionId, context = {}) => {
    const flow = content.flows[flowId];
    const nextContext = flow.contextKey ? { ...context, [flow.contextKey]: optionId } : context;
    const nextMessage = flow.nextFlow
      ? { type: "flow", flowId: flow.nextFlow, context: nextContext }
      : { type: "flow-response", flowId, optionId, context: nextContext };

    setMessages((currentMessages) => [
      ...currentMessages,
      { type: "visitor-flow", flowId, optionId },
      nextMessage,
    ]);
  };

  const handleGuideOption = (questionId, optionId) => {
    const questionIndex = guideOrder.indexOf(questionId);
    const nextQuestion = guideOrder[questionIndex + 1];
    const nextMessage = nextQuestion
      ? { type: "guide", id: nextQuestion }
      : { type: "recommendation", id: optionId };

    setMessages((currentMessages) => [
      ...currentMessages,
      { type: "visitor-guide", questionId, optionId },
      nextMessage,
    ]);
  };

  const appendDeterministicReply = (text, includeVisitor = true) => {
    const intent = matchIntent(text, content);
    const response = intent ? responseForAction(intent, text) : { type: "assistant", id: "fallback" };

    setMessages((currentMessages) => [
      ...currentMessages,
      ...(includeVisitor ? [{ type: "visitor-text", text }] : []),
      response,
    ]);
  };

  const addAiHistoryMessage = (role, text) => {
    const contentText = text.trim().slice(0, MAX_AI_HISTORY_CONTENT_LENGTH);
    if (!contentText) return;

    aiHistoryRef.current = [
      ...aiHistoryRef.current,
      { role, content: contentText },
    ].slice(-MAX_AI_HISTORY_MESSAGES);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isAiPendingRef.current) return;

    if (!aiEnabled && !hasAuthenticatedSession && requestUserAuthentication) {
      requestUserAuthentication();
      return;
    }

    setDraft("");
    setHasInteracted(true);
    setSuggestionsOpen(false);

    if (!aiEnabled && !hasAuthenticatedSession) {
      appendDeterministicReply(text);
      return;
    }

    if (aiAccessUnavailable) {
      setMessages((currentMessages) => [
        ...currentMessages,
        { type: "visitor-text", text },
        { type: "assistant-text", text: authCopy.accessUnavailable },
      ]);
      return;
    }

    if (!aiEnabled && aiAccessRequestStatus === "pending") {
      setMessages((currentMessages) => [
        ...currentMessages,
        { type: "visitor-text", text },
        { type: "assistant-text", text: authCopy.requestPending },
      ]);
      return;
    }

    const authClient = getAuthClient();
    if (!authClient) {
      appendDeterministicReply(text);
      return;
    }

    const { data: sessionData } = await authClient.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setDraft(text);
      requestUserAuthentication?.();
      return;
    }

    setMessages((currentMessages) => [...currentMessages, { type: "visitor-text", text }]);
    setConversationOwnerUserId(authenticatedUserId);
    const requestId = aiRequestIdRef.current + 1;
    aiRequestIdRef.current = requestId;
    isAiPendingRef.current = true;
    setIsAiPending(true);

    try {
      const { data, error } = await authClient.functions.invoke("careerfit-assistant", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          message: text,
          language,
          history: aiHistoryRef.current.slice(-MAX_AI_HISTORY_MESSAGES),
        },
      });
      const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
      const responseStatus = error?.context?.status;
      const responseError = typeof data?.error === "string" ? data.error : "";

      if (responseStatus === 401 || responseError === "unauthorized") {
        if (requestId === aiRequestIdRef.current) {
          setMessages((currentMessages) => [
            ...currentMessages,
            { type: "assistant-text", text: authCopy.sessionRequired },
          ]);
          requestUserAuthentication?.();
        }
        return;
      }

      if (responseStatus === 403 || responseError === "ai_access_unavailable") {
        if (requestId === aiRequestIdRef.current) {
          setAiAccessUnavailable(true);
          setMessages((currentMessages) => [
            ...currentMessages,
            { type: "assistant-text", text: authCopy.accessUnavailable },
          ]);
        }
        return;
      }

      if (error || data?.ok !== true || !reply) throw new Error("AI response unavailable");
      if (requestId !== aiRequestIdRef.current) return;

      setMessages((currentMessages) => [...currentMessages, { type: "assistant-text", text: reply }]);
      addAiHistoryMessage("user", text);
      addAiHistoryMessage("assistant", reply);
      setAiAccessUnavailable(false);
      setRemainingMessages(typeof data.remainingMessages === "number" ? data.remainingMessages : null);
    } catch {
      if (requestId === aiRequestIdRef.current) appendDeterministicReply(text, false);
    } finally {
      if (requestId === aiRequestIdRef.current) {
        isAiPendingRef.current = false;
        setIsAiPending(false);
      }
    }
  };

  const renderCta = (cta) => (
    <button type="button" className="careerfit-assistant__message-action" onClick={() => navigateTo(cta.target)}>
      {cta.label}
    </button>
  );

  const renderMessage = (message, index) => {
    if (message.type === "flow") {
      const flow = content.flows[message.flowId];
      const isAnswered = messages.some(
        (item, itemIndex) => itemIndex > index && item.type === "visitor-flow" && item.flowId === message.flowId,
      );
      return (
        <article className="careerfit-assistant__message careerfit-assistant__message--assistant" key={`flow-${message.flowId}-${index}`}>
          <span className="careerfit-assistant__message-label">{content.assistantLabel}</span>
          <p>{flow.prompt}</p>
          {!isAnswered ? <div className="careerfit-assistant__guide-options">
            {flow.options.map((option) => (
              <button type="button" key={option.id} onClick={() => handleFlowOption(message.flowId, option.id, message.context)}>
                {option.label}
              </button>
            ))}
          </div> : null}
        </article>
      );
    }

    if (message.type === "visitor-flow") {
      const option = content.flows[message.flowId].options.find((item) => item.id === message.optionId);
      return (
        <article className="careerfit-assistant__message careerfit-assistant__message--visitor" key={`flow-answer-${message.flowId}-${index}`}>
          <span className="careerfit-assistant__message-label">{content.youLabel}</span>
          <p>{option.label}</p>
        </article>
      );
    }

    if (message.type === "flow-response") {
      const response = content.flows[message.flowId].responses[message.optionId];
      const paragraphs = response.contextLines
        ? [response.contextLines[message.context.situation], ...response.body]
        : response.body;
      return (
        <article className="careerfit-assistant__message careerfit-assistant__message--assistant" key={`flow-response-${message.flowId}-${index}`}>
          <span className="careerfit-assistant__message-label">{content.assistantLabel}</span>
          {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {response.cta ? renderCta(response.cta) : null}
        </article>
      );
    }

    if (message.type === "guide") {
      const question = content.guide.questions[message.id];
      const isAnswered = messages.some(
        (item, itemIndex) => itemIndex > index && item.type === "visitor-guide" && item.questionId === message.id,
      );
      return (
        <article className="careerfit-assistant__message careerfit-assistant__message--assistant" key={`guide-${message.id}-${index}`}>
          <span className="careerfit-assistant__message-label">{content.assistantLabel}</span>
          <p>{question.prompt}</p>
          {!isAnswered ? <div className="careerfit-assistant__guide-options">
            {question.options.map((option) => (
              <button type="button" key={option.id} onClick={() => handleGuideOption(message.id, option.id)}>
                {option.label}
              </button>
            ))}
          </div> : null}
        </article>
      );
    }

    if (message.type === "visitor-guide") {
      const option = content.guide.questions[message.questionId].options.find((item) => item.id === message.optionId);
      return (
        <article className="careerfit-assistant__message careerfit-assistant__message--visitor" key={`guide-answer-${message.questionId}-${index}`}>
          <span className="careerfit-assistant__message-label">{content.youLabel}</span>
          <p>{option.label}</p>
        </article>
      );
    }

    if (message.type === "visitor-text") {
      return (
        <article className="careerfit-assistant__message careerfit-assistant__message--visitor" key={`text-${index}`}>
          <span className="careerfit-assistant__message-label">{content.youLabel}</span>
          <p>{message.text}</p>
        </article>
      );
    }

    if (message.type === "assistant-text") {
      return (
        <article className="careerfit-assistant__message careerfit-assistant__message--assistant" key={`assistant-text-${index}`}>
          <span className="careerfit-assistant__message-label">{content.assistantLabel}</span>
          <p>{message.text}</p>
        </article>
      );
    }

    if (message.type === "recommendation") {
      const recommendation = content.guide.recommendations[message.id];
      return (
        <article className="careerfit-assistant__message careerfit-assistant__message--assistant" key={`recommendation-${message.id}-${index}`}>
          <span className="careerfit-assistant__message-label">{content.assistantLabel}</span>
          <p>{recommendation.body}</p>
          {renderCta(recommendation.cta)}
        </article>
      );
    }

    if (message.type === "contact") {
      return (
        <article className="careerfit-assistant__message careerfit-assistant__message--contact" key={`contact-${index}`}>
          <strong>{content.contact.title}</strong>
          <p>{content.contact.body}</p>
          <span className="careerfit-assistant__contact-name">{content.contact.name}</span>
          <dl>
            <div><dt>{content.contact.emailText}</dt><dd dir="ltr">{content.contact.email}</dd></div>
            <div><dt>{content.contact.whatsappText}</dt><dd dir="ltr">{content.contact.phone}</dd></div>
          </dl>
          <div className="careerfit-assistant__contact-actions">
            <a href={`mailto:${content.contact.email}`} aria-label={`${content.contact.emailLabel}: ${content.contact.email}`}>{content.contact.emailLabel}</a>
            <a href={content.contact.whatsappUrl} target="_blank" rel="noreferrer" aria-label={`${content.contact.whatsappLabel}: ${content.contact.phone}`}>{content.contact.whatsappLabel}</a>
          </div>
        </article>
      );
    }

    const action = content.actions.find((item) => item.id === message.id);
    const messageContent = message.type === "visitor" ? action : content.messages[message.id];
    return (
      <article className={`careerfit-assistant__message careerfit-assistant__message--${message.type}`} key={`${message.type}-${message.id}-${index}`}>
        <span className="careerfit-assistant__message-label">
          {message.type === "visitor" ? content.youLabel : content.assistantLabel}
        </span>
        {message.type === "visitor" ? <p>{messageContent.label}</p> : null}
        {message.type === "assistant" ? messageContent.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>) : null}
        {message.type === "assistant" && messageContent.cta ? renderCta(messageContent.cta) : null}
      </article>
    );
  };

  const primaryActions = content.actions.filter((action) => primaryActionIds.includes(action.id));
  const secondaryActions = content.actions.filter((action) => !primaryActionIds.includes(action.id));
  const visibleMenuActions = hasVisibleInteraction ? content.actions : secondaryActions;
  const showAiAccessRequest = !aiEnabled
    && Boolean(authenticatedUser?.id)
    && !isAiAccessRequestLoading
    && aiAccessRequestStatus !== "pending"
    && aiAccessRequestStatus !== "approved"
    && aiAccessRequestStatus !== "granted";

  return (
    <div className={`careerfit-assistant ${panelIsOpen ? "is-open" : "is-closed"} ${isExpanded ? "is-expanded" : ""}`} dir={isArabic ? "rtl" : "ltr"} lang={isArabic ? "ar" : "en"}>
      {panelIsOpen ? (
        <>
          {isExpanded ? <div className="careerfit-assistant__backdrop" aria-hidden="true" /> : null}
          <section className="careerfit-assistant__panel" id={panelId} aria-label={content.title}>
          <div className="careerfit-assistant__panel-head">
            <div className="careerfit-assistant__title-block"><strong>{content.title}</strong><span>{content.subtitle}</span></div>
            <div className="careerfit-assistant__panel-controls">
              <button type="button" className="careerfit-assistant__expand-toggle" onClick={() => setIsExpanded((expanded) => !expanded)} aria-label={isExpanded ? content.minimizeLabel : content.expandLabel} title={isExpanded ? content.minimizeLabel : content.expandLabel}>
                <span aria-hidden="true">{isExpanded ? "−" : "↗"}</span>
              </button>
              <button type="button" className="careerfit-assistant__close" onClick={closeAssistant} aria-label={content.closeLabel}><span aria-hidden="true">×</span></button>
            </div>
          </div>
          <div className="careerfit-assistant__messages" ref={messagesRef} aria-label={content.messagesLabel} aria-live="polite">
            {visibleMessages.map(renderMessage)}
            {isConversationForCurrentUser && (aiEnabled || hasAuthenticatedSession) && isAiPending ? (
              <article
                className="careerfit-assistant__message careerfit-assistant__message--assistant careerfit-assistant__typing"
                aria-label={content.assistantLabel}
              >
                <span className="careerfit-assistant__message-label">{content.assistantLabel}</span>
                <span className="careerfit-assistant__typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </article>
            ) : null}
          </div>
          <div className={`careerfit-assistant__quick-actions ${hasVisibleInteraction ? "is-compact" : ""}`} aria-label={content.quickActionsLabel}>
            {!hasVisibleInteraction ? <div className="careerfit-assistant__primary-suggestions">
              {primaryActions.map((action) => <button type="button" key={action.id} onClick={() => handleQuickAction(action.id)}>{action.label}</button>)}
              <button type="button" className="careerfit-assistant__suggestion-toggle" onClick={() => setSuggestionsOpen((open) => !open)} aria-expanded={suggestionsOpen}>
                {content.moreLabel}
              </button>
            </div> : <button type="button" className="careerfit-assistant__suggestion-toggle" onClick={() => setSuggestionsOpen((open) => !open)} aria-expanded={suggestionsOpen}>
              {content.suggestionsLabel}
            </button>}
            {isConversationForCurrentUser && suggestionsOpen ? <div className="careerfit-assistant__suggestion-menu">
              {visibleMenuActions.map((action) => <button type="button" key={action.id} onClick={() => handleQuickAction(action.id)}>{action.label}</button>)}
            </div> : null}
          </div>
          <form className="careerfit-assistant__composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor={`${panelId}-input`}>{content.inputLabel}</label>
            <input id={`${panelId}-input`} type="text" value={visibleDraft} onChange={(event) => setDraft(event.target.value)} placeholder={content.inputPlaceholder} maxLength={1000} />
            <button type="submit" disabled={!visibleDraft.trim() || isAiPending}>{content.sendLabel}</button>
          </form>
          <div className="careerfit-assistant__composer-meta" aria-live="polite">
            <span dir="ltr">{visibleDraft.length} / 1000</span>
            {!aiEnabled && hasAuthenticatedSession ? <span>{authCopy.testingNotice}</span> : null}
            {!aiEnabled && hasAuthenticatedSession && remainingMessages !== null ? <span>{authCopy.remaining(remainingMessages)}</span> : null}
            {!aiEnabled && authenticatedUser?.id && aiAccessRequestStatus === "pending" ? <span>{aiAccessRequestSubmitted ? authCopy.requestSubmitted : authCopy.requestPending}</span> : null}
            {!aiEnabled && authenticatedUser?.id && aiAccessRequestStatus === "rejected" ? <span>{authCopy.requestRejected}</span> : null}
            {showAiAccessRequest ? <button type="button" className="careerfit-assistant__access-request" onClick={requestAiAccess} disabled={isAiAccessRequestSubmitting}>{isAiAccessRequestSubmitting ? authCopy.requestSubmitting : authCopy.requestAccess}</button> : null}
            {aiAccessRequestError ? <span className="careerfit-assistant__access-request-error">{aiAccessRequestError}</span> : null}
            {!aiEnabled && hasAuthenticatedSession ? <button type="button" className="careerfit-assistant__sign-out" onClick={handleUserSignOut}>{authCopy.signOut}</button> : null}
            {signOutError ? <span className="careerfit-assistant__sign-out-error">{signOutError}</span> : null}
          </div>
          </section>
        </>
      ) : null}
      <button type="button" className="careerfit-assistant__launcher" ref={launcherRef} onClick={toggleAssistant} aria-expanded={panelIsOpen} aria-controls={panelId} aria-label={content.launcherLabel}>
        <span className="careerfit-assistant__launcher-core" aria-hidden="true">CF</span>
        <span className="careerfit-assistant__launcher-text">{content.launcherText}</span>
      </button>
    </div>
  );
}
