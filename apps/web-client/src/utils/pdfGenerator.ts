/**
 * Isolated Iframe PDF & Print Generator
 * Renders HTML/CSS within an isolated iframe context to ensure complete style isolation,
 * correct pagination, accurate font rendering, and avoid CSS bleeding/parent opacity bugs.
 */

export const printHtmlViaIframe = (
  html: string,
  css: string = '',
  filename: string = 'document.pdf'
) => {
  try {
    if (!html || !html.trim()) {
      console.warn('printHtmlViaIframe received empty HTML payload');
      return;
    }

    // Remove any previous print virtual frames
    const oldFrame = document.getElementById('global-print-virtual-frame');
    if (oldFrame && oldFrame.parentNode) {
      oldFrame.parentNode.removeChild(oldFrame);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'global-print-virtual-frame';
    
    // Position off-screen with non-zero dimensions and non-zero opacity
    // (Crucial: WebKit and Gecko skip layout passes for display:none or opacity:0 iframes)
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
      return;
    }

    const cleanTitle = filename.replace(/\.pdf$/i, '');

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
  <style>
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

    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Error during iframe printing execution:', err);
      } finally {
        setTimeout(() => {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 5000);
      }
    };

    // Wait for images and resources to settle before triggering print dialog
    if (iframe.contentWindow) {
      iframe.contentWindow.onload = () => {
        setTimeout(triggerPrint, 300);
      };
      // Guaranteed safety fallback
      setTimeout(triggerPrint, 450);
    } else {
      setTimeout(triggerPrint, 450);
    }
  } catch (error) {
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
