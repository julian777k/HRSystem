import { NextRequest, NextResponse } from 'next/server';
import { basePrismaClient } from '@/lib/prisma';
import { verifySuperAdmin, requirePasswordChanged } from '@/lib/super-admin-auth';
import { getLicenseInfo } from '@/lib/license';

/**
 * 1회 구매 테넌트를 월 구독으로 전환한다. (약관 제13조)
 * 이용 종료일(licenseExpiresAt)은 기록으로 남겨 전환 이력을 추적할 수 있게 한다.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await verifySuperAdmin(request);
        if (!admin) {
            return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
        }
        const pwBlock = requirePasswordChanged(admin);
        if (pwBlock) return pwBlock;

        const { id } = await params;
        const { subscriptionFee, force } = await request.json().catch(() => ({}));

        const tenant = await basePrismaClient.tenant.findUnique({ where: { id } });
        if (!tenant) {
            return NextResponse.json({ message: '테넌트를 찾을 수 없습니다.' }, { status: 404 });
        }

        const t = tenant as Record<string, unknown>;
        if (t.billingMode === 'subscription') {
            return NextResponse.json({ message: '이미 구독으로 전환된 테넌트입니다.' }, { status: 409 });
        }

        if (subscriptionFee !== undefined && subscriptionFee !== null) {
            if (typeof subscriptionFee !== 'number' || subscriptionFee < 0) {
                return NextResponse.json({ message: '월 구독료는 0 이상의 숫자여야 합니다.' }, { status: 400 });
            }
        }

        // 이용 기간이 남아 있는데 전환하면 구매 조건을 앞당겨 깨는 것이 되므로 기본 차단한다.
        // 고객이 조기 전환을 원하는 예외 상황에서만 force로 넘긴다.
        const info = getLicenseInfo(t as never);
        if (!info.canConvert && !force) {
            return NextResponse.json(
                {
                    message: `아직 이용 기간이 남아 있습니다. (${info.daysLeft}일) 조기 전환은 force 옵션이 필요합니다.`,
                    license: info,
                },
                { status: 400 }
            );
        }

        const updated = await basePrismaClient.tenant.update({
            where: { id },
            data: {
                billingMode: 'subscription',
                subscriptionStartedAt: new Date().toISOString(),
                subscriptionFee: subscriptionFee ?? null,
                status: 'active',
            } as never,
        });

        return NextResponse.json({
            message: '구독으로 전환되었습니다.',
            tenant: updated,
            license: getLicenseInfo(updated as never),
        });
    } catch (error) {
        console.error('Convert subscription error:', error);
        return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}

/** 구독 전환을 되돌린다 (오조작 복구용). 1회 구매 상태로 복귀한다. */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await verifySuperAdmin(request);
        if (!admin) {
            return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
        }
        const pwBlock = requirePasswordChanged(admin);
        if (pwBlock) return pwBlock;

        const { id } = await params;
        const tenant = await basePrismaClient.tenant.findUnique({ where: { id } });
        if (!tenant) {
            return NextResponse.json({ message: '테넌트를 찾을 수 없습니다.' }, { status: 404 });
        }

        const updated = await basePrismaClient.tenant.update({
            where: { id },
            data: {
                billingMode: 'onetime',
                subscriptionStartedAt: null,
                subscriptionFee: null,
            } as never,
        });

        return NextResponse.json({
            message: '구독 전환이 취소되었습니다.',
            tenant: updated,
            license: getLicenseInfo(updated as never),
        });
    } catch (error) {
        console.error('Revert subscription error:', error);
        return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
