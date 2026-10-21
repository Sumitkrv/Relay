import tokens from './tokens';

export { tokens };
export const theme = {
  colors: {
    ink: tokens.colors.brand.sidebar,
    primary: tokens.colors.primary.default,
    secondary: tokens.colors.secondary.default,
    mint: tokens.colors.primary.default,
    paper: tokens.colors.neutral.canvas,
  },
  tokens,
};

export default theme;
