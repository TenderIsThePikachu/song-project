import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BASS_NOTES,
  CHICAGO_STREET_NOTES,
  DRUM_TRACK_LABELS,
  GLOCKENSPIEL_NOTES,
  GUITAR_TRACK_LABELS,
  MELODY_NOTES,
  PICCOLO_NOTES,
  SAXOPHONE_NOTES,
  STUDIO_ALTO_SAX_NOTES,
  SUPPORTING_PIANO_NOTES,
  VIOLIN_NOTES,
} from '../constants/composer';
import {
  LYRICS_MELODY_TRACK_ID,
  type ExtraInstrumentTrack,
  type InstrumentKey,
  useSongStore,
} from '../store/songStore';
import { buildMusicXml, hasTrackNotes, type MusicXmlTrack } from '../utils/musicXml';
import './ScoreViewer.css';

type ScoreViewerProps = {
  open: boolean;
  title: string;
  creator?: string;
  createdAt?: number;
  updatedAt?: number;
  onClose: () => void;
  parts: Array<{
    id: string;
    trackId?: string;
    instrument: InstrumentKey;
    name: string;
  }>;
};

type ScoreRenderer = {
  Zoom: number;
  clear: () => void;
  load: (content: string) => Promise<unknown>;
  render: () => void;
};

type ScoreTrackOption = {
  id: string;
  name: string;
  track: MusicXmlTrack | null;
};

const scorePartNames: Partial<Record<InstrumentKey, { name: string; shortName: string }>> = {
  melody: { name: '피아노', shortName: '피아노' },
  violin: { name: '바이올린', shortName: '바이올린' },
  saxophone: { name: '색소폰', shortName: '색소폰' },
  guitar: { name: '통기타', shortName: '기타' },
  bass: { name: '베이스', shortName: '베이스' },
  drums: { name: '드럼', shortName: '드럼' },
  glockenspiel: { name: '클로켄', shortName: '클로켄' },
  piccolo: { name: '피콜로', shortName: '피콜로' },
  supportingPiano: { name: '서포팅', shortName: '서포팅' },
  chicagoStreet: { name: '시카고', shortName: '시카고' },
  studioAltoSax: { name: '알토', shortName: '알토' },
};

function getScorePartNames(instrument: InstrumentKey, displayName: string) {
  const names = scorePartNames[instrument];
  const suffix = displayName.match(/\s+\d+$/)?.[0] ?? '';
  if (displayName.startsWith('AI 보컬')) {
    return { name: `AI 보컬${suffix}`, shortName: `보컬${suffix}` };
  }
  return names
    ? { name: `${names.name}${suffix}`, shortName: `${names.shortName}${suffix}` }
    : { name: displayName, shortName: displayName };
}

type ScoreRendererModule = typeof import('opensheetmusicdisplay');
let scoreRendererModulePromise: Promise<ScoreRendererModule> | null = null;

function loadScoreRendererModule() {
  if (!scoreRendererModulePromise) {
    scoreRendererModulePromise = import('opensheetmusicdisplay').catch((error) => {
      scoreRendererModulePromise = null;
      throw error;
    });
  }
  return scoreRendererModulePromise;
}

void loadScoreRendererModule();

const instrumentPitches: Record<Exclude<InstrumentKey, 'drums'>, readonly string[]> = {
  melody: MELODY_NOTES,
  violin: VIOLIN_NOTES,
  saxophone: SAXOPHONE_NOTES,
  guitar: GUITAR_TRACK_LABELS,
  bass: BASS_NOTES,
  glockenspiel: GLOCKENSPIEL_NOTES,
  piccolo: PICCOLO_NOTES,
  supportingPiano: SUPPORTING_PIANO_NOTES,
  chicagoStreet: CHICAGO_STREET_NOTES,
  studioAltoSax: STUDIO_ALTO_SAX_NOTES,
};

const drumDisplayPitches = ['F4', 'C5', 'G5', 'D5', 'A5'] as const;
const drumMidiNotes = [36, 38, 42, 39, 56] as const;

