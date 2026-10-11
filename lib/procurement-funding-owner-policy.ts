/** Owner decision 2026-10-11. Forecast only: no 1C cancellation or payment matching.
 * Nine remaining versions of the eleven reviewed legacy requests. The other
 * two no longer appeared in the live source at capture. Changed versions must
 * be reviewed again; this is deliberately not a supplier/date cutoff.
 */
export const FUNDING_POLICY_EFFECTIVE_FROM = '2026-10-11';
export const LEGACY_FUNDING_EXCLUSIONS = [
  '0668314a927dec03b5f538fcad304125e3baf781da000a3af523127e4cad7405',
  '48761e66c201e54b8ff642c118cba0f51775c778947b4544f4d0849f2dfa82c2',
  '72faabd900785565b7469024dcfaa5b9f53c27d855c634dbb3b990a0bce30a31',
  '86dad5daad0498ee24b0f1b87f3a92a145645d0844269c5da9f842677e7ee118',
  'b012bd6567c873914054fad8c84c6a38650062a24e5a8e0f3fc67e51fce02ae2',
  'b590baf937302dee9e88beb8b1622136977169f44338bdeaccda5f73d52fb658',
  'd04f6363c62f5fc712d796d6f10cd3b8a204da78fc86fb56389cdddabaf2b064',
  'ef311fec72b4837b19504d6f76aafb63423db8886a65cee6064fc569f2f7fb27',
  'fc7e985f88cde3726dadbdbfad2f26cb9632c8d2c7b10cf1e9b5a96de093e97f',
] as const;
export const FUNDING_PAYROLL_POLICY = {
  effectiveFrom: FUNDING_POLICY_EFFECTIVE_FROM,
  includeRefs: [
    '830a355a-aeab-11df-8fe6-00241d5a8bc3', // Marat: current debt approved by owner.
    'f393105e-c21e-11f0-a343-002590803daf', // Shared trainee identity: current film worker.
  ],
} as const;
