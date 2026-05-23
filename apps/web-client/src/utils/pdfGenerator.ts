import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const generateInvoicePDF = async (elementId: string, filename: string = 'invoice.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Invoice element not found');
    return;
  }

  try {
    // Temporarily make the element visible for rendering if it was hidden
    const originalDisplay = element.style.display;
    element.style.display = 'block';

    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better resolution
      useCORS: true,
      logging: false,
    });

    element.style.display = originalDisplay;

    const imgData = canvas.toDataURL('image/png');
    
    // A4 size in mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // Add image to PDF
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
    // If the content is taller than an A4 page, we might need multiple pages.
    // For simplicity, assuming html2canvas renders the whole thing and we scale it down.
    // If it's too long, it might scale too much. A better approach for multi-page
    // is to slice the canvas, but let's start with a single scaled page.
    let heightLeft = pdfHeight - pdf.internal.pageSize.getHeight();
    let position = 0;

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};
