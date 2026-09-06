export const orderDirectPair = (first: string, second: string) => first < second ? [first, second] as const : [second, first] as const
export const GROUP_MEMBER_LIMIT = 256
