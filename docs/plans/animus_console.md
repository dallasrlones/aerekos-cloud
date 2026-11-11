# Animus console (Jarvis × Animus)

Sci-fi cloud ops UI: shared HUD kit, light/dark toggle, per-service metaphors, AWS-shaped flows.

## Tokens

- [`conductor/app/styles/theme.js`](../../conductor/app/styles/theme.js) — `getTheme('light'|'dark')`, status tokens, animus glass/void
- Persist: `aerekos.theme.mode` (AsyncStorage + `localStorage`)
- Settings → Appearance

## Kit

Compose from [`conductor/app/components/Animus/`](../../conductor/app/components/Animus/):

`AnimusPage`, `AnimusPanel`, `AnimusListRow`, `AnimusEmpty`, `AnimusState`, `AnimusActionBar`, `AnimusNextSteps`, `AnimusMeter`, …

Rule: same console slots; different `metaphor` (planet / hangar / archive / vault / cipher / station). Don’t invent hex when a token exists.

## Metaphors

Declared on [`serviceCatalog.js`](../../conductor/app/services/serviceCatalog.js) (`metaphor` field). Devices = planet flagship; Adonis stays Cloud9 dark IDE.

## Styles

Prefer `useThemedStyles(createXStyles)` so theme toggles repaint.
