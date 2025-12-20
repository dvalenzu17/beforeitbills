// app/import-csv.js
import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import { useStore } from "../lib/store";
import { parseCSV, extractTxn, matchSubscriptionByMerchant } from "../lib/utils";

export default function ImportCSVScreen() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const [preview, setPreview] = useState([]);
  const [status, setStatus] = useState("Pick a CSV to import.");

  async function pickFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "text/csv",
        copyToCacheDirectory: true
      });
      if (res.canceled || !res.assets?.length) return;
      const file = res.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const { rows } = parseCSV(content);

      // Build transactions from rows
      const txns = rows.map(r => extractTxn(r)).map(t => {
        // attempt to match with an existing subscription by merchant/name/provider
        const match = matchSubscriptionByMerchant(state.subs, t.raw_merchant);
        return {
          id: undefined,
          subId: match?.id || match?._id || null,
          date: t.date,
          amount_cents: t.amount_cents,
          currency: t.currency,
          raw_merchant: t.raw_merchant,
          source: "csv"
        };
      });

      setPreview(txns.slice(0, 15));
      setStatus(`Parsed ${txns.length} transactions. Ready to import.`);
      // Store full parsed list on component for save
      _parsedTxns = txns;
    } catch (e) {
      console.error(e);
      Alert.alert("Import error", "Could not read or parse the CSV.");
    }
  }

  let _parsedTxns = [];

  function save() {
    if (!_parsedTxns.length) {
      Alert.alert("Nothing to import", "Pick a CSV first.");
      return;
    }
    dispatch({ type: "ADD_TRANSACTIONS", payload: _parsedTxns });
    setStatus(`Imported ${_parsedTxns.length} transactions.`);
    Alert.alert("Imported", "Transactions saved locally.");
    router.back();
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Import Bank CSV</Text>
      <Text style={{ opacity: 0.7 }}>{status}</Text>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable onPress={pickFile} style={btnStyle}>
          <Text style={btnText}>Pick CSV</Text>
        </Pressable>
        <Pressable onPress={save} style={[btnStyle, { backgroundColor: "#0a7" }]}>
          <Text style={btnText}>Save</Text>
        </Pressable>
      </View>

      <Text style={{ marginTop: 8, fontWeight: "600" }}>Preview (first 15)</Text>
      <ScrollView style={{ flex: 1, borderWidth: 1, borderColor: "#eee", borderRadius: 8, padding: 12 }}>
        {preview.map((t, i) => (
          <View key={i} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}>
            <Text style={{ fontWeight: "600" }}>{t.raw_merchant}</Text>
            <Text>{new Date(t.date).toDateString()} · {(t.amount_cents/100).toFixed(2)} {t.currency}</Text>
            <Text style={{ opacity: 0.7 }}>Linked to: {t.subId ? findSubName(state.subs, t.subId) : "— (no match)"}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function findSubName(subs, id) {
  const s = subs.find(x => x.id === id || x._id === id);
  return s?.name || "Unknown";
}

const btnStyle = {
  backgroundColor: "#0a6",
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 10
};
const btnText = { color: "white", fontWeight: "600" };
