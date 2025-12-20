import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function exportSubsToCsv(subs = []) {
  const header = ['id','merchant','amount','currency','cadence','nextRenewal','category','tags'].join(',');
  const rows = subs.map(s =>
    [s.id, s.merchant, s.amount, s.currency, s.cadence, s.nextRenewal, s.category ?? '', (s.tags||[]).join('|')]
      .map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const path = FileSystem.cacheDirectory + 'sublytics.csv';
  await FileSystem.writeAsStringAsync(path, csv);
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Subscriptions' });
}