function extraTrackToScoreTrack(
  track: ExtraInstrumentTrack,
  noteLyrics: Record<string, string>
): MusicXmlTrack | null {
  if (track.instrument === 'drums') {
    return {
      id: track.id,
      name: track.label,
      grid: track.grid,
      pitches: drumDisplayPitches,
      percussion: true,
      percussionNames: DRUM_TRACK_LABELS,
      percussionMidiNotes: drumMidiNotes,
    };
  }
    return {
      id: track.id,
      name: track.label,
      grid: track.grid,
      lengths: track.melodyLengths,
      pitches: instrumentPitches[track.instrument],
      lyrics: track.id === LYRICS_MELODY_TRACK_ID ? noteLyrics : undefined,
      grandStaff: track.instrument === 'melody' || track.instrument === 'supportingPiano',
  };
}

function ScoreIcon({ name }: { name: 'close' | 'download' | 'minus' | 'plus' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === 'close' ? <path d="m6 6 12 12M18 6 6 18" /> : null}
      {name === 'download' ? <path d="M12 3v12m0 0 5-5m-5 5-5-5M4 19h16" /> : null}
      {name === 'minus' ? <path d="M5 12h14" /> : null}
      {name === 'plus' ? <path d="M5 12h14M12 5v14" /> : null}
    </svg>
  );
}

function sanitizeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ') || '제목 없는 곡';
}

const PDF_KOREAN_FONT_FILE = 'NanumGothic-Regular.ttf';
const PDF_KOREAN_FONT_NAME = 'NanumGothic';
const KOREAN_TEXT_PATTERN = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;
let pdfKoreanFontPromise: Promise<string> | null = null;

function loadPdfKoreanFont() {
  if (!pdfKoreanFontPromise) {
    pdfKoreanFontPromise = fetch(`/fonts/${PDF_KOREAN_FONT_FILE}`)
      .then((response) => {
        if (!response.ok) throw new Error('PDF 한글 폰트를 불러오지 못했습니다.');
        return response.arrayBuffer();
      })
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
        }
        return btoa(binary);
      })
      .catch((error) => {
        pdfKoreanFontPromise = null;
        throw error;
      });
  }
  return pdfKoreanFontPromise;
}

function applyKoreanFontToSvg(svg: SVGSVGElement) {
  svg.querySelectorAll<SVGElement>('text, tspan').forEach((element) => {
    if (!KOREAN_TEXT_PATTERN.test(element.textContent ?? '')) return;
    element.setAttribute('font-family', PDF_KOREAN_FONT_NAME);
    element.style.fontFamily = PDF_KOREAN_FONT_NAME;
  });
}

function styleInstrumentLabels(container: ParentNode, instrumentNames: string[]) {
  const names = new Set(instrumentNames);
  container.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => {
    svg.querySelectorAll<SVGTextElement>('text').forEach((element) => {
      if (!names.has(element.textContent?.trim() ?? '')) return;
      element.setAttribute('font-family', PDF_KOREAN_FONT_NAME);
      element.setAttribute('font-weight', '400');
      element.setAttribute('fill', '#000000');
      element.style.fontFamily = PDF_KOREAN_FONT_NAME;
    });
  });
}

function getInstrumentLabelNames(tracks: MusicXmlTrack[]) {
  return tracks.flatMap((track) => [track.name, track.shortName ?? track.name]);
}

