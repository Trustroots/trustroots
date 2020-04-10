/**
 * @typedef {array} rule - first element is testing function, second element is error
 * testing function has value as the first argument
 *    and all values as the second optional argument
 * error can be anything
 */
/**
 * provided a dictionary of rules and a dictionary of values,
 * return a dictionary of errors for each value
 *
 * @param {Object.<string, rule[]>} ruleDict - dictionary of array of rules
 * @param {Object.<string, any>} valueDict - dictionary of values
 * @returns {Object.<string, any[]>} - dictionary of array of errors
 */
export const createValidator = ruleDict => valueDict => {
  const entries = Object.entries(valueDict);

  const outputEntries = entries.map(([name, value]) => {
    const rules = ruleDict[name] ?? [];
    const errors = rules
      .filter(([rule]) => !rule(value, valueDict))
      .map(([, error]) => error);
    return [name, errors];
  });

  return Object.fromEntries(outputEntries);
};
