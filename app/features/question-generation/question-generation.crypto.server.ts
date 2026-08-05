import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import { serverEnv, type ServerEnv } from "~/lib/env.server";

const CREDENTIAL_AAD_VERSION = "v1";
const CREDENTIAL_NONCE_BYTES = 12;
const CREDENTIAL_AUTH_TAG_BYTES = 16;
const CREDENTIAL_KEY_BYTES = 32;

export interface QuestionGenerationKeyring {
  activeVersion: number;
  keys: ReadonlyMap<number, Buffer>;
}

export interface StoredQuestionGenerationCredential {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: number;
}

export class QuestionGenerationCredentialError extends Error {
  constructor() {
    super("Question-generation credential is unavailable.");
    this.name = "QuestionGenerationCredentialError";
  }
}

export function getQuestionGenerationKeyring(
  environment: Pick<
    ServerEnv,
    | "QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION"
    | "QUESTION_GENERATION_ENCRYPTION_KEYS"
  > = serverEnv,
): QuestionGenerationKeyring {
  const activeVersion =
    environment.QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION;
  const keys = environment.QUESTION_GENERATION_ENCRYPTION_KEYS;

  if (activeVersion === undefined || keys === undefined) {
    throw new QuestionGenerationCredentialError();
  }

  return createQuestionGenerationKeyring({ activeVersion, keys });
}

export function createQuestionGenerationKeyring({
  activeVersion,
  keys,
}: QuestionGenerationKeyring): QuestionGenerationKeyring {
  if (!keys.has(activeVersion) || !Array.from(keys.values()).every(isEncryptionKey)) {
    throw new QuestionGenerationCredentialError();
  }

  return { activeVersion, keys: new Map(keys) };
}

export function encryptQuestionGenerationCredential({
  credential,
  keyring = getQuestionGenerationKeyring(),
  ownerUserId,
}: {
  credential: string;
  keyring?: QuestionGenerationKeyring;
  ownerUserId: string;
}): StoredQuestionGenerationCredential {
  const nonce = randomBytes(CREDENTIAL_NONCE_BYTES);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getKeyForVersion(keyring, keyring.activeVersion),
    nonce,
  );

  cipher.setAAD(createCredentialAdditionalData(ownerUserId));

  const ciphertext = Buffer.concat([
    cipher.update(credential, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64url"),
    nonce: nonce.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    keyVersion: keyring.activeVersion,
  };
}

export function decryptQuestionGenerationCredential({
  keyring = getQuestionGenerationKeyring(),
  material,
  ownerUserId,
}: {
  keyring?: QuestionGenerationKeyring;
  material: StoredQuestionGenerationCredential;
  ownerUserId: string;
}) {
  try {
    return decryptCredentialMaterial({ keyring, material, ownerUserId });
  } catch {
    throw new QuestionGenerationCredentialError();
  }
}

export function decryptAndRotateQuestionGenerationCredential({
  keyring = getQuestionGenerationKeyring(),
  material,
  ownerUserId,
}: {
  keyring?: QuestionGenerationKeyring;
  material: StoredQuestionGenerationCredential;
  ownerUserId: string;
}) {
  const credential = decryptQuestionGenerationCredential({
    keyring,
    material,
    ownerUserId,
  });

  return {
    credential,
    rotatedMaterial:
      material.keyVersion === keyring.activeVersion
        ? undefined
        : encryptQuestionGenerationCredential({ credential, keyring, ownerUserId }),
  };
}

function decryptCredentialMaterial({
  keyring,
  material,
  ownerUserId,
}: {
  keyring: QuestionGenerationKeyring;
  material: StoredQuestionGenerationCredential;
  ownerUserId: string;
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKeyForVersion(keyring, material.keyVersion),
    decodeStoredValue(material.nonce, CREDENTIAL_NONCE_BYTES),
  );

  decipher.setAAD(createCredentialAdditionalData(ownerUserId));
  decipher.setAuthTag(
    decodeStoredValue(material.authTag, CREDENTIAL_AUTH_TAG_BYTES),
  );

  return Buffer.concat([
    decipher.update(decodeStoredValue(material.ciphertext)),
    decipher.final(),
  ]).toString("utf8");
}

function getKeyForVersion(keyring: QuestionGenerationKeyring, version: number) {
  const key = keyring.keys.get(version);

  if (key === undefined || !isEncryptionKey(key)) {
    throw new QuestionGenerationCredentialError();
  }

  return key;
}

function isEncryptionKey(key: Buffer) {
  return key.length === CREDENTIAL_KEY_BYTES;
}

function createCredentialAdditionalData(ownerUserId: string) {
  return Buffer.from(
    `askora:question-generation-credential:${CREDENTIAL_AAD_VERSION}:${ownerUserId}`,
  );
}

function decodeStoredValue(value: string, expectedLength?: number) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new QuestionGenerationCredentialError();
  }

  const decoded = Buffer.from(value, "base64url");

  if (
    decoded.length === 0 ||
    (expectedLength !== undefined && decoded.length !== expectedLength) ||
    decoded.toString("base64url") !== value
  ) {
    throw new QuestionGenerationCredentialError();
  }

  return decoded;
}
