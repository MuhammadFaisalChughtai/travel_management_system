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
