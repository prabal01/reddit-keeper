import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportReportToPDF = (data: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : new Date().toLocaleDateString();

    // Title
    doc.setFontSize(22);
    doc.setTextColor(255, 69, 0); // Primary color
    doc.text("OpinionDeck Intelligence Report", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${dateStr}`, 14, 30);
    doc.line(14, 35, pageWidth - 14, 35);

    // Executive Summary
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Executive Summary", 14, 45);
    doc.setFontSize(11);
    const splitSummary = doc.splitTextToSize(data.executive_summary || "No summary available.", pageWidth - 28);
    doc.text(splitSummary, 14, 52);

    let finalY = 52 + (splitSummary.length * 5);

    // Themes Table
    if (data.themes && data.themes.length > 0) {
        doc.setFontSize(16);
        doc.text("Key Themes", 14, finalY + 15);
        autoTable(doc, {
            startY: finalY + 20,
            head: [['Theme', 'Confidence', 'Sentiment', 'Description']],
            body: data.themes.map((t: any) => [
                t.title,
                `${t.confidence}%`,
                t.sentiment,
                t.description
            ]),
            theme: 'striped',
            headStyles: { fillColor: [255, 69, 0] }
        });
        finalY = (doc as any).lastAutoTable.finalY;
    }

    // Feature Requests
    if (data.feature_requests && data.feature_requests.length > 0) {
        doc.setFontSize(16);
        doc.text("Feature Requests", 14, finalY + 15);
        autoTable(doc, {
            startY: finalY + 20,
            head: [['Feature', 'Frequency', 'Context']],
            body: data.feature_requests.map((f: any) => [f.feature, f.frequency, f.context]),
            theme: 'grid',
            headStyles: { fillColor: [245, 158, 11] } // Orange-ish
        });
        finalY = (doc as any).lastAutoTable.finalY;
    }

    // Pain Points
    if (data.pain_points && data.pain_points.length > 0) {
        doc.setFontSize(16);
        doc.text("Pain Points & Bugs", 14, finalY + 15);
        autoTable(doc, {
            startY: finalY + 20,
            head: [['Issue', 'Severity', 'Description']],
            body: data.pain_points.map((p: any) => [p.issue, p.severity, p.description]),
            theme: 'grid',
            headStyles: { fillColor: [239, 68, 68] } // Red-ish
        });
        finalY = (doc as any).lastAutoTable.finalY;
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 25, doc.internal.pageSize.getHeight() - 10);
        doc.text("© 2026 OpinionDeck - Confidential Market Intelligence", 14, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`OpinionDeck_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};
