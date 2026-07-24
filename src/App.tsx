import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

const bootLines = [
  "Initializing personal workspace...",
  "Loading engineering modules...",
  "Connecting projects...",
  "✓ profile ready",
  "",
  "Location: New York City",
  "Role: Software Engineer",
  "Current mode: building thoughtfully",
  "",
  "anthony.cheng v1.0 — ready.",
];

type CommandName =
  | "about"
  | "home"
  | "photography"
  | "github"
  | "linkedin"
  | "clear"
  | "help";

interface ToastState {
  id: number;
  message: string;
}

type ViewName = "home" | "about";

function WindowControls() {
  return (
    <div className="lights" aria-hidden="true">
      <span className="light" />
      <span className="light" />
      <span className="light" />
    </div>
  );
}

function BootScreen({ onFinish }: { onFinish: () => void }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setVisibleCount(bootLines.length);
      return;
    }

    const timer = window.setInterval(() => {
      setVisibleCount((count) => {
        if (count >= bootLines.length) {
          window.clearInterval(timer);
          return count;
        }
        return count + 1;
      });
    }, 115);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="boot" aria-live="polite">
      <div className="boot-lines">
        {bootLines.slice(0, visibleCount).map((line, index) => {
          const className = line.startsWith("✓")
            ? "ok"
            : line.startsWith("anthony")
              ? "brand"
              : undefined;

          return (
            <div className={className} key={`${line}-${index}`}>
              {line || "\u00a0"}
            </div>
          );
        })}
      </div>
      <button
        className={`boot-action ${visibleCount === bootLines.length ? "is-visible" : ""}`}
        disabled={visibleCount !== bootLines.length}
        onClick={onFinish}
        type="button"
      >
        Enter portfolio
      </button>
    </div>
  );
}

function IdentityPanel() {
  return (
    <section className="identity" id="about">
      <figure
        className="portrait-frame reveal"
        style={{ "--delay": "90ms" } as React.CSSProperties}
      >
        <img
          src="/images/img1.jpg?v=20260724"
          alt="A colorful thermal-style portrait of Anthony Cheng wearing sunglasses"
        />
      </figure>
      <div className="profile-meta reveal" style={{ "--delay": "150ms" } as React.CSSProperties}>
        <p>Software Engineer · Photographer</p>
        <p>New York City</p>
      </div>
    </section>
  );
}

