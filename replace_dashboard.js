const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps', 'web-client', 'src', 'pages', 'Dashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const startIndex = content.indexOf('  const stats = useMemo(() => {');
const endIndex = content.indexOf('  if (!user) return null;');

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find boundaries.");
  process.exit(1);
}

const newContent = `  const stats = useMemo(() => {
    const totalActualRevenue = bookings.reduce((sum, b) => sum + (parseFloat(b.totalPrice) || 0), 0);
    const bookingCount = bookings.length;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const thisMonthRevenue = bookings.filter(b => { 
      const d = new Date(b.date); 
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear; 
    }).reduce((sum, b) => sum + (parseFloat(b.totalPrice) || 0), 0);
    
    const lastMonthRevenue = bookings.filter(b => { 
      const d = new Date(b.date); 
      return d.getMonth() === (currentMonth === 0 ? 11 : currentMonth - 1) && d.getFullYear() === (currentMonth === 0 ? currentYear - 1 : currentYear); 
    }).reduce((sum, b) => sum + (parseFloat(b.totalPrice) || 0), 0);
    
    let growth = 0;
    if (lastMonthRevenue > 0) {
      growth = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    } else if (thisMonthRevenue > 0) {
      growth = 100;
    }

    const currentAov = bookingCount > 0 ? totalActualRevenue / bookingCount : 0;

    return {
      actualRevenue: totalActualRevenue,
      totalRevenue: totalActualRevenue,
      totalVolume: bookingCount,
      aov: currentAov,
      growth: parseFloat(growth.toFixed(1)), 
      conversionRate: bookingCount > 0 ? 100 : 0 
    };
  }, [bookings]);

  const revenueChartData = useMemo(() => {
    const getActualSum = (filterFn) => {
      return bookings.filter(filterFn).reduce((sum, b) => sum + (parseFloat(b.totalPrice) || 0), 0);
    };

    switch (timeframe) {
      case 'daily':
        return Array.from({ length: 14 }).map((_, idx) => {
          const d = new Date();
          d.setDate(d.getDate() - (13 - idx));
          const dateStr = d.toISOString().split('T')[0];
          const actualSum = getActualSum(b => b.date.startsWith(dateStr));
          return {
            label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            Revenue: parseFloat(actualSum.toFixed(2)),
            Target: 0
          };
        });

      case 'monthly':
      default:
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonthIdx = new Date().getMonth();
        return Array.from({ length: 12 }).map((_, idx) => {
          const mIdx = (currentMonthIdx - 11 + idx + 12) % 12;
          const yearOffset = mIdx > currentMonthIdx ? 1 : 0;
          const actualSum = getActualSum(b => {
            const bDate = new Date(b.date);
            return bDate.getMonth() === mIdx && bDate.getFullYear() === (new Date().getFullYear() - yearOffset);
          });
          return {
            label: months[mIdx],
            Revenue: parseFloat(actualSum.toFixed(2)),
            Target: 0
          };
        });

      case 'quarterly':
        return [0, 1, 2, 3].map(idx => {
          const d = new Date();
          const currentQuarter = Math.floor(d.getMonth() / 3);
          const currentYear = d.getFullYear();
          let qIdx = currentQuarter - (3 - idx);
          let y = currentYear;
          while (qIdx < 0) { qIdx += 4; y -= 1; }
          const actualSum = getActualSum(b => {
            const bDate = new Date(b.date);
            return bDate.getFullYear() === y && Math.floor(bDate.getMonth() / 3) === qIdx;
          });
          return {
            label: \`Q\${qIdx + 1} \${y}\`,
            Revenue: parseFloat(actualSum.toFixed(2)),
            Target: 0
          };
        });

      case 'biannual':
        return [0, 1, 2, 3].map(idx => {
          const d = new Date();
          const currentHalf = d.getMonth() < 6 ? 0 : 1;
          const currentYear = d.getFullYear();
          let hIdx = currentHalf - (3 - idx);
          let y = currentYear;
          while (hIdx < 0) { hIdx += 2; y -= 1; }
          const actualSum = getActualSum(b => {
            const bDate = new Date(b.date);
            return bDate.getFullYear() === y && (bDate.getMonth() < 6 ? 0 : 1) === hIdx;
          });
          return {
            label: \`H\${hIdx + 1} \${y}\`,
            Revenue: parseFloat(actualSum.toFixed(2)),
            Target: 0
          };
        });

      case 'yearly':
        const currentYear = new Date().getFullYear();
        const years = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear];
        return years.map(yr => {
          const actualSum = getActualSum(b => new Date(b.date).getFullYear() === yr);
          return {
            label: String(yr),
            Revenue: parseFloat(actualSum.toFixed(2)),
            Target: 0
          };
        });
    }
  }, [timeframe, bookings]);

  const channelData = useMemo(() => {
    let flights = 0, hotels = 0, packages = 0, tours = 0;

    bookings.forEach(b => {
      flights += b._count?.flightServices || 0;
      hotels += b._count?.accommodations || 0;
      packages += b._count?.visaServices || 0;
      tours += b._count?.transportServices || 0;
    });

    const total = flights + hotels + packages + tours;
    return [
      { name: 'Custom Packages', value: total > 0 ? Math.round((packages / total) * 100) : 0, color: '#6366f1' },
      { name: 'Hotel Bookings', value: total > 0 ? Math.round((hotels / total) * 100) : 0, color: '#3b82f6' },
      { name: 'Flight Services', value: total > 0 ? Math.round((flights / total) * 100) : 0, color: '#10b981' },
      { name: 'Local Excursions', value: total > 0 ? Math.round((tours / total) * 100) : 0, color: '#f59e0b' }
    ];
  }, [bookings]);

  const weeklyRadarData = useMemo(() => {
    const days = [
      { day: 'Mon', Sales: 0, AOV: 0, _count: 0 }, { day: 'Tue', Sales: 0, AOV: 0, _count: 0 }, 
      { day: 'Wed', Sales: 0, AOV: 0, _count: 0 }, { day: 'Thu', Sales: 0, AOV: 0, _count: 0 }, 
      { day: 'Fri', Sales: 0, AOV: 0, _count: 0 }, { day: 'Sat', Sales: 0, AOV: 0, _count: 0 }, 
      { day: 'Sun', Sales: 0, AOV: 0, _count: 0 }
    ];

    bookings.forEach(b => {
      const dayIdx = new Date(b.date).getDay();
      const mappedIdx = dayIdx === 0 ? 6 : dayIdx - 1;
      days[mappedIdx].Sales += parseFloat(b.totalPrice) || 0;
      days[mappedIdx]._count += 1;
    });

    return days.map(d => ({
      subject: d.day,
      Sales: parseFloat(d.Sales.toFixed(2)),
      AOV: d._count > 0 ? Math.round(d.Sales / d._count) : 0
    }));
  }, [bookings]);

  const composedVolumeData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    
    const last6 = Array.from({ length: 6 }).map((_, idx) => {
      const mIdx = (currentMonthIdx - 5 + idx + 12) % 12;
      return { month: months[mIdx], Vol: 0, Revenue: 0, Aov: 0 };
    });

    bookings.forEach((b) => {
      const monthStr = new Date(b.date).toLocaleDateString('en-US', { month: 'short' });
      const target = last6.find(m => m.month === monthStr);
      if (target) {
        target.Vol += 1;
        target.Revenue += parseFloat(b.totalPrice) || 0;
      }
    });

    return last6.map(m => ({
      month: m.month,
      Vol: m.Vol,
      Aov: m.Vol > 0 ? Math.round(m.Revenue / m.Vol) : 0
    }));
  }, [bookings]);

  const agentsAnalytics = useMemo(() => {
    const agentPerformance = {};
    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    const badgeColors = ['bg-indigo-50 text-indigo-600', 'bg-primary-50 text-primary-600', 'bg-emerald-50 text-emerald-600', 'bg-amber-50 text-amber-600', 'bg-pink-50 text-pink-600', 'bg-purple-50 text-purple-600'];
    
    let colorIndex = 0;
    bookings.forEach(b => {
      const agent = b.agentName || 'System / Auto';
      const price = parseFloat(b.totalPrice) || 0;
      
      if (!agentPerformance[agent]) {
        agentPerformance[agent] = {
          revenue: 0,
          bookings: 0,
          color: colors[colorIndex % colors.length],
          badgeColor: badgeColors[colorIndex % badgeColors.length]
        };
        colorIndex++;
      }
      agentPerformance[agent].revenue += price;
      agentPerformance[agent].bookings += 1;
    });

    const performanceList = Object.entries(agentPerformance).map(([name, data]) => ({
      name,
      ...data,
      aov: data.bookings > 0 ? data.revenue / data.bookings : 0
    })).sort((a, b) => b.revenue - a.revenue);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    const last6Months = Array.from({ length: 6 }).map((_, idx) => months[(currentMonthIdx - 5 + idx + 12) % 12]);
    
    const monthlyTrends = last6Months.map((m) => {
      const row = { label: m };
      Object.keys(agentPerformance).forEach(agent => {
        row[agent] = 0;
      });
      return row;
    });

    bookings.forEach(b => {
      const agent = b.agentName || 'System / Auto';
      const bMonthStr = new Date(b.date).toLocaleDateString('en-US', { month: 'short' });
      const trendRow = monthlyTrends.find(r => r.label === bMonthStr);
      if (trendRow && trendRow[agent] !== undefined) {
        trendRow[agent] += parseFloat(b.totalPrice) || 0;
      }
    });

    return {
      performanceList,
      monthlyTrends
    };
  }, [bookings]);

`;

const finalContent = content.substring(0, startIndex) + newContent + content.substring(endIndex);
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log("Successfully replaced Dashboard charts data logic.");
