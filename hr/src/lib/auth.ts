import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'auth_token';

let _jwtSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (_jwtSecret) return _jwtSecret;
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET 또는 NEXTAUTH_SECRET 환경변수가 설정되지 않았습니다.');
  }
  _jwtSecret = new TextEncoder().encode(secret);
  return _jwtSecret;
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId: string;
  departmentName: string;
  positionName: string;
  tenantId: string;
}

export interface JWTUserPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  departmentId: string;
  departmentName: string;
  positionName: string;
  tenantId: string;
}

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
    departmentName: user.departmentName,
    positionName: user.positionName,
    tenantId: user.tenantId,
  } satisfies Omit<JWTUserPayload, 'sub'>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<{ user: AuthUser; shouldRefresh: boolean } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const p = payload as unknown as JWTUserPayload;
    const user: AuthUser = {
      id: payload.sub!,
      email: p.email,
      name: p.name,
      role: p.role,
      departmentId: p.departmentId,
      departmentName: p.departmentName,
      positionName: p.positionName,
      tenantId: p.tenantId || '',
    };
    // 만료 4시간 전이면 갱신 필요 플래그
    const exp = (payload.exp || 0) * 1000;
    const shouldRefresh = exp - Date.now() < 4 * 60 * 60 * 1000;
    return { user, shouldRefresh };
  } catch {
    return null;
  }
}

