import { useCallback } from 'react';
import { Download } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { analyzeDrawdowns } from '@/lib/drawdown-utils';
import { analyzeRandomness } from '@/lib/randomness-tests';
import { runWalkForward } from '@/lib/walk-forward';

export function PDFExportButton() {
  const { strategies, analyses, trades: tradesMap, equityCurves, selectedStrategyIds } = useAppStore();

  const exportPDF = useCallback(async () => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const selected = strategies.filter(s => selectedStrategyIds.includes(s.id));
    if (selected.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    let y = 15;

    const addHeader = () => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 12, 'F');
      doc.setTextColor(16, 185, 129);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('EdgeValidator — Análisis de Ventaja Estadística', 10, 8);
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7);
      doc.text(new Date().toISOString().slice(0, 10), pageW - 30, 8);
    };

    const newPage = () => {
      doc.addPage();
      addHeader();
      y = 18;
    };

    addHeader();
    y = 18;

    for (const strategy of selected) {
      const analysis = analyses.get(strategy.id);
      const trades = tradesMap.get(strategy.id) || [];
      const equity = equityCurves.get(strategy.id) || [];

      // Title
      doc.setFontSize(14);
      doc.setTextColor(226, 232, 240);
      doc.setFont('helvetica', 'bold');
      doc.text(strategy.name, 10, y);
      y += 6;

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`${strategy.setup.symbol} • ${strategy.setup.timeframe} • ${strategy.setup.dateFrom} → ${strategy.setup.dateTo}`, 10, y);
      y += 8;

      // Verdict
      if (analysis) {
        const verdictColor: [number, number, number] =
          analysis.verdict === 'strong_edge' ? [16, 185, 129] :
          analysis.verdict === 'moderate_edge' ? [245, 158, 11] :
          analysis.verdict === 'weak_edge' ? [245, 158, 11] :
          [239, 68, 68];

        doc.setFontSize(20);
        doc.setTextColor(...verdictColor);
        doc.text(`Edge Score: ${analysis.overallScore.toFixed(0)}`, 10, y);
        doc.setFontSize(12);
        doc.text(`— ${analysis.verdictLabel}`, 70, y);
        y += 10;

        // Components table
        const compRows = analysis.components.map(c => [
          c.name,
          c.score.toFixed(1),
          `x${c.weight.toFixed(1)}`,
          c.description.substring(0, 60),
        ]);

        (doc as any).autoTable({
          startY: y,
          head: [['Componente', 'Score', 'Peso', 'Descripción']],
          body: compRows,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5, textColor: [200, 200, 200], fillColor: [30, 41, 59] },
          headStyles: { fillColor: [16, 185, 129], textColor: [15, 23, 42], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [15, 23, 42] },
        });

        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // Trade stats
      if (trades.length > 0) {
        if (y > pageH - 50) newPage();

        const wins = trades.filter(t => t.pnlMoney > 0).length;
        const totalPnl = trades.reduce((s, t) => s + t.pnlMoney, 0);
        const gp = trades.filter(t => t.pnlMoney > 0).reduce((s, t) => s + t.pnlMoney, 0);
        const gl = Math.abs(trades.filter(t => t.pnlMoney < 0).reduce((s, t) => s + t.pnlMoney, 0));
        const pf = gl > 0 ? gp / gl : 0;

        const dd = analyzeDrawdowns(trades, equity, strategy.moneyManagement.initialCapital);

        const statsRows = [
          ['Total Trades', String(trades.length)],
          ['Win Rate', `${(wins / trades.length * 100).toFixed(1)}%`],
          ['P&L Total', `$${totalPnl.toFixed(2)}`],
          ['Profit Factor', pf.toFixed(2)],
          ['Max Drawdown', `${dd.maxDrawdownPct.toFixed(2)}%`],
          ['Recovery Factor', dd.recoveryFactor.toFixed(2)],
          ['Calmar Ratio', dd.calmarRatio.toFixed(2)],
          ['Max DD Duration', `${dd.maxDrawdownDuration} días`],
        ];

        (doc as any).autoTable({
          startY: y,
          head: [['Métrica', 'Valor']],
          body: statsRows,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5, textColor: [200, 200, 200], fillColor: [30, 41, 59] },
          headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [15, 23, 42] },
          columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 40 } },
        });

        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // Randomness tests
      if (trades.length >= 15) {
        if (y > pageH - 40) newPage();

        const rand = analyzeRandomness(trades);
        const randRows = [
          ['Test de Rachas', rand.runsTest.isRandom ? 'Aleatorio' : 'Patrón', `z=${rand.runsTest.zScore.toFixed(3)} p=${rand.runsTest.pValue.toFixed(4)}`],
          ['Autocorrelación', rand.autocorrelation.hasSignificantLag ? 'Dependencia' : 'Independiente', rand.autocorrelation.description.substring(0, 50)],
          ['Distribución P&L', rand.distribution.isNormal ? 'Normal' : 'No Normal', `Asim:${rand.distribution.skewness.toFixed(3)} Kurt:${rand.distribution.kurtosis.toFixed(3)}`],
          ['Score Aleatoriedad', `${rand.overallRandomnessScore}/100`, ''],
        ];

        doc.setFontSize(9);
        doc.setTextColor(200, 200, 200);
        doc.text('Tests de Aleatoriedad', 10, y);
        y += 4;

        (doc as any).autoTable({
          startY: y,
          head: [['Test', 'Resultado', 'Detalle']],
          body: randRows,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5, textColor: [200, 200, 200], fillColor: [30, 41, 59] },
          headStyles: { fillColor: [245, 158, 11], textColor: [15, 23, 42], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [15, 23, 42] },
        });

        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // Walk-Forward
      if (trades.length >= 30) {
        if (y > pageH - 40) newPage();

        const wf = runWalkForward(trades);
        if (wf.windows.length > 0) {
          doc.setFontSize(9);
          doc.setTextColor(200, 200, 200);
          doc.text('Walk-Forward Analysis', 10, y);
          y += 4;

          const wfRows = wf.windows.map(w => [
            `W${w.windowIndex}`,
            String(w.isTrades),
            String(w.oosTrades),
            `${w.isWinRate.toFixed(1)}%`,
            `${w.oosWinRate.toFixed(1)}%`,
            `$${w.isPnl.toFixed(0)}`,
            `$${w.oosPnl.toFixed(0)}`,
            `${(w.degradation * 100).toFixed(0)}%`,
          ]);

          (doc as any).autoTable({
            startY: y,
            head: [['#', 'IS Trades', 'OOS Trades', 'IS WR%', 'OOS WR%', 'IS P&L', 'OOS P&L', 'Deg%']],
            body: wfRows,
            theme: 'grid',
            styles: { fontSize: 6.5, cellPadding: 1.2, textColor: [200, 200, 200], fillColor: [30, 41, 59] },
            headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [15, 23, 42] },
          });

          y = (doc as any).lastAutoTable.finalY + 5;
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(`OOS Efficiency: ${wf.oosEfficiency.toFixed(0)}% • Consistency: ${wf.consistency.toFixed(0)}% • Avg Degradation: ${(wf.avgDegradation * 100).toFixed(1)}%`, 10, y);
          y += 8;
        }
      }

      // Page break for next strategy
      if (selected.indexOf(strategy) < selected.length - 1) newPage();
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(`EdgeValidator • Página ${p}/${totalPages}`, pageW / 2, pageH - 5, { align: 'center' });
    }

    doc.save(`EdgeValidator_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [strategies, analyses, tradesMap, equityCurves, selectedStrategyIds]);

  return (
    <button
      onClick={exportPDF}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface-2 hover:bg-surface-3 rounded transition-colors"
    >
      <Download className="w-3 h-3" />
      Exportar PDF
    </button>
  );
}
