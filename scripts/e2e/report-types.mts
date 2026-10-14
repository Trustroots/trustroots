/** The report fields used by the E2E coverage and aggregation pipeline. */
export interface Annotation {
  type: string;
  description?: string;
}
export interface ReportResult {
  status: string;
  duration?: number;
  annotations?: Annotation[];
}
export interface ReportTest {
  projectName: string;
  results?: ReportResult[];
  annotations?: Annotation[];
}
export interface ReportSpec {
  file: string;
  title: string;
  line?: number;
  column?: number;
  tests?: ReportTest[];
  annotations?: Annotation[];
}
export interface ReportSuite {
  title: string;
  specs?: ReportSpec[];
  suites?: ReportSuite[];
}
export interface Report {
  suites?: ReportSuite[];
  errors?: unknown[];
}
export interface AreaResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}
export interface CodeCoverage {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}
