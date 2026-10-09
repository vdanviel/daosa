class CommandUtil {

    static camelize(value, upperFirst = false) {
        if (typeof value !== 'string' || value.length === 0) {
            return '';
        }

        const normalized = value
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_\-\s]+/g, ' ')
            .trim();

        const parts = normalized
            .split(' ')
            .filter(Boolean)
            .map((part, index) => {
                const lower = part.toLowerCase();
                if (index === 0 && !upperFirst) {
                    return lower;
                }
                return lower.charAt(0).toUpperCase() + lower.slice(1);
            });

        return parts.join('');
    }
    
}

export { CommandUtil };