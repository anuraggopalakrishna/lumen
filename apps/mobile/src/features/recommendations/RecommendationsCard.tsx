import type { Recommendation, SuggestionCategory } from "@lumen/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getHealthPreferences } from "../../services/api/preferences";
import {
  generateRecommendations,
  listRecommendations,
  sendRecommendationFeedback,
} from "../../services/api/recommendations";
import { ApiError } from "../../services/api/client";
import { useApp } from "../../stores/AppProvider";
import { colors, fonts } from "../../stores/theme";

const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  movement: "Movement",
  food: "Food",
  recovery: "Recovery",
  practice: "Practice",
};

const CONFIDENCE_LABELS = {
  low: "low confidence",
  medium: "medium confidence",
  high: "high confidence",
} as const;

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return "AI suggestions need your consent and sharing turned on. Enable them in Profile.";
    }
    if (error.status === 501) {
      return "AI generation is disabled on the server right now.";
    }
    if (error.status === 502 || error.status === 503 || error.status === 504) {
      return "The local model could not produce a suggestion just now. Try again shortly.";
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Please try again.";
}

/**
 * Drop machine tokens before showing model text. The model occasionally echoes
 * field names ("basedOn:") or codes ("low_mood") from its context; users should
 * only ever see plain sentences.
 */
