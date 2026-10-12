# Receipt PDF renderer

Mozilla PDF.js, npm package `pdfjs-dist` version `6.4.299`.
Source: https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz
License: Apache-2.0; see the included LICENSE.

Only minified browser modules and their CMaps, standard fonts and WebAssembly
assets are included. They are loaded from this portal's origin only when a
user opens a PDF receipt. Receipt data is never sent to a third-party viewer.

Keep the versioned directory and the path in components/useReceiptPdf.ts in
sync when upgrading. Do not replace files under an already released path.
