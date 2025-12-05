/**
 * Utility functions for generating unique codes
 */

/**
 * Generate a unique code based on name and existing codes
 * @param name - Name to generate code from
 * @param existingCodes - Array of existing codes to check for uniqueness
 * @param prefix - Optional prefix for the code
 * @returns Unique code string
 */
export function generateUniqueCode(
    name: string,
    existingCodes: string[],
    prefix: string = ''
): string {
    // Remove special characters and convert to uppercase
    const sanitized = name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    // Create base code with optional prefix
    let baseCode = prefix ? `${prefix}_${sanitized}` : sanitized;

    // Limit length to reasonable size (e.g., 30 characters)
    if (baseCode.length > 30) {
        baseCode = baseCode.substring(0, 30);
    }

    // If code doesn't exist, return it
    if (!existingCodes.includes(baseCode)) {
        return baseCode;
    }

    // Otherwise, append number to make it unique
    let counter = 1;
    let uniqueCode = `${baseCode}_${counter}`;

    while (existingCodes.includes(uniqueCode)) {
        counter++;
        uniqueCode = `${baseCode}_${counter}`;
    }

    return uniqueCode;
}

/**
 * Generate code specifically for activities (backward compatible)
 * @param name - Activity name
 * @param techCategory - Technology category
 * @param existingCodes - Existing activity codes
 * @returns Unique activity code
 */
export function generateActivityCode(
    name: string,
    techCategory: string,
    existingCodes: string[]
): string {
    // Get tech category prefix (first 2-3 letters)
    const techPrefix = getTechCategoryPrefix(techCategory);

    return generateUniqueCode(name, existingCodes, techPrefix);
}

/**
 * Get prefix from technology category
 * @param techCategory - Technology category
 * @returns Short prefix for the category
 */
function getTechCategoryPrefix(techCategory: string): string {
    const prefixMap: Record<string, string> = {
        'POWER_PLATFORM': 'PP',
        'BACKEND': 'BE',
        'FRONTEND': 'FE',
        'USU': 'USU',
        'MULTI': 'CRS',
        'DATABASE': 'DB',
        'INFRASTRUCTURE': 'INF',
        'MOBILE': 'MOB',
        'API': 'API',
    };

    return prefixMap[techCategory] || techCategory.substring(0, 3).toUpperCase();
}

/**
 * Sanitize string for use in code/identifier
 * @param input - String to sanitize
 * @returns Sanitized string safe for use as code
 */
export function sanitizeForCode(input: string): string {
    return input
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}
