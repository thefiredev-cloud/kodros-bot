import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { currentApiBase } from "../lib/api";
import { submitInstallLead } from "../lib/commerce";
import { MESHVAULT_SELL } from "../lib/sell";

export default function Founding() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [leadStatus, setLeadStatus] = useState<string | null>(null);
  const [leadError, setLeadError] = useState(false);
  const [leadPending, setLeadPending] = useState(false);

  async function submitLead() {
    if (leadPending) return;
    setLeadPending(true);
    setLeadError(false);
    setLeadStatus("Sending to Kodros.");
    try {
      await submitInstallLead(currentApiBase(), {
        name: name.trim(),
        email: email.trim(),
        company: company.trim(),
        notes: notes.trim(),
      });
      setName("");
      setEmail("");
      setCompany("");
      setNotes("");
      setLeadStatus("Sent. A person at tanner@kodros.ai will reply.");
    } catch (err) {
      setLeadError(true);
      setLeadStatus(
        err instanceof Error ? err.message : "The form could not send. Email tanner@kodros.ai.",
      );
    } finally {
      setLeadPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F7F7F4" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={{ color: "#1B1B1E", fontSize: 28, fontWeight: "500" }}>Kodros</Text>
        <Text style={{ color: "#1B1B1E", marginTop: 10, fontSize: 16, lineHeight: 22 }}>
          {MESHVAULT_SELL}
        </Text>
        <Text style={{ color: "#6E6E68", marginTop: 10, fontSize: 16, lineHeight: 22 }}>
          iOS is pre-release. There is no App Store or TestFlight download yet.
        </Text>

        <Text style={{ color: "#1B1B1E", fontSize: 20, fontWeight: "600", marginTop: 32 }}>
          Founding install
        </Text>
        <Text style={{ color: "#6E6E68", marginTop: 8, fontSize: 15, lineHeight: 22 }}>
          Request a founding or managed install. The form emails tanner@kodros.ai. No fake inbox.
        </Text>

        <Field label="Name" value={name} onChangeText={setName} autoComplete="name" />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Company (optional)"
          value={company}
          onChangeText={setCompany}
          autoComplete="organization"
        />
        <Field
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Hardware, team size, what you want installed"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request a founding install"
          onPress={() => void submitLead()}
          disabled={leadPending}
          style={{
            marginTop: 20,
            backgroundColor: "#121215",
            borderRadius: 13,
            padding: 18,
            alignItems: "center",
            opacity: leadPending ? 0.5 : 1,
          }}
        >
          <Text style={{ color: "#FBFBF9", fontSize: 17 }}>
            {leadPending ? "Sending…" : "Request a founding install"}
          </Text>
        </Pressable>
        {leadStatus ? (
          <Text
            style={{
              color: leadError ? "#C94244" : "#6E6E68",
              marginTop: 12,
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            {leadStatus}
          </Text>
        ) : null}
        <Text style={{ color: "#A8A8A2", marginTop: 16, fontSize: 13, lineHeight: 18 }}>
          Or email tanner@kodros.ai. A person replies. No fake inbox.
        </Text>
        <Text style={{ color: "#A8A8A2", marginTop: 16, fontSize: 13, lineHeight: 18 }}>
          {MESHVAULT_SELL}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  autoCapitalize,
  autoComplete,
  keyboardType,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "name" | "email" | "organization";
  keyboardType?: "email-address";
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: "#6E6E68", fontSize: 14 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#8C8C86"
        style={{
          marginTop: 8,
          backgroundColor: "#F1F1ED",
          borderRadius: 13,
          padding: 16,
          color: "#1B1B1E",
          minHeight: multiline ? 96 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}
