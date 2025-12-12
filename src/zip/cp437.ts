/**
 * CP437 (Code Page 437) to Unicode conversion
 *
 * CP437 was the original IBM PC character set and is the default encoding
 * for ZIP filenames when the UTF-8 flag (bit 11) is not set.
 *
 * Characters 0x00-0x7F are standard ASCII.
 * Characters 0x80-0xFF are the extended characters that differ from Latin-1.
 */

// CP437 to Unicode mapping for bytes 0x80-0xFF
// prettier-ignore
const CP437_HIGH: string[] = [
  // 0x80-0x8F
  '\u00C7',
  '\u00FC',
  '\u00E9',
  '\u00E2',
  '\u00E4',
  '\u00E0',
  '\u00E5',
  '\u00E7',
  '\u00EA',
  '\u00EB',
  '\u00E8',
  '\u00EF',
  '\u00EE',
  '\u00EC',
  '\u00C4',
  '\u00C5',
  // 0x90-0x9F
  '\u00C9',
  '\u00E6',
  '\u00C6',
  '\u00F4',
  '\u00F6',
  '\u00F2',
  '\u00FB',
  '\u00F9',
  '\u00FF',
  '\u00D6',
  '\u00DC',
  '\u00A2',
  '\u00A3',
  '\u00A5',
  '\u20A7',
  '\u0192',
  // 0xA0-0xAF
  '\u00E1',
  '\u00ED',
  '\u00F3',
  '\u00FA',
  '\u00F1',
  '\u00D1',
  '\u00AA',
  '\u00BA',
  '\u00BF',
  '\u2310',
  '\u00AC',
  '\u00BD',
  '\u00BC',
  '\u00A1',
  '\u00AB',
  '\u00BB',
  // 0xB0-0xBF (box drawing light)
  '\u2591',
  '\u2592',
  '\u2593',
  '\u2502',
  '\u2524',
  '\u2561',
  '\u2562',
  '\u2556',
  '\u2555',
  '\u2563',
  '\u2551',
  '\u2557',
  '\u255D',
  '\u255C',
  '\u255B',
  '\u2510',
  // 0xC0-0xCF (box drawing)
  '\u2514',
  '\u2534',
  '\u252C',
  '\u251C',
  '\u2500',
  '\u253C',
  '\u255E',
  '\u255F',
  '\u255A',
  '\u2554',
  '\u2569',
  '\u2566',
  '\u2560',
  '\u2550',
  '\u256C',
  '\u2567',
  // 0xD0-0xDF (box drawing continued)
  '\u2568',
  '\u2564',
  '\u2565',
  '\u2559',
  '\u2558',
  '\u2552',
  '\u2553',
  '\u256B',
  '\u256A',
  '\u2518',
  '\u250C',
  '\u2588',
  '\u2584',
  '\u258C',
  '\u2590',
  '\u2580',
  // 0xE0-0xEF (Greek letters)
  '\u03B1',
  '\u00DF',
  '\u0393',
  '\u03C0',
  '\u03A3',
  '\u03C3',
  '\u00B5',
  '\u03C4',
  '\u03A6',
  '\u0398',
  '\u03A9',
  '\u03B4',
  '\u221E',
  '\u03C6',
  '\u03B5',
  '\u2229',
  // 0xF0-0xFF (math symbols)
  '\u2261',
  '\u00B1',
  '\u2265',
  '\u2264',
  '\u2320',
  '\u2321',
  '\u00F7',
  '\u2248',
  '\u00B0',
  '\u2219',
  '\u00B7',
  '\u221A',
  '\u207F',
  '\u00B2',
  '\u25A0',
  '\u00A0',
];

/**
 * Decode CP437 encoded bytes to a Unicode string
 *
 * @param buf - Buffer containing CP437 encoded data
 * @param start - Start offset in buffer
 * @param end - End offset in buffer
 * @returns Decoded Unicode string
 */
export function decodeCP437(buf: Buffer, start: number, end: number): string {
  let result = '';
  for (let i = start; i < end; i++) {
    const byte = buf[i];
    if (byte < 0x80) {
      // Standard ASCII
      result += String.fromCharCode(byte);
    } else {
      // Extended characters - use lookup table
      result += CP437_HIGH[byte - 0x80];
    }
  }
  return result;
}

/**
 * Check if a buffer contains only ASCII characters (0x00-0x7F)
 * If true, CP437 and UTF-8 will produce identical results
 */
export function isAscii(buf: Buffer, start: number, end: number): boolean {
  for (let i = start; i < end; i++) {
    if (buf[i] >= 0x80) {
      return false;
    }
  }
  return true;
}
