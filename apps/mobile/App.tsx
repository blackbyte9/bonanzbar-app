import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

const configuredWebAppUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");
const metroHost = Constants.expoConfig?.hostUri?.split(":")[0];
const canReachMetroHost = metroHost && !["127.0.0.1", "localhost", "0.0.0.0", "::1"].includes(metroHost);
const webAppUrl = configuredWebAppUrl ?? (__DEV__ && canReachMetroHost ? `http://${metroHost}:3000` : undefined);

function LoadingView() {
  return <View style={styles.centered}><ActivityIndicator color="#f4ca6b" size="large" /><Text style={styles.loadingText}>Bonanzbar wird geladen...</Text></View>;
}

export default function App() {
  const [loadError, setLoadError] = useState<string | null>(null);

  if (!webAppUrl || loadError) {
    return <SafeAreaView style={styles.page}>
      <StatusBar style="light" />
      <View style={styles.errorCard}>
        <Text style={styles.kicker}>BONANZBAR</Text>
        <Text style={styles.title}>{loadError ? "Verbindung nicht möglich" : "Web-App-Adresse fehlt"}</Text>
        <Text style={styles.message}>{loadError ?? "Starte Expo Go im LAN-Modus oder setze EXPO_PUBLIC_API_URL auf die HTTPS-Adresse der Bonanzbar-Web-App."}</Text>
        <Text style={styles.detail}>{webAppUrl ? `Ziel: ${webAppUrl}` : "Für lokale Tests müssen Telefon und Rechner im selben WLAN sein."}</Text>
        {loadError && <Pressable style={styles.retry} onPress={() => setLoadError(null)}><Text style={styles.retryText}>Erneut versuchen</Text></Pressable>}
      </View>
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.page}>
    <StatusBar style="light" />
    <WebView
      source={{ uri: webAppUrl }}
      startInLoadingState
      renderLoading={() => <LoadingView />}
      onError={(event) => setLoadError(event.nativeEvent.description || "Die Bonanzbar-Web-App konnte nicht geladen werden.")}
      onHttpError={(event) => setLoadError(`Die Bonanzbar-Web-App antwortet mit HTTP ${event.nativeEvent.statusCode}.`)}
      onLoadStart={() => setLoadError(null)}
      sharedCookiesEnabled
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#12100e" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 28 },
  loadingText: { color: "#f7f1e4", fontSize: 15, fontWeight: "700" },
  errorCard: { flex: 1, justifyContent: "center", padding: 28, gap: 12 },
  kicker: { color: "#f4ca6b", fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  title: { color: "#fff8ed", fontSize: 27, fontWeight: "700" },
  message: { color: "#f3d7bd", fontSize: 15, lineHeight: 22 },
  detail: { color: "#b9b0a2", fontSize: 13, lineHeight: 19 },
  retry: { alignSelf: "flex-start", marginTop: 8, borderColor: "#f4ca6b", borderRadius: 4, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  retryText: { color: "#f4ca6b", fontSize: 13, fontWeight: "700" },
});