function PortfolioIndex({ onCommand }: { onCommand: (command: string) => void }) {
  return (
    <aside className="content" aria-label="Portfolio index">
      <section
        className="summary-block reveal"
        style={{ "--delay": "130ms" } as React.CSSProperties}
      >
        <p className="block-label">Profile</p>
        <p className="intro">
          I build reliable software at the intersection of{" "}
          <strong>data, product, and the web</strong>—turning complicated systems into tools
          that feel clear and useful.
        </p>
        <div className="availability">
          <span className="pulse" aria-hidden="true" />
          available for good conversations
        </div>
      </section>

      <nav
        className="nav-block reveal"
        style={{ "--delay": "180ms" } as React.CSSProperties}
        aria-label="Primary"
      >
        <p className="block-label">Explore</p>
        <ul className="nav-list">
          {[
            ["about", "about"],
            ["photography", "photography"],
            ["linkedin", "linkedin"],
            ["github", "github"],
          ].map(([command, label]) => (
            <li key={command}>
              <a
                className="nav-link"
                href={`#${command}`}
                onClick={(event) => {
                  event.preventDefault();
                  onCommand(command);
                }}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function AboutView({ onNavigate }: { onNavigate: (view: ViewName) => void }) {
  return (
    <main className="about-view" id="main">
      <header className="about-header reveal" style={{ "--delay": "70ms" } as React.CSSProperties}>
        <div>
          <p className="block-label">About</p>
          <h2>Background &amp; experience</h2>
        </div>
        <button className="back-command" type="button" onClick={() => onNavigate("home")}>
          /home
        </button>
      </header>

      <div className="about-sections">
        <section
          className="timeline-section reveal"
          style={{ "--delay": "120ms" } as React.CSSProperties}
        >
          <div className="section-heading">
            <span aria-hidden="true">01</span>
            <h3>Education</h3>
          </div>
          <ol className="timeline-list">
            <li className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <p className="record-title">Columbia University</p>
                <p>Master of Science</p>
                <p>Completed 2022</p>
                <small>Computer Science</small>
              </div>
            </li>
            <li className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <p className="record-title">University of Wisconsin–Madison</p>
                <p>Bachelor of Science</p>
                <p>Completed 2020</p>
                <small>Computer Science + Mathematics · double major</small>
              </div>
            </li>
          </ol>
        </section>

        <section
          className="timeline-section reveal"
          style={{ "--delay": "170ms" } as React.CSSProperties}
        >
          <div className="section-heading">
            <span aria-hidden="true">02</span>
            <h3>Experience</h3>
          </div>
          <ol className="timeline-list experience-list">
            <li className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <p className="record-company">KKR</p>
                <p className="record-title">Software Engineer — Assistant Vice President</p>
                <small>Dates and team details to be added</small>
              </div>
            </li>
            <li className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <p className="record-company">Goldman Sachs</p>
                <p className="record-title">Software Engineer — Associate</p>
                <p>Jan 2024 — Present · New York, NY</p>
                <small>Front office SWE · Equity and Debt Capital Markets Engineering</small>
              </div>
            </li>
            <li className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <p className="record-company">Goldman Sachs</p>
                <p className="record-title">Software Engineer — Senior Analyst</p>
                <p>Jan 2023 — Dec 2023 · New York, NY</p>
                <small>Front office SWE · Equity Capital Markets Engineering</small>
              </div>
            </li>
            <li className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <p className="record-company">Goldman Sachs</p>
                <p className="record-title">Software Engineer — Analyst</p>
                <p>Jul 2022 — Dec 2022 · New York, NY</p>
                <small>Front office SWE · Equity Capital Markets Engineering</small>
              </div>
            </li>
            <li className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <p className="record-company">Kepler</p>
                <p className="record-title">Software Engineer</p>
                <p>Aug 2021 — Jul 2022 · New York, NY</p>
                <small>Technology &amp; Data Services · Data Engineering</small>
              </div>
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}

function CommandBar({
  inputRef,
  onSubmit,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (command: string) => void;
}) {
  const [command, setCommand] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(command);
    setCommand("");
  }

  return (
    <form className="commandbar" onSubmit={handleSubmit}>
      <span className="prompt" aria-hidden="true">
        ›
      </span>
      <label htmlFor="command-input">Portfolio command</label>
      <input
        id="command-input"
        ref={inputRef}
        value={command}
        onChange={(event) => setCommand(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder='Type "help" or try "github"...'
      />
      <span className="hint">⌘ K to focus</span>
    </form>
  );
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [activeView, setActiveView] = useState<ViewName>("home");
  const [toast, setToast] = useState<ToastState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastId = useRef(0);

  const showToast = useCallback((message: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, message });
  }, []);

  const runCommand = useCallback(
    (rawCommand: string) => {
      const command = rawCommand.trim().toLowerCase().replace(/^\//, "") as CommandName;

      if (!command) return;

      const actions: Partial<Record<CommandName, () => void>> = {
        about: () => setActiveView("about"),
        home: () => setActiveView("home"),
        photography: () => showToast("Photography archive: coming next."),
        github: () => window.open("https://github.com/as7cheng", "_blank", "noopener"),
        linkedin: () =>
          window.open("https://www.linkedin.com/in/anthonysscc/", "_blank", "noopener"),
        clear: () => showToast("Terminal cleared."),
        help: () =>
          showToast("Commands: home · about · photography · linkedin · github · clear"),
      };

      const action = actions[command];
      if (action) {
        action();
      } else {
        showToast(`Command not found: ${command}. Try “help”.`);
      }
    },
    [showToast],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!booted && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        setBooted(true);
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setBooted(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [booted]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="site-shell">
        <section className={`terminal ${booted ? "ready" : ""}`} aria-label="Portfolio terminal">
          <header className="titlebar">
            <WindowControls />
            <div className="path">
              <span>anthony@cheng</span> ~/portfolio{activeView === "about" ? "/about" : ""}
            </div>
            <div className="status">● online</div>
          </header>

          {!booted && <BootScreen onFinish={() => setBooted(true)} />}

          {activeView === "home" ? (
            <main className="main-grid" id="main">
              <IdentityPanel />
              <PortfolioIndex onCommand={runCommand} />
            </main>
          ) : (
            <AboutView onNavigate={setActiveView} />
          )}

          <div className="system-message reveal" style={{ "--delay": "230ms" } as React.CSSProperties}>
            <p>
              <span>[system]</span> Personal workspace mounted successfully.
            </p>
            <p>
              {activeView === "home" ? (
                <>
                  Type <strong>/help</strong> for commands · photography archive is next
                </>
              ) : (
                <>
                  Viewing <strong>/about</strong> · use <strong>/home</strong> to return
                </>
              )}
            </p>
          </div>

          <CommandBar inputRef={inputRef} onSubmit={runCommand} />
        </section>
      </div>

      <div
        className={`toast ${toast ? "is-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast?.message}
      </div>
    </>
  );
}
