import source from "../../en_strings.json";
import languages from "../../languages.json";

export const entries = source.entries;
export const sections = source.sections;
export const languageList = languages;
export function validLanguage(code: string) { return languageList.some((language) => language.code === code); }
