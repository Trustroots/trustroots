type Rule<T, Values> = readonly [
  (value: T, values: Values) => boolean,
  unknown,
];

type RuleDictionary<Values> = Record<string, readonly Rule<unknown, Values>[]>;
type ValueDictionary = Record<string, unknown>;

/** Return a dictionary of validation errors for each provided value. */
export const createValidator =
  <Values extends ValueDictionary>(ruleDict: RuleDictionary<Values>) =>
  (valueDict: Values): Record<string, unknown[]> => {
    const entries = Object.entries(valueDict);

    const outputEntries = entries.map(([name, value]) => {
      const rules = ruleDict[name] ?? [];
      const errors = rules
        .filter(([rule]) => !rule(value, valueDict))
        .map(([, error]) => error);
      return [name, errors] as const;
    });

    return Object.fromEntries(outputEntries);
  };
