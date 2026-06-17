import { useAuthStore } from '../store/authStore';

export const useCurrency = () => {
  const user = useAuthStore(state => state.user);
  const currency = user?.currency || 'GBP';
  
  const getSymbol = () => {
    switch (currency.toUpperCase()) {
      case 'GBP': return '£';
      case 'EUR': return '€';
      case 'PKR': return 'Rs';
      case 'USD': return '$';
      case 'AED': return 'AED ';
      case 'MYR': return 'RM';
      default: return `${currency} `;
    }
  };
  
  const format = (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    return `${getSymbol()}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  return { currency, symbol: getSymbol(), format };
};