function readable(text: string): string {
  return text
    .replace(/^\s*based\s*on\s*[:\-–]?\s*/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function RecommendationItem({
  recommendation,
  onFeedback,
  pendingFeedback,
  rated,
}: {
  recommendation: Recommendation;
  onFeedback: (helpfulness: "helpful" | "not_helpful") => void;
  pendingFeedback: boolean;
  rated: "helpful" | "not_helpful" | undefined;
}) {
  const { suggestion } = recommendation;
  return (
    <View style={styles.item}>
      <View style={styles.itemHead}>
        <Text style={styles.category}>
          {CATEGORY_LABELS[recommendation.category]}
        </Text>
        <Text style={styles.confidence}>
          {CONFIDENCE_LABELS[recommendation.suggestion.confidence]}
        </Text>
      </View>
      <Text style={styles.suggestion}>
        {readable(suggestion.recommendation)}
      </Text>
      {/* <Text style={styles.rationale}>{readable(suggestion.rationale)}</Text> */}
      {suggestion.caution ? (
        <Text style={styles.caution}>{readable(suggestion.caution)}</Text>
      ) : null}
      <View style={styles.feedbackRow}>
        <Text style={styles.feedbackPrompt}>Was this helpful?</Text>
        <View style={styles.feedbackButtons}>
          {rated ? (
            <Text style={styles.thanks}>
              {rated === "helpful"
                ? "✓ Marked helpful"
                : "✓ Marked not helpful"}
            </Text>
          ) : (
            <>
              <Pressable
                disabled={pendingFeedback}
                onPress={() => onFeedback("helpful")}
                accessibilityRole="button"
                accessibilityLabel="Mark suggestion helpful"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.feedbackButton,
                  styles.feedbackPrimary,
                  pressed && styles.feedbackPressed,
                  pendingFeedback && styles.feedbackDisabled,
                ]}
              >
                <Text style={styles.feedbackPrimaryText}>
                  {pendingFeedback ? "…" : "👍 Helpful"}
                </Text>
              </Pressable>
              <Pressable
                disabled={pendingFeedback}
                onPress={() => onFeedback("not_helpful")}
                accessibilityRole="button"
                accessibilityLabel="Mark suggestion not helpful"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.feedbackButton,
                  styles.feedbackSecondary,
                  pressed && styles.feedbackPressed,
                  pendingFeedback && styles.feedbackDisabled,
                ]}
              >
                <Text style={styles.feedbackSecondaryText}>👎 Not helpful</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export function RecommendationsCard() {
  const { status } = useApp();
  const queryClient = useQueryClient();
  const signedIn = status === "signedIn";

  const recommendationsQuery = useQuery({
    queryKey: ["recommendations"],
    queryFn: listRecommendations,
    enabled: signedIn,
  });

  const preferencesQuery = useQuery({
    queryKey: ["health-preferences"],
    queryFn: getHealthPreferences,
    enabled: signedIn,
  });

  const generate = useMutation({
    mutationFn: generateRecommendations,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recommendations"] });
    },
    onError: (error) => {
      Alert.alert("Could not generate suggestions", errorMessage(error));
    },
  });

  const [feedbackPendingId, setFeedbackPendingId] = useState<string | null>(
    null,
  );
  const [rated, setRated] = useState<Record<string, "helpful" | "not_helpful">>(
    {},
  );

  const giveFeedback = async (
    recommendation: Recommendation,
    helpfulness: "helpful" | "not_helpful",
  ) => {
    setFeedbackPendingId(recommendation.id);
    try {
      await sendRecommendationFeedback(recommendation.id, {
        helpfulness,
        actionTaken: "none",
      });
      setRated((current) => ({ ...current, [recommendation.id]: helpfulness }));
    } catch (error) {
      Alert.alert("Could not save feedback", errorMessage(error));
    } finally {
      setFeedbackPendingId(null);
    }
  };

  if (!signedIn) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyTitle}>Sign in for suggestions</Text>
        <Text style={styles.emptyBody}>
          Personal suggestions are generated on the private server from your
          synced features. Sign in to turn them on.
        </Text>
      </View>
    );
  }

  const aiSharingEnabled =
    preferencesQuery.data?.preferences.aiSharingEnabled ?? false;
  const recommendations = recommendationsQuery.data?.recommendations ?? [];

  return (
    <View>
      {!aiSharingEnabled ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>AI suggestions are off</Text>
          <Text style={styles.noticeBody}>
            Turn on “Use my features for suggestions” in Profile to allow the
            private server to generate them.
          </Text>
        </View>
      ) : null}

      {recommendations.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>Nothing yet today</Text>
          <Text style={styles.emptyBody}>
            Ask Lumen to read your recent windows and propose a few gentle,
            grounded suggestions.
          </Text>
        </View>
      ) : (
        recommendations.map((recommendation) => (
          <RecommendationItem
            key={recommendation.id}
            recommendation={recommendation}
            rated={rated[recommendation.id]}
            pendingFeedback={feedbackPendingId === recommendation.id}
            onFeedback={(helpfulness) =>
              void giveFeedback(recommendation, helpfulness)
            }
          />
        ))
      )}

      <Pressable
        onPress={() => generate.mutate()}
        disabled={generate.isPending || !aiSharingEnabled}
        style={[
          styles.button,
          (!aiSharingEnabled || generate.isPending) && styles.buttonDisabled,
        ]}
      >
        {generate.isPending ? (
          <ActivityIndicator color={colors.primaryDeep} />
        ) : (
          <Text style={styles.buttonText}>
            {recommendations.length > 0
              ? "Generate new suggestions"
              : "Generate suggestions"}
          </Text>
        )}
      </Pressable>
      <Text style={styles.footnote}>
        Generated locally from minimized features. Not medical advice.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
  },
  item: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  itemHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  category: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  confidence: { color: colors.textFaint, fontSize: 10, fontWeight: "700" },
  suggestion: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 23,
    marginBottom: 6,
  },
  rationale: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  caution: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 8 },
  feedbackRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  feedbackPrompt: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  feedbackButtons: { flexDirection: "row", gap: 10 },
  feedbackButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  feedbackPrimary: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  feedbackPrimaryText: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: "800",
  },
  feedbackSecondary: {
    backgroundColor: colors.surface,
    borderColor: "#D9D5CD",
  },
  feedbackSecondaryText: { color: "#5E5C56", fontSize: 14, fontWeight: "700" },
  feedbackPressed: { opacity: 0.75 },
  feedbackDisabled: { opacity: 0.6 },
  thanks: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  notice: {
    backgroundColor: colors.plan,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  noticeTitle: { color: "#352F28", fontSize: 14, fontWeight: "700" },
  noticeBody: { color: "#625C52", fontSize: 12, lineHeight: 17, marginTop: 4 },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 18,
    marginBottom: 6,
  },
  emptyBody: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  button: {
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    height: 54,
    marginTop: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.primaryDeep, fontSize: 15, fontWeight: "700" },
  footnote: {
    color: colors.textFaint,
    fontSize: 10,
    textAlign: "center",
    marginTop: 10,
  },
});
