import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PdfViewer } from "./PdfViewer";
import {
  compareProject,
  normalize,
  parseTables,
  validateProject,
  type Comparison,
  type Contract,
  type Evidence,
  type Extraction,
  type Project,
  type Rect,
} from "./engine";
import { demoProject } from "./demo";
import { readDraft, writeDraft, clearDraft } from "./draft";
import { cellProposal } from "./authoring";

GlobalWorkerOptions.workerSrc = pdfWorker;

type View = "review" | "checks" | "outputs";
type IconName =
  | "grid"
  | "file"
  | "check"
  | "arrow"
  | "plus"
  | "download"
  | "upload"
  | "shield"
  | "code"
  | "close"
  | "help"
  | "play";
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </>
    ),
    check: (
      <>
        <path d="m8 12 3 3 5-6" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m-4 4 4-4 4 4M5 16v4h14v-4" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
        <path d="m8 11 3 3 5-5" />
      </>
    ),
    code: (
      <>
        <path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 4m0 3v.1" />
      </>
    ),
    play: <path d="m8 4 12 8-12 8Z" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const emptyProject = (): Project => ({
  version: 1,
  name: "Untitled project",
  source: { name: "", hash: "", pages: 1 },
  baseline: { name: "baseline.md", format: "markdown", text: "" },
  candidate: { name: "candidate.md", format: "markdown", text: "" },
  contracts: [],
});
async function sha256(bytes: ArrayBuffer) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
const changeLabel: Record<Comparison["change"], string> = {
  regression: "New regression",
  "existing-failure": "Existing failure",
  improvement: "Improved",
  unchanged: "Still passing",
  review: "Needs review",
};
const download = (name: string, contents: string) => {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function App() {
  const [project, setProject] = useState<Project>(emptyProject);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [view, setView] = useState<View>("review");
  const [page, setPage] = useState(1);
  const [focusRequest, setFocusRequest] = useState(0);
  const [results, setResults] = useState<Comparison[] | null>(null);
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("all");
  const [authoring, setAuthoring] = useState(false);
  const [region, setRegion] = useState<Evidence | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [help, setHelp] = useState(false);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [editing, setEditing] = useState<Contract | undefined>();
  const [deviceSave, setDeviceSave] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Export to keep your work");
  const [ready, setReady] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    text: string;
    action: () => void;
  } | null>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveGeneration = useRef(0);
  function confirmAction(text: string, action: () => void) {
    setPendingAction({ text, action });
  }
  useEffect(() => {
    if (pendingAction) confirmRef.current?.showModal();
    else confirmRef.current?.close();
  }, [pendingAction]);
  useEffect(() => {
    if (!ready || !deviceSave) return;
    const generation = ++saveGeneration.current;
    setSaveStatus("Saving on this device…");
    const timer = setTimeout(() => {
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => (project.source.hash ? writeDraft(project) : clearDraft()));
      void saveQueue.current
        .then(() => {
          if (generation === saveGeneration.current)
            setSaveStatus(
              project.source.hash
                ? "Saved on this device · PDF not stored"
                : "No source yet · previous draft removed",
            );
        })
        .catch(() => {
          if (generation === saveGeneration.current)
            setSaveStatus("Device save failed · export your project");
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [project, deviceSave, ready]);
  async function toggleDeviceSave(enabled: boolean) {
    saveGeneration.current++;
    setDeviceSave(enabled);
    if (!enabled) {
      setSaveStatus("Removing device draft…");
      saveQueue.current = saveQueue.current.catch(() => {}).then(clearDraft);
      try {
        await saveQueue.current;
        setSaveStatus("Export to keep your work");
      } catch {
        setSaveStatus("Could not remove device draft");
      }
    }
  }
  const sourceInput = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null);
  const operation = useRef(0),
    booted = useRef(false),
    helpRef = useRef<HTMLDialogElement>(null),
    exportRef = useRef<HTMLDialogElement>(null);
  const tables = useMemo(
    () => parseTables(project.baseline),
    [project.baseline],
  );
  const active = project.contracts.find((c) => c.id === selected);
  const activeResult = results?.find((r) => r.contract.id === selected);
  const regressions =
    results?.filter((r) => r.change === "regression").length ?? 0;
  const passing =
    results?.filter((r) => r.candidate.status === "pass").length ?? 0;
  const reviewCount = results?.filter((r) => r.change === "review").length ?? 0;
  const candidateProblems =
    results?.filter((r) => r.candidate.status !== "pass").length ?? 0;

  useEffect(
    () => () => {
      void pdf?.destroy();
    },
    [pdf],
  );
  useEffect(() => {
    if (help) helpRef.current?.showModal();
    else helpRef.current?.close();
  }, [help]);
  useEffect(() => {
    if (exportJson !== null) exportRef.current?.showModal();
    else exportRef.current?.close();
  }, [exportJson]);
  const error = (e: unknown) =>
    setNotice({
      text:
        e instanceof Error
          ? e.message
          : "The operation could not be completed.",
      error: true,
    });

  async function loadDemo(ask = true) {
    if (ask && project.source.hash) {
      confirmAction(
        "Replace this workspace with the synthetic demo? Export first to keep your current checks.",
        () => void loadDemo(false),
      );
      return;
    }
    const request = ++operation.current;
    setBusy(true);
    setNotice(null);
    let document: PDFDocumentProxy | undefined;
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}northstar-demo.pdf`,
      );
      if (!response.ok) throw new Error("Could not load the demo PDF.");
      const bytes = await response.arrayBuffer(),
        hash = await sha256(bytes);
      document = await getDocument({ data: new Uint8Array(bytes) }).promise;
      if (request !== operation.current) {
        await document.destroy();
        return;
      }
      const next = demoProject(hash);
      setProject(next);
      setPdf(document);
      setResults(compareProject(next));
      setSelected(next.contracts[0].id);
      setPage(1);
      setIsDemo(true);
      setAuthoring(false);
      setRegion(undefined);
      setView("review");
      setFilter("all");
    } catch {
      if (request === operation.current)
        error(
          new Error(
            "The demo PDF could not be loaded. Check your connection, then choose Try the synthetic demo to retry, or attach your own PDF.",
          ),
        );
      await document?.destroy();
    } finally {
      if (request === operation.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void (async () => {
      try {
        const draft = await readDraft();
        if (draft) {
          setProject(draft);
          setDeviceSave(true);
          setSelected(draft.contracts[0]?.id ?? "");
          setView("checks");
          setSaveStatus("Saved on this device · PDF not stored");
          setNotice({
            text: "Device draft restored. Attach the matching PDF to view source evidence.",
          });
        } else await loadDemo(false);
      } catch {
        await loadDemo(false);
        setNotice({
          text: "Device draft could not be restored. It has not been deleted. Use Open project to restore an exported backup.",
          error: true,
        });
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function attachSource(file: File) {
    const request = ++operation.current;
    setBusy(true);
    setNotice(null);
    let document: PDFDocumentProxy | undefined;
    try {
      if (file.size > 50_000_000)
        throw new Error("Choose a PDF smaller than 50 MB.");
      const bytes = await file.arrayBuffer(),
        hash = await sha256(bytes);
      if (
        project.source.hash &&
        hash !== project.source.hash &&
        project.contracts.length
      )
        throw new Error(
          "This PDF does not match the reviewed source. Start a new project to check a different document; existing evidence cannot be rebound.",
        );
      document = await getDocument({
        data: new Uint8Array(bytes),
        isEvalSupported: false,
      }).promise;
      if (document.numPages > 10_000)
        throw new Error("This PDF exceeds the 10,000-page limit.");
      if (request !== operation.current) {
        await document.destroy();
        return;
      }
      if (
        project.source.hash === hash &&
        project.source.pages !== document.numPages
      )
        throw new Error("The project page count does not match this PDF.");
      setPdf(document);
      setProject((p) => ({
        ...p,
        source: { name: file.name, hash, pages: document!.numPages },
      }));
      setPage(1);
      setRegion(undefined);
      setNotice({
        text: "Source PDF attached. Your document stays in this browser.",
      });
      if (project.source.hash !== hash) {
        setResults(null);
        setIsDemo(false);
      }
    } catch (e) {
      if (request === operation.current) error(e);
      await document?.destroy();
    } finally {
      if (request === operation.current) setBusy(false);
    }
  }
  function newProject(confirmed = false) {
    if (project.source.hash && !confirmed) {
      confirmAction(
        "Start a new workspace? Export first to keep your current checks.",
        () => newProject(true),
      );
      return;
    }
    operation.current++;
    setBusy(false);
    setProject(emptyProject());
    setPdf(null);
    setResults(null);
    setSelected("");
    setRegion(undefined);
    setAuthoring(false);
    setPage(1);
    setIsDemo(false);
    setView("checks");
    setNotice(null);
  }
  async function importProject(file: File, confirmed = false) {
    try {
      if (file.size > 12_000_000)
        throw new Error("Project files must be smaller than 12 MB.");
      const next = validateProject(JSON.parse(await file.text()));
      if (project.source.hash && !confirmed) {
        confirmAction(
          "Open this project and replace the current workspace? Export first to keep your current checks.",
          () => void importProject(file, true),
        );
        return;
      }
      operation.current++;
      setBusy(false);
      setProject(next);
      setPdf(null);
      setResults(null);
      setSelected(next.contracts[0]?.id ?? "");
      setRegion(undefined);
      setAuthoring(false);
      setPage(1);
      setIsDemo(false);
      setView("checks");
      setNotice({
        text: "Project opened. Attach the matching source PDF to view evidence and run checks.",
      });
    } catch (e) {
      error(e);
    }
  }
  function exportProject() {
    try {
      validateProject(project);
      setExportJson(JSON.stringify(project, null, 2));
      setCopied(false);
      setCopyError("");
    } catch (e) {
      error(e);
    }
  }
  function updateExtraction(
    which: "baseline" | "candidate",
    value: Extraction,
  ) {
    setProject((p) => ({ ...p, [which]: value }));
    setResults(null);
    setIsDemo(false);
  }
  function selectCheck(id: string) {
    setSelected(id);
    const c = project.contracts.find((c) => c.id === id);
    if (c) setPage(c.evidence.page);
    setAuthoring(false);
    setRegion(undefined);
  }
  function addCheck(contract: Contract) {
    setProject((p) => ({
      ...p,
      contracts: editing
        ? p.contracts.map((c) => (c.id === editing.id ? contract : c))
        : [...p.contracts, contract],
    }));
    setEditing(undefined);
    setIsDemo(false);
    setResults(null);
    setSelected(contract.id);
    setAuthoring(false);
    setRegion(undefined);
    setNotice({
      text: "Verified check saved. Run comparison to test both outputs.",
    });
  }
  function runChecks() {
    try {
      if (!pdf)
        throw new Error(
          "Attach the matching source PDF before running checks in this workspace.",
        );
      if (!project.contracts.length)
        throw new Error("Create at least one verified check first.");
      validateProject(project);
      const comparison = compareProject(project);
      setResults(comparison);
      setView("review");
      setFilter("all");
      const first =
        comparison.find(
          (r) => r.change === "regression" || r.change === "review",
        ) ?? comparison[0];
      selectCheck(first.contract.id);
      setNotice(null);
    } catch (e) {
      error(e);
    }
  }
  function beginAuthoring() {
    setEditing(undefined);
    setView("checks");
    setAuthoring(true);
    setRegion(undefined);
    setNotice(null);
  }
  const evidence = authoring ? region : active?.evidence;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="Proofwork"
        >
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          proofwork<span className="brand-period">.</span>
        </a>
        <details className="mobile-project-menu">
          <summary>
            <Icon name="grid" size={15} />
            Project
          </summary>
          <div
            onClick={(e) =>
              e.currentTarget.parentElement?.removeAttribute("open")
            }
          >
            <button onClick={() => newProject()} disabled={busy}>
              <Icon name="plus" size={15} />
              New project
            </button>
            <button
              onClick={() => projectInput.current?.click()}
              disabled={busy}
            >
              <Icon name="upload" size={15} />
              Open project
            </button>
            <button
              onClick={exportProject}
              disabled={!project.source.hash || busy}
            >
              <Icon name="download" size={15} />
              Export project
            </button>
            <button onClick={() => setHelp(true)}>
              <Icon name="help" size={15} />
              How it works
            </button>
          </div>
        </details>
        <div className="workspace-label">Document workspace</div>
        <button className="project-switch" onClick={() => setView("checks")}>
          <span className="project-icon">
            <Icon name="file" />
          </span>
          <span>
            <strong>{isDemo ? "Northstar catalogue" : project.name}</strong>
            <small>{isDemo ? "Synthetic demo" : "Local project"}</small>
          </span>
          <span className="switch-chevron">⌄</span>
        </button>
        <nav aria-label="Workspace navigation">
          <button
            className={view === "checks" ? "nav-item active" : "nav-item"}
            onClick={() => setView("checks")}
          >
            <Icon name="file" />
            Source & checks
            <span className="nav-count">{project.contracts.length}</span>
          </button>
          <button
            className={view === "outputs" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setView("outputs");
              setAuthoring(false);
            }}
          >
            <Icon name="code" />
            Extraction outputs
          </button>
          <button
            className={view === "review" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setView("review");
              setAuthoring(false);
            }}
          >
            <Icon name="grid" />
            Review results
            {regressions > 0 && (
              <span className="nav-count danger">{regressions}</span>
            )}
          </button>
        </nav>
        <div className="sidebar-divider" />
        <div className="workspace-label">Project</div>
        <button
          className="nav-item"
          onClick={() => newProject()}
          disabled={busy}
        >
          <Icon name="plus" />
          New project
        </button>
        <button
          className="nav-item"
          onClick={() => projectInput.current?.click()}
          disabled={busy}
        >
          <Icon name="upload" />
          Open project
        </button>
        <button
          className="nav-item"
          onClick={exportProject}
          disabled={!project.source.hash || busy}
        >
          <Icon name="download" />
          Export project
        </button>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <Icon name="shield" size={22} />
            <strong>Your files stay yours.</strong>
            <p>Local processing. No uploads, accounts, or AI judge.</p>
          </div>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <Icon name="help" />
            How it works<span className="external-arrow">↗</span>
          </button>
          <div className="sidebar-footer">
            <span className="avatar">P</span>
            <div>
              <strong>Local workspace</strong>
              <small>{saveStatus}</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>
              {view === "review"
                ? "Review results"
                : view === "checks"
                  ? "Source & checks"
                  : "Extraction outputs"}
            </strong>
          </div>
          <div className="local-badge">
            <span />
            Runs on your device
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <h1>
                {view === "review"
                  ? "Review extraction changes"
                  : view === "checks"
                    ? "Source-linked checks"
                    : "Extraction outputs"}
              </h1>
              <p>
                {view === "review"
                  ? "See what changed, then verify it against the original."
                  : view === "checks"
                    ? "Confirm it once in the source. Check it every time your pipeline changes."
                    : "Compare a known baseline with the next version of your extraction."}
              </p>
            </div>
            <button
              className="primary-button"
              onClick={runChecks}
              disabled={busy || !pdf || !project.contracts.length}
            >
              <Icon name="play" size={16} />
              Run comparison
            </button>
          </div>
          <div className="device-save-bar">
            <label>
              <input
                type="checkbox"
                checked={deviceSave}
                onChange={(e) => void toggleDeviceSave(e.target.checked)}
              />
              Keep a draft on this device
            </label>
            <span role="status">{saveStatus}</span>
            <small>
              Retains checks and extraction text in this browser. No PDF bytes.
              Uncheck to remove.
            </small>
          </div>
          {notice && (
            <div
              className={`notice ${notice.error ? "notice-error" : ""}`}
              role={notice.error ? "alert" : "status"}
            >
              <span>{notice.text}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice(null)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {isDemo && (
            <div className="demo-banner">
              <span className="demo-label">Demo</span>
              <span>
                A synthetic catalogue with two intentional extraction errors.
                Explore a check to see the evidence.
              </span>
              <button onClick={() => newProject()} disabled={busy}>
                Use your own PDF <Icon name="arrow" size={15} />
              </button>
            </div>
          )}
          {view === "outputs" ? (
            <div className="outputs-layout">
              <div className="output-intro">
                <Icon name="code" size={24} />
                <div>
                  <h2>Two versions. One source of truth.</h2>
                  <p>
                    Upload or paste Markdown / HTML tables. Their order and
                    selected header row are part of each check.
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => void loadDemo()}
                  disabled={busy}
                >
                  Load demo
                </button>
              </div>
              <div className="output-grid">
                <OutputEditor
                  label="Baseline"
                  extraction={project.baseline}
                  onChange={(v) => updateExtraction("baseline", v)}
                  onError={error}
                />
                <OutputEditor
                  label="Candidate"
                  extraction={project.candidate}
                  onChange={(v) => updateExtraction("candidate", v)}
                  onError={error}
                />
              </div>
              <div className="format-note">
                <Icon name="shield" />
                <p>
                  HTML is parsed as table data and never executed. Checks
                  preserve numeric precision, signs and units. Only whitespace
                  and Unicode composition are normalized.
                </p>
              </div>
            </div>
          ) : (
            <>
              {view === "review" && (
                <div className="comparison-summary">
                  {project.contracts.length} verified checks <span>·</span>{" "}
                  {results
                    ? `${regressions} new regressions · ${passing} candidate passing · ${reviewCount} need review`
                    : "Comparison not run"}
                </div>
              )}
              <div className="workspace-grid">
                <div className="source-card">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">Source document</span>
                      <h2>
                        <Icon name="file" />
                        {project.source.name || "No PDF attached"}
                        {pdf && (
                          <span className="bound-badge">Source matched</span>
                        )}
                      </h2>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Attach source PDF"
                      title="Attach source PDF"
                      onClick={() => sourceInput.current?.click()}
                      disabled={busy}
                    >
                      <Icon name="upload" />
                    </button>
                  </div>
                  <PdfViewer
                    pdf={pdf}
                    page={page}
                    onPage={setPage}
                    evidence={evidence}
                    drawing={authoring}
                    focusRequest={focusRequest}
                    onSelect={(rect) =>
                      setRegion({ page, rect, sourceHash: project.source.hash })
                    }
                  />
                  {!pdf && (
                    <div className="attach-action">
                      <button
                        className="primary-button"
                        onClick={() => sourceInput.current?.click()}
                        disabled={busy}
                      >
                        <Icon name="upload" />
                        Attach source PDF
                      </button>
                      {!project.source.hash && (
                        <button
                          className="text-button"
                          onClick={() => void loadDemo(false)}
                          disabled={busy}
                        >
                          Try the synthetic demo
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="checks-card">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">
                        {authoring
                          ? "New verified check"
                          : view === "review"
                            ? "Comparison"
                            : "Saved checks"}
                      </span>
                      <h2>
                        {authoring
                          ? editing
                            ? "Edit verified check"
                            : "Capture the source fact"
                          : view === "review"
                            ? "Check by check"
                            : `${project.contracts.length} source-linked checks`}
                      </h2>
                    </div>
                    {authoring ? (
                      <button
                        className="icon-button"
                        aria-label="Cancel new check"
                        onClick={() => {
                          setAuthoring(false);
                          setRegion(undefined);
                        }}
                      >
                        <Icon name="close" />
                      </button>
                    ) : (
                      <button
                        className="small-button"
                        onClick={beginAuthoring}
                        disabled={!pdf || busy}
                      >
                        <Icon name="plus" size={14} />
                        New check
                      </button>
                    )}
                  </div>
                  {authoring ? (
                    <CheckForm
                      key={`${project.source.hash}-${editing?.id ?? "new"}`}
                      initial={editing}
                      tables={tables}
                      sourceHash={project.source.hash}
                      page={page}
                      region={region}
                      onRegion={(rect) =>
                        setRegion({
                          page,
                          rect,
                          sourceHash: project.source.hash,
                        })
                      }
                      onSave={addCheck}
                    />
                  ) : (
                    <>
                      {view === "review" && results && (
                        <>
                          <div
                            className={`gate-summary ${candidateProblems ? "gate-blocked" : "gate-pass"}`}
                          >
                            <span>{candidateProblems ? "!" : "✓"}</span>
                            <div>
                              <strong>
                                {candidateProblems
                                  ? "Candidate needs attention"
                                  : "Saved checks passed"}
                              </strong>
                              <small>
                                {candidateProblems
                                  ? `${candidateProblems} candidate check${candidateProblems === 1 ? "" : "s"} did not pass.`
                                  : "All saved facts still hold. Unchecked content is outside this gate."}
                              </small>
                            </div>
                          </div>
                          <div
                            className="filter-tabs"
                            role="group"
                            aria-label="Filter comparison results"
                          >
                            <button
                              className={filter === "all" ? "selected" : ""}
                              onClick={() => setFilter("all")}
                            >
                              All <span>{results.length}</span>
                            </button>
                            <button
                              className={
                                filter === "regression" ? "selected" : ""
                              }
                              onClick={() => setFilter("regression")}
                            >
                              Regressions <span>{regressions}</span>
                            </button>
                            <button
                              className={filter === "review" ? "selected" : ""}
                              onClick={() => setFilter("review")}
                            >
                              Review <span>{reviewCount}</span>
                            </button>
                          </div>
                        </>
                      )}
                      {view === "review" && !results && (
                        <div className="run-empty">
                          <Icon name="play" size={24} />
                          <strong>
                            {project.contracts.length
                              ? "Ready for a fresh comparison"
                              : "Create your first verified check"}
                          </strong>
                          <p>
                            {project.contracts.length
                              ? "Run the current baseline and candidate against your saved facts."
                              : "Attach a PDF, add both outputs, then confirm a table fact in the source."}
                          </p>
                        </div>
                      )}
                      <div className="check-list">
                        {project.contracts
                          .filter(
                            (c) =>
                              view !== "review" ||
                              !results ||
                              filter === "all" ||
                              results.find((r) => r.contract.id === c.id)
                                ?.change === filter,
                          )
                          .map((contract, index) => {
                            const result = results?.find(
                              (r) => r.contract.id === contract.id,
                            );
                            return (
                              <button
                                key={contract.id}
                                className={`check-item ${selected === contract.id ? "selected" : ""}`}
                                onClick={() => selectCheck(contract.id)}
                              >
                                <div className="check-row">
                                  <span
                                    className={`status-icon ${result?.candidate.status === "pass" ? "passed" : result ? "failed" : "pending"}`}
                                  >
                                    {result?.candidate.status === "pass"
                                      ? "✓"
                                      : result
                                        ? "!"
                                        : "·"}
                                  </span>
                                  <span className="check-number">
                                    Check {String(index + 1).padStart(2, "0")}
                                  </span>
                                  {result && (
                                    <span
                                      className={`status-badge ${result.change}`}
                                    >
                                      {changeLabel[result.change]}
                                    </span>
                                  )}
                                </div>
                                <strong>{contract.title}</strong>
                                <div className="check-meta">
                                  Page {contract.evidence.page} <span>·</span>{" "}
                                  {contract.rowLabel} <span>→</span>{" "}
                                  {contract.valueColumn}
                                </div>
                                {result &&
                                  result.candidate.status === "fail" && (
                                    <div className="inline-diff">
                                      <span className="expected">
                                        {contract.expected}
                                      </span>
                                      <Icon name="arrow" size={13} />
                                      <span className="actual">
                                        {result.candidate.actual ?? "Missing"}
                                      </span>
                                    </div>
                                  )}
                              </button>
                            );
                          })}
                        {!project.contracts.length && (
                          <div className="checks-empty">
                            <span>01</span>
                            <h3>Save the facts that matter.</h3>
                            <p>
                              A product price, a reporting year, a quantity.
                              Confirm the source once, then catch changes
                              automatically.
                            </p>
                            <button
                              className="secondary-button"
                              onClick={beginAuthoring}
                              disabled={!pdf}
                            >
                              Create a check
                            </button>
                          </div>
                        )}
                        {results &&
                          filter !== "all" &&
                          !results.some((r) => r.change === filter) && (
                            <div className="filter-empty">
                              No{" "}
                              {filter === "review"
                                ? "checks need review"
                                : "new regressions"}{" "}
                              in this run.
                            </div>
                          )}
                      </div>
                      {active && (
                        <div className="detail-panel">
                          <div className="detail-title">
                            <span>Verified expectation</span>
                            <span className="source-chip">
                              p. {active.evidence.page}
                            </span>
                          </div>
                          <div className="expected-value">
                            {active.expected}
                          </div>
                          <p>
                            <strong>{active.rowLabel}</strong> under{" "}
                            <strong>{active.valueColumn}</strong>
                          </p>
                          {activeResult && (
                            <div className="outcome-pair">
                              <div>
                                <small>Baseline</small>
                                <span
                                  className={
                                    activeResult.baseline.status === "pass"
                                      ? "outcome-pass"
                                      : "outcome-fail"
                                  }
                                >
                                  {activeResult.baseline.status === "pass"
                                    ? "✓ Passed"
                                    : activeResult.baseline.status}
                                </span>
                                <p>{activeResult.baseline.reason}</p>
                              </div>
                              <div>
                                <small>Candidate</small>
                                <span
                                  className={
                                    activeResult.candidate.status === "pass"
                                      ? "outcome-pass"
                                      : "outcome-fail"
                                  }
                                >
                                  {activeResult.candidate.status === "pass"
                                    ? "✓ Passed"
                                    : activeResult.candidate.status}
                                </span>
                                <p>{activeResult.candidate.reason}</p>
                              </div>
                            </div>
                          )}
                          <div className="detail-actions">
                            <button
                              className="text-button"
                              onClick={() => {
                                setPage(active.evidence.page);
                                setFocusRequest((n) => n + 1);
                                setNotice({
                                  text: `Source evidence is highlighted on page ${active.evidence.page}.`,
                                });
                              }}
                            >
                              Locate source <Icon name="arrow" size={14} />
                            </button>
                            <button
                              className="text-button"
                              disabled={!pdf}
                              onClick={() => {
                                setEditing(active);
                                setRegion(active.evidence);
                                setPage(active.evidence.page);
                                setAuthoring(true);
                                setView("checks");
                              }}
                            >
                              Edit check
                            </button>
                            <button
                              className="delete-button"
                              onClick={() =>
                                confirmAction(
                                  `Delete “${active.title}”?`,
                                  () => {
                                    setProject((p) => ({
                                      ...p,
                                      contracts: p.contracts.filter(
                                        (c) => c.id !== active.id,
                                      ),
                                    }));
                                    setResults(null);
                                    setSelected("");
                                    setIsDemo(false);
                                  },
                                )
                              }
                            >
                              Delete check
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="bottom-note">
                <Icon name="shield" size={16} />
                <span>
                  Checks cover only the facts you verified. Passing is not a
                  certification of the entire document.
                </span>
                <span className="hash-label">
                  {project.source.hash
                    ? `SHA-256 ${project.source.hash.slice(0, 10)}…`
                    : "No source attached"}
                </span>
              </div>
            </>
          )}
        </div>
        <input
          ref={sourceInput}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void attachSource(file);
            e.target.value = "";
          }}
        />
        <input
          ref={projectInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importProject(file);
            e.target.value = "";
          }}
        />
        {busy && (
          <div className="loading-bar" role="status">
            Opening PDF…
          </div>
        )}
        <dialog
          ref={helpRef}
          className="help-dialog"
          aria-label="How Proofwork works"
          onCancel={() => setHelp(false)}
          onClose={() => setHelp(false)}
        >
          <div className="dialog-heading">
            <h2>A little proof goes a long way.</h2>
            <button
              className="icon-button"
              aria-label="Close help"
              onClick={() => setHelp(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <ol>
            <li>
              <strong>Attach the original PDF.</strong> Its fingerprint binds
              every check to the reviewed source.
            </li>
            <li>
              <strong>Bring two extraction outputs.</strong> Use Markdown or
              HTML tables from your existing pipeline.
            </li>
            <li>
              <strong>Confirm a fact.</strong> Mark its source region and save
              the row, column and expected value.
            </li>
            <li>
              <strong>Review the comparison.</strong> New failures, existing
              failures and ambiguous checks are separate.
            </li>
            <li>
              <strong>Keep it portable.</strong> Export your project; reattach
              the same PDF next time or use the CLI.
            </li>
          </ol>
          <p>
            Multi-level headers require you to choose a row with unique column
            names. Nested tables and invalid spans need review. Table numbers
            must remain stable between outputs.
          </p>
          <p className="muted">
            Optional device drafts retain extraction text and checks in this
            browser; they do not retain PDFs. Export for a portable backup.
            Project exports include extraction text and source fingerprints, but
            no PDF bytes.
          </p>
          <button className="primary-button" onClick={() => setHelp(false)}>
            Got it
          </button>
        </dialog>
        <dialog
          ref={exportRef}
          className="help-dialog export-dialog"
          aria-label="Export project JSON"
          onCancel={() => setExportJson(null)}
          onClose={() => setExportJson(null)}
        >
          <div className="dialog-heading">
            <h2>Take your checks with you.</h2>
            <button
              className="icon-button"
              aria-label="Close export"
              onClick={() => setExportJson(null)}
            >
              <Icon name="close" />
            </button>
          </div>
          <p className="export-description">
            Save this project as JSON to reopen it or run it in CI. It includes
            extraction text and evidence, but no PDF bytes. Keep the original
            PDF alongside it.
          </p>
          <textarea
            aria-label="Project JSON"
            value={exportJson ?? ""}
            readOnly
            spellCheck={false}
            onFocus={(e) => e.target.select()}
          />
          {copyError && (
            <p className="notice notice-error" role="alert">{copyError}</p>
          )}
          <div className="export-actions">
            <button
              className="secondary-button"
              onClick={async () => {
                setCopyError("");
                try {
                  await navigator.clipboard.writeText(exportJson ?? "");
                  setCopied(true);
                } catch {
                  setCopied(false);
                  setCopyError(
                    "Clipboard is unavailable. Select and copy the project JSON manually, or choose Download JSON.",
                  );
                }
              }}
            >
              {copied ? "✓ JSON copied" : "Copy JSON"}
            </button>
            <button
              className="primary-button"
              onClick={() =>
                download("proofwork-project.json", exportJson ?? "")
              }
            >
              <Icon name="download" />
              Download JSON
            </button>
          </div>
        </dialog>
        <dialog
          ref={confirmRef}
          className="help-dialog"
          aria-labelledby="confirm-title"
          onCancel={() => setPendingAction(null)}
          onClose={() => setPendingAction(null)}
        >
          <h2 id="confirm-title">Replace or remove work?</h2>
          <p className="export-description">{pendingAction?.text}</p>
          <div className="export-actions">
            <button
              className="secondary-button"
              onClick={exportProject}
              disabled={!project.source.hash}
            >
              Export first
            </button>
            <button
              className="secondary-button"
              autoFocus
              onClick={() => setPendingAction(null)}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              onClick={() => {
                const action = pendingAction?.action;
                setPendingAction(null);
                action?.();
              }}
            >
              Continue
            </button>
          </div>
        </dialog>
      </main>
    </div>
  );
}

function OutputEditor({
  label,
  extraction,
  onChange,
  onError,
}: {
  label: string;
  extraction: Extraction;
  onChange: (v: Extraction) => void;
  onError: (e: unknown) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const tables = useMemo(() => parseTables(extraction), [extraction]);
  const [preview, setPreview] = useState(false);
  async function load(file: File) {
    try {
      if (file.size > 5_000_000)
        throw new Error("Extraction files must be smaller than 5 MB.");
      const text = await file.text();
      onChange({
        name: file.name,
        format: /\.html?$/i.test(file.name) ? "html" : "markdown",
        text,
      });
    } catch (e) {
      onError(e);
    }
  }
  return (
    <section className="output-card">
      <div className="output-card-heading">
        <div>
          <span className={`output-dot ${label.toLowerCase()}`} />
          <h2>{label}</h2>
        </div>
        <button className="small-button" onClick={() => input.current?.click()}>
          <Icon name="upload" size={14} />
          Upload file
        </button>
      </div>
      <div className="output-fields">
        <label>
          File label
          <input
            value={extraction.name}
            maxLength={1000}
            onChange={(e) => onChange({ ...extraction, name: e.target.value })}
          />
        </label>
        <label>
          Format
          <select
            value={extraction.format}
            onChange={(e) =>
              onChange({
                ...extraction,
                format: e.target.value as Extraction["format"],
              })
            }
          >
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
          </select>
        </label>
      </div>
      <div className="editor-tabs">
        <button
          className={!preview ? "active" : ""}
          onClick={() => setPreview(false)}
        >
          Raw output
        </button>
        <button
          className={preview ? "active" : ""}
          onClick={() => setPreview(true)}
        >
          Table preview <span>{tables.length}</span>
        </button>
      </div>
      {!preview ? (
        <textarea
          aria-label={`${label} extraction text`}
          className="output-editor"
          value={extraction.text}
          placeholder="Paste the extraction output here…"
          maxLength={5_000_000}
          spellCheck={false}
          onChange={(e) => onChange({ ...extraction, text: e.target.value })}
        />
      ) : (
        <div className="tables-preview">
          {tables.length ? (
            tables.map((table, i) => (
              <div key={i}>
                <div className="table-label">
                  Table {i + 1}
                  {table.caption ? ` · ${table.caption}` : ""}
                </div>
                {table.issue && <p className="table-warning">{table.issue}</p>}
                <div className="preview-scroll">
                  <table>
                    <tbody>
                      {table.rows.map((row, r) => (
                        <tr key={r}>
                          {row.map((cell, c) =>
                            r === 0 ? (
                              <th key={c}>{cell}</th>
                            ) : (
                              <td key={c}>{cell}</td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <div className="filter-empty">
              No supported tables detected. Use pipe-separated Markdown tables
              or HTML &lt;table&gt; elements.
            </div>
          )}
        </div>
      )}
      <div className="output-footer">
        <span>
          {tables.length} table{tables.length !== 1 ? "s" : ""} detected
        </span>
        <span>{extraction.text.length.toLocaleString()} characters</span>
      </div>
      <input
        ref={input}
        type="file"
        accept=".md,.markdown,.txt,.html,.htm"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void load(file);
          e.target.value = "";
        }}
      />
    </section>
  );
}

function CheckForm({
  tables,
  sourceHash,
  page,
  region,
  onRegion,
  onSave,
  initial,
}: {
  tables: ReturnType<typeof parseTables>;
  sourceHash: string;
  page: number;
  region?: Evidence;
  onRegion: (rect: Rect) => void;
  onSave: (c: Contract) => void;
  initial?: Contract;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [tableIndex, setTableIndex] = useState(initial?.tableIndex ?? 0),
    [headerRow, setHeaderRow] = useState(initial?.headerRow ?? 0);
  const [rowColumn, setRowColumn] = useState(initial?.rowColumn ?? ""),
    [rowLabel, setRowLabel] = useState(initial?.rowLabel ?? ""),
    [valueColumn, setValueColumn] = useState(initial?.valueColumn ?? ""),
    [expected, setExpected] = useState(initial?.expected ?? "");
  const [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState("");
  const [bounds, setBounds] = useState({
    x: "10",
    y: "20",
    width: "80",
    height: "25",
  });
  const table = tables[tableIndex],
    headers = table?.rows[headerRow] ?? [];
  const rowOptions =
    table?.rows
      .slice(headerRow + 1)
      .map((r) => r[headers.indexOf(rowColumn)] ?? "")
      .filter(Boolean) ?? [];
  useEffect(() => {
    setConfirmed(false);
  }, [
    region,
    expected,
    rowLabel,
    rowColumn,
    valueColumn,
    tableIndex,
    headerRow,
  ]);

  const currentRegion = region?.page === page ? region : undefined;
  function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!currentRegion) {
      setError(
        "Mark the evidence on this page, or apply the rectangle bounds below.",
      );
      return;
    }
    if (table?.issue) {
      setError(table.issue);
      return;
    }
    if (!confirmed) {
      setError("Confirm the expected value against the original PDF first.");
      return;
    }
    if (
      ![rowColumn, valueColumn, rowLabel, expected].every((v) => normalize(v))
    ) {
      setError("Complete the row, column and expected value.");
      return;
    }
    if (
      headers.filter((h) => normalize(h) === normalize(rowColumn)).length !==
        1 ||
      headers.filter((h) => normalize(h) === normalize(valueColumn)).length !==
        1
    ) {
      setError(
        "Choose a header row with unique names for both selected columns.",
      );
      return;
    }
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim() || `${rowLabel} · ${valueColumn}`,
      tableIndex,
      headerRow,
      rowColumn,
      rowLabel: normalize(rowLabel),
      valueColumn,
      expected: normalize(expected),
      evidence: currentRegion,
    });
  }
  return (
    <form className="check-form" onSubmit={save}>
      <div className="authoring-guide">
        <span>1</span>
        <p>
          Mark a region in the PDF containing the value and its row / column
          context.
        </p>
      </div>
      <div className={`region-state ${currentRegion ? "ready" : ""}`}>
        {currentRegion
          ? `✓ Evidence selected · page ${currentRegion.page}`
          : `Select evidence on page ${page}`}
      </div>
      <details className="bounds-details">
        <summary>Enter region bounds with keyboard</summary>
        <div className="bounds-grid">
          {(["x", "y", "width", "height"] as const).map((key) => (
            <label key={key}>
              {key === "x" ? "Left %" : key === "y" ? "Top %" : `${key} %`}
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={bounds[key]}
                onChange={(e) =>
                  setBounds((b) => ({ ...b, [key]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          className="small-button"
          onClick={() => {
            const r = {
              x: Number(bounds.x) / 100,
              y: Number(bounds.y) / 100,
              width: Number(bounds.width) / 100,
              height: Number(bounds.height) / 100,
            };
            if (
              ![r.x, r.y, r.width, r.height].every(Number.isFinite) ||
              r.x < 0 ||
              r.y < 0 ||
              r.width <= 0 ||
              r.height <= 0 ||
              r.x + r.width > 1 ||
              r.y + r.height > 1
            ) {
              setError("Use a rectangle contained within the page.");
              return;
            }
            setError("");
            onRegion(r);
          }}
        >
          Apply region
        </button>
      </details>
      <div className="authoring-guide second">
        <span>2</span>
        <p>
          Describe the fact. Read the expected value from the source, not from
          the extraction.
        </p>
      </div>
      <label>
        Check name <span className="optional">optional</span>
        <input
          value={title}
          maxLength={1000}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Atlas keeps its 2024 price"
        />
      </label>
      <div className="form-pair">
        <label>
          Table
          <select
            value={tableIndex}
            onChange={(e) => {
              setTableIndex(Number(e.target.value));
              setHeaderRow(0);
              setRowColumn("");
              setValueColumn("");
              setRowLabel("");
              setExpected("");
            }}
          >
            {tables.map((_, i) => (
              <option key={i} value={i}>
                Table {i + 1}
              </option>
            ))}
            {!tables.length && <option>No tables</option>}
          </select>
        </label>
        <label>
          Header row
          <select
            value={headerRow}
            onChange={(e) => {
              setHeaderRow(Number(e.target.value));
              setRowColumn("");
              setValueColumn("");
              setRowLabel("");
              setExpected("");
            }}
          >
            {(table?.rows ?? []).map((_, i) => (
              <option key={i} value={i}>
                Row {i + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
      {table && !table.issue && (
        <details className="cell-picker" open={!initial}>
          <summary>Choose a baseline cell to prefill</summary>
          <p>
            Extraction values are suggestions. Verify against the PDF before
            saving. Uses the first column as the row label; other layouts can be
            entered below.
          </p>
          <div className="preview-scroll">
            <table>
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows
                  .slice(headerRow + 1, headerRow + 51)
                  .map((row, r) => (
                    <tr key={r}>
                      {row.map((value, c) => (
                        <td key={c}>
                          {cellProposal(
                            table,
                            tableIndex,
                            headerRow,
                            headerRow + 1 + r,
                            c,
                          ) ? (
                            <button
                              type="button"
                              aria-label={`Use ${row[0]} / ${headers[c]} / ${value}`}
                              onClick={() => {
                                const proposal = cellProposal(
                                  table,
                                  tableIndex,
                                  headerRow,
                                  headerRow + 1 + r,
                                  c,
                                )!;
                                setRowColumn(proposal.rowColumn!);
                                setRowLabel(proposal.rowLabel!);
                                setValueColumn(proposal.valueColumn!);
                                setExpected(proposal.expected!);
                              }}
                            >
                              {value}
                            </button>
                          ) : (
                            value
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {table.rows.length - headerRow > 51 && (
            <p>
              Showing the first 50 data rows. Use the fields below for later
              rows.
            </p>
          )}
        </details>
      )}
      {!tables.length && (
        <p className="form-error">
          Add a baseline extraction with a supported table in Extraction outputs
          first.
        </p>
      )}
      {table?.issue && <p className="form-error">{table.issue}</p>}
      <label>
        Row label column
        <select
          value={rowColumn}
          onChange={(e) => {
            setRowColumn(e.target.value);
            setRowLabel("");
          }}
          required
        >
          <option value="">Choose a column</option>
          {headers.map((header, i) => (
            <option key={i} value={header}>
              {header || "(empty)"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Row label
        <input
          value={rowLabel}
          maxLength={1000}
          list="row-label-options"
          placeholder="Exact label from the source"
          onChange={(e) => setRowLabel(e.target.value)}
          required
        />
        <datalist id="row-label-options">
          {[...new Set(rowOptions)].map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
      </label>
      <label>
        Value column
        <select
          value={valueColumn}
          onChange={(e) => setValueColumn(e.target.value)}
          required
        >
          <option value="">Choose a column</option>
          {headers.map((header, i) => (
            <option key={i} value={header}>
              {header || "(empty)"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Expected value
        <input
          className="expected-input"
          value={expected}
          maxLength={1000}
          placeholder="e.g. 125.60"
          onChange={(e) => setExpected(e.target.value)}
          required
        />
      </label>
      <label className="confirmation">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>I verified the row, column and value in the original PDF.</span>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary-button save-check"
        disabled={!tables.length || !currentRegion || !confirmed}
      >
        <Icon name="check" />
        Save verified check
      </button>
      <p className="form-footnote">
        The table number is fixed. Reordered tables and duplicate labels require
        review.
      </p>
    </form>
  );
}
