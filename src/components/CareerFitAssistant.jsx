import { useEffect, useId, useRef, useState } from "react";
import { careerFitAssistantContent } from "../data/careerFitAssistantContent";

const initialMessages = [{ type: "assistant", id: "welcome" }];
const guideOrder = ["situation", "challenge", "target"];
const primaryActionIds = ["fit", "apply", "gain"];
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

export default function CareerFitAssistant({ language = "ar", isOpen, onOpenChange }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const content = careerFitAssistantContent[language] || careerFitAssistantContent.ar;
  const panelId = useId();
  const launcherRef = useRef(null);
  const messagesRef = useRef(null);
  const isArabic = language === "ar";
  const panelIsOpen = (typeof isOpen === "boolean" ? isOpen : uncontrolledOpen) || assistantWasOpen;
  const setPanelOpen = onOpenChange || setUncontrolledOpen;

  useEffect(() => {
    if (panelIsOpen && messagesRef.current) {
      const latestMessage = messagesRef.current.lastElementChild;
      messagesRef.current.scrollTop = latestMessage ? latestMessage.offsetTop : 0;
    }
  }, [panelIsOpen, messages]);

  useEffect(() => () => {
    if (assistantWasOpen) {
      window.sessionStorage.setItem("careerfit-assistant-restore-open", "true");
    }
  }, []);

  const closeAssistant = () => {
    assistantWasOpen = false;
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

  const handleSubmit = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const intent = matchIntent(text, content);
    const response = intent ? responseForAction(intent, text) : { type: "assistant", id: "fallback" };
    setMessages((currentMessages) => [
      ...currentMessages,
      { type: "visitor-text", text },
      response,
    ]);
    setDraft("");
    setHasInteracted(true);
    setSuggestionsOpen(false);
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
  const visibleMenuActions = hasInteracted ? content.actions : secondaryActions;

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
            {messages.map(renderMessage)}
          </div>
          <div className={`careerfit-assistant__quick-actions ${hasInteracted ? "is-compact" : ""}`} aria-label={content.quickActionsLabel}>
            {!hasInteracted ? <div className="careerfit-assistant__primary-suggestions">
              {primaryActions.map((action) => <button type="button" key={action.id} onClick={() => handleQuickAction(action.id)}>{action.label}</button>)}
              <button type="button" className="careerfit-assistant__suggestion-toggle" onClick={() => setSuggestionsOpen((open) => !open)} aria-expanded={suggestionsOpen}>
                {content.moreLabel}
              </button>
            </div> : <button type="button" className="careerfit-assistant__suggestion-toggle" onClick={() => setSuggestionsOpen((open) => !open)} aria-expanded={suggestionsOpen}>
              {content.suggestionsLabel}
            </button>}
            {suggestionsOpen ? <div className="careerfit-assistant__suggestion-menu">
              {visibleMenuActions.map((action) => <button type="button" key={action.id} onClick={() => handleQuickAction(action.id)}>{action.label}</button>)}
            </div> : null}
          </div>
          <form className="careerfit-assistant__composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor={`${panelId}-input`}>{content.inputLabel}</label>
            <input id={`${panelId}-input`} type="text" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={content.inputPlaceholder} />
            <button type="submit" disabled={!draft.trim()}>{content.sendLabel}</button>
          </form>
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
