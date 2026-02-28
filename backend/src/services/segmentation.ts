type Polygon = number[];

export type LineBox = {
  text: string;
  page: number;
  polygon?: Polygon;
  pageWidth?: number;
  pageHeight?: number;
  unit?: string;
};

export function extractLinesFromLayoutResult(layoutResult: any): LineBox[] {
  const pages = Array.isArray(layoutResult?.pages) ? layoutResult.pages : [];
  const lines: LineBox[] = [];

  for (const page of pages) {
    const pageNumber = Number(page?.pageNumber ?? 1);
    const pageWidth = Number(page?.width ?? NaN);
    const pageHeight = Number(page?.height ?? NaN);
    const unit = typeof page?.unit === "string" ? page.unit : undefined;
    const pageLines = Array.isArray(page?.lines) ? page.lines : [];
    for (const line of pageLines) {
      const text = String(line?.content ?? "").trim();
      if (!text) continue;
      lines.push({
        text,
        page: pageNumber,
        polygon: Array.isArray(line?.polygon) ? line.polygon : undefined,
        pageWidth: Number.isFinite(pageWidth) ? pageWidth : undefined,
        pageHeight: Number.isFinite(pageHeight) ? pageHeight : undefined,
        unit
      });
    }
  }

  return lines;
}

function topLeft(l: LineBox): { x: number; y: number } {
  const poly = Array.isArray(l.polygon) ? l.polygon : [];
  if (poly.length >= 8) {
    const xs = [poly[0], poly[2], poly[4], poly[6]];
    const ys = [poly[1], poly[3], poly[5], poly[7]];
    return { x: Math.min(...xs), y: Math.min(...ys) };
  }
  return { x: 0, y: 0 };
}

export function orderLines(lines: LineBox[]): LineBox[] {
  const sorted = [...lines].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    const at = topLeft(a);
    const bt = topLeft(b);
    const dy = at.y - bt.y;
    if (Math.abs(dy) > 2) return dy;
    return at.x - bt.x;
  });
  return sorted;
}

export function segmentByQuestionNumbers(
  lines: LineBox[],
  questionNumbers: number[]
): Array<{ questionNo: number; answerText: string; lineBoxes: LineBox[] }> {
  const markers = new Map<number, number>();
  const normalized = lines.map((l) => l.text.replace(/\s+/g, " ").trim());

  const patternsFor = (q: number) => [
    new RegExp(`^Q\\s*${q}\\b`, "i"),
    new RegExp(`^${q}\\s*\\)\\b`),
    new RegExp(`^${q}\\s*\\.`),
    new RegExp(`^\\(${q}\\)\\b`)
  ];

  for (let i = 0; i < normalized.length; i++) {
    for (const q of questionNumbers) {
      if (markers.has(q)) continue;
      if (patternsFor(q).some((p) => p.test(normalized[i]))) markers.set(q, i);
    }
  }

  const sortedQs = [...questionNumbers].sort((a, b) => a - b);
  const segments: Array<{ questionNo: number; answerText: string; lineBoxes: LineBox[] }> = [];

  for (let idx = 0; idx < sortedQs.length; idx++) {
    const q = sortedQs[idx];
    const start = markers.get(q);
    if (start == null) continue;
    const nextQ = sortedQs[idx + 1];
    const endExclusive = nextQ != null && markers.get(nextQ) != null ? (markers.get(nextQ) as number) : lines.length;

    const slice = lines.slice(start, endExclusive);
    const answerText = slice.map((l) => l.text).join("\n").trim();
    segments.push({ questionNo: q, answerText, lineBoxes: slice });
  }

  return segments;
}

export function findQAPairsFromLines(
  lines: LineBox[]
): Array<{ questionNo: number; questionText: string; answerText: string }> {
  const text = lines.map((l) => l.text).join("\n");
  const normalized = normalizeQaText(text);
  const re = /(^|\n)\s*(\d+)[.)]\s*(.+?)\s+ans:\s*([\s\S]*?)(?=\n\s*\d+[.)]\s+|$)/gi;
  const pairs: Array<{ questionNo: number; questionText: string; answerText: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) != null) {
    const no = Number(m[2]);
    const q = String(m[3]).trim();
    const a = String(m[4]).trim();
    if (Number.isFinite(no) && q) {
      pairs.push({ questionNo: no, questionText: q, answerText: a });
    }
  }
  return pairs;
}

export function normalizeQaText(text: string): string {
  let t = String(text ?? "");
  t = t.replace(/\r/g, "\n");
  t = t.replace(/-\s*\n\s*/g, "");
  t = t.replace(/^\s*page\s+\d+.*$/gmi, "");
  t = t.replace(/[^\S\n]+/g, " ");
  t = t.replace(/(ans|answer)\s*[:\-.]?\s*/gi, "ans: ");
  return t.trim();
}

export function detectNumberBlocks(
  lines: LineBox[]
): Array<{ questionNo: number; lineBoxes: LineBox[]; text: string }> {
  const normalized = lines.map((l) => l.text.replace(/[^\S\n]+/g, " ").trim());
  const markerAt: Array<{ idx: number; no: number }> = [];
  for (let i = 0; i < normalized.length; i++) {
    const s = normalized[i];
    let m: RegExpMatchArray | null = null;
    m = s.match(/^Q\s*(\d+)\b/i);
    if (!m) m = s.match(/^\(?\s*(\d+)\s*[.)\-:]\s+/);
    if (m) {
      const no = Number(m[1]);
      if (Number.isFinite(no)) {
        markerAt.push({ idx: i, no });
      }
    }
  }
  const blocks: Array<{ questionNo: number; lineBoxes: LineBox[]; text: string }> = [];
  markerAt.sort((a, b) => a.idx - b.idx);
  for (let i = 0; i < markerAt.length; i++) {
    const start = markerAt[i];
    const endIdx = i + 1 < markerAt.length ? markerAt[i + 1].idx : lines.length;
    const slice = lines.slice(start.idx, endIdx);
    const text = slice.map((l) => l.text).join("\n").trim();
    blocks.push({ questionNo: start.no, lineBoxes: slice, text });
  }
  return blocks;
}

export function normalizeForGrading(questionText: string, answerText: string): string {
  let a = String(answerText ?? "");
  const q = String(questionText ?? "");
  const hasX = /\bx\b/i.test(q);
  const hasY = /\by\b/i.test(q);
  const hasN = /\bn\b/i.test(q);

  a = a.replace(/[–—−]/g, "-");
  a = a.replace(/[×✕✖]/g, "x");
  a = a.replace(/[＝]/g, "=");
  a = a.replace(/[：]/g, ":");
  a = a.replace(/\s+/g, " ").replace(/\s*\n\s*/g, "\n");

  if (hasX && !/\bx\b/i.test(a)) {
    a = a
      .replace(/(^|[^A-Za-z0-9])n(?=\b)/g, "$1x")
      .replace(/(?<=\d)n(?=\b)/g, "x");
  }
  if (hasY && !/\by\b/i.test(a)) {
    a = a
      .replace(/(^|[^A-Za-z0-9])v(?=\b)/g, "$1y")
      .replace(/(?<=\d)v(?=\b)/g, "y");
  }
  if (!hasX && hasN && /\bx\b/i.test(a)) {
    a = a.replace(/(^|[^A-Za-z0-9])x(?=\b)/g, "$1n");
  }

  return a.trim();
}
