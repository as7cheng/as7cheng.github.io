import { FormEvent, useEffect, useRef, useState } from "react";

const turnstileSiteKey = import.meta.env.DEV
  ? "1x00000000000000000000AA"
  : import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAAD9QRZr8_foFWHzw";

type SubmitState = "idle" | "submitting" | "success" | "error";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "light";
      size: "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function TurnstileWidget({
  onToken,
  resetSignal,
}: {
  onToken: (token: string) => void;
  resetSignal: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const scriptId = "cloudflare-turnstile";

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) {
        return;
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: turnstileSiteKey,
        theme: "light",
        size: "flexible",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (window.turnstile) {
      renderWidget();
    } else if (existingScript) {
      existingScript.addEventListener("load", renderWidget);
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderWidget);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      existingScript?.removeEventListener("load", renderWidget);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onToken]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  return <div className="turnstile-widget" ref={containerRef} />;
}

export default function PhotographyPage() {
  const [contactOpen, setContactOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [resetSignal, setResetSignal] = useState(0);

  useEffect(() => {
    if (!contactOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContactOpen(false);
      }
    };

    document.body.classList.add("contact-is-open");
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("contact-is-open");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contactOpen]);

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!turnstileToken || submitState === "submitting") return;

    setSubmitState("submitting");
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          message: formData.get("message"),
          website: formData.get("website"),
          turnstileToken,
        }),
      });

      if (!response.ok) {
        throw new Error("Contact request failed");
      }

      form.reset();
      setTurnstileToken("");
      setSubmitState("success");
      setResetSignal((value) => value + 1);
    } catch {
      setSubmitState("error");
      setTurnstileToken("");
      setResetSignal((value) => value + 1);
    }
  }

  return (
    <>
      <main className="photography-page">
        <header className="photography-nav">
          <a href="/">Portfolio</a>
          <nav aria-label="Photography">
            <a href="/">About</a>
            <button
              type="button"
              onClick={() => {
                setSubmitState("idle");
                setContactOpen(true);
              }}
            >
              Contact
            </button>
          </nav>
        </header>

        <section className="photography-hero" aria-labelledby="photography-title">
          <div className="photography-intro">
            <p>Photographing quiet moments, distant places, and the strange beauty in between.</p>
            <span>New York · personal archive</span>
          </div>
          <h1 id="photography-title">
            Anthony <span>Cheng</span>
          </h1>
        </section>
      </main>

      <section
        className={`contact-panel ${contactOpen ? "is-open" : ""}`}
        aria-hidden={!contactOpen}
        aria-labelledby="contact-title"
      >
        <header className="contact-header">
          <span>New York · available worldwide</span>
          <button type="button" onClick={() => setContactOpen(false)}>
            Close
          </button>
        </header>

        <div className="contact-content">
          <div className="contact-heading">
            <p>Contact</p>
            <h2 id="contact-title">Let&apos;s make something memorable.</h2>
          </div>

          {submitState === "success" ? (
            <div className="contact-success" role="status">
              <p>Thank you.</p>
              <span>Your message has been sent. I&apos;ll be in touch soon.</span>
              <button type="button" onClick={() => setSubmitState("idle")}>
                Send another message
              </button>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleContactSubmit}>
              <label>
                <span>Name</span>
                <input name="name" type="text" autoComplete="name" maxLength={80} required />
              </label>

              <label>
                <span>Email</span>
                <input name="email" type="email" autoComplete="email" maxLength={254} required />
              </label>

              <label>
                <span>Message</span>
                <textarea name="message" rows={5} minLength={10} maxLength={4000} required />
              </label>

              <label className="contact-honeypot" aria-hidden="true">
                <span>Website</span>
                <input name="website" type="text" tabIndex={-1} autoComplete="off" />
              </label>

              <TurnstileWidget onToken={setTurnstileToken} resetSignal={resetSignal} />

              <div className="contact-submit-row">
                <button
                  type="submit"
                  disabled={!turnstileToken || submitState === "submitting"}
                >
                  {submitState === "submitting" ? "Sending…" : "Send message"}
                </button>
                {submitState === "error" && (
                  <p role="alert">Something went wrong. Please try again.</p>
                )}
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
