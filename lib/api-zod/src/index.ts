export * from "./generated/api";
export type * from "./generated/types";

// Both generated modules define these 14 names: `generated/api` as zod SCHEMAS
// (values, used as `UpsertCheckInBody.parse(req.body)`) and `generated/types`
// as interfaces of the same shape. Two `export *`s made every one of them
// ambiguous — 14 of the 23 errors that surfaced the moment this package began
// being typechecked from source instead of through a stale project reference.
//
// An explicit re-export outranks a star export, so this picks a winner. The
// schema wins because that is what every consumer of this package actually
// uses; the interface twins are generated independently into
// lib/api-client-react, which is where anything wanting the type gets it.
export {
  CreateActivityBody,
  CreateConversationBody,
  CreateCultivationBody,
  CreateLogBody,
  CreateSupplementBody,
  ListCultivationCheckInsParams,
  UpdateActivityBody,
  UpdateCultivationBody,
  UpdateLogBody,
  UpdateSupplementBody,
  UpdateSupportPreferencesBody,
  UpsertCheckInBody,
  UpsertCultivationCheckInBody,
  UpsertNatalChartBody,
} from "./generated/api";
