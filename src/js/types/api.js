/**
 * JSDoc typedefs for Guild API responses. These are the contract between the
 * API and the Store -- updating them is part of "add a new endpoint" in
 * docs/PATTERNS.md.
 *
 * Types are intentionally loose (most fields optional) because the API surface
 * is evolving. The runtime `validate()` helper checks envelope shape only;
 * field-level coercion lives in the relevant manager.
 *
 * @typedef {{ success: boolean, errors?: string[], data?: unknown }} Envelope
 */

/**
 * @typedef {{
 *   id: string,
 *   name?: string,
 *   pfp?: string,
 *   reactor_id?: string,
 *   owner_id?: string,
 *   entry_substation_id?: string,
 *   entry_rank?: number,
 *   join_infusion_minimum?: string,
 *   endpoint?: string,
 *   client_websocket?: string,
 *   grass_nats_websocket?: string,
 *   member_count?: number,
 *   substation_count?: number,
 * }} GuildData
 */

/**
 * @typedef {{
 *   id: string,
 *   guild_id?: string,
 *   primary_address?: string,
 *   name?: string,
 *   pfp?: string,
 *   pfp_client_render_attributes?: string,
 *   guild_rank?: number,
 *   substation_id?: string,
 *   ore?: string,
 *   alpha?: string,
 *   capacity?: string,
 *   load?: string,
 *   last_action_block_height?: number,
 * }} PlayerData
 */

/**
 * @typedef {{
 *   id: string,
 *   guild_id?: string,
 *   name?: string,
 *   pfp?: string,
 *   capacity?: string,
 *   load?: string,
 *   energy_in?: string,
 *   energy_out?: string,
 *   player_count?: number,
 * }} SubstationData
 */

/**
 * @typedef {{
 *   id: string,
 *   allocation_type?: string,
 *   source_id?: string,
 *   destination_id?: string,
 *   creator?: string,
 *   controller?: string,
 *   index?: number,
 * }} AllocationData
 */

/**
 * @typedef {{
 *   id: string,
 *   owner_id?: string,
 *   guild_id?: string,
 *   validator?: string,
 *   default_commission?: string | number,
 *   owner?: string,
 * }} ReactorData
 */

/**
 * @typedef {{
 *   destination_id?: string,
 *   address?: string,
 *   player_id?: string,
 *   reactor_id?: string,
 *   fuel?: string,
 *   power?: string,
 *   defusing?: boolean,
 *   defusing_p?: string,
 *   commission?: string | number,
 *   ratio?: string | number,
 * }} InfusionData
 */

/**
 * @typedef {{
 *   guild_id?: string,
 *   guildId?: string,
 *   player_id?: string,
 *   playerId?: string,
 *   substation_id?: string,
 *   substationId?: string,
 *   join_type?: string,
 *   joinType?: string | number,
 *   status?: string,
 *   registration_status?: string,
 *   registrationStatus?: string | number,
 *   proposer?: string,
 * }} MembershipApplicationData
 */

/**
 * @typedef {{
 *   id?: string,
 *   owner_id?: string,
 *   guild_id?: string,
 *   capacity?: string,
 *   access_policy?: string,
 * }} ProviderData
 */

/**
 * @typedef {{
 *   id?: string,
 *   guild_id?: string,
 *   provider_id?: string,
 *   capacity?: string,
 *   active?: boolean,
 * }} AgreementData
 */

/**
 * @typedef {{
 *   timestamp?: number,
 *   value?: string | number,
 *   metric?: string,
 * }} StatRowData
 */

/**
 * @typedef {{
 *   id?: string,
 *   attribute_type?: string,
 *   object_type?: string,
 *   object_index?: number,
 *   object_id?: string,
 *   val?: number,
 *   updated_at?: string,
 * }} GridRow
 */

/** Marker export so types/api.js participates in module graph for IDE typing. */
export const __TYPES_API__ = true;
