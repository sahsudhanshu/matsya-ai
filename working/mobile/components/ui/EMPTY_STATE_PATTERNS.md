# Empty State Patterns

This document provides comprehensive guidelines and examples for implementing empty states across the OceanAI mobile application.

## Overview

Empty states are displayed when there is no data to show in a particular screen or section. They should:

- Provide clear context about why the screen is empty
- Guide users on what actions they can take
- Use appropriate icons that match the context
- Maintain consistent styling with the rest of the app

## Component API

```typescript
interface EmptyStateProps {
  icon: React.ReactNode; // Icon component (typically Ionicons)
  title: string; // Main heading
  description: string; // Explanatory text
  action?: {
    // Optional CTA button
    label: string;
    onPress: () => void;
  };
}
```

## Implemented Empty States

### 1. No Analyses (History Screen)

**Location**: `mobile/app/(tabs)/history.tsx`

**Usage**:

```tsx
<EmptyState
  icon={<Ionicons name="time-outline" size={48} color={COLORS.textMuted} />}
  title="No History Yet"
  description="Your catch analysis history will appear here. Upload images to get started!"
  action={{
    label: "Upload Now",
    onPress: () => router.push("/(tabs)/"),
  }}
/>
```

**When to show**: When user has no analysis history
**Icon**: `time-outline` (represents history/timeline)
**CTA**: Navigates to upload screen

### 2. No Conversations (Chat Sidebar)

**Location**: `mobile/app/(tabs)/chat.tsx` (sidebar)

**Usage**:

```tsx
{chats.length === 0 ? (
  <View style={styles.emptyChatList}>
    <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textMuted} />
    <Text style={styles.emptyChatTitle}>No Conversations Yet</Text>
    <Text style={styles.emptyChatText}>
      Start a new chat to get fishing advice, market insights, and
      catch analysis from OceanAI Assistant.
    </Text>
  </View>
) : (
  // Chat list
)}
```

**When to show**: When user has no saved conversations
**Icon**: `chatbubbles-outline` (represents conversations)
**CTA**: User can click "New Chat" button above the empty state

### 3. No Analytics Data

**Location**: `mobile/app/(tabs)/analytics.tsx`

**Usage**:

```tsx
<EmptyState
  icon={
    <Ionicons name="bar-chart-outline" size={64} color={COLORS.textMuted} />
  }
  title="No Analytics Data"
  description={
    error ||
    "Upload and analyze catches to see your dashboard. Your earnings, catch statistics, and insights will appear here."
  }
  action={
    isOnline
      ? {
          label: "Upload Catch",
          onPress: () => router.push("/(tabs)/"),
        }
      : undefined
  }
/>
```

**When to show**: When user has no analytics data or is offline
**Icon**: `bar-chart-outline` (represents analytics/charts)
**CTA**: Navigates to upload screen (only when online)

## Future Empty State Patterns

### 4. No Notifications

**Recommended Location**: `mobile/app/(tabs)/notifications.tsx` (when implemented)

**Recommended Usage**:

```tsx
<EmptyState
  icon={
    <Ionicons name="notifications-outline" size={48} color={COLORS.textMuted} />
  }
  title="No Notifications"
  description="You're all caught up! Notifications about disaster alerts, analysis results, and updates will appear here."
/>
```

**When to show**: When user has no notifications
**Icon**: `notifications-outline` (represents notifications)
**CTA**: None (no action needed when caught up)

### 5. Search No Results

**Recommended Location**: Any screen with search functionality

**Recommended Usage**:

```tsx
<EmptyState
  icon={<Ionicons name="search-outline" size={48} color={COLORS.textMuted} />}
  title="No Results Found"
  description="Try adjusting your search terms or filters to find what you're looking for."
  action={{
    label: "Clear Filters",
    onPress: clearFilters,
  }}
/>
```

**When to show**: When search returns no results
**Icon**: `search-outline` (represents search)
**CTA**: Clears active filters/search

### 6. No Disaster Alerts

**Recommended Location**: `mobile/app/(tabs)/map.tsx` (disaster alerts panel)

**Recommended Usage**:

```tsx
<EmptyState
  icon={
    <Ionicons
      name="shield-checkmark-outline"
      size={48}
      color={COLORS.success}
    />
  }
  title="All Clear"
  description="No active disaster alerts in your area. Stay safe and check back regularly for updates."
/>
```

**When to show**: When there are no active disaster alerts
**Icon**: `shield-checkmark-outline` (represents safety)
**CTA**: None (good news, no action needed)

