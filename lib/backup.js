import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export async function exportBackupJSON(state) {
  const path = FileSystem.cacheDirectory + 'sublytics-backup.json';
  await FileSystem.writeAsStringAsync(path, JSON.stringify(state, null, 2));
  await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Export Sublytics Backup (JSON)' });
}

export async function importBackupJSON() {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) throw new Error('Cancelled');
  const file = res.assets[0];
  const content = await FileSystem.readAsStringAsync(file.uri);
  const json = JSON.parse(content);
  if (!json || typeof json !== 'object') throw new Error('Invalid backup');
  return json; // caller should validate & hydrate
}
