import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { Evidence, Rect } from './engine';

type Props = {
  pdf: PDFDocumentProxy | null;
  page: number;
  onPage: (page: number) => void;
  evidence?: Evidence;
  drawing: boolean;
  onSelect: (rect: Rect) => void;
  focusRequest: number;
};

export function PdfViewer({ pdf, page, onPage, evidence, drawing, onSelect, focusRequest }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [width, setWidth] = useState(500);
  const [zoom, setZoom] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 500, height: 650 });
  const [draft, setDraft] = useState<Rect | null>(null);
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(false);
  useEffect(() => {
    if (!hostRef.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(220, entry.contentRect.width - 48)));
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setDraft(null); start.current = null; }, [drawing, page, pdf]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || drawing || evidence?.page !== page) return;
    const top = evidence.rect.y * dimensions.height;
    const bottom = (evidence.rect.y + evidence.rect.height) * dimensions.height;
    if (top < host.scrollTop || bottom > host.scrollTop + host.clientHeight - 48) host.scrollTo({ top: Math.max(0, top - 55) });
    if (focusRequest) host.scrollIntoView({ block: 'nearest' });
  }, [evidence, page, dimensions.height, drawing, focusRequest]);
  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | undefined;
    setError('');
    if (!pdf || !canvasRef.current) return;
    setRendering(true);
    void (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: width / base.width * zoom });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (viewport.width * viewport.height * dpr ** 2 > 20_000_000) throw new Error('This page is too large at this zoom. Zoom out to render it.');
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('PDF rendering is unavailable in this browser.');
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        setDimensions({ width: viewport.width, height: viewport.height });
        task = pdfPage.render({ canvasContext: context, viewport, transform: [dpr, 0, 0, dpr, 0, 0] });
        await task.promise;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not render this PDF page.');
      } finally { if (!cancelled) setRendering(false); }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, page, width, zoom]);

  const point = (e: React.PointerEvent<HTMLDivElement>) => {
    const bounds = frameRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (e.clientY - bounds.top) / bounds.height)) };
  };
  const rectangle = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) });
  const overlay = draft ?? (evidence?.page === page ? evidence.rect : undefined);
  return <section className="pdf-viewer" aria-label="Source PDF">
    <div className="viewer-toolbar">
      <div className="page-nav"><button aria-label="Previous page" disabled={!pdf || page <= 1} onClick={() => onPage(page - 1)}>‹</button><span>Page <strong>{page}</strong> <span className="muted">of {pdf?.numPages ?? '—'}</span></span><button aria-label="Next page" disabled={!pdf || page >= pdf.numPages} onClick={() => onPage(page + 1)}>›</button></div>
      <div className="zoom-controls"><button aria-label="Zoom out" disabled={!pdf || zoom <= 0.5} onClick={() => setZoom(z => Math.max(.5, z - .25))}>−</button><button className="zoom-label" disabled={!pdf} onClick={() => setZoom(1)} title="Reset to fit width">{Math.round(zoom * 100)}%</button><button aria-label="Zoom in" disabled={!pdf || zoom >= 2} onClick={() => setZoom(z => Math.min(2, z + .25))}>+</button></div>
    </div>
    <div className={`pdf-scroll ${drawing ? 'drawing' : ''}`} ref={hostRef}>
      {!pdf ? <div className="pdf-empty"><div className="empty-file">↥</div><h3>Attach your source PDF</h3><p>Your checks stay linked to the exact PDF you reviewed. Attach it to view the evidence.</p></div> : <div className="pdf-frame" ref={frameRef} style={{ width: dimensions.width, height: dimensions.height }}
        onPointerDown={e => { if (!drawing || rendering) return; start.current = point(e); setDraft(null); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { if (drawing && start.current) setDraft(rectangle(start.current, point(e))); }}
        onPointerUp={e => { if (!drawing || !start.current) return; const rect = rectangle(start.current, point(e)); start.current = null; if (rect.width > .015 && rect.height > .01) { setDraft(rect); onSelect(rect); } else setDraft(null); }}
        onPointerCancel={() => { start.current = null; setDraft(null); }}>
        <canvas ref={canvasRef} style={{ width: dimensions.width, height: dimensions.height }} aria-label={`Source PDF page ${page}`} />
        {overlay && <div className={`evidence-overlay ${drawing ? 'new-evidence' : ''}`} style={{ left: `${overlay.x * 100}%`, top: `${overlay.y * 100}%`, width: `${overlay.width * 100}%`, height: `${overlay.height * 100}%` }}><span>{drawing ? 'Selected evidence' : 'Verified source'}</span></div>}
      </div>}
      {error && <div className="render-error" role="alert">{error}</div>}
      {rendering && <span className="render-status" role="status">Rendering page…</span>}
    </div>
    <div className="viewer-footer"><span className="small-dot" />{drawing ? 'Drag a box around the source fact, or enter its bounds in the form.' : 'Original PDF · evidence stays bound to this source'}</div>
  </section>;
}
