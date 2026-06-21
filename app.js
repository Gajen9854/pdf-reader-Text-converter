/* --------------------------------------------------------------
   PDF‑JS worker (must be set before any pdfjsLib call)
   -------------------------------------------------------------- */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.worker.min.js';

/* --------------------------------------------------------------
   DOM references & state variables
   -------------------------------------------------------------- */
const pdfViewer = document.getElementById('pdfViewer');
const textReader = document.getElementById('textReader');
const readerContent = document.getElementById('readerContent');

const dictionaryPanel = document.getElementById('dictionaryPanel');
const wordInfo = document.getElementById('wordInfo');

const nightModeToggle = document.getElementById('nightModeToggle');
const textReaderToggle = document.getElementById('textReaderToggle');
const pdfUpload = document.getElementById('pdfUpload');

const prevBtn = document.getElementById('prevPageBtn');
const nextBtn = document.getElementById('nextPageBtn');
const zoomSelect = document.getElementById('zoomSelect');

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');

/* State */
let currentPdf = null;          // PDFDocumentProxy
let currentPageNumber = 1;
let pageScale = 1.0;            // default 100 %
let isNightMode = false;
let isTextReaderActive = false;

/* Simple LRU cache for dictionary look‑ups */
const dictCache = new Map();

/* --------------------------------------------------------------
   Initialise UI / event listeners
   -------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  /* Persist night mode between sessions */
  if (localStorage.getItem('nightMode') === 'true') toggleNightMode(true);

  /* Button handlers */
  nightModeToggle.addEventListener('click', () => toggleNightMode());
  textReaderToggle.addEventListener('click', () => toggleTextReader());

  pdfUpload.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    await loadPDF(file);
  });

  /* Prev / Next */
  prevBtn.addEventListener('click', () => goToPage(currentPageNumber - 1));
  nextBtn.addEventListener('click', () => goToPage(currentPageNumber + 1));

  /* Zoom select */
  zoomSelect.addEventListener('change', ev => {
    const val = ev.target.value;
    pageScale = (val === 'fit') ? null : parseFloat(val); // null means fit‑to‑width
    renderPage(currentPageNumber);
  });

  /* Dictionary search right side */
  searchBtn.addEventListener('click', () => lookupWord(searchInput.value.trim()));
  searchInput.addEventListener('keyup', e => {
    if (e.key === 'Enter') lookupWord(searchInput.value.trim());
  });

  /* Drag‑and‑drop (same as viewer) */
  const dragEvents = ['dragenter', 'dragover'];
  dragEvents.forEach(e =>
    pdfViewer.addEventListener(e, ev => { ev.preventDefault(); pdfViewer.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach(e =>
    pdfViewer.addEventListener(e, ev => { ev.preventDefault(); pdfViewer.classList.remove('dragover'); })
  );

  pdfViewer.addEventListener('drop', async ev => {
    const file = ev.dataTransfer.files[0];
    if (file) await loadPDF(file);
  });

  /* Re‑render on window resize – useful for Fit‑to‑width */
  window.addEventListener('resize', () => renderPage(currentPageNumber));
});

/* --------------------------------------------------------------
   Night‑mode toggle
   -------------------------------------------------------------- */
function toggleNightMode(forceSet) {
  isNightMode = forceSet !== undefined ? !!forceSet : !isNightMode;
  document.body.classList.toggle('night-mode', isNightMode);
  nightModeToggle.classList.toggle('active', isNightMode);
  localStorage.setItem('nightMode', isNightMode);
}

/* --------------------------------------------------------------
   Text‑Reader toggle
   -------------------------------------------------------------- */
function toggleTextReader() {
  isTextReaderActive = !isTextReaderActive;
  textReader.classList.toggle('active', isTextReaderActive);
  textReaderToggle.classList.toggle('active', isTextReaderActive);

  if (isTextReaderActive && currentPdf) showPageText(currentPageNumber);
}

/* --------------------------------------------------------------
   Load a PDF file
   -------------------------------------------------------------- */
async function loadPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    currentPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    if (!currentPdf || !currentPdf.numPages) throw new Error('No pages found');

    /* Reset state */
    currentPageNumber = 1;
    pageScale = 1.0;

    renderPage(currentPageNumber);

    /* Extract entire document once (for dictionary look‑ups only) */
    extractTextFromPdf(currentPdf);
  } catch (err) {
    console.error(err);
    alert(`Could not open PDF: ${err.message}`);
  }
}

/* --------------------------------------------------------------
   Go to a specific page (bounds checked)
   -------------------------------------------------------------- */
function goToPage(pageNum) {
  if (!currentPdf || pageNum < 1 || pageNum > currentPdf.numPages) return;
  currentPageNumber = pageNum;
  renderPage(currentPageNumber);
  if (isTextReaderActive) showPageText(currentPageNumber);
}

/* --------------------------------------------------------------
   Render a single page onto the canvas
   -------------------------------------------------------------- */
