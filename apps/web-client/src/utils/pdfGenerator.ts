export const generateInvoicePDF = async (elementId: string, filename: string = 'invoice.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Invoice element not found');
    return;
  }

  try {
    // Create print-specific styles dynamically
    const style = document.createElement('style');
    style.id = 'print-invoice-style';
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #${elementId}, #${elementId} * {
          visibility: visible !important;
        }
        #${elementId} {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          margin: 0 !important;
          padding: 20mm !important;
          width: 100% !important;
          z-index: 999999 !important;
          opacity: 1 !important;
        }
        @page {
          margin: 0;
          size: A4 portrait;
        }
      }
    `;
    document.head.appendChild(style);

    // Save current document title to restore later
    const originalTitle = document.title;
    // Set title to filename so the default save name in print dialog matches
    document.title = filename.replace('.pdf', '');

    // Trigger native browser print dialog
    window.print();

    // Cleanup
    document.title = originalTitle;
    setTimeout(() => {
      const styleNode = document.getElementById('print-invoice-style');
      if (styleNode) {
        document.head.removeChild(styleNode);
      }
    }, 1000);

  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};

export const printCompiledTemplate = (html: string, css: string, filename: string = 'document.pdf') => {
  try {
    const containerId = 'dynamic-compiled-print-container';
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);
    }
    
    container.style.position = 'absolute';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';

    container.innerHTML = `
      <style>
        ${css}
      </style>
      <div class="compiled-print-payload">
        ${html}
      </div>
    `;

    const styleId = 'print-compiled-style';
    let printStyle = document.getElementById(styleId);
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.id = styleId;
      document.head.appendChild(printStyle);
    }

    printStyle.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #${containerId}, #${containerId} * {
          visibility: visible !important;
        }
        #${containerId} {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          margin: 0 !important;
          padding: 10mm !important;
          width: 100% !important;
          z-index: 999999 !important;
          opacity: 1 !important;
        }
        @page {
          margin: 0;
          size: A4 portrait;
        }
      }
    `;

    const originalTitle = document.title;
    document.title = filename.replace('.pdf', '');

    window.print();

    document.title = originalTitle;
    setTimeout(() => {
      if (printStyle && printStyle.parentNode) {
        printStyle.parentNode.removeChild(printStyle);
      }
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, 1000);
  } catch (error) {
    console.error('Error printing compiled template:', error);
  }
};

