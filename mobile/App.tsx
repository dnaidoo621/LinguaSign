/**
 * LinguaSign Mobile — fully on-device: OCR → translation → risk analysis.
 * Minimal single-screen flow: download models once → pick a document photo →
 * bilingual reader with risk findings. No server required.
 */

import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { ensureModels } from "./engine/assets";
import { PipelineStage, ProcessedBlock, processDocumentImage } from "./engine/pipeline";
import { RiskLevel } from "./engine/risk/rules";

const RISK_COLORS: Record<RiskLevel, string> = {
  none: "#8a8f98",
  low: "#3b82f6",
  medium: "#f59e0b",
  high: "#ef4444",
};

type Phase =
  | { name: "idle" }
  | { name: "downloading"; detail: string }
  | { name: "processing"; detail: string }
  | { name: "results"; blocks: ProcessedBlock[] }
  | { name: "error"; message: string };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  const run = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["image/*"],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      setPhase({ name: "downloading", detail: "Checking models…" });
      await ensureModels((file, i, n) =>
        setPhase({ name: "downloading", detail: `Downloading ${file} (${i}/${n})` }),
      );

      const stageLabel: Record<PipelineStage, string> = {
        ocr: "Reading document (OCR)…",
        translate: "Translating",
        analyze: "Analyzing risk",
        done: "Done",
      };
      const blocks = await processDocumentImage(picked.assets[0].uri, (stage, done, total) =>
        setPhase({
          name: "processing",
          detail:
            stage === "translate" || stage === "analyze"
              ? `${stageLabel[stage]} ${done + 1}/${total}…`
              : stageLabel[stage],
        }),
      );
      setPhase({ name: "results", blocks });
    } catch (e) {
      setPhase({ name: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>LinguaSign</Text>
      <Text style={styles.subtitle}>On-device · offline · Korean → English</Text>

      {(phase.name === "idle" || phase.name === "results" || phase.name === "error") && (
        <Pressable style={styles.button} onPress={run}>
          <Text style={styles.buttonText}>Scan a document</Text>
        </Pressable>
      )}

      {(phase.name === "downloading" || phase.name === "processing") && (
        <View style={styles.progress}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.progressText}>{phase.detail}</Text>
        </View>
      )}

      {phase.name === "error" && <Text style={styles.error}>{phase.message}</Text>}

      {phase.name === "results" && (
        <FlatList
          style={styles.list}
          data={phase.blocks}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View
                  style={[styles.chip, { backgroundColor: RISK_COLORS[item.finding.level] }]}
                >
                  <Text style={styles.chipText}>
                    {item.finding.level.toUpperCase()}
                    {item.finding.type !== "NONE" ? ` · ${item.finding.type}` : ""}
                  </Text>
                </View>
              </View>
              <Text style={styles.ko}>{item.text}</Text>
              <Text style={styles.en}>{item.translation}</Text>
              {item.finding.level !== "none" && (
                <Text style={styles.explanation}>{item.finding.explanation}</Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0d10", paddingTop: 64, paddingHorizontal: 16 },
  title: { color: "#fff", fontSize: 28, fontWeight: "700" },
  subtitle: { color: "#8a8f98", fontSize: 14, marginBottom: 24 },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  progress: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 24 },
  progressText: { color: "#d1d5db", fontSize: 14 },
  error: { color: "#ef4444", marginTop: 12 },
  list: { flex: 1 },
  card: {
    backgroundColor: "#15181d",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", marginBottom: 8 },
  chip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  ko: { color: "#e5e7eb", fontSize: 15, marginBottom: 6 },
  en: { color: "#9ca3af", fontSize: 14 },
  explanation: { color: "#fbbf24", fontSize: 13, marginTop: 8 },
});
