import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'auth_token';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET 또는 NEXTAUTH_SECRET 환경변수가 설정되지 않았습니다.');
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId: string;
  departmentName: string;
  positionName: string;
}

export interface JWTUserPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  departmentId: string;
  departmentName: string;
  positionName: string;
}

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
    departmentName: user.departmentName,
    positionName: user.positionName,
  } satisfies Omit<JWTUserPayload, 'sub'>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const p = payload as unknown as JWTUserPayload;
    return {
      id: payload.sub!,
      email: p.email,
      name: p.name,
      role: p.role,
      departmentId: p.departmentId,
      departmentName: p.departmentName,
      positionName: p.positionName,
    };
  } catch {
    return null;
  }
}
