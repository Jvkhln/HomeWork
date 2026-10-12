/**
 * Exports data to CSV with UTF-8 BOM so Excel opens Mongolian Cyrillic text cleanly.
 */

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (cell: string | number) => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = headers.map(escapeCell).join(',');
  const dataRows = rows.map(row => row.map(escapeCell).join(',')).join('\r\n');
  
  // UTF-8 BOM (\uFEFF) is crucial for Excel to recognize UTF-8 Mongolian text
  const csvContent = '\uFEFF' + headerRow + '\r\n' + dataRows;
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
