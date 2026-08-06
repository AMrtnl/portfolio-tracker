import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { color, font } from '../theme/tokens';

type Props = TextProps & { style?: TextStyle | TextStyle[] };

/** Bricolage Grotesque — headings and the portfolio total. */
export function Display({ style, ...rest }: Props) {
  return <Text {...rest} style={[styles.display, style]} />;
}

export function Title({ style, ...rest }: Props) {
  return <Text {...rest} style={[styles.title, style]} />;
}

/** Uppercase micro-label that opens every section, as on the web. */
export function Overline({ style, ...rest }: Props) {
  return <Text {...rest} style={[styles.overline, style]} />;
}

export function Body({ style, ...rest }: Props) {
  return <Text {...rest} style={[styles.body, style]} />;
}

export function BodyStrong({ style, ...rest }: Props) {
  return <Text {...rest} style={[styles.bodyStrong, style]} />;
}

export function Caption({ style, ...rest }: Props) {
  return <Text {...rest} style={[styles.caption, style]} />;
}

/** IBM Plex Mono with tabular figures so columns of numbers stay aligned. */
export function Mono({ style, ...rest }: Props) {
  return <Text {...rest} style={[styles.mono, style]} />;
}

export function MonoStrong({ style, ...rest }: Props) {
  return <Text {...rest} style={[styles.monoStrong, style]} />;
}

const styles = StyleSheet.create({
  display: {
    fontFamily: font.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: color.foreground,
  },
  title: {
    fontFamily: font.displaySemi,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: color.foreground,
  },
  overline: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.mutedForeground,
  },
  body: {
    fontFamily: font.body,
    fontSize: 15,
    lineHeight: 21,
    color: color.foreground,
  },
  bodyStrong: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    lineHeight: 21,
    color: color.foreground,
  },
  caption: {
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 18,
    color: color.mutedForeground,
  },
  mono: {
    fontFamily: font.mono,
    fontSize: 14,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
    color: color.foreground,
  },
  monoStrong: {
    fontFamily: font.monoMedium,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    color: color.foreground,
  },
});
