# Frontend Coding Guidelines

## Architecture Pattern

### Folder Structure

Organize code into clear, reusable modules:

```
frontend/
├── screens/               # Screen components
│   ├── Login/
│   │   ├── Login.jsx
│   │   └── Login.styles.js
│   └── Dashboard/
│       ├── Dashboard.jsx
│       └── Dashboard.styles.js
├── components/            # Reusable UI components
│   ├── Button/
│   │   ├── Button.jsx
│   │   └── Button.styles.js
│   ├── Card/
│   │   ├── Card.jsx
│   │   └── Card.styles.js
│   └── Input/
│       ├── Input.jsx
│       └── Input.styles.js
├── hooks/                 # Custom React hooks
│   ├── useAuth.js
│   ├── useWorkers.js
│   └── useServices.js
├── styles/                # Global styles and themes
│   ├── colors.js
│   ├── typography.js
│   ├── spacing.js
│   └── theme.js
├── utils/                 # Utility functions
│   ├── api.js            # API client
│   ├── validation.js
│   └── helpers.js
└── services/              # API service layer
    ├── authService.js
    ├── workerService.js
    └── serviceService.js
```

## Principles

- **Component Separation**: Keep components small and focused
  - One component per file
  - Separate styles into `.styles.js` files
  - Components should be reusable and composable

- **Custom Hooks**: Extract reusable logic into hooks
  - Data fetching logic → hooks
  - Form handling → hooks
  - State management → hooks
  - Business logic → hooks

- **Style Separation**: Styles in separate files
  - Use StyleSheet.create() for styles
  - Keep styles co-located with components (`.styles.js`)
  - Use global theme/styles for consistency

- **Utils**: Utility functions in `utils/` folder
  - Pure functions only
  - No side effects
  - Well tested

- **DRY Principle**: Don't Repeat Yourself
  - Extract common UI patterns into components
  - Extract common logic into hooks
  - Reuse styles and utilities

## Component Structure

### Component Example

```javascript
// components/Button/Button.jsx
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { ButtonStyles } from './Button.styles';

export const Button = ({ title, onPress, variant = 'primary' }) => {
  return (
    <TouchableOpacity 
      style={[ButtonStyles.container, ButtonStyles[variant]]} 
      onPress={onPress}
    >
      <Text style={ButtonStyles.text}>{title}</Text>
    </TouchableOpacity>
  );
};
```

### Styles Example

```javascript
// components/Button/Button.styles.js
import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../styles';

export const ButtonStyles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: 4,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
```

### Hook Example

```javascript
// hooks/useAuth.js
import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    // Login logic
  };

  const logout = async () => {
    // Logout logic
  };

  return { user, loading, error, login, logout };
};
```

## API Service Layer

Create service classes for API calls:

```javascript
// services/authService.js
import { apiClient } from '../utils/api';

export const authService = {
  async login(username, password) {
    const response = await apiClient.post('/api/auth/login', {
      username,
      password,
    });
    return response.data;
  },
  
  async getCurrentUser() {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  },
};
```

## State Management

- Use React hooks for local state
- Use Context API for global state (auth, theme, etc.)
- Keep state as close to where it's used as possible
- Lift state up only when necessary

## Error Handling

- Handle errors gracefully in components
- Show user-friendly error messages
- Use try/catch in async functions
- Display loading states during API calls

## Code Quality

- Use functional components and hooks
- Use meaningful variable and function names
- Keep components under 200 lines
- Extract complex logic into hooks or utils
- Use PropTypes or TypeScript for type checking
- Avoid inline styles (use StyleSheet)
- Use constants for magic numbers/strings

## Performance

- Use React.memo for expensive components
- Use useMemo and useCallback appropriately
- Avoid unnecessary re-renders
- Lazy load screens/components when possible
- Optimize images and assets

## Accessibility

- Use semantic HTML/React Native components
- Add accessibility labels
- Ensure proper contrast ratios
- Test with screen readers
- Support keyboard navigation