async function renderPage(pageNum) {
  if (!currentPdf) return;

  const page = await currentPdf.getPage(pageNum);

  /* Compute scale – if 'fit' is chosen, calculate based on viewer width */
  let scale;
  if (pageScale === null) {                    // fit‑to‑width
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = pdfViewer.clientWidth - 20; // padding
    scale = containerWidth / viewport.width;
  } else {
    scale = pageScale;
  }

  const viewport = page.getViewport({ scale });

  /* Create canvas */
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width  = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;

  /* Show only the current canvas (clear old ones) */
  pdfViewer.innerHTML = '';
  pdfViewer.appendChild(canvas);
}

/* --------------------------------------------------------------
   Extract text from **entire** PDF – used for dictionary look‑ups
   -------------------------------------------------------------- */
async function extractTextFromPdf(pdf) {
  try {
    const pages = pdf.numPages;
    let fullText = '';

    for (let i = 1; i <= pages; i++) {
      const txt = await extractTextFromPage(i);
      fullText += ' ' + txt;
    }

    currentPdf.text = cleanText(fullText);
  } catch (err) {
    console.error('Text extraction error', err);
  }
}

/* --------------------------------------------------------------
   Extract text from a **single** page
   -------------------------------------------------------------- */
async function extractTextFromPage(pageNum) {
  const page = await currentPdf.getPage(pageNum);
  const txt = await page.getTextContent();
  const strings = txt.items.map(it => it.str);
  return cleanText(strings.join(' '));
}

/* --------------------------------------------------------------
   Clean a string (remove newlines, duplicate spaces)
   -------------------------------------------------------------- */
function cleanText(str) {
  return str.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/* --------------------------------------------------------------
   Show text of the current page in Text‑Reader pane
   -------------------------------------------------------------- */
async function showPageText(pageNum) {
  const txt = await extractTextFromPage(pageNum);
  readerContent.textContent = txt;
  readerContent.addEventListener('dblclick', handleWordSelectionInReader);
}

/* --------------------------------------------------------------
   Double‑click in Text‑Reader → dictionary lookup
   -------------------------------------------------------------- */
async function handleWordSelectionInReader(e) {
  const sel = window.getSelection();
  if (!sel || !sel.toString().trim()) return;

  await lookupWord(sel.toString().split(/\s+/)[0]);

  /* Highlight for a short time */
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.className = 'highlight';
  range.surroundContents(span);
  setTimeout(() => {
    if (span.parentNode) span.parentNode.replaceChild(document.createTextNode(sel.toString()), span);
  }, 1500);
}

/* --------------------------------------------------------------
   Dictionary lookup – left panel
   -------------------------------------------------------------- */
async function lookupWord(word) {
  const key = word.toLowerCase();
  dictionaryPanel.classList.add('active');
  wordInfo.innerHTML = `<p>Looking up <em>"${word}"</em>…</p>`;

  if (dictCache.has(key)) return displayWordInfo(dictCache.get(key), word);

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${key}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    dictCache.set(key, data);
    displayWordInfo(data, word);
  } catch (err) {
    wordInfo.innerHTML = `<p>No definition found for <em>"${word}"</em></p>`;
  }
}

/* --------------------------------------------------------------
   Render dictionary entry – left panel
   -------------------------------------------------------------- */
function displayWordInfo(data, term) {
  const entry = data[0];
  let html = `<h3>${term}</h3>`;

  /* Phonetics (if any) */
  if (entry.phonetics?.length) {
    const phonetic = entry.phonetics.find(p => p.text);
    if (phonetic) html += `<p><em>Pronunciation:</em> ${phonetic.text}</p>`;
  }

  /* Meanings */
  if (entry.meanings?.length) {
    html += '<div class="meanings">';
    entry.meanings.forEach(m => {
      html += `<div class="meaning"><strong>${m.partOfSpeech}</strong>`;
      m.definitions.slice(0, 3).forEach(d => {
        html += `<p>- ${d.definition}</p>`;
        if (d.example) html += `<em>Example: "${d.example}"</em><br>`;
      });
      html += '</div>';
    });
    html += '</div>';
  }

  wordInfo.innerHTML = html;
}

/* --------------------------------------------------------------
   Dictionary search on the right side
   -------------------------------------------------------------- */
async function lookupRightPanel(word) {
  const key = word.toLowerCase();
  if (dictCache.has(key)) return renderSearchResult(dictCache.get(key), word);

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${key}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    dictCache.set(key, data);
    renderSearchResult(data, word);
  } catch (err) {
    searchResults.innerHTML = `<p>No definition for <em>${word}</em></p>`;
  }
}

/*function renderSearchResult(data, term) {
  const entry = data[0];
  let html = `<h4>${term}</h4>`;

  if (entry.phonetics?.length) {
    const phonetic = entry.phonetics.find(p => p.text);
    if (phonetic) html += `<p><em>Pronunciation:</em> ${phonetic.text}</p>`;
  }

  if (entry.meanings?.length) {
    entry.meanings.forEach(m => {
      html += `<div class="meaning"><strong>${m.partOfSpeech}</strong>`;
      m.definitions.slice(0, 2).forEach(d => {
        html += `<p>- ${d.definition}</p>`;
        if (d.example) html += `<em>Example: "${d.example}"</em><br>`;
      });
      html += '</div>';
    });
  }

  searchResults.innerHTML = html;
}*/

/* Wire the right‑panel button */
searchBtn.addEventListener('click', () => lookupRightPanel(searchInput.value.trim()));
