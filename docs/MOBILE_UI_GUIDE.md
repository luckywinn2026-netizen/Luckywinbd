# Mobile UI Adjustment Guide

APK সব মোবাইল স্ক্রিনে ঠিকমতো দেখানোর জন্য এই গাইড অনুসরণ করুন।

## dp ব্যবহার করুন (px নয়)

Android-এ **dp** (density-independent pixel) বিভিন্ন screen density-তে একই physical size বজায় রাখে।

**Web/CSS-এ dp-এর সমতুল্য:**
- `--dp: 0.6px` (1dp = 1/160 inch, 96dpi reference)
- ব্যবহার: `calc(200 * var(--dp))` = 200dp
- Tailwind: `min-h-44dp`, `min-w-56dp`, `w-200dp` ইত্যাদি

**উদাহরণ:**
```css
/* 200dp width, 44dp min height */
width: calc(200 * var(--dp));
min-height: calc(44 * var(--dp));
```

```tsx
/* Tailwind */
<button className="min-h-44dp min-w-56dp touch-target">Tap</button>
```

## Flexbox / Grid ব্যবহার করুন (Hard-coded position নয়)

Android-এ **ConstraintLayout** / **LinearLayout** যেমন UI automatically adjust করে, Web/CSS-এ **Flexbox** ও **Grid** একই কাজ করে।

**Hard-coded position (এড়িয়ে চলুন):**
```tsx
// ❌ Avoid
<div style={{ position: 'absolute', left: 100, top: 50 }}>
```

**Layout ব্যবহার করুন (prefer):**
```tsx
// ✅ Flexbox – LinearLayout এর মত (row/column)
<div className="flex flex-col gap-2">
<div className="flex flex-row items-center justify-between">

// ✅ Grid – ConstraintLayout এর মত (responsive)
<div className="grid grid-cols-2 gap-3">
<div className="grid grid-cols-1 md:grid-cols-3">

// ✅ Space-between, flex-1 – auto adjust
<div className="flex flex-1 justify-between items-center">
```

| Android | Web/CSS |
|---------|---------|
| LinearLayout (vertical) | `flex flex-col` |
| LinearLayout (horizontal) | `flex flex-row` |
| ConstraintLayout | `grid` বা `flex` + `gap` |
| `layout_width="match_parent"` | `w-full` |
| `layout_height="wrap_content"` | `h-auto` বা default |

## যা করা হয়েছে

### 1. Viewport & Safe Area
- `viewport-fit=cover` – নচড ডিভাইসে ফুল স্ক্রিন
- `safe-area-inset` – নচ, স্ট্যাটাস বার, হোম বারের জন্য স্পেস
- CSS classes: `safe-top`, `safe-bottom`, `safe-x`, `header-safe`, `main-safe-bottom`

### 2. Fluid Typography
- `--text-base`, `--text-sm`, `--text-xs` – স্ক্রিন সাইজ অনুযায়ী ফন্ট সাইজ
- 320px থেকে 428px+ স্ক্রিনে অটো অ্যাডজাস্ট

### 3. Tailwind Breakpoints
- `xs: 320px` – ছোট ফোন
- `max-sm: 639px` – মোবাইল
- `md`, `lg` – ট্যাবলেট/ডেস্কটপ

### 4. Layout Tips
- `flex`, `grid` – Hard-coded `left`/`top` এড়িয়ে layout ব্যবহার করুন
- `flex-1`, `gap-*` – Auto-adjusting spacing
- `min-w-0` – ফ্লেক্স চাইল্ডে overflow ঠিক রাখে
- `max-w-[100vw]` – হরাইজন্টাল স্ক্রল বন্ধ
- `overflow-x-hidden` – এক্সট্রা স্ক্রল লুকানো

## নতুন কম্পোনেন্টে ব্যবহার

```tsx
// Safe area সহ হেডার
<header className="header-safe safe-x ...">

// বটম নেভ + সেফ এরিয়া
<div className="main-safe-bottom safe-x ...">

// ছোট স্ক্রিনে আলাদা স্টাইল
<div className="text-sm md:text-base">
<div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4">
```

## Games Responsive

গেমগুলো বিভিন্ন স্ক্রিনে adjust হবে:
- **SlotGame** – reel size `min(20vw, 72px)`, machine `min-h-[min(50vw,260px)]`
- **SpinWheelGame** – wheel `min(85vw, 340px)`
- **FortuneWheelGame** – max-w `min(95vw, 480px)`
- **Daily Spin** – wheel `min(85vw, 320px)`
- **TropicalFruits, ClassicCasino, FruitParty, Lucky777** – max-w `min(95vw, 480px)`
- **MoneyComing** – wheel `min(70vw, 280px)`, container `min(95vw, 480px)`
- **Classic777, SweetBonanza, SuperAce** – max-w `min(95vw, 480px)`
- **Aviator (Crash)** – canvas area `min(95vw, 480px)`
- **ColorPrediction** – modals `min(95vw, 320px)` / `min(95vw, 400px)`
- **game-canvas**, **game-canvas-sm**, **game-canvas-lg** – নতুন গেমে ব্যবহার করুন

## টেস্ট করার ডিভাইস

- 320px (ছোট ফোন)
- 360px (সাধারণ ফোন)
- 412px (বড় ফোন)
- 428px (আইফোন)

Chrome DevTools → Toggle device toolbar দিয়ে চেক করুন।
