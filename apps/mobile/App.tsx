import { formatCurrency, roleLabels, type Role } from "@bonanzbar/shared";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Item = { id: string; name: string; category: string; unit: string; priceCents: number; helperPriceCents: number; effectivePriceCents: number; reorderLevel: number; onHand: number };
type Snapshot = { user: { name: string; role: Role }; inventory: Item[] };

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const demoTokens: Record<Role, string> = {
  ADMIN: "demo-admin-local-only",
  MANAGER: "demo-manager-local-only",
  USER: "demo-member-local-only",
};

export default function App() {
  const [role, setRole] = useState<Role>("USER");
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState("1");

  const token = demoTokens[role];
  const api = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "x-bonanzbar-token": token, ...(init?.headers ?? {}) },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Anfrage fehlgeschlagen");
    return body;
  };
  const load = async () => {
    setLoading(true);
    try {
      setData(await api("/api/bootstrap"));
    } catch (error) {
      Alert.alert("Bonanzbar nicht erreichbar", error instanceof Error ? error.message : "Prüfe die API-Adresse.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [role]);

  const lowStock = useMemo(() => data?.inventory.filter((item) => item.onHand <= item.reorderLevel).length ?? 0, [data]);
  const recordDrink = async () => {
    if (!selectedItem) return;
    try {
      await api("/api/consumptions", { method: "POST", body: JSON.stringify({ itemId: selectedItem.id, quantity: Number(quantity) }) });
      Alert.alert("Zum Konto hinzugefügt", `${quantity}× ${selectedItem.name} wurde für dich eingetragen.`);
      setSelectedItem(null);
      setQuantity("1");
    } catch (error) {
      Alert.alert("Getränk konnte nicht eingetragen werden", error instanceof Error ? error.message : "Bitte versuche es erneut.");
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.brand}><Image source={require("./assets/bonanzbar-logo.png")} style={styles.logo} resizeMode="contain" /><View><Text style={styles.kicker}>BONANZBAR</Text><Text style={styles.title}>Die Bar in deiner Hand.</Text></View></View>
        <Pressable onPress={() => void load()} style={styles.refresh}><Text style={styles.refreshText}>{loading ? "..." : "Aktualisieren"}</Text></Pressable>
      </View>
      <View style={styles.roles}>
        {(["USER", "MANAGER", "ADMIN"] as Role[]).map((candidate) => <Pressable key={candidate} onPress={() => setRole(candidate)} style={[styles.role, candidate === role && styles.roleSelected]}><Text style={[styles.roleText, candidate === role && styles.roleTextSelected]}>{roleLabels[candidate]}</Text></Pressable>)}
      </View>
      {loading && !data ? <View style={styles.loader}><ActivityIndicator color="#275c46" /></View> : (
        <FlatList
          data={data?.inventory ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<>
            <View style={styles.welcome}><Text style={styles.welcomeText}>Angemeldet als {data?.user.name ?? roleLabels[role]}</Text><Text style={styles.welcomeDetail}>{role === "USER" ? "Tippe einen Artikel an, um ihn deinem Konto hinzuzufügen." : lowStock === 1 ? "1 Artikel braucht Aufmerksamkeit." : `${lowStock} Artikel brauchen Aufmerksamkeit.`}</Text></View>
            {selectedItem && <View style={styles.consumeCard}><Text style={styles.cardTitle}>{selectedItem.name} hinzufügen</Text><Text style={styles.muted}>{formatCurrency(selectedItem.effectivePriceCents)} pro Stück</Text><View style={styles.consumeRow}><TextInput style={styles.input} keyboardType="number-pad" value={quantity} onChangeText={setQuantity} /><Pressable style={styles.primary} onPress={() => void recordDrink()}><Text style={styles.primaryText}>Eintragen</Text></Pressable><Pressable onPress={() => setSelectedItem(null)}><Text style={styles.cancel}>Abbrechen</Text></Pressable></View></View>}
            {role !== "USER" && <View style={styles.managerNote}><Text style={styles.cardTitle}>Betriebsansicht</Text><Text style={styles.muted}>Für Zählungen, Einkaufslisten, Rechnungen und Zeitraumberichte nutze die Web-Verwaltung.</Text></View>}
            <Text style={styles.sectionTitle}>Verfügbares Inventar</Text>
          </>}
          renderItem={({ item }) => <Pressable style={styles.item} onPress={() => role === "USER" ? setSelectedItem(item) : undefined}><View><Text style={styles.itemName}>{item.name}</Text><Text style={styles.muted}>{item.category} · {formatCurrency(item.effectivePriceCents)}</Text></View><View style={styles.stock}><Text style={[styles.stockValue, item.onHand <= item.reorderLevel && styles.low]}>{item.onHand}</Text><Text style={styles.muted}>{item.unit}</Text></View></Pressable>}
          ListEmptyComponent={<Text style={styles.muted}>Kein Inventar verfügbar. Starte die Web-API und fülle die Beispieldaten ein.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#12100e" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, backgroundColor: "#8d3216", borderBottomWidth: 2, borderBottomColor: "#c8a456" },
  brand: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 10 },
  logo: { width: 50, height: 42, marginRight: 10 },
  kicker: { color: "#f2ce78", letterSpacing: 2, fontSize: 11, fontWeight: "700" },
  title: { color: "#fff8ed", fontSize: 27, fontWeight: "700", marginTop: 3 },
  refresh: { borderWidth: 1, borderColor: "#f2ce78", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 3 },
  refreshText: { color: "#fff8ed", fontWeight: "700", fontSize: 12 },
  roles: { flexDirection: "row", paddingHorizontal: 20, gap: 7, paddingBottom: 15, paddingTop: 15, backgroundColor: "#1c1916" },
  role: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 3, backgroundColor: "#29231d", borderWidth: 1, borderColor: "#4d4233" },
  roleSelected: { backgroundColor: "#8d3216", borderColor: "#c8a456" },
  roleText: { fontSize: 12, color: "#d8cfbf", fontWeight: "700" },
  roleTextSelected: { color: "#ffffff" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, paddingTop: 4, gap: 9 },
  welcome: { backgroundColor: "#8d3216", borderWidth: 1, borderColor: "#c8a456", borderRadius: 4, padding: 18, marginBottom: 10 },
  welcomeText: { color: "#fffaf0", fontWeight: "700", fontSize: 17 },
  welcomeDetail: { color: "#f3d7bd", marginTop: 5, lineHeight: 20 },
  managerNote: { backgroundColor: "#1c1916", borderWidth: 1, borderColor: "#4d4233", padding: 15, borderRadius: 4, marginBottom: 10 },
  consumeCard: { backgroundColor: "#2b2017", borderWidth: 1, borderColor: "#a57838", padding: 15, borderRadius: 4, marginBottom: 10 },
  cardTitle: { color: "#f4ca6b", fontWeight: "700", fontSize: 15 },
  muted: { color: "#b9b0a2", marginTop: 3, fontSize: 12 },
  consumeRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12 },
  input: { color: "#f7f1e4", backgroundColor: "#120f0d", borderWidth: 1, borderColor: "#80652e", borderRadius: 3, paddingHorizontal: 10, paddingVertical: 8, width: 52 },
  primary: { backgroundColor: "#8d3216", borderWidth: 1, borderColor: "#c17036", paddingVertical: 9, paddingHorizontal: 13, borderRadius: 3 },
  primaryText: { color: "white", fontWeight: "700", fontSize: 12 },
  cancel: { color: "#f1c86e", fontWeight: "700", fontSize: 12 },
  sectionTitle: { fontWeight: "700", fontSize: 16, color: "#f4ca6b", marginTop: 8, marginBottom: 2 },
  item: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1c1916", borderWidth: 1, borderColor: "#4d4233", borderRadius: 4, padding: 15 },
  itemName: { color: "#f7f1e4", fontWeight: "700", fontSize: 15 },
  stock: { alignItems: "flex-end" },
  stockValue: { color: "#f1c86e", fontSize: 20, fontWeight: "700" },
  low: { color: "#ff9a58" },
});
