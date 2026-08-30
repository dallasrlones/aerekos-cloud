# Style Guidelines

## Design Inspiration

The application style is inspired by **Assassin's Creed loading screens** - dark, mysterious, with elegant typography and subtle animations.

### Key Characteristics

- **Dark Theme**: Deep blacks, dark grays, with accent colors
- **Elegant Typography**: Clean, modern fonts with good readability
- **Subtle Animations**: Smooth, purposeful transitions
- **Minimalist UI**: Clean interfaces with focus on content
- **Mysterious Aesthetic**: Dark backgrounds with glowing accents

## Color Palette

### Primary Colors

```javascript
// styles/colors.js
export const colors = {
  // Dark base colors (Assassin's Creed inspired)
  background: '#0A0A0A',        // Deep black
  surface: '#1A1A1A',           // Dark gray surface
  surfaceElevated: '#2A2A2A',   // Elevated surfaces
  
  // Accent colors
  primary: '#C89B3C',            // Gold/amber accent (Assassin's Creed style)
  primaryDark: '#8B6914',        // Darker gold
  primaryLight: '#F4D03F',       // Lighter gold
  
  // Status colors
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
  
  // Text colors
  textPrimary: '#FFFFFF',        // White text
  textSecondary: '#B0B0B0',      // Light gray text
  textTertiary: '#707070',       // Darker gray text
  
  // Borders and dividers
  border: '#333333',
  divider: '#2A2A2A',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.8)',
};
```

## Typography

### Font Families

- **Primary**: System fonts (San Francisco on iOS, Roboto on Android)
- **Monospace**: For code/data display
- **Headings**: Bold, clean, modern

### Font Sizes

```javascript
// styles/typography.js
export const typography = {
  h1: { fontSize: 32, fontWeight: 'bold', lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: 'bold', lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  h4: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
};
```

## Spacing

```javascript
// styles/spacing.js
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

## Component Styles

### Cards

- Dark background (`surface`)
- Subtle border or shadow
- Rounded corners (8px)
- Padding: `spacing.md`

### Buttons

- Primary: Gold/amber background (`primary`)
- Secondary: Outlined with gold border
- Dark background with gold text for accent
- Smooth hover/press animations

### Inputs

- Dark background (`surface`)
- Gold border on focus
- Placeholder text in `textSecondary`
- Smooth focus transitions

### Loading States

- Animated spinners with gold accent
- Skeleton loaders with dark backgrounds
- Smooth fade-in animations

## Animations

### Transitions

- Use `Animated` API or `react-native-reanimated`
- Duration: 200-300ms for most transitions
- Easing: `ease-in-out` for smooth feel
- Subtle scale/opacity animations

### Loading Screen Style

Inspired by Assassin's Creed loading screens:

- Dark background with subtle patterns
- Centered content
- Animated progress indicators
- Elegant typography
- Smooth transitions between states

## Shadows and Elevation

- Use subtle shadows for depth
- Elevation: 2-4 for cards, 8+ for modals
- Dark shadows that blend with background

## Icons

- Use consistent icon library (e.g., Material Icons, Feather)
- Gold accent color for active/important icons
- White/gray for regular icons
- Size: 16px, 20px, 24px, 32px

## Layout

- Use flexbox for layouts
- Consistent padding/margins using spacing scale
- Max content width for readability
- Responsive design considerations

## Dark Theme Best Practices

- High contrast for readability
- Use color sparingly (gold accents)
- Avoid pure white backgrounds
- Test in low-light conditions
- Ensure accessibility (WCAG AA compliance)

## Example Theme File

```javascript
// styles/theme.js
import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
  },
};
```
