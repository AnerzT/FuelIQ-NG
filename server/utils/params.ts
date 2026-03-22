// server/utils/params.ts

/**
 * Utility functions for safely handling Express request parameters
 * Express can return string | string[] | undefined for query and params
 * These functions ensure we always get a consistent type
 */

/**
 * Ensures a value is a string, not a string array
 * @param param - The parameter value (could be string, string[], or undefined)
 * @param defaultValue - Default value if param is undefined or empty
 * @returns A string value
 * 
 * @example
 * // For route params
 * const terminalId = ensureString(req.params.terminalId);
 * 
 * @example
 * // For query params with default
 * const limit = ensureString(req.query.limit, '50');
 */
export function ensureString(
  param: string | string[] | undefined,
  defaultValue: string = ''
): string {
  if (param === undefined || param === null) {
    return defaultValue;
  }
  if (Array.isArray(param)) {
    return param[0] || defaultValue;
  }
  return param;
}

/**
 * Ensures a value is a number
 * @param param - The parameter value (could be string, string[], or undefined)
 * @param defaultValue - Default value if conversion fails
 * @returns A number value
 * 
 * @example
 * const page = ensureNumber(req.query.page, 1);
 * const limit = ensureNumber(req.query.limit, 50);
 */
export function ensureNumber(
  param: string | string[] | undefined,
  defaultValue: number = 0
): number {
  const str = ensureString(param);
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Ensures a value is a float number
 * @param param - The parameter value (could be string, string[], or undefined)
 * @param defaultValue - Default value if conversion fails
 * @returns A float number value
 * 
 * @example
 * const price = ensureFloat(req.query.price, 0);
 */
export function ensureFloat(
  param: string | string[] | undefined,
  defaultValue: number = 0
): number {
  const str = ensureString(param);
  const num = parseFloat(str);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Ensures a value is a boolean
 * @param param - The parameter value (could be string, string[], or undefined)
 * @param defaultValue - Default value if conversion fails
 * @returns A boolean value
 * 
 * @example
 * const active = ensureBoolean(req.query.active, false);
 */
export function ensureBoolean(
  param: string | string[] | undefined,
  defaultValue: boolean = false
): boolean {
  const str = ensureString(param).toLowerCase();
  if (str === 'true' || str === '1' || str === 'yes') return true;
  if (str === 'false' || str === '0' || str === 'no') return false;
  return defaultValue;
}

/**
 * Ensures a value is a string array
 * @param param - The parameter value (could be string, string[], or undefined)
 * @param defaultValue - Default value if param is undefined
 * @returns A string array
 * 
 * @example
 * const products = ensureArray(req.query.products, ['PMS']);
 */
export function ensureArray(
  param: string | string[] | undefined,
  defaultValue: string[] = []
): string[] {
  if (param === undefined || param === null) {
    return defaultValue;
  }
  if (Array.isArray(param)) {
    return param;
  }
  return [param];
}

/**
 * Ensures a value is an integer within a range
 * @param param - The parameter value
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param defaultValue - Default value if conversion fails or out of range
 * @returns A number within the specified range
 * 
 * @example
 * const limit = ensureInRange(req.query.limit, 1, 100, 50);
 */
export function ensureInRange(
  param: string | string[] | undefined,
  min: number,
  max: number,
  defaultValue: number
): number {
  const num = ensureNumber(param, defaultValue);
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

/**
 * Ensures a value is one of a set of allowed values
 * @param param - The parameter value
 * @param allowedValues - Array of allowed values
 * @param defaultValue - Default value if not in allowed list
 * @returns The validated value
 * 
 * @example
 * const productType = ensureEnum(req.query.productType, ['PMS', 'AGO', 'DPK'], 'PMS');
 */
export function ensureEnum<T extends string>(
  param: string | string[] | undefined,
  allowedValues: readonly T[],
  defaultValue: T
): T {
  const value = ensureString(param);
  if (allowedValues.includes(value as T)) {
    return value as T;
  }
  return defaultValue;
}

/**
 * Extracts and validates route parameters
 * @param params - Express route params object
 * @param required - Array of required parameter names
 * @returns An object with validated params or throws error
 * 
 * @example
 * const { terminalId, productType } = validateParams(req.params, ['terminalId']);
 */
export function validateParams(
  params: Record<string, string | string[] | undefined>,
  required: string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const key of required) {
    const value = ensureString(params[key]);
    if (!value) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    result[key] = value;
  }
  
  return result;
}

/**
 * Parses pagination parameters from query
 * @param query - Express query object
 * @param defaultLimit - Default limit per page
 * @param maxLimit - Maximum allowed limit
 * @returns Pagination object with page, limit, and offset
 * 
 * @example
 * const { page, limit, offset } = parsePagination(req.query, 20, 100);
 */
export function parsePagination(
  query: Record<string, string | string[] | undefined>,
  defaultLimit: number = 20,
  maxLimit: number = 100
): { page: number; limit: number; offset: number } {
  const page = ensureNumber(query.page, 1);
  const limit = ensureInRange(query.limit, 1, maxLimit, defaultLimit);
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * Parses date parameters from query
 * @param dateParam - The date parameter value
 * @param defaultValue - Default date if not provided
 * @returns Date object or default
 * 
 * @example
 * const startDate = parseDate(req.query.startDate, new Date());
 */
export function parseDate(
  dateParam: string | string[] | undefined,
  defaultValue?: Date
): Date | undefined {
  const dateStr = ensureString(dateParam);
  if (!dateStr) return defaultValue;
  
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? defaultValue : date;
}
