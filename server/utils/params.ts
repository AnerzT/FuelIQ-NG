import { type ParsedQs } from "qs";

type ParamValue = string | string[] | ParsedQs | ParsedQs[] | undefined;

export function ensureString(param: ParamValue, defaultValue: string = ''): string {
  if (param === undefined || param === null) return defaultValue;
  if (Array.isArray(param)) {
    const first = param[0];
    if (typeof first === 'string') return first;
    return defaultValue;
  }
  if (typeof param === 'string') return param;
  return defaultValue;
}

export function ensureNumber(param: ParamValue, defaultValue: number = 0): number {
  const str = ensureString(param);
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
}

export function ensureFloat(param: ParamValue, defaultValue: number = 0): number {
  const str = ensureString(param);
  const num = parseFloat(str);
  return isNaN(num) ? defaultValue : num;
}

export function ensureBoolean(param: ParamValue, defaultValue: boolean = false): boolean {
  const str = ensureString(param).toLowerCase();
  if (str === 'true' || str === '1') return true;
  if (str === 'false' || str === '0') return false;
  return defaultValue;
}

export function ensureArray(param: ParamValue, defaultValue: string[] = []): string[] {
  if (param === undefined || param === null) return defaultValue;
  if (Array.isArray(param)) {
    return param.filter(item => typeof item === 'string') as string[];
  }
  if (typeof param === 'string') return [param];
  return defaultValue;
}

export function parsePagination(query: Record<string, ParamValue>, defaultLimit: number = 20, maxLimit: number = 100): { page: number; limit: number; offset: number } {
  const page = ensureNumber(query.page, 1);
  const limit = ensureNumber(query.limit, defaultLimit);
  const safeLimit = Math.min(limit, maxLimit);
  const offset = (page - 1) * safeLimit;
  return { page, limit: safeLimit, offset };
}
