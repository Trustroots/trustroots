type BabelConfigItem = string | [string] | [string, Record<string, unknown>];

export interface BabelConfiguration {
  presets: BabelConfigItem[];
  plugins: BabelConfigItem[];
}
