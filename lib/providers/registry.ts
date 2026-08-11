import { z } from 'zod';

export type ProviderDomain = 'stream' | 'drive';

export interface ProviderField {
  key: string; // full eav key, e.g. "stream.discord.bot_token"
  label: string;
  type: 'text' | 'password' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: { label: string; value: string }[];
}

export interface ProviderDefinition {
  id: string; // unique provider id, e.g. "discord"
  domain: ProviderDomain;
  label: string;
  description: string;
  icon: string; // lucide icon name
  /** Auth flow: "manual" (user enters fields) or "oauth" (redirect to OAuth). */
  authMode: 'manual' | 'oauth';
  /** OAuth start path (app route) when authMode === 'oauth'. */
  oauthStartPath?: string;
  fields: ProviderField[];
  /** Optional zod schema for field validation; falls back to a permissive schema. */
  schema?: z.ZodType<any>;
}

export interface ProviderRegistry {
  list(domain: ProviderDomain): ProviderDefinition[];
  get(domain: ProviderDomain, id: string): ProviderDefinition | undefined;
  register(def: ProviderDefinition): void;
}

const streamProviders = new Map<string, ProviderDefinition>();
const driveProviders = new Map<string, ProviderDefinition>();

function register(def: ProviderDefinition) {
  if (def.domain === 'stream') streamProviders.set(def.id, def);
  else driveProviders.set(def.id, def);
}

function list(domain: ProviderDomain): ProviderDefinition[] {
  return Array.from((domain === 'stream' ? streamProviders : driveProviders).values());
}

function get(domain: ProviderDomain, id: string): ProviderDefinition | undefined {
  return (domain === 'stream' ? streamProviders : driveProviders).get(id);
}

export const providerRegistry: ProviderRegistry = { list, get, register };

// ============ Built-in stream providers ============

providerRegistry.register({
  id: 'discord',
  domain: 'stream',
  label: 'Discord',
  description: 'Connect a Discord bot to listen and reply in a guild.',
  icon: 'MessageCircle',
  authMode: 'manual',
  fields: [
    {
      key: 'stream.discord.bot_token',
      label: 'Bot Token',
      type: 'password',
      placeholder: 'MTk4NjIy...',
      required: true,
      helpText: 'Token from the Discord Developer Portal → Bot → Reset Token.',
    },
    {
      key: 'stream.discord.guild_id',
      label: 'Guild ID',
      type: 'text',
      placeholder: '123456789012345678',
      required: true,
      helpText: 'Enable Developer Mode in Discord, right-click the server → Copy ID.',
    },
  ],
});

providerRegistry.register({
  id: 'daosa',
  domain: 'stream',
  label: 'Daosa Native',
  description: 'Use the built-in Daosa chat channel. No external auth required.',
  icon: 'Bot',
  authMode: 'manual',
  fields: [
    {
      key: 'stream.daosa.channel_id',
      label: 'Channel ID',
      type: 'text',
      placeholder: 'auto-generated if left blank',
      helpText: 'Optional. Leave blank to auto-generate a Daosa channel id.',
    },
  ],
});

// ============ Built-in drive providers ============

providerRegistry.register({
  id: 'google',
  domain: 'drive',
  label: 'Google Drive',
  description: 'OAuth2 connection to read files from a Google Drive account.',
  icon: 'FolderOpen',
  authMode: 'oauth',
  oauthStartPath: '/api/oauth/google/start',
  fields: [
    {
      key: 'drive.google.access_token',
      label: 'Access Token',
      type: 'password',
      required: true,
      helpText: 'Obtained automatically after Google consent.',
    },
    {
      key: 'drive.google.refresh_token',
      label: 'Refresh Token',
      type: 'password',
      required: true,
      helpText: 'Obtained automatically after Google consent.',
    },
  ],
});

providerRegistry.register({
  id: 's3',
  domain: 'drive',
  label: 'S3 / Personal Cloud',
  description: 'Connect an S3-compatible bucket with access keys.',
  icon: 'Cloud',
  authMode: 'manual',
  fields: [
    {
      key: 'drive.s3.access_key',
      label: 'Access Key',
      type: 'text',
      placeholder: 'AKIA...',
      required: true,
    },
    {
      key: 'drive.s3.secret_key',
      label: 'Secret Key',
      type: 'password',
      required: true,
    },
    {
      key: 'drive.s3.bucket_name',
      label: 'Bucket Name',
      type: 'text',
      required: true,
    },
    {
      key: 'drive.s3.region',
      label: 'Region',
      type: 'text',
      placeholder: 'us-east-1',
      required: true,
    },
  ],
});

providerRegistry.register({
  id: 'database',
  domain: 'drive',
  label: 'Personal Database',
  description: 'Connect an external database via connection string.',
  icon: 'Database',
  authMode: 'manual',
  fields: [
    {
      key: 'drive.database.connection_string',
      label: 'Connection String',
      type: 'textarea',
      placeholder: 'postgresql://user:pass@host:5432/db',
      required: true,
    },
    {
      key: 'drive.database.driver',
      label: 'Driver',
      type: 'select',
      options: [
        { label: 'PostgreSQL', value: 'postgres' },
        { label: 'MySQL', value: 'mysql' },
        { label: 'MongoDB', value: 'mongo' },
      ],
      required: true,
    },
  ],
});

export function buildZodSchema(provider: ProviderDefinition): z.ZodType<any> {
  if (provider.schema) return provider.schema;
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of provider.fields) {
    const base = f.type === 'textarea' ? z.string() : z.string();
    shape[f.key] = f.required ? base.min(1, `${f.label} is required`) : base.optional();
  }
  return z.object(shape);
}
