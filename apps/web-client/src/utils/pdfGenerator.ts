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

  // Helper to find innermost leaf element matching text (avoids matching large parent wrappers)
  const findDeepestElementByText = (root: HTMLElement, regex: RegExp): HTMLElement | null => {
    const elements = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6, div, p, span, strong, b, td, th'));
    const matches = elements.filter((el) => {
      const txt = (el.textContent || '').trim();
      return regex.test(txt) && txt.length < 200;
    });
    if (matches.length === 0) return null;
    matches.sort((a, b) => (a.textContent?.trim().length || 0) - (b.textContent?.trim().length || 0));
    return matches[0] as HTMLElement;
  };

  // Helper to find the top-level section container for an element without ascending into other sections
  const findSpecificSectionContainer = (
    headingNode: HTMLElement,
    docRoot: HTMLElement,
    boundaryHeadings: (HTMLElement | null)[]
  ): HTMLElement => {
    let curr: HTMLElement = headingNode;
    while (curr.parentElement && curr.parentElement !== docRoot && curr.parentElement.tagName !== 'BODY') {
      const parent = curr.parentElement;
      const containsBoundary = boundaryHeadings.some(
        (b) => b && b !== headingNode && parent.contains(b)
      );
      if (containsBoundary) {
        break;
      }
      curr = parent;
    }
    return curr;
  };

  // 1. Remove leading page breaks and empty nodes from root
  const stripLeadingBreaksAndEmpty = (container: HTMLElement) => {
    while (container.firstChild) {
      const node = container.firstChild;
      if (node.nodeType === Node.COMMENT_NODE) {
        container.removeChild(node);
      } else if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
        container.removeChild(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (
          el.classList.contains('page-break') ||
          (el.textContent?.trim() === '' && !el.querySelector('img, table, svg'))
        ) {
          container.removeChild(node);
        } else {
          break;
        }
      } else {
        break;
      }
    }
  };

  stripLeadingBreaksAndEmpty(temp);

  const docRoot = (temp.querySelector('.tax-invoice-document, .doc-container, #invoice-template') as HTMLElement) || temp;
  stripLeadingBreaksAndEmpty(docRoot);

  // 2. Locate distinct semantic headings
  const invoiceHeading = findDeepestElementByText(temp, /TAX\s*INVOICE/i);
  const customerHeading = findDeepestElementByText(temp, /CUSTOMER\s*\/\s*BILL\s*TO/i);
  const billingHeading = findDeepestElementByText(temp, /BILLING\s*&?\s*PACKAGE\s*FARE|Package Billing & Inclusions/i);
  const totalsHeading = findDeepestElementByText(temp, /TOTAL\s*AMOUNT\s*DUE|FINANCIAL\s*SETTLEMENT/i);
  const tcHeading = findDeepestElementByText(temp, /TERMS\s*&\s*CONDITIONS/i);
  const sigHeading = findDeepestElementByText(temp, /CUSTOMER\s*ACCEPTANCE|Legal Acceptance & Booking Confirmation/i);

  if (tcHeading) {
    const priorHeadings = [invoiceHeading, customerHeading, billingHeading, totalsHeading].filter(Boolean) as HTMLElement[];
    const tcContainer = findSpecificSectionContainer(tcHeading, docRoot, priorHeadings);

    let sigContainer: HTMLElement | null = null;
    if (sigHeading) {
      sigContainer = findSpecificSectionContainer(sigHeading, docRoot, [...priorHeadings, tcHeading]);
    }

    // Check if Terms & Conditions is placed before customer/invoice or before billing/amount
    const isTcBeforeContent = priorHeadings.some((prior) => {
      return !!(tcContainer.compareDocumentPosition(prior) & Node.DOCUMENT_POSITION_FOLLOWING);
    });

    if (isTcBeforeContent) {
      // Detach TC and Signature
      tcContainer.remove();
      if (sigContainer && sigContainer !== tcContainer) {
        sigContainer.remove();
      }

      stripLeadingBreaksAndEmpty(docRoot);

      // Clean up orphaned page breaks between customer details and amount
      const internalBreaks = Array.from(docRoot.querySelectorAll('.page-break'));
      internalBreaks.forEach((br) => {
        if (br.parentElement && br.parentElement !== docRoot) {
          br.remove();
        }
      });

      // Append clean page break
      const pageBreak = document.createElement('div');
      pageBreak.className = 'page-break';
      pageBreak.style.cssText = 'page-break-after: always !important; break-after: page !important; height: 0; margin: 0; padding: 0; border: none;';
      docRoot.appendChild(pageBreak);

      // Wrap and append Terms & Conditions
      const tcWrapper = document.createElement('div');
      tcWrapper.className = 'invoice-page tc-page';
      tcWrapper.style.cssText = 'padding: 24px 28px; box-sizing: border-box;';
      tcWrapper.appendChild(tcContainer);
      docRoot.appendChild(tcWrapper);

      // Append Signature block beneath Terms & Conditions
      if (sigContainer && sigContainer !== tcContainer) {
        const sigWrap = document.createElement('div');
        sigWrap.className = 'signature-wrap';
        sigWrap.style.cssText = 'margin-top: 18px;';
        sigWrap.appendChild(sigContainer);
        tcWrapper.appendChild(sigWrap);
      }
    } else if (sigContainer && tcContainer && (sigContainer.compareDocumentPosition(tcContainer) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      // Signature is before TC -> move signature beneath TC at the end
      sigContainer.remove();
      const sigWrap = document.createElement('div');
      sigWrap.className = 'signature-wrap';
      sigWrap.style.cssText = 'margin-top: 18px;';
      sigWrap.appendChild(sigContainer);
      tcContainer.parentElement?.appendChild(sigWrap) || docRoot.appendChild(sigWrap);
    }
  }

  // Ensure bold titles on all 13 clauses for crisp typography
  const tcClauses = Array.from(temp.querySelectorAll('.tc-page div, .tc-page p, .tax-invoice-page div, .tax-invoice-page p'));
  tcClauses.forEach((el) => {
    const html = el.innerHTML;
    if (/(?:^|\s)(\d{1,2}\.\s*[^:<]+:)/.test(html) && !/<strong[^>]*>\s*\d{1,2}\./.test(html)) {
      el.innerHTML = html.replace(/(?:^|\s)(\d{1,2}\.\s*[^:<]+:)/g, ' <strong>$1</strong>');
    }
  });

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
