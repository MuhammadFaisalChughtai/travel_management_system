/**
 * Isolated Iframe PDF & Print Generator
 * Renders HTML/CSS within an isolated iframe context to ensure complete style isolation,
 * correct pagination, accurate font rendering, and avoid CSS bleeding/parent opacity bugs.
 */

let isPrintingGlobalLock = false;

export function normalizeDocumentLayout(html: string): string {
  if (!html || typeof document === 'undefined') return html;

  const isInvoice = /TAX\s*INVOICE/i.test(html) || /TERMS\s*&\s*CONDITIONS/i.test(html);
  if (!isInvoice) return html;

  const temp = document.createElement('div');
  temp.innerHTML = html;

  // 1. Remove any leading page breaks, empty text, or comments at document start
  while (temp.firstChild) {
    const node = temp.firstChild;
    if (node.nodeType === Node.COMMENT_NODE) {
      temp.removeChild(node);
    } else if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      temp.removeChild(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (
        el.classList.contains('page-break') ||
        (el.textContent?.trim() === '' && !el.querySelector('img, table, svg'))
      ) {
        temp.removeChild(node);
      } else {
        break;
      }
    } else {
      break;
    }
  }

  const docRoot = (temp.querySelector('.tax-invoice-document, .doc-container') as HTMLElement) || temp;
  while (docRoot.firstChild) {
    const node = docRoot.firstChild;
    if (node.nodeType === Node.COMMENT_NODE) {
      docRoot.removeChild(node);
    } else if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      docRoot.removeChild(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (
        el.classList.contains('page-break') ||
        (el.textContent?.trim() === '' && !el.querySelector('img, table, svg'))
      ) {
        docRoot.removeChild(node);
      } else {
        break;
      }
    } else {
      break;
    }
  }

  // 2. Identify Terms & Conditions block and Customer Acceptance block
  const allElements = Array.from(temp.querySelectorAll('*'));
  
  const tcHeading = allElements.find((el) => {
    const txt = el.textContent || '';
    return /TERMS\s*&\s*CONDITIONS/i.test(txt) && (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'DIV');
  });

  const sigHeading = allElements.find((el) => {
    const txt = el.textContent || '';
    return (
      /CUSTOMER\s*ACCEPTANCE\s*&\s*SIGNATURE/i.test(txt) ||
      /Legal Acceptance & Booking Confirmation Signatures/i.test(txt)
    );
  });

  const invoiceHeader = allElements.find((el) => {
    const txt = el.textContent || '';
    return /TAX\s*INVOICE/i.test(txt) && (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'DIV' || el.tagName === 'SPAN');
  });

  if (tcHeading && invoiceHeader) {
    let tcContainer: HTMLElement = tcHeading as HTMLElement;
    while (
      tcContainer.parentElement &&
      tcContainer.parentElement !== temp &&
      tcContainer.parentElement !== docRoot &&
      !tcContainer.parentElement.classList.contains('tax-invoice-document') &&
      tcContainer.parentElement.id !== 'invoice-template'
    ) {
      tcContainer = tcContainer.parentElement;
    }

    let sigContainer: HTMLElement | null = null;
    if (sigHeading) {
      sigContainer = sigHeading as HTMLElement;
      while (
        sigContainer.parentElement &&
        sigContainer.parentElement !== temp &&
        sigContainer.parentElement !== docRoot &&
        sigContainer.parentElement !== tcContainer &&
        !sigContainer.parentElement.classList.contains('tax-invoice-document') &&
        sigContainer.parentElement.id !== 'invoice-template'
      ) {
        sigContainer = sigContainer.parentElement;
      }
    }

    const isTcBeforeInvoice = !!(tcContainer.compareDocumentPosition(invoiceHeader) & Node.DOCUMENT_POSITION_FOLLOWING);

    if (isTcBeforeInvoice) {
      tcContainer.remove();

      if (sigContainer && sigContainer !== tcContainer) {
        sigContainer.remove();
      }

      while (docRoot.firstElementChild && docRoot.firstElementChild.classList.contains('page-break')) {
        docRoot.firstElementChild.remove();
      }

      const pageBreak = document.createElement('div');
      pageBreak.className = 'page-break';
      pageBreak.style.cssText = 'page-break-after: always; break-after: page; height: 0; margin: 0; padding: 0;';

      docRoot.appendChild(pageBreak);
      docRoot.appendChild(tcContainer);

      if (sigContainer && sigContainer !== tcContainer) {
        const sigWrap = document.createElement('div');
        sigWrap.style.cssText = 'margin-top: 16px;';
        sigWrap.appendChild(sigContainer);
        docRoot.appendChild(sigWrap);
      }
    } else if (sigContainer && tcContainer && (sigContainer.compareDocumentPosition(tcContainer) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      sigContainer.remove();
      const sigWrap = document.createElement('div');
      sigWrap.style.cssText = 'margin-top: 16px;';
      sigWrap.appendChild(sigContainer);
      docRoot.appendChild(sigWrap);
    }
  }

  return temp.innerHTML;
}

export const printHtmlViaIframe = (
  rawHtml: string,
  css: string = '',
  filename: string = 'document.pdf'
) => {
  if (isPrintingGlobalLock) {
    console.warn('Print already in progress, suppressing duplicate call');
    return;
  }
  isPrintingGlobalLock = true;

  try {
    if (!rawHtml || !rawHtml.trim()) {
      console.warn('printHtmlViaIframe received empty HTML payload');
      isPrintingGlobalLock = false;
      return;
    }

    // Normalize layout order and strip leading empty pages/breaks
    const html = normalizeDocumentLayout(rawHtml);
    const cleanTitle = filename.replace(/\.pdf$/i, '');

    // Set document title immediately so Chrome print dialog adopts it
    const originalDocTitle = document.title;
    if (cleanTitle) {
      document.title = cleanTitle;
    }

    // Remove any previous print virtual frames
    const oldFrame = document.getElementById('global-print-virtual-frame');
    if (oldFrame && oldFrame.parentNode) {
      oldFrame.parentNode.removeChild(oldFrame);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'global-print-virtual-frame';
    
    // Position off-screen with non-zero dimensions and non-zero opacity
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1000px';
    iframe.style.height = '1000px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      console.error('Failed to access print iframe document');
      isPrintingGlobalLock = false;
      return;
    }

    // Collect all stylesheets and style elements from parent document
    let parentStyles = '';
    const styleNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
    styleNodes.forEach((node) => {
      if (node.tagName === 'STYLE') {
        parentStyles += node.innerHTML + '\n';
      } else if (node.tagName === 'LINK') {
        const link = node as HTMLLinkElement;
        if (link.href) {
          parentStyles += `@import url("${link.href}");\n`;
        }
      }
    });

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${cleanTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${parentStyles}
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .page-break {
      page-break-after: always !important;
      break-after: page !important;
      height: 0;
      margin: 0;
      padding: 0;
      border: none;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .page-break {
        page-break-after: always !important;
        break-after: page !important;
      }
    }
    ${css || ''}
  </style>
</head>
<body>
  ${html}
</body>
</html>`);
    doc.close();

    let hasPrinted = false;
    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

    const triggerPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;

      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
        fallbackTimeout = null;
      }

      try {
        if (cleanTitle) {
          document.title = cleanTitle;
        }
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Error during iframe printing execution:', err);
      } finally {
        setTimeout(() => {
          isPrintingGlobalLock = false;
          if (cleanTitle && originalDocTitle !== undefined) {
            document.title = originalDocTitle;
          }
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 8000);
      }
    };

    // Wait for images and resources to settle before triggering print dialog exactly ONCE
    if (iframe.contentWindow) {
      iframe.contentWindow.onload = () => {
        setTimeout(triggerPrint, 250);
      };
      // Guaranteed safety fallback if onload does not fire within 1500ms
      fallbackTimeout = setTimeout(triggerPrint, 1500);
    } else {
      fallbackTimeout = setTimeout(triggerPrint, 400);
    }
  } catch (error) {
    isPrintingGlobalLock = false;
    console.error('Error in printHtmlViaIframe:', error);
  }
};

export const generateInvoicePDF = async (elementId: string, filename: string = 'invoice.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`DOM print element not found: #${elementId}`);
    return;
  }

  // Extract content
  const htmlContent = element.innerHTML;

  // Collect active stylesheets to preserve Tailwind utility classes
  let collectedStyles = '';
  const styleNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
  styleNodes.forEach((node) => {
    if (node.tagName === 'STYLE') {
      collectedStyles += node.innerHTML + '\n';
    } else if (node.tagName === 'LINK') {
      const link = node as HTMLLinkElement;
      if (link.href) {
        collectedStyles += `@import url("${link.href}");\n`;
      }
    }
  });

  printHtmlViaIframe(htmlContent, collectedStyles, filename);
};

export const printCompiledTemplate = (
  html: string,
  css: string = '',
  filename: string = 'document.pdf'
) => {
  printHtmlViaIframe(html, css, filename);
};
