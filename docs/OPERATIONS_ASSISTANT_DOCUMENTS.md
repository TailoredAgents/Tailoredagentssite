# Employee assistant documents

Employees can upload files in Assistant → **Upload files**, wait for extraction, select up to five files, and ask a question or request a downloadable brief/table. **Files & results** lists accessible uploads and generated files. The detail page provides extracted sections, source links, download, explicit sharing and deletion. Each source has an immutable content hash; a replacement is a new upload/version.

## Supported formats and actual limits

- PDF: up to 100 pages. Text extraction preserves page references; reading order and tables may need visual inspection. Scanned pages retain a source reference and can be inspected one page at a time.
- DOCX: main-body paragraphs and table text. Headers, footnotes, comments, images and layout are not extracted.
- TXT/Markdown: UTF-8 text with line references. HTML/program files are not supported.
- CSV/XLSX: up to 10,000 rows and 50,000 cells across up to 20 XLSX worksheets, including hidden sheets. Values and saved formula results are read; no formulas, macros or external links execute. Custom number formats are identified; supported built-in dates are converted. Charts and layout are not reproduced.
- Still PNG/JPEG: up to 16 million pixels. Visual reading uses a metadata-free image bounded to 768 pixels on each side. Fine print, names and numbers may require confirmation.
- All uploads: 10 MB per file, five attachments per message, one million extracted characters, 12,000 bounded sections. Office archives additionally cap expansion at 32 MB, individual entries at 12 MB and entry count at 400. Invalid, encrypted, active-content and oversized files fail with an explanation.
- Storage: 50 MB / 200 files per employee and 250 MB / 1,000 files per workspace. Temporary files expire after 90 days. Deleting files releases their quota; metadata needed to prevent duplicate requests remains.
- Outputs: actual PDF/DOCX briefs and CSV/XLSX tables, up to 500 rows and 12 columns. Unsupported PDF glyphs request DOCX instead of silently losing characters. CSV formula-like strings are neutralized; XLSX strings are explicitly typed as text. Source references appear in briefs, the XLSX notes/source sheet and the private detail page. CSV contains the requested table only.

## Access, processing and costs

Uploads start private. The owner can share with current employees or the workspace; naming a client/project does not share a file. Generated results that reference private source files remain private. Download and tool access check current membership and all source ancestors. Sharing changes stop active assignments using affected files. Every subsequent model/tool step rechecks the assignment's source access; a request already in flight may finish, but its result cannot advance a stopped assignment.

Bytes are encrypted in the dedicated assistant document tables with a purpose-specific key derived from the dashboard auth secret. This does not change the database's backup/retention policy. Keep the existing secret stable; rotating it requires a document-key migration before old encrypted uploads can be read. Extracted text is permissioned in PostgreSQL and searched without an external vector service. No Factory storage keys or public buckets are reused.

Uploads and extraction leases are persisted. One extraction per workspace runs at a time in a worker with no application secret environment, a 20-second timeout and bounded V8 memory. The parser accepts data only; uploaded programs never run. PDF/XML remote resources are disabled. Expired claims can recover at most three times; parser failures do not silently bill AI. The existing assistant cron recovers queued work, and an open file list helps drain its owner's pending uploads. This worker is not a general-purpose code sandbox or an antivirus product.

Deterministic extraction, search and exports have no model charge. `inspect_document_image` submits only a selected image/PDF page to the company AI service, reserves conservatively within the same assignment and shared monthly ledger, and records actual usage. A saved provider response is reused; unknown outcomes are not automatically retried. Normal chat generation also uses the existing allowance. No separate website-building or meeting-ingestion budget is used.

Deletion invalidates encrypted bytes, extracted chunks, derived results and active cached assignment state. Past chat text, previously downloaded copies and messages already sent are separately retained; deleting a source cannot retract them. Expiry uses the same invalidation path.

## External attachment policy

Original uploads are **not** declared malware-free and are not yet eligible for assistant email forwarding. The communication milestone may forward only exact reviewed files produced by the data-only renderer (content disarm and regeneration: no original macros, embedded programs, formulas, links or Office objects). Forwarding an original requires a separately configured and tested malware scanner. This boundary must be enforced at final dispatch, not just hidden in the UI.

## Verification and deployment

Synthetic local acceptance covers round trips for all four export formats, formula neutralization, Unicode, quoted CSV, XML entities, archive traversal/expansion/macros, PDF-page rendering, owner/workspace isolation, sharing withdrawal, transitive source permissions, deletion, expiry, parser failures and durable upload identifiers. Desktop and phone browser journeys upload a private source, ask the assistant for a cited DOCX, download the result and delete it. Provider replies are synthetic; no customer messages or real model calls are made.

Independent `python-docx` and `openpyxl` readers confirmed accents, table cells, decimal/negative values, blanks, inert formula-like text and source notes. Poppler rendered the one-page sample and an eight-page table export; inspected pages were legible and within bounds. These checks do not claim a physical iPhone download/share-sheet acceptance or full Word/Excel visual layout testing.

Migration `0058_assistant_documents.sql` is required before enabling the new routes. The parser scripts, font/license and npm dependencies must remain in the release; Next tracing includes them. The Render repository deployment includes them through the normal install/build path. The pinned PDF.js runtime requires Node 22.13 or newer. Live release/cron acceptance is recorded separately in the overall plan.

Third-party references: [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html), [yauzl archive validation](https://github.com/thejoshwolfe/yauzl), [PDF-lib](https://pdf-lib.js.org/docs/api/classes/pdfdocument). The bundled Noto Sans font is distributed under its [SIL Open Font License](../assets/assistant/OFL.txt).
