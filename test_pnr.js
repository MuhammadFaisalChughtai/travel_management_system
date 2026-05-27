const pnrText = `GPLGMZ/84 QSBSB  0705843 AG 99999992 25APR  
 1 . GF    8 Q  26JUL LGWBAH HX2  1040   1915  O*          SU  `;

const cleanText = pnrText.replace(/\//g, ' ');
const pnrRefMatch = cleanText.match(/\b([A-Z0-9]{6})\b/i);
const flightNoMatch = pnrText.match(/\b([A-Z]{2})\s+(\d{1,4})\b/i);
const routeMatch = pnrText.match(/\b(\d{2}[A-Z]{3})\s+([A-Z]{6})\b/i);
const fallbackRouteMatch = !routeMatch ? pnrText.match(/\b([A-Z]{3})\s*(?:TO|-)\s*([A-Z]{3})\b/i) : null;
const timeMatch = pnrText.match(/\b(\d{4})\s+(\d{4})\b/);
const fallbackDateMatch = !routeMatch ? pnrText.match(/(\d{2}[A-Z]{3})/i) : null;

const extracted = {
  airline: flightNoMatch ? flightNoMatch[1].toUpperCase() : undefined,
  flightNo: flightNoMatch ? `${flightNoMatch[1].toUpperCase()}${flightNoMatch[2]}` : undefined,
  date: routeMatch ? routeMatch[1] : (fallbackDateMatch ? fallbackDateMatch[1] : undefined),
  departedFrom: routeMatch ? routeMatch[2].substring(0, 3).toUpperCase() : (fallbackRouteMatch ? fallbackRouteMatch[1].toUpperCase() : undefined),
  arrivedAt: routeMatch ? routeMatch[2].substring(3, 6).toUpperCase() : (fallbackRouteMatch ? fallbackRouteMatch[2].toUpperCase() : undefined),
  departTime: timeMatch ? `${timeMatch[1].substring(0,2)}:${timeMatch[1].substring(2,4)}` : undefined,
  arrivalTime: timeMatch ? `${timeMatch[2].substring(0,2)}:${timeMatch[2].substring(2,4)}` : undefined,
  pnr: pnrRefMatch ? pnrRefMatch[1].toUpperCase() : undefined
};

console.log(extracted);
