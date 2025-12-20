// lib/theme.js
import React, { createContext, useContext } from 'react';

export const THEME = {
  primary: '#9B87F5',
  accent:  '#A78BFA',
  grad1:   '#7C3AED',
  grad2:   '#8B5CF6',
  grad3:   '#C4B5FD',
  bg:      '#0F1115',
  surface: '#151823',
  card:    '#161A27',
  text:    '#E8ECF1',
  subtext: '#A6B0C3',
  border:  'rgba(255,255,255,0.06)',
  radius:  18,
};

const Ctx = createContext(THEME);
export const ThemeProvider = ({ children }) => (
  <Ctx.Provider value={THEME}>{children}</Ctx.Provider>
);
export const useTheme = () => useContext(Ctx);
