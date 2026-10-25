// Shared by uploadBooksGoogle.js (what gets indexed) and chat.js (mapping retrieved text
// back to paragraphs), so both must produce exactly the same text.

export function cleanText(text) {
    return text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .split('\n').map(l => l.trim()).join('\n')
        .trim();
}

// Raw JSON wastes embedding tokens on keys/css classes and yields noisy chunks,
// so we index plain text with the book title and chapter headings kept in.
export function bookToMarkdown(book) {
    const lines = [`# ${book.title}`, ''];
    for (const chapter of book.chapters) {
        const title = cleanText(chapter.title || '');
        if (title) lines.push(`## ${title}`, '');
        for (const p of chapter.paragraphs || []) {
            const text = cleanText(p.text || '');
            if (text) lines.push(text, '');
        }
    }
    return lines.join('\n');
}

// Loose form used to find a quoted sentence inside a paragraph:
// ignores case, quote marks, soft hyphens, markdown emphasis and spacing differences.
// Mirrored in krishna-search-php/api/ks-ai.php (ksNormalize): keep both identical,
// which is why whitespace is listed explicitly instead of relying on \s.
// Code points, not escapes, so the character lists cannot be mangled by editors
const SPACE_CODES = [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680,
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
    0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff];
// soft hyphen, zero width space
const INVISIBLE = new RegExp('[' + String.fromCharCode(0xad, 0x200b) + ']', 'g');
export const MATCH_SPACES = new RegExp('[' + String.fromCharCode(...SPACE_CODES) + ']+', 'g');

// ---------- Keyword search tokens ----------
// Mirrored in krishna-search-php/api/ks-ai.php (ksTokens): keep both identical.
// Diacritics are folded so "Krsna", "Kṛṣṇa" and "KRSNA" match, and "sh" is read as "s"
// so common spellings like "Krishna" / "Vishnu" meet the books' "Kṛṣṇa" / "Viṣṇu".

const FOLD = {
    'ā': 'a', 'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a',
    'ī': 'i', 'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ū': 'u', 'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'ē': 'e', 'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'ō': 'o', 'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o',
    'ṛ': 'r', 'ṝ': 'r', 'ḷ': 'l', 'ḹ': 'l', 'ṁ': 'm', 'ṃ': 'm', 'ṅ': 'n', 'ñ': 'n', 'ṇ': 'n',
    'ṭ': 't', 'ḍ': 'd', 'ś': 's', 'ṣ': 's', 'ḥ': 'h', 'ç': 'c', 'ý': 'y',
};
const FOLD_RE = new RegExp('[' + Object.keys(FOLD).join('') + ']', 'g');
// Combining accents (U+0300 to U+036F) left by decomposed input
const COMBINING_RE = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

export const STOPWORDS = new Set(('a an and are as at be been but by can do does for from had has have he her his how i if in ' +
    'into is it its me my no not of on or our she so than that the their them then there these they this to ' +
    'us was we were what when where which who whom why will with you your about also any all one only very ' +
    'tell give says say said according book books').split(' '));

// Spellings that folding alone does not bring together
const ALIASES = { krisna: 'krsna', krisnas: 'krsna', krsnas: 'krsna' };

export function searchTokens(text) {
    const folded = text.normalize('NFC').toLowerCase().replace(FOLD_RE, c => FOLD[c]).replace(COMBINING_RE, '');
    const tokens = [];
    // \p{M} keeps Bengali / Devanagari vowel signs inside their words
    for (const [word] of folded.matchAll(/[\p{L}\p{N}\p{M}]+/gu)) {
        let token = word.replace(/sh/g, 's');
        token = ALIASES[token] || token;
        if (token.length >= 2 && !STOPWORDS.has(token)) tokens.push(token);
    }
    return tokens;
}

export function normalizeForMatch(text) {
    return text
        .normalize('NFC')
        .toLowerCase()
        .replace(INVISIBLE, '')
        .replace(/[‘’“”"'`*_]/g, '')
        .replace(/[—–]/g, '-')
        .replace(MATCH_SPACES, ' ')
        .trim();
}
