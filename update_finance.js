const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps', 'web-client', 'src', 'pages', 'FinancePage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Change default tab to ledger
content = content.replace(
  "const [activeTab, setActiveTab] = useState<'client' | 'vendor' | 'ledger'>('client');",
  "const [activeTab, setActiveTab] = useState<'client' | 'vendor' | 'ledger'>('ledger');"
);

// 2. Set default dateStart to 10 days ago
content = content.replace(
  `  const [ledgerFilters, setLedgerFilters] = useState({
    dateStart: '',
    dateEnd: '',
    agentName: '',
    vendorName: '',
    reference: ''
  });`,
  `  const [ledgerFilters, setLedgerFilters] = useState({
    dateStart: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString().split('T')[0],
    dateEnd: '',
    agentName: '',
    vendorName: '',
    reference: ''
  });`
);

// 3. Rearrange tabs and polish colors
content = content.replace(
  `        <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          <button 
            onClick={() => setActiveTab('client')}
            className={\`px-6 py-2 rounded-lg text-[13px] font-bold transition-all \${activeTab === 'client' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}\`}
          >
            Client Payments
          </button>
          <button 
            onClick={() => setActiveTab('vendor')}
            className={\`px-6 py-2 rounded-lg text-[13px] font-bold transition-all \${activeTab === 'vendor' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}\`}
          >
            Vendor Payments
          </button>
          <button 
            onClick={() => setActiveTab('ledger')}
            className={\`px-6 py-2 rounded-lg text-[13px] font-bold transition-all \${activeTab === 'ledger' ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}\`}
          >
            Ledger Report
          </button>
        </div>`,
  `        <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          <button 
            onClick={() => setActiveTab('ledger')}
            className={\`px-6 py-2 rounded-lg text-[13px] font-bold transition-all \${activeTab === 'ledger' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}\`}
          >
            Ledger Report
          </button>
          <button 
            onClick={() => setActiveTab('client')}
            className={\`px-6 py-2 rounded-lg text-[13px] font-bold transition-all \${activeTab === 'client' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}\`}
          >
            Client Payments
          </button>
          <button 
            onClick={() => setActiveTab('vendor')}
            className={\`px-6 py-2 rounded-lg text-[13px] font-bold transition-all \${activeTab === 'vendor' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}\`}
          >
            Vendor Payments
          </button>
        </div>`
);

// 4. Remove ledger pagination state
content = content.replace(
  `  const [ledgerPage, setLedgerPage] = useState(1);
  const ledgerPerPage = 10;
  useEffect(() => { setLedgerPage(1); }, [ledgerTransactions]);`,
  ``
);

// 5. Remove slice from map
content = content.replace(
  `{ledgerTransactions.slice((ledgerPage - 1) * ledgerPerPage, ledgerPage * ledgerPerPage).map((txn) => {`,
  `{ledgerTransactions.map((txn) => {`
);

// 6. Remove Pagination component from ledger
const paginationStr = `              {ledgerTransactions.length > 0 && (
                <Pagination 
                  currentPage={ledgerPage} 
                  totalPages={Math.ceil(ledgerTransactions.length / ledgerPerPage)} 
                  onPageChange={setLedgerPage} 
                  itemsPerPage={ledgerPerPage} 
                  totalItems={ledgerTransactions.length} 
                />
              )}`;
content = content.replace(paginationStr, ``);

// 7. Clear All should respect 10 days
content = content.replace(
  `const blank = { dateStart: '', dateEnd: '', agentName: '', vendorName: '', reference: '' }; setLedgerFilters(blank); fetchLedgerReport(blank);`,
  `const blank = { dateStart: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString().split('T')[0], dateEnd: '', agentName: '', vendorName: '', reference: '' }; setLedgerFilters(blank); fetchLedgerReport(blank);`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("FinancePage updated successfully.");