function formatScoreDate(timestamp?: number) {
  if (!timestamp || !Number.isFinite(timestamp)) return null;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function ScoreViewer({
  open,
  title,
  creator,
  createdAt,
  updatedAt,
  onClose,
  parts,
}: ScoreViewerProps) {
  const bpm = useSongStore((state) => state.bpm);
  const melody = useSongStore((state) => state.melody);
  const melodyLengths = useSongStore((state) => state.melodyLengths);
  const violin = useSongStore((state) => state.violin);
  const violinLengths = useSongStore((state) => state.violinLengths);
  const saxophone = useSongStore((state) => state.saxophone);
  const saxophoneLengths = useSongStore((state) => state.saxophoneLengths);
  const guitar = useSongStore((state) => state.guitar);
  const guitarLengths = useSongStore((state) => state.guitarLengths);
  const drums = useSongStore((state) => state.drums);
  const bass = useSongStore((state) => state.bass);
  const bassLengths = useSongStore((state) => state.bassLengths);
  const steps = useSongStore((state) => state.steps);
  const extraTracks = useSongStore((state) => state.extraTracks);
  const noteLyrics = useSongStore((state) => state.noteLyrics);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ScoreRenderer | null>(null);
  const zoomRef = useRef(0.9);
  const [selectedTrackId, setSelectedTrackId] = useState('all');
  const [zoom, setZoom] = useState(0.9);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [renderError, setRenderError] = useState('');

  const trackOptions = useMemo(() => {
    return parts.map((part): ScoreTrackOption => {
      const displayName = part.instrument === 'supportingPiano'
        ? '서포팅 캐스트 피아노'
        : part.name;
      const scoreNames = getScorePartNames(part.instrument, displayName);
      const usesImplicitExtraTrack = [
        'glockenspiel',
        'piccolo',
        'supportingPiano',
        'chicagoStreet',
        'studioAltoSax',
      ].includes(part.instrument);
      const extraTrack = part.trackId
        ? extraTracks.find((track) => track.id === part.trackId)
        : usesImplicitExtraTrack
          ? extraTracks.find((track) => track.instrument === part.instrument)
          : undefined;
      const extraScoreTrack = extraTrack ? extraTrackToScoreTrack(extraTrack, noteLyrics) : null;
      if (extraScoreTrack) {
        return {
          id: part.id,
          name: displayName,
          track: {
            ...extraScoreTrack,
            id: part.id,
            name: scoreNames.name,
            shortName: scoreNames.shortName,
          },
        };
      }

      let track: MusicXmlTrack | null = null;
      switch (part.instrument) {
        case 'melody':
          track = { id: part.id, name: scoreNames.name, shortName: scoreNames.shortName, grid: melody, lengths: melodyLengths, pitches: MELODY_NOTES, grandStaff: true };
          break;
        case 'violin':
          track = { id: part.id, name: scoreNames.name, shortName: scoreNames.shortName, grid: violin, lengths: violinLengths, pitches: VIOLIN_NOTES };
          break;
        case 'saxophone':
          track = { id: part.id, name: scoreNames.name, shortName: scoreNames.shortName, grid: saxophone, lengths: saxophoneLengths, pitches: SAXOPHONE_NOTES };
          break;
        case 'guitar':
          track = { id: part.id, name: scoreNames.name, shortName: scoreNames.shortName, grid: guitar, lengths: guitarLengths, pitches: GUITAR_TRACK_LABELS };
          break;
        case 'drums':
          track = {
            id: part.id,
            name: scoreNames.name,
            shortName: scoreNames.shortName,
            grid: drums,
            pitches: drumDisplayPitches,
            percussion: true,
            percussionNames: DRUM_TRACK_LABELS,
            percussionMidiNotes: drumMidiNotes,
          };
          break;
        case 'bass':
          track = { id: part.id, name: scoreNames.name, shortName: scoreNames.shortName, grid: bass, lengths: bassLengths, pitches: BASS_NOTES };
          break;
        default:
          break;
      }

      return { id: part.id, name: displayName, track };
    });
  }, [
    bass,
    bassLengths,
    drums,
    extraTracks,
    guitar,
    guitarLengths,
    melody,
    melodyLengths,
    noteLyrics,
    parts,
    saxophone,
    saxophoneLengths,
    violin,
    violinLengths,
  ]);

  const availableTracks = useMemo(
    () => trackOptions.flatMap((option) => option.track && hasTrackNotes(option.track) ? [option.track] : []),
    [trackOptions]
  );

  const selectedTracks = useMemo(
    () => selectedTrackId === 'all'
      ? availableTracks
      : availableTracks.filter((track) => track.id === selectedTrackId),
    [availableTracks, selectedTrackId]
  );
  const createdLabel = formatScoreDate(createdAt);
  const updatedLabel = updatedAt && (!createdAt || Math.abs(updatedAt - createdAt) >= 60_000)
    ? formatScoreDate(updatedAt)
    : null;
  const musicXml = useMemo(
    () => buildMusicXml({
      title,
      creator,
      bpm,
      tracks: selectedTracks,
    }),
    [bpm, creator, selectedTracks, title]
  );

  useEffect(() => {
    if (selectedTrackId !== 'all' && !trackOptions.some((option) => option.id === selectedTrackId)) {
      setSelectedTrackId('all');
    }
  }, [selectedTrackId, trackOptions]);

  useEffect(() => {
    if (!open) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !containerRef.current || !selectedTracks.length) return undefined;
    let cancelled = false;
    const container = containerRef.current;
    setIsLoading(true);
    setRenderError('');

    const renderScore = async () => {
      try {
        const { OpenSheetMusicDisplay } = await loadScoreRendererModule();
        if (cancelled) return;
        container.replaceChildren();
        const renderer = new OpenSheetMusicDisplay(container, {
          autoResize: true,
          backend: 'svg',
          drawingParameters: 'default',
          drawCredits: true,
          drawTitle: true,
          drawComposer: true,
          drawMeasureNumbers: true,
          drawMeasureNumbersOnlyAtSystemStart: false,
          measureNumberInterval: 4,
          autoBeam: true,
          alignRests: 2,
          drawPartNames: true,
          drawPartAbbreviations: true,
        });
        renderer.EngravingRules.TitleBottomDistance = 2.5;
        renderer.EngravingRules.SystemLabelsRightMargin = 2.5;
        renderer.EngravingRules.MinimumDistanceBetweenSystems = 9;
        renderer.EngravingRules.MinSkyBottomDistBetweenSystems = 5;
        await renderer.load(musicXml);
        if (cancelled) return;
        renderer.Zoom = zoomRef.current;
        renderer.render();
        styleInstrumentLabels(container, getInstrumentLabelNames(selectedTracks));
        rendererRef.current = renderer;
      } catch (error) {
        console.error('Score rendering failed:', error);
        if (!cancelled) setRenderError('악보를 표시하지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void renderScore();

    return () => {
      cancelled = true;
      rendererRef.current?.clear();
      rendererRef.current = null;
      container.replaceChildren();
    };
  }, [musicXml, open, selectedTracks]);

  useEffect(() => {
    zoomRef.current = zoom;
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.Zoom = zoom;
    renderer.render();
    if (containerRef.current) {
      styleInstrumentLabels(containerRef.current, getInstrumentLabelNames(selectedTracks));
    }
  }, [selectedTracks, zoom]);

  if (!open) return null;

  const downloadMusicXml = () => {
    const blob = new Blob([musicXml], { type: 'application/vnd.recordare.musicxml+xml' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sanitizeFileName(title)}.musicxml`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!selectedTracks.length || isExportingPdf) return;

    setIsExportingPdf(true);
    try {
      const previewContainer = containerRef.current;
      if (!previewContainer) throw new Error('PDF로 변환할 악보가 없습니다.');

      const scoreSvgs = [...previewContainer.querySelectorAll<SVGSVGElement>('svg')]
        .flatMap((sourceSvg) => {
          const sourceViewBox = sourceSvg.viewBox.baseVal;
          const bounds = sourceSvg.getBoundingClientRect();
          const width = sourceViewBox.width || bounds.width;
          const height = sourceViewBox.height || bounds.height;
          if (!width || !height) return [];

          return [{
            svg: sourceSvg.cloneNode(true) as SVGSVGElement,
            viewBox: { x: sourceViewBox.x, y: sourceViewBox.y, width, height },
          }];
        });
      if (!scoreSvgs.length) throw new Error('PDF로 변환할 악보가 없습니다.');

      const [{ jsPDF }] = await Promise.all([
        import('jspdf'),
        import('svg2pdf.js'),
      ]);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const koreanFont = await loadPdfKoreanFont();
      pdf.addFileToVFS(PDF_KOREAN_FONT_FILE, koreanFont);
      pdf.addFont(PDF_KOREAN_FONT_FILE, PDF_KOREAN_FONT_NAME, 'normal');
      pdf.addFont(PDF_KOREAN_FONT_FILE, PDF_KOREAN_FONT_NAME, 'bold');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      let hasPageContent = false;

      for (const scoreSvg of scoreSvgs) {
        const { svg: sourceSvg, viewBox } = scoreSvg;
        const sourceWidth = viewBox.width;
        const sourceHeight = viewBox.height;

        let sourceY = 0;
        while (sourceY < sourceHeight) {
          if (hasPageContent) pdf.addPage('a4', 'portrait');
          const scoreY = margin;
          const availableHeight = pageHeight - margin - scoreY;
          const sourcePageHeight = sourceWidth * (availableHeight / contentWidth);
          const visibleHeight = Math.min(sourcePageHeight, sourceHeight - sourceY);
          const drawHeight = visibleHeight * (contentWidth / sourceWidth);

          const pageSvg = sourceSvg.cloneNode(true) as SVGSVGElement;
          pageSvg.setAttribute(
            'viewBox',
            `${viewBox.x} ${viewBox.y + sourceY} ${sourceWidth} ${visibleHeight}`
          );
          pageSvg.setAttribute('width', String(sourceWidth));
          pageSvg.setAttribute('height', String(visibleHeight));
          applyKoreanFontToSvg(pageSvg);
          await pdf.svg(pageSvg, {
            x: margin,
            y: scoreY,
            width: contentWidth,
            height: drawHeight,
          });
          hasPageContent = true;
          sourceY += visibleHeight;
        }
      }

      if (!hasPageContent) throw new Error('PDF로 변환할 악보가 없습니다.');
      pdf.save(`${sanitizeFileName(title)}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF 파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return createPortal(
    <div className="score-viewer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="score-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="읽기 전용 악보"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="score-viewer-header">
          <div className="score-viewer-title">
            <span>READ ONLY</span>
            <strong>{title.trim() || '제목 없는 곡'}</strong>
            <dl className="score-viewer-meta">
              {createdLabel ? <div><dt>작성</dt><dd>{createdLabel}</dd></div> : null}
              {updatedLabel ? <div><dt>수정</dt><dd>{updatedLabel}</dd></div> : null}
              <div><dt>템포</dt><dd>{bpm} BPM</dd></div>
              <div><dt>길이</dt><dd>{Math.max(1, Math.ceil(steps / 16))}마디</dd></div>
              <div><dt>파트</dt><dd>{availableTracks.length}개</dd></div>
            </dl>
          </div>
          <button type="button" className="score-viewer-icon-button" onClick={onClose} aria-label="악보 닫기">
            <ScoreIcon name="close" />
          </button>
        </header>

        <div className="score-viewer-toolbar">
          <label className="score-viewer-track-select">
            <span>파트</span>
            <select value={selectedTrackId} onChange={(event) => setSelectedTrackId(event.target.value)}>
              <option value="all">전체 악기</option>
              {trackOptions.map((option) => (
                <option key={option.id} value={option.id} disabled={!option.track}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <div className="score-viewer-zoom" aria-label="악보 확대 축소">
            <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))} aria-label="축소"><ScoreIcon name="minus" /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))} aria-label="확대"><ScoreIcon name="plus" /></button>
          </div>
          <div className="score-viewer-actions">
            <button type="button" onClick={downloadMusicXml} disabled={!selectedTracks.length}>
              <ScoreIcon name="download" /> MusicXML
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={() => void exportPdf()}
              disabled={!selectedTracks.length || isExportingPdf}
              aria-label="악보를 PDF로 저장"
              title="PDF로 저장"
            >
              {isExportingPdf ? 'PDF 저장 중...' : 'PDF'}
            </button>
          </div>
        </div>

        <div className="score-viewer-paper-shell">
          {!selectedTracks.length ? (
            <div className="score-viewer-empty"><strong>선택한 파트에 표시할 노트가 없습니다.</strong><span>피아노롤에 노트를 입력한 뒤 다시 열어주세요.</span></div>
          ) : null}
          {isLoading ? <div className="score-viewer-loading">악보를 만드는 중...</div> : null}
          {renderError ? <div className="score-viewer-empty"><strong>{renderError}</strong></div> : null}
          <div ref={containerRef} className="score-viewer-canvas" />
        </div>
      </section>
    </div>,
    document.body
  );
}