### 7. No Zone Insights

**Recommended Location**: `mobile/app/(tabs)/map.tsx` (zone insights panel)

**Recommended Usage**:

```tsx
<EmptyState
  icon={<Ionicons name="location-outline" size={48} color={COLORS.textMuted} />}
  title="No Zone Data"
  description="Select a fishing zone on the map to view insights, recommendations, and recent activity."
/>
```

**When to show**: When no zone is selected or zone has no data
**Icon**: `location-outline` (represents location/zone)
**CTA**: None (instruction to select zone)

### 8. No Catch in Group Analysis

**Recommended Location**: `mobile/app/history/[groupId].tsx`

**Recommended Usage**:

```tsx
<EmptyState
  icon={<Ionicons name="fish-outline" size={48} color={COLORS.textMuted} />}
  title="No Fish Detected"
  description="No fish were detected in this analysis. Try uploading clearer images with better lighting."
  action={{
    label: "Upload Again",
    onPress: () => router.push("/(tabs)/"),
  }}
/>
```

**When to show**: When group analysis detects no fish
**Icon**: `fish-outline` (represents fish/catch)
**CTA**: Navigates to upload screen

## Icon Selection Guidelines

Choose icons that clearly represent the context:

- **History/Timeline**: `time-outline`, `calendar-outline`
- **Chat/Messages**: `chatbubbles-outline`, `chatbubble-outline`
- **Analytics/Stats**: `bar-chart-outline`, `stats-chart-outline`, `pie-chart-outline`
- **Notifications**: `notifications-outline`, `alert-circle-outline`
- **Search**: `search-outline`, `filter-outline`
- **Location/Map**: `location-outline`, `map-outline`, `navigate-outline`
- **Fish/Catch**: `fish-outline` (custom or use `water-outline`)
- **Safety/Alerts**: `shield-checkmark-outline`, `shield-outline`, `warning-outline`
- **Upload**: `cloud-upload-outline`, `camera-outline`, `images-outline`

## Styling Guidelines

### Icon Size

- **Small contexts** (inline, cards): 32-40px
- **Standard contexts** (full screen): 48-56px
- **Large contexts** (prominent empty states): 64-72px

### Colors

- **Icon color**: `COLORS.textMuted` (default)
- **Success states**: `COLORS.success` (e.g., "All Clear")
- **Warning states**: `COLORS.warning` (e.g., "Slow Connection")
- **Error states**: `COLORS.error` (e.g., "Failed to Load")

### Text

- **Title**: Bold, `FONTS.sizes.xl` or `FONTS.sizes.md`
- **Description**: Regular, `COLORS.textMuted`, line height 20-22

### Spacing

- Icon to title: `SPACING.xl` (32px)
- Title to description: `SPACING.sm` (8px)
- Description to button: `SPACING.xl` (32px)
- Container padding: `SPACING['3xl']` (48px) or `SPACING['2xl']` (48px)

## Best Practices

1. **Be Helpful**: Explain why the screen is empty and what the user can do
2. **Be Concise**: Keep titles short (2-4 words) and descriptions brief (1-2 sentences)
3. **Be Actionable**: Provide a clear CTA when there's an action the user can take
4. **Be Consistent**: Use the same EmptyState component across the app
5. **Be Contextual**: Match the icon and copy to the specific context
6. **Be Positive**: Frame empty states as opportunities, not failures
7. **Consider Offline**: Handle offline states gracefully (hide CTAs that require internet)

## Testing Checklist

When implementing a new empty state:

- [ ] Icon is appropriate for the context
- [ ] Title is clear and concise
- [ ] Description explains the situation and next steps
- [ ] CTA button (if present) has clear label and working action
- [ ] Styling matches other empty states in the app
- [ ] Works correctly in both light and dark modes (if applicable)
- [ ] Handles offline state appropriately
- [ ] Accessible to screen readers
- [ ] Tested on different screen sizes

## Related Components

- **EmptyState**: `mobile/components/ui/EmptyState.tsx`
- **Button**: `mobile/components/ui/Button.tsx`
- **Colors**: `mobile/lib/constants.ts` (COLORS)
- **Spacing**: `mobile/lib/constants.ts` (SPACING)
- **Fonts**: `mobile/lib/constants.ts` (FONTS)

## Web Parity

Ensure mobile empty states match the web application:

- Same copy/messaging
- Similar visual style (adapted for mobile)
- Consistent iconography (Ionicons on mobile, Lucide on web)
- Same user guidance and CTAs
