import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";

const issuer = "https://token.actions.githubusercontent.com";
const keys = createRemoteJWKSet(new URL(issuer + "/.well-known/jwks"), {
  timeoutDuration: 5000,
  cooldownDuration: 30000,
  cacheMaxAge: 10 * 60 * 1000,
});
export const OPERATIONS_OIDC_AUDIENCE = "sgtech-operations";

export async function verifyGitHubOperationsToken(
  token: string,
  keyResolver: JWTVerifyGetKey = keys,
) {
  try {
    if (
      token.length > 12000 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
    )
      return false;
    const repository =
      process.env.SGTECH_GITHUB_REPOSITORY || "phongdz76/e-commerce";
    const repositoryId =
      process.env.SGTECH_GITHUB_REPOSITORY_ID || "1044465509";
    const ownerId = process.env.SGTECH_GITHUB_OWNER_ID || "145427852";
    const [owner, name] = repository.split("/");
    const payload = decodeJwt(token);
    const subjects = [
      `repo:${repository}:ref:refs/heads/main`,
      `repo:${owner}@${ownerId}/${name}@${repositoryId}:ref:refs/heads/main`,
    ];
    // Reject unrelated repositories before resolving keys, then verify the signed claims as well.
    if (
      payload.repository !== repository ||
      payload.repository_id !== repositoryId ||
      payload.repository_owner_id !== ownerId ||
      payload.ref !== "refs/heads/main" ||
      payload.workflow_ref !==
        `${repository}/.github/workflows/operations.yml@refs/heads/main` ||
      !subjects.includes(String(payload.sub)) ||
      !["schedule", "workflow_dispatch"].includes(String(payload.event_name))
    )
      return false;
    await jwtVerify(token, keyResolver, {
      issuer,
      audience: OPERATIONS_OIDC_AUDIENCE,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "nbf"],
      maxTokenAge: "10m",
      clockTolerance: 15,
    });
    return true;
  } catch {
    return false;
  }
}
